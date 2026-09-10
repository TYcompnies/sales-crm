/**
 * Seed - 預載範例資料（三業務示範：林建宏 / 張雅婷 / 陳冠宇）
 * 建立日期刻意分散在 9/7、9/8、9/9，讓「每日新增戰報」有三天資料可看
 */

const Seed = (() => {

  // 本地日期字串（避免 UTC 跳日），offset = 往前推幾天
  const localDate = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const createdAtOf = (offset) => localDate(offset) + 'T08:00:00';
  const today = () => localDate(0);

  const seedData = () => {
    // 確定性 id：兩台裝置各自首次播種時會產生「完全相同」的資料，
    // 雲端合併後不會出現重複的範例客戶/商機（若用隨機 uid 就會變兩份）
    let _n = 0;
    const sid = (prefix) => `seed_${prefix}_${++_n}`;

    const data = {
      schemaVersion: 2,
      companies: [],
      contacts: [],
      deals: [],
      activities: [],
      tasks: [],
      dailyMetrics: [],
      meta: {
        createdAt: createdAtOf(0),
        updatedAt: createdAtOf(0),
        owner: '鈦沅CRM',
        seeded: true,
        team: [
          { id: 'mb_lin', name: '林建宏' },
          { id: 'mb_chang', name: '張雅婷' },
          { id: 'mb_chen', name: '陳冠宇' }
        ]
      }
    };

    // ===== 1. 智邦科技（林建宏，9/9 新增）=====
    const c1 = {
      id: sid('co'),
      name: '智邦科技股份有限公司',
      taxId: '12345678',
      industry: '網通設備製造業',
      employeeCount: 3500,
      capital: null,
      region: '新竹科學園區',
      source: '舊客戶回流',
      owner: '林建宏',
      tags: ['A+', '高科技', '高金額'],
      website: 'https://www.accton.com.tw',
      notes: '台灣網通設備大廠，重點客戶',
      createdAt: createdAtOf(0)
    };
    const ct1 = {
      id: sid('ct'),
      companyId: c1.id,
      name: '陳建宏',
      position: '技術長',
      influence: '關鍵決策者',
      owner: '林建宏',
      line: '@chenjh',
      email: 'jh.chen@accton.com',
      phone: '0928-777-666',
      birthday: null,
      notes: '',
      createdAt: createdAtOf(0)
    };
    const d1 = {
      id: sid('dl'),
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
      owner: '林建宏',
      tags: ['高金額', '重點'],
      createdAt: createdAtOf(0)
    };
    const a1 = {
      id: sid('act'),
      dealId: d1.id,
      contactId: ct1.id,
      owner: '林建宏',
      date: today(),
      method: '當面拜訪',
      type: '方案演示',
      summary: '實機測試溫度較對手低5度，符合客戶規格書',
      feedback: '對效能滿意，但要求提供3年保固',
      concerns: '價格過高',
      competitor: '奇鋐科技',
      createdAt: createdAtOf(0)
    };
    const t1 = {
      id: sid('tk'),
      dealId: d1.id,
      title: '準備保固成本分析與議價對策',
      owner: '林建宏',
      dueDate: '2026-09-12',
      priority: 'P1',
      status: 'open',
      createdAt: createdAtOf(0)
    };

    // ===== 2. 台亞半導體（林建宏，9/8 新增）=====
    const c2 = {
      id: sid('co'),
      name: '台亞半導體股份有限公司',
      taxId: '87654321',
      industry: '晶圓測試',
      employeeCount: 1200,
      capital: null,
      region: '桃園市',
      source: '業務開發',
      owner: '林建宏',
      tags: ['A+', '高科技', '高金額'],
      website: '',
      notes: '',
      createdAt: createdAtOf(1)
    };
    const ct2 = {
      id: sid('ct'),
      companyId: c2.id,
      name: '張美玲',
      position: '採購經理',
      influence: '守門人',
      owner: '林建宏',
      line: '',
      email: 'ml.chang@taiya.com.tw',
      phone: '0933-452-111',
      birthday: null,
      notes: '預算審核關鍵人',
      createdAt: createdAtOf(1)
    };
    const d2 = {
      id: sid('dl'),
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
      owner: '林建宏',
      tags: ['緊急', '高金額'],
      createdAt: createdAtOf(1)
    };
    const a2 = {
      id: sid('act'),
      dealId: d2.id,
      contactId: ct2.id,
      owner: '林建宏',
      date: '2026-09-08',
      method: '視訊會議',
      type: '報價溝通',
      summary: '我方報價較對手高8%，但可節省20%人力',
      feedback: '要求降價至350萬否則轉單',
      concerns: '預算上限明確，需高層授權特惠價',
      competitor: '蔚華科技',
      createdAt: createdAtOf(1)
    };
    const t2 = {
      id: sid('tk'),
      dealId: d2.id,
      title: '向主管申請專案折扣',
      owner: '林建宏',
      dueDate: '2026-09-10',
      priority: 'P1',
      status: 'open',
      createdAt: createdAtOf(1)
    };

    // ===== 3. 樂森餐飲（張雅婷，9/7 新增）=====
    const c3 = {
      id: sid('co'),
      name: '樂森餐飲連鎖集團',
      taxId: '11223344',
      industry: '餐飲服務業',
      employeeCount: 800,
      capital: null,
      region: '台中市',
      source: '客戶介紹',
      owner: '張雅婷',
      tags: ['B', '連鎖'],
      website: '',
      notes: '',
      createdAt: createdAtOf(2)
    };
    const ct3 = {
      id: sid('ct'),
      companyId: c3.id,
      name: '王俊傑',
      position: '資訊長',
      influence: '關鍵決策者',
      owner: '張雅婷',
      line: '',
      email: 'jj.wang@lesen.com.tw',
      phone: '0975-888-123',
      birthday: null,
      notes: '',
      createdAt: createdAtOf(2)
    };
    const d3 = {
      id: sid('dl'),
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
      owner: '張雅婷',
      tags: ['教育期'],
      createdAt: createdAtOf(2)
    };
    const a3 = {
      id: sid('act'),
      dealId: d3.id,
      contactId: ct3.id,
      owner: '張雅婷',
      date: '2026-09-07',
      method: '電話',
      type: '後續跟進',
      summary: '說明雲端備份與資安合規方案',
      feedback: '對訂閱制收費方式有興趣，但擔心離線交易中斷',
      concerns: '內部IT團隊傾向自建機房',
      competitor: '微軟合作夥伴',
      createdAt: createdAtOf(2)
    };
    const t3 = {
      id: sid('tk'),
      dealId: d3.id,
      title: '提供斷線續傳技術白皮書',
      owner: '張雅婷',
      dueDate: '2026-09-14',
      priority: 'P2',
      status: 'open',
      createdAt: createdAtOf(2)
    };

    // ===== 每日量化指標（同一天可多位業務各自填寫）=====
    const m1 = {   // 9/9 林建宏
      id: sid('mt'),
      date: today(),
      owner: '林建宏',
      contactCount: 8,
      effectiveTalks: 5,
      newLeads: 2,
      callCount: 12,
      visitCount: 3,
      closedToday: 0,
      targetCall: 15,
      targetVisit: 5,
      learning: '智邦報價準備充分，客戶反應正面',
      topThree: '1. 完成智邦報價議價對策\n2. 申請台亞特惠折扣\n3. 開發 2 家新網通客戶',
      createdAt: createdAtOf(0)
    };
    const m2 = {   // 9/9 張雅婷
      id: sid('mt'),
      date: today(),
      owner: '張雅婷',
      contactCount: 6,
      effectiveTalks: 3,
      newLeads: 1,
      callCount: 9,
      visitCount: 2,
      closedToday: 0,
      targetCall: 12,
      targetVisit: 4,
      learning: '樂森對離線交易中斷有疑慮，需補技術白皮書',
      topThree: '1. 寄送樂森斷線續傳白皮書\n2. 約樂森 IT 主管做第二次簡報\n3. 回訪 2 家餐飲連鎖老客戶',
      createdAt: createdAtOf(0)
    };
    const m3 = {   // 9/8 陳冠宇
      id: sid('mt'),
      date: localDate(1),
      owner: '陳冠宇',
      contactCount: 10,
      effectiveTalks: 4,
      newLeads: 3,
      callCount: 14,
      visitCount: 1,
      closedToday: 1,
      targetCall: 15,
      targetVisit: 3,
      learning: '陌生開發命中率：A+ 名單遠高於隨機名單，明天繼續照標籤打',
      topThree: '1. 跟進昨日新增 3 家潛在客戶\n2. 完成已成交客戶的售後交接\n3. 產出 10 家 A+ 名單',
      createdAt: createdAtOf(1)
    };

    data.companies = [c1, c2, c3];
    data.contacts = [ct1, ct2, ct3];
    data.deals = [d1, d2, d3];
    data.activities = [a1, a2, a3];
    data.tasks = [t1, t2, t3];
    data.dailyMetrics = [m1, m2, m3];

    return Store.normalize(data);
  };

  return { seedData };
})();

window.Seed = Seed;
