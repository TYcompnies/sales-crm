/**
 * Store - 資料層封裝
 * localStorage 主存儲 + storage event 多 tab 同步
 */

const Store = (() => {
  const KEY = 'crm_data_v1';
  const PROFILE_KEY = 'crm_profile_v1';   // 本機使用者身份（不同步，綁裝置）
  const DASH_MODE_KEY = 'crm_dash_mode';  // 戰報範圍：mine / team（不同步）
  const SCHEMA_VERSION = 2;

  // 預設資料結構
  const defaultData = () => ({
    schemaVersion: SCHEMA_VERSION,
    companies: [],
    contacts: [],
    deals: [],
    activities: [],
    tasks: [],
    dailyMetrics: [],
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      owner: '鈦沅CRM',
      team: [],           // 業務成員清單 [{id, name}]
      removedMembers: []  // 已刪除的業務名稱（防止 normalize 從其名下資料 owner 自動復活）
    }
  });

  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // 資料遷移 / 補齊（v1 → v2）
  // 確保 meta.team 存在、每個 entity 都有 owner
  const normalize = (data) => {
    data.meta = { ...defaultData().meta, ...(data.meta || {}) };
    if (!Array.isArray(data.meta.team)) data.meta.team = [];
    if (!Array.isArray(data.meta.removedMembers)) data.meta.removedMembers = [];
    // 已刪除的業務不得殘留於 team（避免被下方 owner 掃描自動復活）
    const removed = data.meta.removedMembers;
    if (removed.length) data.meta.team = data.meta.team.filter(m => m && !removed.includes(m.name));

    const dealOwner = (dealId) => {
      const d = data.deals.find(x => x.id === dealId);
      return d?.owner || '';
    };
    const contactCompanyId = (contactId) => {
      const c = data.contacts.find(x => x.id === contactId);
      return c?.companyId || '';
    };
    const companyOwnerOf = (companyId) => {
      const c = data.companies.find(x => x.id === companyId);
      return c?.owner || '';
    };

    // 補 owner（避免覆蓋既有值）
    (data.deals || []).forEach(d => { if (!d.owner) d.owner = '未指派'; });
    (data.companies || []).forEach(c => { if (!c.owner) c.owner = '未指派'; });
    (data.contacts || []).forEach(ct => {
      if (!ct.owner) {
        // 從同客戶的商機 owner 繼承
        const owners = [...new Set(data.deals.filter(d => d.companyId === ct.companyId).map(d => d.owner).filter(Boolean))];
        ct.owner = owners[0] || companyOwnerOf(ct.companyId) || '未指派';
      }
    });
    (data.activities || []).forEach(a => {
      if (!a.owner) a.owner = dealOwner(a.dealId) || companyOwnerOf(contactCompanyId(a.contactId)) || '未指派';
    });
    (data.tasks || []).forEach(t => { if (!t.owner) t.owner = dealOwner(t.dealId) || '未指派'; });
    (data.dailyMetrics || []).forEach(m => { if (!m.owner) m.owner = '未指派'; });

    // 重建 team：收集所有出現過的 owner 名稱（排除「未指派」）
    const names = [...new Set([
      ...data.companies.map(c => c.owner),
      ...data.contacts.map(c => c.owner),
      ...data.deals.map(d => d.owner),
      ...data.activities.map(a => a.owner),
      ...data.tasks.map(t => t.owner),
      ...data.dailyMetrics.map(m => m.owner)
    ].filter(n => n && n !== '未指派'))];
    names.forEach(name => {
      if (!removed.includes(name) && !data.meta.team.some(m => m.name === name)) {
        data.meta.team.push({ id: uid('mb'), name });
      }
    });

    data.schemaVersion = SCHEMA_VERSION;
    return data;
  };

  // 讀取資料
  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      // 確保所有欄位都存在
      const data = defaultData();
      const merged = {
        ...data,
        ...parsed,
        meta: { ...data.meta, ...(parsed.meta || {}) }
      };
      return normalize(merged);
    } catch (e) {
      console.error('Store load error:', e);
      return normalize(defaultData());
    }
  };

  // 儲存資料
  let saveTimer = null;
  const save = (data, opts = {}) => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        data.meta.updatedAt = new Date().toISOString();
        localStorage.setItem(KEY, JSON.stringify(data));
        // 通知其他 tab（同源）
        if (!opts.silent) {
          window.dispatchEvent(new CustomEvent('crm:dataChanged', { detail: data }));
        }
      } catch (e) {
        console.error('Store save error:', e);
        App.toast('儲存失敗：' + e.message, 'error');
      }
    }, 100);
  };

  // 立即儲存（同步用）
  const saveNow = (data) => {
    try {
      data.meta.updatedAt = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(data));
      window.dispatchEvent(new CustomEvent('crm:dataChanged', { detail: data }));
    } catch (e) {
      console.error('Store saveNow error:', e);
    }
  };

  // 重置為範例資料
  const reset = () => {
    localStorage.removeItem(KEY);
    return load();
  };

  // 完整替換資料（用於匯入）
  const replace = (data) => {
    const merged = { ...defaultData(), ...data, meta: { ...defaultData().meta, ...(data.meta || {}) } };
    const norm = normalize(merged);
    saveNow(norm);
    return norm;
  };

  // ===== 本機身份（Profile）=====
  const getProfile = () => {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); }
    catch (e) { return null; }
  };
  const setProfile = (p) => {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }
    catch (e) { console.error('setProfile error', e); }
  };

  // ===== 戰報範圍模式 =====
  const getDashMode = () => localStorage.getItem(DASH_MODE_KEY) || 'mine';
  const setDashMode = (mode) => localStorage.setItem(DASH_MODE_KEY, mode);

  // ===== 團隊成員管理 =====
  // 回傳業務成員（含「未指派」偽成員做顯示用，不參與選單）
  const teamMembers = (data) => data.meta?.team || [];
  // 確保姓名在團隊清單中，回傳該成員（若曾被刪除則自動解除黑名單＝重新啟用）
  const ensureMember = (data, name) => {
    if (!name) return null;
    let m = (data.meta.team || []).find(x => x.name === name);
    if (!m) {
      m = { id: uid('mb'), name };
      data.meta.team.push(m);
      const rm = data.meta.removedMembers || (data.meta.removedMembers = []);
      const i = rm.indexOf(name);
      if (i >= 0) rm.splice(i, 1);
    }
    return m;
  };
  // 從團隊移除成員（名下資料「不刪除」，owner 欄位保留原名 → 歷史歸屬不變）
  // 會寫入 meta.removedMembers，避免 normalize() 從名下資料的 owner 自動把此人復活
  // 回傳 { removed, stats }：stats 統計該成員名下各類資料筆數（供刪除前警告）
  const removeMember = (data, name) => {
    const before = (data.meta.team || []).length;
    data.meta.team = (data.meta.team || []).filter(m => m.name !== name);
    const removed = data.meta.team.length < before;
    if (removed) {
      const rm = data.meta.removedMembers || (data.meta.removedMembers = []);
      if (!rm.includes(name)) rm.push(name);
    }
    return {
      removed,
      stats: {
        companies: data.companies.filter(c => c.owner === name).length,
        contacts: data.contacts.filter(c => c.owner === name).length,
        deals: data.deals.filter(d => d.owner === name).length,
        activities: data.activities.filter(a => a.owner === name).length,
        tasks: data.tasks.filter(t => t.owner === name).length
      }
    };
  };
  // 目前使用者名稱（無 Profile 回空字串）
  const me = () => getProfile()?.name || '';
  // owner 下拉選單 HTML：保留既有值（舊資料/未指派），團隊成員依 meta.team
  const ownerOptionsHtml = (data, current) => {
    const team = teamMembers(data);
    const cur = current || '';
    const out = [];
    if (cur && !team.some(m => m.name === cur)) {
      out.push(`<option value="${esc(cur)}" selected>${esc(cur)}</option>`);
    }
    if (!cur) out.push('<option value="" selected>— 選擇業務 —</option>');
    team.forEach(m => {
      out.push(`<option value="${esc(m.name)}"${cur === m.name ? ' selected' : ''}>${esc(m.name)}</option>`);
    });
    return out.join('');
  };

  // ID 生成
  const uid = (prefix = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 銷售管線定義
  const PIPELINE_STAGES = [
    { key: 'potential',    name: '潛在客戶',  prob: 10, color: '#6b7280', definition: '剛獲得線索，尚未建立有效聯繫。' },
    { key: 'contact',      name: '初步溝通',  prob: 20, color: '#3b82f6', definition: '已建立首次通話/郵件，確認對方有模糊需求。' },
    { key: 'needs',        name: '需求確認',  prob: 40, color: '#06b6d4', definition: '完成痛點挖掘，釐清預算、決策流程、時間表 (BANT)。' },
    { key: 'quote',        name: '方案報價',  prob: 60, color: '#f59e0b', definition: '已提交客製化提案或正式報價單。' },
    { key: 'negotiation',  name: '商務談判',  prob: 80, color: '#f97316', definition: '正在進行價格、合約條款、交付週期的來回協商。' },
    { key: 'won',          name: '成交',      prob: 100, color: '#10b981', definition: '簽約回傳，贏單！' },
    { key: 'lost',         name: '失敗',      prob: 0, color: '#ef4444', definition: '明確拒絕 / 流失。' }
  ];

  const STAGE_MAP = Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, s]));

  // 計算熱度指數（成交機率 × 預估金額 / 剩餘天數）
  const calcHeat = (deal, today = new Date()) => {
    const prob = deal.prob ?? STAGE_MAP[deal.stage]?.prob ?? 0;
    const amount = Number(deal.amount) || 0;
    let dueDays = 30;
    if (deal.dueDate) {
      const due = new Date(deal.dueDate);
      const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      dueDays = Math.max(1, diff);
    }
    // 加權公式：機率 × 金額 / 剩餘天數（歸一化到 0-100 分）
    const raw = (prob / 100) * amount / dueDays;
    // 用 log 壓縮動態範圍
    const score = Math.min(100, Math.round(Math.log10(raw + 1) * 25));
    return { score, dueDays, raw };
  };

  // 自動階段推導（基於商機的成交機率欄位）
  const syncStageProb = (deal) => {
    if (STAGE_MAP[deal.stage]) {
      if (deal.prob == null) deal.prob = STAGE_MAP[deal.stage].prob;
    }
    return deal;
  };

  // 工具：取得客戶關聯的商機
  const dealsByCompany = (data, companyId) =>
    data.deals.filter(d => d.companyId === companyId);

  // 工具：取得商機的互動紀錄
  const activitiesByDeal = (data, dealId) =>
    data.activities.filter(a => a.dealId === dealId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

  // 工具：取得商機的待辦任務
  const tasksByDeal = (data, dealId) =>
    data.tasks.filter(t => t.dealId === dealId);

  // 工具：依熱度排序所有進行中商機
  const dealsByHeat = (data) => {
    return [...data.deals]
      .filter(d => d.stage !== 'won' && d.stage !== 'lost')
      .map(d => ({ ...d, heat: calcHeat(d) }))
      .sort((a, b) => b.heat.score - a.heat.score);
  };

  return {
    load,
    save,
    saveNow,
    reset,
    replace,
    uid,
    normalize,
    PIPELINE_STAGES,
    STAGE_MAP,
    calcHeat,
    syncStageProb,
    dealsByCompany,
    activitiesByDeal,
    tasksByDeal,
    dealsByHeat,
    getProfile,
    setProfile,
    getDashMode,
    setDashMode,
    teamMembers,
    ensureMember,
    removeMember,
    me,
    ownerOptionsHtml
  };
})();

window.Store = Store;