/**
 * Seed - 預載範例資料（大叔提供的三筆商機）
 */

const Seed = (() => {

  const today = () => new Date().toISOString().slice(0, 10);
  const isoToday = new Date().toISOString();

  const seedData = () => {
    const data = {
      schemaVersion: 1,
      companies: [],
      contacts: [],
      deals: [],
      activities: [],
      tasks: [],
      dailyMetrics: [],
      meta: {
        createdAt: isoToday,
        updatedAt: isoToday,
        owner: '41大叔',
        seeded: true
      }
    };

    // ===== 1. 智邦科技 =====
    const c1 = {
      id: Store.uid('co'),
      name: '智邦科技股份有限公司',
      taxId: '12345678',
      industry: '網通設備製造業',
      employeeCount: 3500,
      capital: null,
      region: '新竹科學園區',
      source: '舊客戶回流',
      tags: ['A+', '高科技', '高金額'],
      website: 'https://www.accton.com.tw',
      notes: '台灣網通設備大廠，重點客戶',
      createdAt: isoToday
    };
    const ct1 = {
      id: Store.uid('ct'),
      companyId: c1.id,
      name: '陳建宏',
      position: '技術長',
      influence: '關鍵決策者',
      line: '@chenjh',
      email: 'jh.chen@accton.com',
      phone: '0928-777-666',
      birthday: null,
      notes: ''
    };
    const d1 = {
      id: Store.uid('dl'),
      companyId: c1.id,
      contactId: ct1.id,
      name: '5G基站散熱模組',
      product: '均熱板+風扇模組',
      stage: 'quote',
      prob: 60,
      amount: 15000000,
      currency: 'NT$',
      dueDate: '2026-10-15',
      competitor: '奇鋐科技',
      feedback: '對效能滿意，但要求提供3年保固',
      summary: '實機測試溫度較對手低5度，符合客戶規格書',
      concerns: '價格過高',
      riskFactor: '競爭對手下週將提出殺價方案',
      lastDate: today(),
      lastMethod: '當面拜訪',
      lastType: '方案演示',
      owner: '林業務',
      tags: ['高金額', '重點'],
      createdAt: isoToday
    };
    const a1 = {
      id: Store.uid('act'),
      dealId: d1.id,
      contactId: ct1.id,
      date: today(),
      method: '當面拜訪',
      type: '方案演示',
      summary: '實機測試溫度較對手低5度，符合客戶規格書',
      feedback: '對效能滿意，但要求提供3年保固',
      concerns: '價格過高',
      competitor: '奇鋐科技',
      createdAt: isoToday
    };
    const t1 = {
      id: Store.uid('tk'),
      dealId: d1.id,
      title: '準備保固成本分析與議價對策',
      owner: '林業務',
      dueDate: '2026-09-12',
      priority: 'P1',
      status: 'open',
      createdAt: isoToday
    };

    // ===== 2. 台亞半導體 =====
    const c2 = {
      id: Store.uid('co'),
      name: '台亞半導體股份有限公司',
      taxId: '87654321',
      industry: '晶圓測試',
      employeeCount: 1200,
      capital: null,
      region: '桃園市',
      source: '業務開發',
      tags: ['A+', '高科技', '高金額'],
      website: '',
      notes: '',
      createdAt: isoToday
    };
    const ct2 = {
      id: Store.uid('ct'),
      companyId: c2.id,
      name: '張美玲',
      position: '採購經理',
      influence: '守門人',
      line: '',
      email: 'ml.chang@taiya.com.tw',
      phone: '0933-452-111',
      birthday: null,
      notes: '預算審核關鍵人'
    };
    const d2 = {
      id: Store.uid('dl'),
      companyId: c2.id,
      contactId: ct2.id,
      name: '測試機台校準軟體升級',
      product: 'AI自動校正模組',
      stage: 'negotiation',
      prob: 80,
      amount: 3800000,
      currency: 'NT$',
      dueDate: '2026-09-30',
      competitor: '蔚華科技',
      feedback: '要求降價至350萬否則轉單',
      summary: '我方報價較對手高8%，但可節省20%人力',
      concerns: '預算上限明確',
      riskFactor: '需高層授權特惠價',
      lastDate: '2026-09-08',
      lastMethod: '視訊會議',
      lastType: '報價溝通',
      owner: '林業務',
      tags: ['緊急', '高金額'],
      createdAt: isoToday
    };
    const a2 = {
      id: Store.uid('act'),
      dealId: d2.id,
      contactId: ct2.id,
      date: '2026-09-08',
      method: '視訊會議',
      type: '報價溝通',
      summary: '我方報價較對手高8%，但可節省20%人力',
      feedback: '要求降價至350萬否則轉單',
      concerns: '預算上限明確，需高層授權特惠價',
      competitor: '蔚華科技',
      createdAt: isoToday
    };
    const t2 = {
      id: Store.uid('tk'),
      dealId: d2.id,
      title: '向主管申請專案折扣',
      owner: '林業務',
      dueDate: '2026-09-10',
      priority: 'P1',
      status: 'open',
      createdAt: isoToday
    };

    // ===== 3. 樂森餐飲 =====
    const c3 = {
      id: Store.uid('co'),
      name: '樂森餐飲連鎖集團',
      taxId: '11223344',
      industry: '餐飲服務業',
      employeeCount: 800,
      capital: null,
      region: '台中市',
      source: '客戶介紹',
      tags: ['B', '連鎖'],
      website: '',
      notes: '',
      createdAt: isoToday
    };
    const ct3 = {
      id: Store.uid('ct'),
      companyId: c3.id,
      name: '王俊傑',
      position: '資訊長',
      influence: '關鍵決策者',
      line: '',
      email: 'jj.wang@lesen.com.tw',
      phone: '0975-888-123',
      birthday: null,
      notes: ''
    };
    const d3 = {
      id: Store.uid('dl'),
      companyId: c3.id,
      contactId: ct3.id,
      name: '門市POS系統雲端化',
      product: 'Azure雲端POS',
      stage: 'needs',
      prob: 40,
      amount: 2500000,
      currency: 'NT$',
      dueDate: '2026-11-01',
      competitor: '微軟合作夥伴',
      feedback: '對訂閱制收費方式有興趣，但擔心離線交易中斷',
      summary: '說明雲端備份與資安合規方案',
      concerns: '內部IT團隊傾向自建機房',
      riskFactor: '內部阻力',
      lastDate: '2026-09-07',
      lastMethod: '電話',
      lastType: '後續跟進',
      owner: '林業務',
      tags: ['教育期'],
      createdAt: isoToday
    };
    const a3 = {
      id: Store.uid('act'),
      dealId: d3.id,
      contactId: ct3.id,
      date: '2026-09-07',
      method: '電話',
      type: '後續跟進',
      summary: '說明雲端備份與資安合規方案',
      feedback: '對訂閱制收費方式有興趣，但擔心離線交易中斷',
      concerns: '內部IT團隊傾向自建機房',
      competitor: '微軟合作夥伴',
      createdAt: isoToday
    };
    const t3 = {
      id: Store.uid('tk'),
      dealId: d3.id,
      title: '提供斷線續傳技術白皮書',
      owner: '林業務',
      dueDate: '2026-09-14',
      priority: 'P2',
      status: 'open',
      createdAt: isoToday
    };

    // ===== 今日量化指標 =====
    const m1 = {
      id: Store.uid('mt'),
      date: today(),
      owner: '林業務',
      contactCount: 8,
      effectiveTalks: 5,
      newLeads: 2,
      callCount: 12,
      visitCount: 3,
      closedToday: 0,
      targetCall: 15,
      targetVisit: 5,
      learning: '智邦報價準備充分，客戶反應正面',
      topThree: '1. 完成智邦報價議價對策\n2. 申請台亞特惠折扣\n3. 寄送樂森技術白皮書',
      createdAt: isoToday
    };

    data.companies = [c1, c2, c3];
    data.contacts = [ct1, ct2, ct3];
    data.deals = [d1, d2, d3];
    data.activities = [a1, a2, a3];
    data.tasks = [t1, t2, t3];
    data.dailyMetrics = [m1];

    return data;
  };

  return { seedData };
})();

window.Seed = Seed;