/**
 * Dashboard - 今日戰報儀表板
 */

const Dashboard = (() => {

  const render = () => {
    const data = Store.load();
    const today = new Date().toISOString().slice(0, 10);
    const todayMetrics = data.dailyMetrics.find(m => m.date === today) || {};
    const monthPrefix = today.slice(0, 7);

    // 計算核心指標
    const stats = calcStats(data, todayMetrics, monthPrefix);

    const html = `
      <div class="view-header">
        <div>
          <h2 class="view-title">📊 今日戰報 · ${today}</h2>
          <p class="view-subtitle">晨間規劃 → 午間執行 → 傍晚復盤 · 量化指標即時更新</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" id="btnFillMetric">📈 填寫今日數據</button>
        </div>
      </div>

      <h3 style="font-size:14px;margin-bottom:12px;color:var(--text-secondary);">🔥 活動量指標</h3>
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
            const company = data.companies.find(c => c.id === d.companyId);
            const daysLeft = d.dueDate ? Math.ceil((new Date(d.dueDate) - new Date()) / (1000*60*60*24)) : null;
            return `
              <div class="list-item" data-deal-id="${d.id}">
                <div class="list-item-title">
                  <span class="stage-badge stage-${d.stage}">${Store.STAGE_MAP[d.stage]?.name}</span>
                  ${escapeHtml(d.name)}
                </div>
                <div class="list-item-meta">
                  ${escapeHtml(company?.name || '未綁定客戶')} · ${d.prob}%
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
            const deal = data.deals.find(d => d.id === t.dealId);
            return `
              <div class="list-item">
                <div class="list-item-title">
                  <span class="task-priority ${t.priority}">${t.priority}</span>
                  ${t.status === 'completed' ? '✅ ' : ''}${escapeHtml(t.title)}
                </div>
                <div class="list-item-meta">
                  ${deal ? escapeHtml(deal.name) : '未綁定商機'} · ${escapeHtml(t.owner || '未指派')}
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
            const deal = data.deals.find(d => d.id === a.dealId);
            const company = deal ? data.companies.find(c => c.id === deal.companyId) : null;
            return `
              <div class="list-item">
                <div class="list-item-title">
                  ${a.method} · ${a.type}
                </div>
                <div class="list-item-meta">
                  ${escapeHtml(deal?.name || '')} · ${escapeHtml(company?.name || '')} · ${a.date}
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
        <div class="card-title">🌅 夕會復盤強制欄位</div>
        <p class="muted" style="font-size:12px;margin-bottom:12px;">每日 18:00 後填寫今日學習 + 明日三個首要目標（建議手機拍照存證）。</p>
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
          <button class="btn-primary" id="btnSaveReflection">💾 儲存復盤</button>
        </div>
      </div>
    `;

    document.getElementById('mainView').innerHTML = html;
    bindEvents();
  };

  const calcStats = (data, todayMetrics, monthPrefix) => {
    // 今日必推進（按熱度排序）
    const topDeals = Store.dealsByHeat(data);

    // 今日截止任務
    const today = new Date().toISOString().slice(0, 10);
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

    // 對話→成交（本月）
    const monthDeals = data.activities.filter(a => a.date && a.date.startsWith(monthPrefix));
    const monthClosed = (todayMetrics.closedToday || 0) + data.dailyMetrics
      .filter(m => m.date.startsWith(monthPrefix))
      .reduce((sum, m) => sum + (m.closedToday || 0), 0);
    const monthTalks = data.dailyMetrics
      .filter(m => m.date.startsWith(monthPrefix))
      .reduce((sum, m) => sum + (m.effectiveTalks || 0), 0);
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

    return { topDeals, todayTasks, recentActivities, talkRate, closeRate, winRate, advanceRate, stageTotals };
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
    document.querySelectorAll('.list-item[data-deal-id]').forEach(el => {
      el.addEventListener('click', () => Deals.openDetail(el.dataset.dealId));
    });
  };

  const saveReflection = () => {
    const data = Store.load();
    const today = new Date().toISOString().slice(0, 10);
    let metric = data.dailyMetrics.find(m => m.date === today);
    if (!metric) {
      metric = {
        id: Store.uid('mt'),
        date: today,
        owner: '林業務',
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