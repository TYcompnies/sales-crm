/**
 * Store - 資料層封裝
 * localStorage 主存儲 + storage event 多 tab 同步
 */

const Store = (() => {
  const KEY = 'crm_data_v1';
  const SCHEMA_VERSION = 1;

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
      owner: '41大叔'
    }
  });

  // 讀取資料
  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      // 確保所有欄位都存在
      const data = defaultData();
      return {
        ...data,
        ...parsed,
        meta: { ...data.meta, ...(parsed.meta || {}) }
      };
    } catch (e) {
      console.error('Store load error:', e);
      return defaultData();
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
    saveNow(merged);
    return merged;
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
    PIPELINE_STAGES,
    STAGE_MAP,
    calcHeat,
    syncStageProb,
    dealsByCompany,
    activitiesByDeal,
    tasksByDeal,
    dealsByHeat
  };
})();

window.Store = Store;