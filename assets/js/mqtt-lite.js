/**
 * MqttLite — 極簡 MQTT 3.1.1 over WebSocket 客戶端（零依賴）
 *
 * 只實作本專案需要的子集：
 *   CONNECT / CONNACK / SUBSCRIBE / SUBACK / PUBLISH(QoS 0,1 + retain) / PUBACK / PINGREQ / PINGRESP / DISCONNECT
 *
 * 為什麼自己寫而不用 mqtt.js？
 *   1. 本專案「零依賴、無 build step」原則（不需 <script src="cdn...">）
 *   2. 中國大陸環境 CDN（unpkg/jsdelivr）常被封鎖或不穩，自帶最可靠
 *   3. 體積小（~7KB），行為可控
 *
 * 可在瀏覽器（window.MqttLite）與 Node（require，需 Node 22+ 內建 WebSocket）執行。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MqttLite = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TE = new TextEncoder();
  const TD = new TextDecoder();

  const encStr = (s) => TE.encode(String(s));
  const decStr = (b) => TD.decode(b);

  // 可變長度整數編碼（MQTT remaining length）
  const remLen = (n) => {
    const out = [];
    do {
      let b = n % 128;
      n = Math.floor(n / 128);
      if (n > 0) b |= 0x80;
      out.push(b);
    } while (n > 0);
    return out;
  };

  // 組合封包：固定頭 + 可變長度 + 內容
  const build = (header, body) => {
    const h = remLen(body.length);
    const out = new Uint8Array(1 + h.length + body.length);
    out[0] = header;
    out.set(h, 1);
    out.set(body, 1 + h.length);
    return out;
  };

  // UTF-8 字串 → MQTT 字串（2 bytes 長度 + 內容）
  const mqttStr = (s) => {
    const b = encStr(s);
    const out = new Uint8Array(2 + b.length);
    out[0] = (b.length >> 8) & 0xFF;
    out[1] = b.length & 0xFF;
    out.set(b, 2);
    return out;
  };

  const u16 = (n) => new Uint8Array([(n >> 8) & 0xFF, n & 0xFF]);

  const cat = (...arrs) => {
    const len = arrs.reduce((a, x) => a + x.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    arrs.forEach((x) => { out.set(x, o); o += x.length; });
    return out;
  };

  class Client {
    /**
     * @param {object} opts
     *   url        {string}  wss://broker.emqx.io:8084/mqtt
     *   clientId   {string}
     *   keepAlive  {number}  秒（預設 120）
     *   onConnect  {fn}
     *   onMessage  {fn(topic, payloadBytes, retain)}
     *   onClose    {fn(reason)}
     *   onError    {fn(err)}
     */
    constructor(opts) {
      this.url = opts.url;
      this.clientId = opts.clientId || ('ml_' + Math.random().toString(36).slice(2, 10));
      this.keepAlive = opts.keepAlive || 120;
      this.onConnect = opts.onConnect || (() => {});
      this.onMessage = opts.onMessage || (() => {});
      this.onClose = opts.onClose || (() => {});
      this.onError = opts.onError || (() => {});

      this.ws = null;
      this.connected = false;
      this.connecting = false;
      this.closedByUser = false;
      this._buf = new Uint8Array(0);
      this._pid = 1;
      this._pending = new Map();   // pid -> {timer, packet, label}
      this._subs = [];             // [{topic, qos, resolve}]
      this._pingTimer = null;
      this._reconnTimer = null;
      this._reconnDelay = 1000;
    }

    nextPid() {
      this._pid = this._pid >= 65535 ? 1 : this._pid + 1;
      return this._pid;
    }

    connect() {
      if (this.connected || this.connecting) return;
      this.connecting = true;
      this.closedByUser = false;
      let ws;
      try {
        ws = new WebSocket(this.url, 'mqtt');
      } catch (e) {
        this.connecting = false;
        this.onError(e);
        this._scheduleReconnect();
        return;
      }
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      ws.onopen = () => {
        try {
          ws.send(this._connectPacket());
        } catch (e) {
          this.onError(e);
        }
      };
      ws.onmessage = (ev) => {
        try {
          const data = ev.data instanceof ArrayBuffer
            ? new Uint8Array(ev.data)
            : new Uint8Array(ev.data.buffer || ev.data);
          this._feed(data);
        } catch (e) {
          this.onError(e);
        }
      };
      ws.onerror = (e) => { this.onError(e); };
      ws.onclose = () => {
        this.connected = false;
        this.connecting = false;
        this._stopPing();
        this._failPending('connection closed');
        this.onClose('closed');
        if (!this.closedByUser) this._scheduleReconnect();
      };
    }

    disconnect() {
      this.closedByUser = true;
      if (this._reconnTimer) { clearTimeout(this._reconnTimer); this._reconnTimer = null; }
      this._stopPing();
      if (this.ws && this.ws.readyState === 1) {
        try { this.ws.send(build(0xE0, new Uint8Array(0))); } catch (e) {}
      }
      try { if (this.ws) this.ws.close(); } catch (e) {}
      this.connected = false;
    }

    /** 訂閱主題（連線成功後會自動重訂） */
    subscribe(topic, qos) {
      qos = qos || 0;
      this._subs.push({ topic, qos });
      if (this.connected) this._doSubscribe(topic, qos);
    }

    /**
     * 重新送一次 SUBSCRIBE（不新增訂閱記錄）。
     * 用途：MQTT broker 對每次 SUBSCRIBE 都會重送 retained 訊息，
     * 因此可用來「主動拉取雲端最新版」。
     */
    refresh(topic, qos) {
      if (this.connected) this._doSubscribe(topic, qos == null ? 0 : qos);
    }

    /**
     * 發佈訊息
     * @returns {Promise<void>} QoS1 於收到 PUBACK 後 resolve
     */
    publish(topic, payloadBytes, opts) {
      opts = opts || {};
      const qos = opts.qos == null ? 0 : opts.qos;
      const retain = !!opts.retain;
      return new Promise((resolve) => {
        if (!this.connected) { resolve(false); return; }
        const pid = qos > 0 ? this.nextPid() : 0;
        const pkt = this._publishPacket(topic, payloadBytes, qos, retain, pid);
        if (qos === 0) {
          try { this.ws.send(pkt); resolve(true); } catch (e) { resolve(false); }
          return;
        }
        // QoS 1：等 PUBACK，最多重送 1 次
        const entry = { packet: pkt, label: topic, tries: 0 };
        const arm = () => {
          entry.timer = setTimeout(() => {
            entry.tries++;
            if (entry.tries > 2 || !this.connected) {
              this._pending.delete(pid);
              resolve(false);
              return;
            }
            try { this.ws.send(entry.packet); } catch (e) {}
            arm();
          }, 5000);
        };
        this._pending.set(pid, { entry, resolve });
        try { this.ws.send(pkt); } catch (e) { this._pending.delete(pid); resolve(false); return; }
        arm();
      });
    }

    // ---------- 封包組裝 ----------
    _connectPacket() {
      const varHeader = cat(
        new Uint8Array([0x00, 0x04]),      // protocol name length
        encStr('MQTT'),                     // protocol name
        new Uint8Array([0x04]),             // protocol level 4 = 3.1.1
        new Uint8Array([0x02]),             // connect flags: clean session
        u16(this.keepAlive)
      );
      const payload = mqttStr(this.clientId);
      return build(0x10, cat(varHeader, payload));
    }

    _publishPacket(topic, payload, qos, retain, pid) {
      let header = 0x30 | (qos << 1) | (retain ? 1 : 0);
      const parts = [mqttStr(topic)];
      if (qos > 0) parts.push(u16(pid));
      parts.push(payload);
      return build(header, cat(...parts));
    }

    _doSubscribe(topic, qos) {
      const pid = this.nextPid();
      const body = cat(u16(pid), mqttStr(topic), new Uint8Array([qos]));
      try { this.ws.send(build(0x82, body)); } catch (e) { this.onError(e); }
    }

    /** 送 PINGREQ 保持連線（分頁切回前景時可手動呼叫） */
    ping() { this._ping(); }

    _ping() {
      if (this.connected && this.ws && this.ws.readyState === 1) {
        try { this.ws.send(build(0xC0, new Uint8Array(0))); } catch (e) {}
      }
    }

    _startPing() {
      this._stopPing();
      const every = Math.max(20, Math.floor(this.keepAlive / 2)) * 1000;
      this._pingTimer = setInterval(() => this._ping(), every);
    }

    _stopPing() {
      if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
    }

    _scheduleReconnect() {
      if (this._reconnTimer || this.closedByUser) return;
      const delay = this._reconnDelay;
      this._reconnDelay = Math.min(this._reconnDelay * 1.8, 30000);
      this._reconnTimer = setTimeout(() => {
        this._reconnTimer = null;
        this.connect();
      }, delay);
    }

    _failPending(why) {
      this._pending.forEach(({ entry, resolve }) => {
        if (entry.timer) clearTimeout(entry.timer);
        resolve(false);
      });
      this._pending.clear();
    }

    // ---------- 解析 ----------
    _feed(chunk) {
      // 累積緩衝
      if (this._buf.length === 0) {
        this._buf = chunk;
      } else {
        const merged = new Uint8Array(this._buf.length + chunk.length);
        merged.set(this._buf, 0);
        merged.set(chunk, this._buf.length);
        this._buf = merged;
      }

      // 盡可能解析完整封包
      for (;;) {
        const p = this._parseOne(this._buf);
        if (!p) break;
        this._buf = this._buf.slice(p.total);
        this._handle(p);
      }
    }

    _parseOne(buf) {
      if (buf.length < 2) return null;
      let i = 1, mult = 1, len = 0, b;
      do {
        if (i >= buf.length) return null;
        b = buf[i++];
        len += (b & 127) * mult;
        mult *= 128;
        if (mult > 128 * 128 * 128) return null; // 格式錯誤
      } while (b & 128);
      const total = i + len;
      if (buf.length < total) return null;
      return {
        type: buf[0] >> 4,
        flags: buf[0] & 0x0F,
        body: buf.slice(i, total),
        total
      };
    }

    _handle(p) {
      switch (p.type) {
        case 2: { // CONNACK
          const rc = p.body[1];
          if (rc !== 0) { this.onError(new Error('MQTT CONNACK 失敗，代碼 ' + rc)); return; }
          this.connected = true;
          this.connecting = false;
          this._reconnDelay = 1000;
          this._startPing();
          // 重訂所有主題
          this._subs.forEach((s) => this._doSubscribe(s.topic, s.qos));
          this.onConnect();
          break;
        }
        case 3: { // PUBLISH
          const qos = (p.flags >> 1) & 0x03;
          const retain = !!(p.flags & 1);
          let o = 0;
          const tl = (p.body[o] << 8) | p.body[o + 1]; o += 2;
          const topic = decStr(p.body.slice(o, o + tl)); o += tl;
          if (qos > 0) {
            const pid = (p.body[o] << 8) | p.body[o + 1]; o += 2;
            // QoS1 → 回 PUBACK
            try { this.ws.send(build(0x40, u16(pid))); } catch (e) {}
          }
          const payload = p.body.slice(o);
          this.onMessage(topic, payload, retain);
          break;
        }
        case 4: { // PUBACK
          let o = 0;
          const pid = (p.body[o] << 8) | p.body[o + 1];
          const e = this._pending.get(pid);
          if (e) {
            if (e.entry.timer) clearTimeout(e.entry.timer);
            this._pending.delete(pid);
            e.resolve(true);
          }
          break;
        }
        case 9:   // SUBACK
        case 11:  // UNSUBACK
        case 13:  // PINGRESP
          break;
        default:
          break;
      }
    }
  }

  return { Client, build, remLen, mqttStr };
});
