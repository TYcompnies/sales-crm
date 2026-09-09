/**
 * Sync - 跨裝置同步模組
 *
 * 同步策略（不需要任何 API key、不需要本地伺服器）：
 * 1. localStorage 主存儲（每個瀏覽器一份完整資料）
 * 2. BroadcastChannel API：同一瀏覽器多 tab / 多裝置（同源）即時同步
 * 3. storage event：同源多 tab 被動同步
 * 4. 剪貼簿同步（SyncCode）：一鍵複製 / 貼上，跨網域 / 跨裝置 / 跨 IP
 * 5. JSON 檔案匯出 / 匯入：完整備份 / 還原
 * 6. 微型連結：把單筆商機打包成 base64 網址，傳給同事直接打開
 */

const Sync = (() => {
  const CHANNEL_NAME = 'crm_sync_channel_v1';

  let channel = null;
  let lastSyncAt = null;

  // 初始化 BroadcastChannel
  const init = () => {
    try {
      if ('BroadcastChannel' in window) {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = (ev) => {
          console.log('[Sync] BroadcastChannel 收到訊息', ev.data?.type);
          if (ev.data?.type === 'data-sync') {
            // 收到其他 tab 的同步資料
            Store.replace(ev.data.payload);
            updateIndicator('synced');
            App.toast('已從其他裝置同步最新資料', 'success');
          }
        };
      }
    } catch (e) {
      console.warn('[Sync] BroadcastChannel 不可用:', e);
    }

    // storage event：同源跨 tab 被動同步
    window.addEventListener('storage', (ev) => {
      if (ev.key === 'crm_data_v1' && ev.newValue) {
        try {
          const data = JSON.parse(ev.newValue);
          // 不儲存（避免迴圈），只更新 UI
          window.dispatchEvent(new CustomEvent('crm:dataChanged', { detail: data }));
          App.toast('偵測到其他視窗更新，已重新整理', 'info');
        } catch (e) {
          console.error('[Sync] storage event parse error:', e);
        }
      }
    });
  };

  // 廣播給其他 tab
  const broadcast = (data) => {
    if (channel) {
      try {
        channel.postMessage({ type: 'data-sync', payload: data });
      } catch (e) {
        console.warn('[Sync] broadcast failed:', e);
      }
    }
  };

  // 更新同步狀態指示器
  const updateIndicator = (status) => {
    const indicator = document.getElementById('syncIndicator');
    const statusEl = document.getElementById('syncStatus');
    if (!indicator || !statusEl) return;

    indicator.classList.remove('synced', 'syncing');

    if (status === 'syncing') {
      indicator.classList.add('syncing');
      statusEl.textContent = '同步中…';
    } else if (status === 'synced') {
      indicator.classList.add('synced');
      statusEl.textContent = '已同步 ' + new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      lastSyncAt = Date.now();
    } else {
      statusEl.textContent = '本機';
    }
  };

  // 編碼：把資料壓縮成同步碼（base64 + JSON）
  const encode = (data) => {
    const json = JSON.stringify(data);
    // 使用 UTF-8 安全的方式：encodeURIComponent + unescape
    const utf8 = unescape(encodeURIComponent(json));
    return btoa(utf8);
  };

  // 解碼
  const decode = (code) => {
    try {
      const utf8 = atob(code.trim());
      const json = decodeURIComponent(escape(utf8));
      return JSON.parse(json);
    } catch (e) {
      throw new Error('同步碼格式錯誤，請確認是否複製完整');
    }
  };

  // 複製同步碼到剪貼簿
  const copySyncCode = async () => {
    const data = Store.load();
    const code = encode(data);
    document.getElementById('syncCode').value = code;
    document.getElementById('syncNote').textContent = `同步碼大小：${(code.length / 1024).toFixed(1)} KB，包含 ${data.deals.length} 筆商機、${data.companies.length} 個客戶。`;

    try {
      await navigator.clipboard.writeText(code);
      App.toast('已複製同步碼到剪貼簿，到其他裝置貼上即可同步', 'success', 4000);
    } catch (e) {
      App.toast('自動複製失敗，請手動 Ctrl+C 複製', 'warning');
    }
  };

  // 從剪貼簿貼上同步碼
  const pasteSyncCode = async () => {
    updateIndicator('syncing');
    try {
      let code;
      try {
        code = await navigator.clipboard.readText();
      } catch (e) {
        code = prompt('自動讀取剪貼簿失敗，請手動貼上同步碼：');
        if (!code) return;
      }
      if (!code || !code.trim()) {
        App.toast('剪貼簿是空的', 'warning');
        updateIndicator('synced');
        return;
      }

      const imported = decode(code);
      if (!imported.schemaVersion) {
        throw new Error('同步碼格式不正確');
      }

      const ok = await App.confirm(
        `即將從同步碼匯入 ${imported.deals?.length || 0} 筆商機、${imported.companies?.length || 0} 個客戶。\n\n注意：這會覆蓋本機目前的資料，確定嗎？`
      );
      if (!ok) {
        updateIndicator();
        return;
      }

      Store.replace(imported);
      broadcast(imported);
      updateIndicator('synced');
      App.toast('同步完成！資料已更新', 'success');
      App.render();
    } catch (e) {
      console.error(e);
      App.toast('同步失敗：' + e.message, 'error', 5000);
      updateIndicator();
    }
  };

  // 匯出 JSON
  const exportJson = () => {
    const data = Store.load();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `crm-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    document.getElementById('fileNote').textContent = `已匯出，檔名：crm-backup-${date}.json`;
    document.getElementById('fileNote').className = 'sync-note success';
    App.toast('已匯出 JSON 備份檔', 'success');
  };

  // 匯入 JSON
  const importJson = (file) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.schemaVersion) {
          throw new Error('檔案格式不正確（缺少 schemaVersion）');
        }
        const ok = await App.confirm(
          `即將從 JSON 匯入 ${data.deals?.length || 0} 筆商機、${data.companies?.length || 0} 個客戶。\n\n注意：這會覆蓋本機目前的資料，確定嗎？`
        );
        if (!ok) return;

        Store.replace(data);
        broadcast(data);
        updateIndicator('synced');
        App.toast('匯入完成！資料已更新', 'success');
        App.render();
        document.getElementById('fileNote').textContent = '匯入成功';
        document.getElementById('fileNote').className = 'sync-note success';
      } catch (e) {
        document.getElementById('fileNote').textContent = '匯入失敗：' + e.message;
        document.getElementById('fileNote').className = 'sync-note error';
        App.toast('匯入失敗：' + e.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  // 微型連結分享（單筆商機）
  const generateShareLink = () => {
    const data = Store.load();
    if (data.deals.length === 0) {
      App.toast('目前沒有商機可以分享', 'warning');
      return;
    }

    // 簡單做法：選擇第一筆進行中商機
    const activeDeal = data.deals.find(d => d.stage !== 'won' && d.stage !== 'lost') || data.deals[0];
    const company = data.companies.find(c => c.id === activeDeal.companyId);

    const mini = {
      n: activeDeal.name,                  // name
      c: company?.name || '未知客戶',      // company
      s: activeDeal.stage,                  // stage
      a: activeDeal.amount,                // amount
      p: activeDeal.prob,                   // probability
      d: activeDeal.dueDate,                // dueDate
      pr: activeDeal.product,               // product
      co: activeDeal.competitor,            // competitor
      f: activeDeal.feedback,               // feedback
      t: Date.now()                          // timestamp
    };

    const code = encode(mini);
    const baseUrl = window.location.origin + window.location.pathname;
    const link = `${baseUrl}?share=${code}`;

    document.getElementById('shareLink').value = link;
    document.getElementById('linkNote').textContent = `已產生「${activeDeal.name}」的微型連結，可直接傳給同事。`;
    document.getElementById('linkNote').className = 'sync-note success';
  };

  const copyShareLink = async () => {
    const link = document.getElementById('shareLink').value;
    if (!link) {
      App.toast('請先產生分享連結', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      App.toast('已複製分享連結', 'success');
    } catch (e) {
      App.toast('複製失敗，請手動複製', 'warning');
    }
  };

  // 解析分享連結（從 URL query）
  const parseShareLink = () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('share');
    if (!code) return null;
    try {
      const mini = decode(code);
      return {
        name: mini.n,
        company: mini.c,
        stage: mini.s,
        amount: mini.a,
        prob: mini.p,
        dueDate: mini.d,
        product: mini.pr,
        competitor: mini.co,
        feedback: mini.f
      };
    } catch (e) {
      console.error('分享連結解析失敗:', e);
      return null;
    }
  };

  return {
    init,
    broadcast,
    updateIndicator,
    encode,
    decode,
    copySyncCode,
    pasteSyncCode,
    exportJson,
    importJson,
    generateShareLink,
    copyShareLink,
    parseShareLink
  };
})();

window.Sync = Sync;