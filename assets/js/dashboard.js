/**
 * Dashboard - 今日戰報儀表板（我的 / 團隊切換）
 */

const Dashboard = (() => {

  // 本地日期字串（避免 UTC 跳日）
  const localDateStr = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  // 依「我的/團隊」模式過濾資料（mine 只留自己的資料）
  const scoped = (data, mode, me) => {
    if (mode !== 'mine' || !me) return data;
    return {
      ...data,
      companies: data.companies.filter(c => c.owner === me),
      contacts: data.contacts.filter(c => c.owner === me),
      deals: data.deals.filter(d => d.owner === me),
      activities: data.activities.filter(a => a.owner === me),
      tasks: data.tasks.filter(t => t.owner === me),
      dailyMetrics: data.dailyMetrics.filter(m => m.owner === me)
    };
  };

  // 當天指標：mine → 自己的那筆；team → 全隊當天加總
  const todayMetricsOf = (data, today, mode, me) => {
    const rows = data.dailyMetrics.filter(m => m.date === today);
    if (mode === 'mine') return rows.find(m => m.owner === me) || {};
    return {
      callCount: rows.reduce((s, m) => s + (m.callCount || 0), 0),
      visitCount: rows.reduce((s, m) => s + (m.visitCount || 0), 0),
      newLeads: rows.reduce((s, m) => s + (m.newLeads || 0), 0),
      effectiveTalks: rows.reduce((s, m) => s + (m.effectiveTalks || 0), 0),
      contactCount: rows.reduce((s, m) => s + (m.contactCount || 0), 0),
      closedToday: rows.reduce((s, m) => s + (m.closedToday || 0), 0),
      targetCall: rows.reduce((s, m) => s + (m.targetCall || 0), 0),
      targetVisit: rows.reduce((s, m) => s + (m.targetVisit || 0), 0)
    };
  };

  const render = () => {
    const data = Store.load();
    const me = Store.me();
    const dashMode = Store.getDashMode();        // 'mine' | 'team'
    const needGuide = dashMode === 'mine' && !me; // 我的模式但還沒選身份 → 顯示引導
    const scopeMode = needGuide ? 'team' : dashMode;
    const sd = scoped(data, scopeMode, me);
    const today = localDateStr(0);
    const todayMetrics = todayMetricsOf(sd, today, scopeMode, me);
    const monthPrefix = today.slice(0, 7);

    // 計算核心指標
    const stats = calcStats(sd, todayMetrics, monthPrefix, today);
    const visitStats = calcVisitStats(sd, today);
    const upcomingVisits = calcUpcomingVisits(sd, today);

    // 今日其他業務復盤（自己的除外，供團隊互看）
    const othersReflection = data.dailyMetrics
      .filter(m => m.date === today && (!me || m.owner !== me) && (m.learning || m.topThree));

    const titleHtml = dashMode === 'mine' && me
      ? `📊 我的今日戰報 · ${escapeHtml(me)}`
      : `📊 團隊今日戰報 · ${today}`;

    const html = `
      <div class="view-header">
        <div>
          <h2 class="view-title">${titleHtml}</h2>
          <p class="view-subtitle">晨間規劃 → 午間執行 → 傍晚復盤 · 量化指標即時更新</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <div class="seg" id="dashModeSeg">
            <button class="seg-btn ${dashMode === 'team' ? 'active' : ''}" data-mode="team">👥 團隊</button>
            <button class="seg-btn ${dashMode === 'mine' ? 'active' : ''}" data-mode="mine">🙋 我的</button>
          </div>
          <button class="btn-secondary" id="btnFillMetric">📈 填寫今日數據</button>
        </div>
      </div>

      ${needGuide ? `
        <div class="guide-banner">
          <div class="guide-text">
            <b>👋 歡迎使用鈦沅CRM作戰！</b>
            <span>先設定「你是哪位業務」，之後新增的客戶 / 聯絡人 / 商機 / 互動 / 任務都會自動掛上你的名字；戰報就能切換「我的 / 團隊」。</span>
          </div>
          <button class="btn-primary" id="btnGuideProfile">👤 設定身份</button>
        </div>
      ` : ''}

      <!-- ============= 新增：客戶拜訪紀錄流程 ============= -->
      ${renderOnboarding(sd)}
      ${renderVisitHeroCard(sd, today, visitStats)}
      ${renderUpcomingVisits(sd, today, upcomingVisits)}

      <h3 style="font-size:14px;margin-bottom:12px;color:var(--text-secondary);">🔥 活動量指標 <span style="font-weight:400;color:var(--text-muted);">${dashMode === 'mine' ? '（只看我自己）' : '（全團隊合計）'}</span></h3>
      <div class="stats-grid">
        ${renderActivityCard('今日撥打量', todayMetrics.callCount || 0, todayMetrics.targetCall || 15, '通', 'info')}
        ${renderActivityCard('今日拜訪量', todayMetrics.visitCount || 0, todayMetrics.targetVisit || 5, '次', 'purple')}
        ${renderActivityCard('今日新增潛客', todayMetrics.newLeads || 0, 1, '個', 'success', true)}
        ${renderActivityCard('今日有效對話', todayMetrics.effectiveTalks || 0, todayMetrics.contactCount || 10, '通', 'warning')}
      </div>

      <h3 style="font-size:14px;margin-bottom:12px;color:var(--text-secondary); margin-top:24px;">🎯 轉化率透視</h3>
      <div class="stats-grid">
        ${renderRateCard('接觸→對話', stats.talkRate, 20, '低於 20% 需檢討開場白')}
        ${renderRateCard('對話→成交', stats.closeRate, null, '本月成交轉化率')}
        ${renderRateCard('整體推進率', stats.advanceRate, null, '商機往前階段推進的比例')}
        ${renderRateCard('贏率', stats.winRate, null, '歷史已成交 / (已成交 + 已失敗)')}
      </div>

      <div class="dashboard-row" style="margin-top:24px;">
        <div class="list-card">
          <h3>🔥 今日必推進（按熱度指數排序） <span class="badge">${stats.topDeals.length}</span></h3>
          ${stats.topDeals.length === 0 ? '<div class="empty" style="padding:30px 10px;"><div class="empty-icon">🎉</div><div class="empty-text">目前沒有進行中的商機</div></div>' : ''}
          ${stats.topDeals.slice(0, 5).map(d => {
            const company = sd.companies.find(c => c.id === d.companyId);
            const daysLeft = d.dueDate ? Math.ceil((new Date(d.dueDate) - new Date()) / (1000*60*60*24)) : null;
            return `
              <div class="list-item" data-deal-id="${d.id}">
                <div class="list-item-title">
                  <span class="stage-badge stage-${d.stage}">${Store.STAGE_MAP[d.stage]?.name}</span>
                  ${escapeHtml(d.name)}
                </div>
                <div class="list-item-meta">
                  ${escapeHtml(company?.name || '未綁定客戶')} · 👤 ${escapeHtml(d.owner || '未指派')} · ${d.prob}%
                  ${daysLeft !== null ? (daysLeft >= 0 ? ` · 剩 ${daysLeft} 天` : ` · <span style="color:var(--danger);">逾期 ${Math.abs(daysLeft)} 天</span>`) : ''}
                  · <span style="color:var(--warning);">🔥 ${d.heat.score}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="list-card">
          <h3>⏰ 今日截止任務 <span class="badge">${stats.todayTasks.length}</span></h3>
          ${stats.todayTasks.length === 0 ? '<div class="empty" style="padding:30px 10px;"><div class="empty-icon">✅</div><div class="empty-text">今日無截止任務</div></div>' : ''}
          ${stats.todayTasks.slice(0, 5).map(t => {
            const deal = sd.deals.find(d => d.id === t.dealId);
            return `
              <div class="list-item">
                <div class="list-item-title">
                  <span class="task-priority ${t.priority}">${t.priority}</span>
                  ${t.status === 'completed' ? '✅ ' : ''}${escapeHtml(t.title)}
                </div>
                <div class="list-item-meta">
                  ${deal ? escapeHtml(deal.name) : '未綁定商機'} · 👤 ${escapeHtml(t.owner || '未指派')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="dashboard-row">
        <div class="list-card">
          <h3>📞 最後互動排行（最近聯絡的客戶）</h3>
          ${stats.recentActivities.length === 0 ? '<div class="empty" style="padding:30px 10px;"><div class="empty-icon">💬</div><div class="empty-text">尚無互動紀錄</div></div>' : ''}
          ${stats.recentActivities.slice(0, 5).map(a => {
            const deal = sd.deals.find(d => d.id === a.dealId);
            const company = deal ? sd.companies.find(c => c.id === deal.companyId) : null;
            return `
              <div class="list-item">
                <div class="list-item-title">
                  ${a.method} · ${a.type}
                </div>
                <div class="list-item-meta">
                  ${escapeHtml(deal?.name || '')} · ${escapeHtml(company?.name || '')} · 👤 ${escapeHtml(a.owner || '未指派')} · ${a.date}
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${escapeHtml(a.summary || '')}</div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="list-card">
          <h3>💵 管線金額分布</h3>
          ${stats.stageTotals.length === 0 ? '<div class="empty" style="padding:30px 10px;"><div class="empty-icon">📊</div><div class="empty-text">無資料</div></div>' : ''}
          <div class="bar-chart">
            ${stats.stageTotals.map(s => `
              <div class="bar-row">
                <span><span class="stage-badge stage-${s.key}">${s.name}</span></span>
                <div class="bar-track">
                  <div class="bar-fill" style="width:${s.pct}%;background:${s.color};">${s.count} 筆</div>
                </div>
                <span style="text-align:right;font-weight:600;color:var(--success);">${(s.amount / 10000).toFixed(0)}萬</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="card mt-3">
        <div class="card-title">🌅 夕會復盤強制欄位 <span style="font-size:11px;color:var(--text-muted);font-weight:400;">（每日 18:00 後填寫，儲存後掛在自己名下）</span></div>

        ${othersReflection.length > 0 ? `
          <div style="margin-bottom:16px;">
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">🤝 同事今日已填：</div>
            ${othersReflection.map(o => `
              <div style="padding:8px 12px;background:var(--bg-secondary);border-radius:6px;margin-bottom:6px;font-size:12px;border-left:3px solid var(--accent);">
                <b>👤 ${escapeHtml(o.owner)}</b>
                ${o.learning ? `<div style="color:var(--text-secondary);margin-top:2px;">💡 ${escapeHtml(o.learning)}</div>` : ''}
                ${o.topThree ? `<div style="color:var(--text-muted);margin-top:2px;white-space:pre-line;">🎯 ${escapeHtml(o.topThree)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${!me ? `
          <div class="guide-banner" style="margin-bottom:4px;">
            <div class="guide-text"><b>設定身份後才能填寫每日復盤</b><span>選擇你是哪位業務，復盤內容會記錄在該業務名下。</span></div>
            <button class="btn-primary" id="btnReflectProfile">👤 設定身份</button>
          </div>
        ` : `
          <p class="muted" style="font-size:12px;margin-bottom:12px;">以 <b>${escapeHtml(me)}</b> 的身份填寫今日學習 + 明日三個首要目標（建議手機拍照存證）。</p>
          <div class="form-grid">
            <div class="form-field">
              <label>今日最大學習點</label>
              <textarea id="metricLearning" placeholder="今天最大的收穫是什麼？">${escapeHtml(todayMetrics.learning || '')}</textarea>
            </div>
            <div class="form-field">
              <label>明日三個首要目標</label>
              <textarea id="metricTopThree" placeholder="1. ...\n2. ...\n3. ...">${escapeHtml(todayMetrics.topThree || '')}</textarea>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-primary" id="btnSaveReflection">💾 儲存我的復盤</button>
          </div>
        `}
      </div>
    `;

    document.getElementById('mainView').innerHTML = html;
    bindEvents();
  };

  const calcStats = (data, todayMetrics, monthPrefix, today) => {
    // 今日必推進（按熱度排序）
    const topDeals = Store.dealsByHeat(data);

    // 今日截止任務
    const todayTasks = data.tasks
      .filter(t => t.dueDate === today && t.status !== 'completed')
      .sort((a, b) => {
        const order = { P1: 0, P2: 1, P3: 2 };
        return (order[a.priority] || 9) - (order[b.priority] || 9);
      });

    // 最近互動
    const recentActivities = [...data.activities]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    // 接觸→對話轉化率
    const contactCount = todayMetrics.contactCount || 0;
    const effectiveTalks = todayMetrics.effectiveTalks || 0;
    const talkRate = contactCount > 0 ? Math.round((effectiveTalks / contactCount) * 100) : 0;

    // 對話→成交（本月，依 dailyMetrics 累計，避免重複加當天）
    const monthMetrics = data.dailyMetrics.filter(m => m.date && m.date.startsWith(monthPrefix));
    const monthClosed = monthMetrics.reduce((sum, m) => sum + (m.closedToday || 0), 0);
    const monthTalks = monthMetrics.reduce((sum, m) => sum + (m.effectiveTalks || 0), 0);
    const closeRate = monthTalks > 0 ? Math.round((monthClosed / monthTalks) * 100) : 0;

    // 贏率
    const wonCount = data.deals.filter(d => d.stage === 'won').length;
    const lostCount = data.deals.filter(d => d.stage === 'lost').length;
    const winRate = (wonCount + lostCount) > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;

    // 推進率：商機位於報價以後階段的比例
    const activeDeals = data.deals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
    const advancedDeals = activeDeals.filter(d => ['quote', 'negotiation'].includes(d.stage));
    const advanceRate = activeDeals.length > 0 ? Math.round((advancedDeals.length / activeDeals.length) * 100) : 0;

    // 管線金額分布
    const stageTotals = Store.PIPELINE_STAGES
      .filter(s => s.key !== 'lost')
      .map(s => {
        const deals = data.deals.filter(d => d.stage === s.key);
        return {
          key: s.key,
          name: s.name,
          color: s.color,
          count: deals.length,
          amount: deals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
        };
      })
      .filter(s => s.count > 0);
    const maxAmount = Math.max(...stageTotals.map(s => s.amount), 1);
    stageTotals.forEach(s => { s.pct = Math.round((s.amount / maxAmount) * 100); });

    return { topDeals, todayTasks, recentActivities, talkRate, closeRate, winRate, advanceRate, stageTotals, visitStats };
  };

  // ===== 拜訪紀錄統計（今日/昨日/本週/本月/應拜訪）=====
  const calcVisitStats = (data, today) => {
    const todayD = new Date(today);
    const yesterdayD = new Date(todayD); yesterdayD.setDate(yesterdayD.getDate() - 1);
    const yesterdayStr = localDateStr(1);
    const weekAgoD = new Date(todayD); weekAgoD.setDate(weekAgoD.getDate() - 7);
    const monthPrefix = today.slice(0, 7);

    // 「拜訪」定義：互動方式 = 當面拜訪 或 視訊會議（業務外出到客戶現場）
    const isVisitAct = (a) => a.method === '當面拜訪' || a.type === '拜訪';

    // 取「每日去過的客戶數」：按日期分組去重 companyId
    const visitedCompaniesByDate = new Map();
    data.activities.forEach(a => {
      if (!isVisitAct(a)) return;
      const deal = data.deals.find(d => d.id === a.dealId);
      const companyId = deal?.companyId;
      if (!companyId) return;
      if (!visitedCompaniesByDate.has(a.date)) visitedCompaniesByDate.set(a.date, new Set());
      visitedCompaniesByDate.get(a.date).add(companyId);
    });

    const todayVisited = visitedCompaniesByDate.get(today)?.size || 0;
    const yesterdayVisited = visitedCompaniesByDate.get(yesterdayStr)?.size || 0;
    const weekVisited = [...visitedCompaniesByDate.entries()]
      .filter(([d]) => new Date(d) >= weekAgoD)
      .reduce((s, [, set]) => s + set.size, 0);
    const monthVisited = [...visitedCompaniesByDate.entries()]
      .filter(([d]) => d.startsWith(monthPrefix))
      .reduce((s, [, set]) => s + set.size, 0);

    // 今日拜訪次數（activities）
    const todayVisitCount = data.activities.filter(a => a.date === today && isVisitAct(a)).length;

    // 應拜訪家數 = 客戶總數 − 今日已拜訪（引導業務把今日客戶都走一遍）
    const totalCompanies = data.companies.length;
    const pendingVisit = Math.max(0, totalCompanies - todayVisited);

    return { todayVisited, yesterdayVisited, weekVisited, monthVisited, todayVisitCount, pendingVisit, totalCompanies };
  };

  // ===== 應拜訪客戶清單（按上次拜訪距今排序：紅 > 黃 > 綠 > 灰）=====
  const stageRank = (key) => Store.PIPELINE_STAGES.findIndex(s => s.key === key);
  const calcUpcomingVisits = (data, today) => {
    const todayD = new Date(today);
    return data.companies.map(co => {
      const deals = data.deals.filter(d => d.companyId === co.id);
      const dealIds = deals.map(d => d.id);
      const contacts = data.contacts.filter(c => c.companyId === co.id);
      const acts = data.activities
        .filter(a => dealIds.includes(a.dealId))
        .sort((a, b) => b.date.localeCompare(a.date));
      const lastDate = acts[0]?.date || null;
      const daysSince = lastDate ? Math.max(0, Math.floor((todayD - new Date(lastDate)) / 86400000)) : null;

      const topDeal = deals
        .filter(d => d.stage !== 'lost')
        .sort((a, b) => stageRank(b.stage) - stageRank(a.stage))[0];

      const lamp = daysSince === null ? 'gray' : daysSince > 14 ? 'red' : daysSince >= 7 ? 'yellow' : 'green';

      return { company: co, contacts, topDeal, lastDate, daysSince, lamp, contactCount: contacts.length };
    })
    .sort((a, b) => {
      const order = { red: 0, yellow: 1, gray: 2, green: 3 };
      const o = order[a.lamp] - order[b.lamp];
      return o !== 0 ? o : ((b.daysSince ?? 9999) - (a.daysSince ?? 9999));
    });
  };

  // ===== 📞 拜訪戰報 Hero Card（首頁最上方亮點區塊）=====
  const renderVisitHeroCard = (data, today, stats) => {
    const me = Store.me();
    if (data.companies.length === 0) return '';
    return `
      <div class="visit-hero">
        <div class="visit-hero-head">
          <div>
            <div class="visit-hero-title">📞 客戶拜訪紀錄 · 今日戰報</div>
            <div class="visit-hero-sub">建議每個客戶每 7–14 天拜訪一次 — 久沒拜訪的客戶容易流失</div>
          </div>
          <button class="btn-primary" id="btnQuickVisit" ${data.deals.length === 0 ? 'disabled title="請先建立商機"' : ''}>📞 記錄今日拜訪</button>
        </div>
        <div class="visit-hero-grid">
          <div class="vh-cell"><div class="vh-label">今日已拜訪</div><div class="vh-val">${stats.todayVisited}<span class="vh-unit">/ ${stats.totalCompanies} 家</span></div></div>
          <div class="vh-cell"><div class="vh-label">昨日已拜訪</div><div class="vh-val">${stats.yesterdayVisited}<span class="vh-unit">家</span></div></div>
          <div class="vh-cell"><div class="vh-label">本週已拜訪</div><div class="vh-val">${stats.weekVisited}<span class="vh-unit">家</span></div></div>
          <div class="vh-cell"><div class="vh-label">本月已拜訪</div><div class="vh-val">${stats.monthVisited}<span class="vh-unit">家</span></div></div>
          <div class="vh-cell ${stats.pendingVisit > 0 ? 'vh-warn' : 'vh-ok'}">
            <div class="vh-label">今日待拜訪</div>
            <div class="vh-val">${stats.pendingVisit}<span class="vh-unit">家</span></div>
          </div>
        </div>
      </div>
    `;
  };

  // ===== 🚦 應拜訪客戶清單 =====
  const lampEmoji = { red: '🔴', yellow: '🟡', green: '🟢', gray: '⚪' };
  const lampLabel = { red: '>14 天未拜訪', yellow: '7–14 天', green: '7 天內', gray: '從未拜訪' };
  const renderUpcomingVisits = (data, today, list) => {
    if (data.companies.length === 0) return '';
    const top = list.slice(0, 8);
    return `
      <div class="card visit-list-card mt-3">
        <div class="card-title">
          🚦 應拜訪客戶清單 <span style="font-size:11px;color:var(--text-muted);font-weight:400;">紅燈 >14 天 / 黃燈 7–14 天 / 綠燈 <7 天 / 灰 = 從未拜訪</span>
        </div>
        ${top.length === 0 ? '<div class="empty" style="padding:24px;"><div class="empty-icon">🏢</div><div class="empty-text">尚無客戶資料</div></div>' : ''}
        <div class="visit-list">
          ${top.map(item => {
            const stageInfo = item.topDeal ? Store.STAGE_MAP[item.topDeal.stage] : null;
            return `
              <div class="visit-row lamp-${item.lamp}">
                <div class="visit-lamp" title="${lampLabel[item.lamp]}">${lampEmoji[item.lamp]}</div>
                <div class="visit-info">
                  <div class="visit-info-title">
                    ${escapeHtml(item.company.name)}
                    ${stageInfo ? `<span class="stage-badge stage-${item.topDeal.stage}" style="margin-left:6px;">${stageInfo.name}</span>` : '<span style="font-size:11px;color:var(--text-muted);margin-left:6px;">無商機</span>'}
                    ${item.contactCount > 0 ? `<span class="owner-tag" style="margin-left:6px;">${item.contactCount} 位聯絡人</span>` : ''}
                  </div>
                  <div class="visit-info-meta">
                    👤 ${escapeHtml(item.company.owner || '未指派')}
                    · 上次互動：${item.lastDate ? `${item.lastDate}（${item.daysSince === 0 ? '今天' : item.daysSince + ' 天前'}）` : '從未拜訪'}
                    ${item.topDeal ? ` · 推進金額 <b style="color:var(--success);">NT$ ${(item.topDeal.amount || 0).toLocaleString()}</b>` : ''}
                  </div>
                </div>
                <button class="visit-action" data-action="record-visit" data-deal-id="${item.topDeal?.id || ''}" data-company-id="${item.company.id}" ${!item.topDeal ? 'disabled title="需先建立商機"' : ''}>
                  📞 記錄拜訪
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  // ===== 🎬 客戶拜訪 4 步流程引導（資料很少時顯示）=====
  const renderOnboarding = (data) => {
    if (data.companies.length >= 3) return ''; // 已上手，不打擾
    const me = Store.me();
    const steps = [
      {
        no: 1, icon: '🏢', title: '建立第一個客戶',
        done: data.companies.length > 0,
        action: () => Companies.openForm()
      },
      {
        no: 2, icon: '👤', title: '新增該客戶的聯絡人',
        done: data.companies.length > 0 && data.contacts.length > 0,
        action: () => Contacts.openForm()
      },
      {
        no: 3, icon: '💰', title: '為客戶建立商機（金額 + 階段）',
        done: data.deals.length > 0,
        action: () => Deals.openForm()
      },
      {
        no: 4, icon: '📞', title: '記錄第一次拜訪（互動紀錄）',
        done: data.activities.some(a => a.method === '當面拜訪' || a.type === '拜訪'),
        action: () => Activities.openForm(null, null, { type: '拜訪', method: '當面拜訪', owner: me || '' })
      }
    ];
    const doneCount = steps.filter(s => s.done).length;
    const pct = Math.round((doneCount / steps.length) * 100);
    return `
      <div class="onboard-card">
        <div class="onboard-head">
          <div>
            <div class="onboard-title">🎬 客戶拜訪紀錄 4 步流程</div>
            <div class="onboard-sub">完成 4 步就能正式啟用拜訪戰報，業務每天到首頁依此流程執行即可</div>
          </div>
          <div class="onboard-progress">
            <div class="onboard-progress-text">${doneCount}/${steps.length} 已完成（${pct}%）</div>
            <div class="onboard-progress-bar"><span style="width:${pct}%;"></span></div>
          </div>
        </div>
        <div class="onboard-steps">
          ${steps.map(s => `
            <div class="onboard-step ${s.done ? 'done' : ''}">
              <div class="onboard-step-no">${s.done ? '✓' : s.no}</div>
              <div class="onboard-step-body">
                <div class="onboard-step-icon">${s.icon}</div>
                <div class="onboard-step-text">
                  <div class="onboard-step-title">${s.title}</div>
                  <div class="onboard-step-sub">${s.done ? '已完成 — 繼續保持' : '點右側按鈕開始'}</div>
                </div>
              </div>
              ${s.done ? '<span class="onboard-step-check">✅</span>' : `<button class="btn-secondary onboard-go" data-step="${s.no}">點此執行 →</button>`}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  const renderActivityCard = (label, current, target, unit, variant, isMin = false) => {
    const pct = isMin
      ? Math.min(100, (current / target) * 100)
      : Math.min(100, (current / target) * 100);
    const ok = current >= target;
    return `
      <div class="stat-card ${variant}">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${current} <span style="font-size:14px;color:var(--text-muted);">/ ${target} ${unit}</span></div>
        <div class="stat-target">${ok ? '✅ 已達標' : `差距 ${target - current} ${unit}`}</div>
        <div class="stat-progress">
          <div class="stat-progress-bar ${variant}" style="width:${pct}%;"></div>
        </div>
      </div>
    `;
  };

  const renderRateCard = (label, value, threshold, hint) => {
    const color = threshold != null ? (value < threshold ? 'danger' : 'success') : 'info';
    return `
      <div class="stat-card ${color}">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}%</div>
        <div class="stat-target">${hint}</div>
        <div class="stat-progress">
          <div class="stat-progress-bar ${color}" style="width:${Math.min(100, value)}%;"></div>
        </div>
      </div>
    `;
  };

  const bindEvents = () => {
    document.getElementById('btnFillMetric')?.addEventListener('click', () => Metrics.openForm());
    document.getElementById('btnSaveReflection')?.addEventListener('click', saveReflection);
    document.getElementById('btnGuideProfile')?.addEventListener('click', () => App.openModal('profileModal'));
    document.getElementById('btnReflectProfile')?.addEventListener('click', () => App.openModal('profileModal'));
    document.querySelectorAll('#dashModeSeg .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === 'mine' && !Store.me()) {
          App.toast('請先設定你的身份（右上角 👤）', 'warning');
          App.openModal('profileModal');
          return;
        }
        Store.setDashMode(mode);
        render();
      });
    });
    document.querySelectorAll('.list-item[data-deal-id]').forEach(el => {
      el.addEventListener('click', () => Deals.openDetail(el.dataset.dealId));
    });

    // 一鍵記錄今日拜訪
    document.getElementById('btnQuickVisit')?.addEventListener('click', () => {
      Activities.openForm(null, null, { type: '拜訪', method: '當面拜訪', owner: Store.me() || '' });
    });

    // 應拜訪清單的「記錄拜訪」按鈕
    document.querySelectorAll('.visit-action[data-action="record-visit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dealId = btn.dataset.dealId;
        if (!dealId) {
          App.toast('此客戶尚無商機，請先建立商機', 'warning');
          Deals.openForm();
          return;
        }
        Activities.openForm(null, dealId, { type: '拜訪', method: '當面拜訪', owner: Store.me() || '' });
      });
    });

    // 4 步引導按鈕
    document.querySelectorAll('.onboard-go').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const step = btn.dataset.step;
        const me = Store.me();
        if (step === '1') Companies.openForm();
        else if (step === '2') Contacts.openForm();
        else if (step === '3') Deals.openForm();
        else if (step === '4') Activities.openForm(null, null, { type: '拜訪', method: '當面拜訪', owner: me || '' });
      });
    });
  };

  const saveReflection = () => {
    const me = Store.me();
    if (!me) {
      App.toast('請先設定身份，再儲存復盤', 'warning');
      App.openModal('profileModal');
      return;
    }
    const data = Store.load();
    const today = localDateStr(0);
    let metric = data.dailyMetrics.find(m => m.date === today && m.owner === me);
    if (!metric) {
      metric = {
        id: Store.uid('mt'),
        date: today,
        owner: me,
        contactCount: 0,
        effectiveTalks: 0,
        newLeads: 0,
        callCount: 0,
        visitCount: 0,
        closedToday: 0,
        targetCall: 15,
        targetVisit: 5,
        createdAt: new Date().toISOString()
      };
      data.dailyMetrics.push(metric);
    }
    metric.learning = document.getElementById('metricLearning').value;
    metric.topThree = document.getElementById('metricTopThree').value;
    Store.save(data);
    Sync.broadcast(data);
    App.toast('已儲存今日復盤', 'success');
  };

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  return { render };
})();

window.Dashboard = Dashboard;
