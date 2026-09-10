/**
 * Cloud — 跨網域 / 跨瀏覽器 / 跨 IP / 跨裝置「全自動」雲端同步
 *
 * 設計目標（大叔的需求）：
 *   ✅ 不同網域、不同瀏覽器、不同 IP、不同裝置 → 自動同步連動
 *   ✅ 完全不需要手動輸入同步碼
 *   ✅ 零 API key、零後端伺服器、零帳號
 *
 * 原理：
 *   1. 傳輸層＝MQTT over WebSocket（wss://broker.emqx.io:8084/mqtt，EMQX 公共 broker，中國可直連）
 *      - WebSocket 不受 CORS 限制，可跨網域
 *      - MQTT 的 retained message 天生就是「雲端最新版」：新裝置一訂閱立刻拿到
 *      - 已訂閱的裝置則即時收到推送（不需要輪詢）
 *   2. 資料格式＝JSON → gzip 壓縮 → AES-GCM 加密 → 二進位送出
 *      - 壓縮：省流量、避開 broker 封包上限
 *      - 加密：內容不以明文暴露在公共 broker 上
 *   3. 衝突處理＝實體級雙向合併（Store.merge），不會互相覆蓋
 *   4. 防迴圈＝每台裝置有唯一 sender id（忽略自己的回音）＋ payload 雜湊（相同不重送）
 *
 * 隱私提醒：同步空間代碼內嵌於本檔案，屬「以模糊性換取零設定的便利」，
 * 不是高強度安全機制。若需更高隱私，請改 WORKSPACE / SECRET 後重新部署。
 */
const Cloud = (() => {
  'use strict';

  // ── 雲端同步設定（內嵌，使用者不需輸入任何代碼）──
  const MQTT_URL  = 'wss://broker.emqx.io:8084/mqtt';
  const WORKSPACE = '0b77ea161e46328f2149';
  const SECRET    = '8c8fda615157f5593bad57ba9c0d2dd557e9e8770a4a1a4e';
  const TOPIC     = 'tycrm/' + WORKSPACE + '/state/v1';

  // 本裝置唯一識別（用來忽略自己發出的回音）
  const SENDER = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);

  const PUSH_DEBOUNCE   = 900;    // 本地變更後延遲推送（毫秒）
  const PUBLISH_MIN_GAP = 1200;   // 兩次推送最小間隔（防抖動洗版）
  const RETAIN_WAIT     = 5000;   // 連線後等待雲端 retained 的最長時間
  const MAX_PAYLOAD     = 900 * 1024; // broker 安全上限（超過則不推，僅本地保存）

  let client = null;
  let state = 'idle';            // idle | connecting | syncing | online | offline
  let pushTimer = null;
  let pendingData = null;
  let lastHash = null;
  let lastPublishAt = 0;
  let gotRetained = false;
  let retainTimer = null;
  let cryptoKey = null;
  let started = false;
  let ready = false;   // 初次握手完成（已取得雲端 retained 或確認雲端為空）才允許推送

  // ── 狀態指示 ──
  const setState = (s) => { state = s; renderStatus(); };

  const renderStatus = () => {
    const ind = document.getElementById('syncIndicator');
    const el = document.getElementById('syncStatus');
    if (!ind || !el) return;
    ind.classList.remove('synced', 'syncing', 'offline');
    const time = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    const map = {
      idle:       ['',        '☁️ 待連線'],
      connecting: ['syncing', '☁️ 連線中…'],
      syncing:    ['syncing', '☁️ 同步中…'],
      online:     ['synced',  '☁️ 已同步 ' + time],
      offline:    ['offline', '☁️ 離線（本機）']
    };
    const [cls, text] = map[state] || map.idle;
    if (cls) ind.classList.add(cls);
    el.textContent = text;

    // 同步 Modal 內的狀態列
    const box = document.getElementById('cloudStateBox');
    if (box) {
      const desc = {
        idle:       '尚未啟動',
        connecting: '正在連線到雲端同步中樞…',
        syncing:    '正在把本機變更推送到雲端…',
        online:     '雲端同步運作中 — 其他裝置的變更會自動進來',
        offline:    '目前離線，資料仍安全保存在本機；恢復網路後會自動補同步'
      };
      box.textContent = desc[state] || '';
      box.className = 'cloud-state ' + (state === 'online' ? 'ok' : (state === 'offline' ? 'bad' : 'busy'));
    }
    const dot = document.getElementById('cloudDot');
    if (dot) dot.className = 'cloud-dot ' + (state === 'online' ? 'ok' : (state === 'offline' ? 'bad' : 'busy'));
  };

  // ── 編碼：JSON → gzip → AES-GCM ──
  const getKey = async () => {
    if (cryptoKey) return cryptoKey;
    const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SECRET));
    cryptoKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    return cryptoKey;
  };

  const gzip = async (bytes) => {
    if (typeof CompressionStream === 'undefined') return null;
    const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  };
  const gunzip = async (bytes) => {
    const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  };

  const encode = async (data) => {
    const json = JSON.stringify({ v: 1, sender: SENDER, ts: Date.now(), data });
    const raw = new TextEncoder().encode(json);
    const gz = await gzip(raw);
    const mode = gz ? 1 : 0;
    const body = gz || raw;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getKey();
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, body));
    const out = new Uint8Array(1 + 12 + ct.length);
    out[0] = mode;
    out.set(iv, 1);
    out.set(ct, 13);
    return out;
  };

  const decode = async (bytes) => {
    if (!bytes || bytes.length < 14) return null;
    const mode = bytes[0];
    const iv = bytes.slice(1, 13);
    const ct = bytes.slice(13);
    const key = await getKey();
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
    const raw = mode === 1 ? await gunzip(plain) : plain;
    return JSON.parse(new TextDecoder().decode(raw));
  };

  const hashStr = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + ':' + s.length;
  };

  // ── 推送 ──
  const publish = async (data) => {
    const json = JSON.stringify(data);
    const h = hashStr(json);
    if (h === lastHash) return true;             // 內容與上次相同 → 不重送（防迴圈）
    let bytes;
    try { bytes = await encode(data); }
    catch (e) { console.warn('[Cloud] encode 失敗', e); return false; }
    if (bytes.length > MAX_PAYLOAD) {
      console.warn('[Cloud] payload 過大，略過雲端推送：', bytes.length);
      App.toast('資料量過大，雲端同步略過（本機資料已保存）', 'warning', 5000);
      return false;
    }
    if (!client || !client.connected) return false;
    const ok = await client.publish(TOPIC, bytes, { qos: 1, retain: true });
    if (ok) { lastHash = h; lastPublishAt = Date.now(); }
    return ok;
  };

  const flush = (force) => {
    if (!pendingData) return;
    if (!ready) return;                          // 尚未完成握手 → 先不推，避免覆蓋雲端既有資料
    if (!client || !client.connected) return;    // 連上後 onConnect 會自動補推
    const gap = Date.now() - lastPublishAt;
    if (!force && gap < PUBLISH_MIN_GAP) {
      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(() => { pushTimer = null; flush(); }, PUBLISH_MIN_GAP - gap);
      return;
    }
    const data = pendingData;
    pendingData = null;
    setState('syncing');
    publish(data).then((ok) => {
      if (ok) { setState('online'); return; }
      // 推送失敗 → 放回佇列，稍後重試
      if (!pendingData) pendingData = data;
      setState(client && client.connected ? 'syncing' : 'offline');
    });
  };

  /** 本地資料變更後呼叫（由 Store.save / saveNow 觸發） */
  const push = (data) => {
    pendingData = data;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushTimer = null; flush(); }, PUSH_DEBOUNCE);
  };

  // ── 接收 ──
  const applyRemote = (remote) => {
    const local = Store.load();
    const merged = Store.merge(local, remote);
    const localJson = JSON.stringify(local);
    const remoteJson = JSON.stringify(remote);
    const mergedJson = JSON.stringify(merged);

    const changedLocal = mergedJson !== localJson;
    const changedRemote = mergedJson !== remoteJson;

    if (changedLocal) {
      pendingData = null;                        // 丟棄尚未推送的舊資料（已被 merged 涵蓋）
      if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
      Store.applyRemote(merged);
      Sync.broadcast(merged);
      App.render();
      App.toast('☁️ 已同步其他裝置的最新資料', 'success');
    }
    if (changedRemote) {
      lastHash = null;                           // 本地有雲端沒有的資料 → 回推聯集
      pendingData = merged;
      flush(true);
    }
  };

  const onMessage = async (topic, payload, retain) => {
    if (topic !== TOPIC) return;
    gotRetained = true;
    if (retainTimer) { clearTimeout(retainTimer); retainTimer = null; }
    try {
      if (payload && payload.length >= 14) {     // 空訊息＝清除 retained
        let env = null;
        try { env = await decode(payload); }
        catch (e) { console.warn('[Cloud] 解密失敗（可能非本團隊訊息）'); }
        if (env && env.sender !== SENDER) applyRemote(env.data);  // 自己的回音 → 忽略
      }
    } finally {
      ready = true;                              // 握手完成，之後才允許推送
      if (pendingData) flush();
    }
  };

  // ── 連線 ──
  const connect = () => {
    if (typeof MqttLite === 'undefined') { setState('offline'); return; }
    if (client) { try { client.disconnect(); } catch (e) {} }
    ready = false;
    setState('connecting');
    client = new MqttLite.Client({
      url: MQTT_URL,
      clientId: 'tycrm_' + WORKSPACE.slice(0, 8) + '_' + Math.random().toString(36).slice(2, 8),
      keepAlive: 180,
      onConnect: () => {
        gotRetained = false;
        client.subscribe(TOPIC, 1);
        setState('online');
        // 等待雲端 retained：等到＝合併；等不到＝本機成為資料來源
        if (retainTimer) clearTimeout(retainTimer);
        retainTimer = setTimeout(() => {
          retainTimer = null;
          if (!gotRetained) {
            // 雲端還沒有資料 → 由本機建立（第一次使用的情境）
            ready = true;
            pendingData = Store.load();
            flush(true);
          }
        }, RETAIN_WAIT);
      },
      onMessage,
      onClose: () => setState('offline'),
      onError: (e) => console.warn('[Cloud] 連線錯誤', e && e.message)
    });
    client.connect();
  };

  /** 主動拉取雲端最新版（重新訂閱 → broker 會重送 retained） */
  const pull = () => {
    if (client && client.connected) {
      gotRetained = false;
      client.refresh(TOPIC, 1);
      App.toast('正在向雲端拉取最新資料…', 'info', 2000);
    } else {
      connect();
    }
  };

  const reconnect = () => {
    connect();
    App.toast('正在重新連線雲端同步…', 'info', 2000);
  };

  const init = () => {
    if (started) return;
    started = true;

    // 非安全環境（非 HTTPS / file://）無法使用 Web Crypto → 自動降級
    if (!window.crypto || !window.crypto.subtle) {
      console.warn('[Cloud] 此環境不支援 Web Crypto，雲端同步停用');
      setState('offline');
      return;
    }

    connect();

    // 分頁切回前景 → 重新拉取（拿到其他裝置的最新變更）
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (client && client.connected) { client.refresh(TOPIC, 1); client.ping(); }
        else connect();
      } else if (pendingData) {
        flush(true);
      }
    });

    // 關閉 / 切走頁面 → 立即把待推資料送出
    window.addEventListener('pagehide', () => { if (pendingData) flush(true); });
    window.addEventListener('beforeunload', () => { if (pendingData) flush(true); });
  };

  return {
    init,
    push,
    pull,
    reconnect,
    renderStatus,
    getState: () => state,
    TOPIC,
    WORKSPACE
  };
})();

window.Cloud = Cloud;
