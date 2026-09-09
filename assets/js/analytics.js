/**
 * Analytics - 高階管理視角（漏斗、週期、團隊績效）
 */

const Analytics = (() => {

  const render = () => {
    const data = Store.load();

    // === 1. 銷售漏斗 ===
    const funnel = Store.PIPELINE_STAGES
      .filter(s => s.key !== 'lost')
      .map(s => {
        const deals = data.deals.filter(d => d.stage === s.key);
        return {
          key: s.key,
          name: s.name,
          color: s.color,
          count: deals.length,
          amount: deals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
          prob: s.prob
        };
      });
    const maxCount = Math.max(...funnel.map(f => f.count), 1);
    const totalActiveAmount = data.deals
      .filter(d => d.stage !== 'won' && d.stage !== 'lost')
      .reduce((sum, d) => sum + (d.amount || 0) * (d.prob || 0) / 100, 0);

    // 漏斗警示
    const needsWarnings = [];
    if (funnel.find(f => f.key === 'contact').count > 0 && funnel.find(f => f.key === 'quote').count === 0) {
      needsWarnings.push('「方案報價」階段商機數為 0，可能需求挖掘不足，建議加強 Demo 技巧培訓。');
    }
    if (funnel.find(f => f.key === 'needs').count > funnel.find(f => f.key === 'quote').count * 2) {
      needsWarnings.push('「需求確認」階段商機遠多於「方案報價」，需求挖掘→報價轉化率偏低。');
    }

    // === 2. 平均成交週期 ===
    const wonDeals = data.deals.filter(d => d.stage === 'won');
    const lostDeals = data.deals.filter(d => d.stage === 'lost');
    const avgWinDays = wonDeals.length > 0
      ? Math.round(wonDeals.reduce((sum, d) => {
          const start = new Date(d.createdAt);
          const end = new Date(d.lastDate || d.dueDate || new Date());
          return sum + Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
        }, 0) / wonDeals.length)
      : 0;
    const avgLossDays = lostDeals.length > 0
      ? Math.round(lostDeals.reduce((sum, d) => {
          const start = new Date(d.createdAt);
          const end = new Date(d.lastDate || d.dueDate || new Date());
          return sum + Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
        }, 0) / lostDeals.length)
      : 0;

    // === 3. 團隊績效 ===
    const owners = [...new Set([
      ...data.deals.map(d => d.owner),
      ...data.tasks.map(t => t.owner),
      ...data.dailyMetrics.map(m => m.owner)
    ].filter(Boolean))];
    const teamPerf = owners.map(owner => {
      const deals = data.deals.filter(d => d.owner === owner);
      const won = deals.filter(d => d.stage === 'won').length;
      const lost = deals.filter(d => d.stage === 'lost').length;
      const tasks = data.tasks.filter(t => t.owner === owner);
      const activities = data.activities.filter(a => {
        const deal = data.deals.find(d => d.id === a.dealId);
        return deal?.owner === owner;
      });
      const metrics = data.dailyMetrics.filter(m => m.owner === owner);
      const totalCalls = metrics.reduce((sum, m) => sum + (m.callCount || 0), 0);
      const totalVisits = metrics.reduce((sum, m) => sum + (m.visitCount || 0), 0);
      return {
        owner,
        deals: deals.length,
        won,
        lost,
        conversionRate: (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0,
        activities: activities.length,
        tasks: tasks.filter(t => t.status === 'completed').length + ' / ' + tasks.length,
        calls: totalCalls,
        visits: totalVisits
      };
    }).sort((a, b) => b.won - a.won || b.conversionRate - a.conversionRate);

    // === 4. A+ 級客戶 ===
    const aPlusCompanies = data.companies
      .filter(c => (c.tags || []).includes('A+'))
      .map(c => {
        const deals = Store.dealsByCompany(data, c.id);
        return { ...c, dealCount: deals.length, dealAmount: deals.reduce((s, d) => s + (d.amount || 0), 0) };
      });

    const html = `
      <div class="view-header">
        <div>
          <h2 class="view-title">🧠 高階管理視角</h2>
          <p class="view-subtitle">銷售漏斗、成交週期、團隊績效對比 · 用於週會或月度策略調整</p>
        </div>
      </div>

      <div class="dashboard-row">
        <div class="list-card">
          <h3>📊 銷售漏斗分析</h3>
          ${needsWarnings.length > 0 ? `
            <div style="padding:10px 12px;background:rgba(239,68,68,.1);border-left:3px solid var(--danger);border-radius:6px;margin-bottom:12px;font-size:12px;">
              <b style="color:var(--danger);">⚠️ 警示：</b>
              <ul style="margin:6px 0 0 18px;">
                ${needsWarnings.map(w => `<li style="margin-bottom:4px;">${w}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          <div class="bar-chart">
            ${funnel.map(f => `
              <div class="bar-row">
                <span><span class="stage-badge stage-${f.key}">${f.name}</span></span>
                <div class="bar-track">
                  <div class="bar-fill" style="width:${(f.count / maxCount) * 100}%;background:${f.color};">
                    ${f.count > 0 ? `${f.count} 筆` : ''}
                  </div>
                </div>
                <span style="text-align:right;font-weight:600;color:var(--success);">
                  ${(f.amount / 10000).toFixed(0)}萬
                </span>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:14px;padding:12px;background:var(--bg-secondary);border-radius:6px;">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">💰 加權管線價值（機率×金額）</div>
            <div style="font-size:20px;font-weight:700;color:var(--success);">NT$ ${Math.round(totalActiveAmount).toLocaleString()}</div>
          </div>
        </div>

        <div class="list-card">
          <h3>⏱ 成交週期</h3>
          <div style="padding:14px 0;border-bottom:1px solid var(--border);">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">🏆 平均贏單週期</div>
            <div style="font-size:28px;font-weight:700;color:var(--success);">${avgWinDays} <span style="font-size:14px;color:var(--text-muted);">天</span></div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">基於 ${wonDeals.length} 筆成交</div>
          </div>
          <div style="padding:14px 0;border-bottom:1px solid var(--border);">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">❌ 平均輸單週期</div>
            <div style="font-size:28px;font-weight:700;color:var(--danger);">${avgLossDays} <span style="font-size:14px;color:var(--text-muted);">天</span></div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">基於 ${lostDeals.length} 筆失敗</div>
          </div>
          <div style="padding:14px 0;">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">📊 贏率</div>
            <div style="font-size:28px;font-weight:700;color:var(--info);">
              ${(wonDeals.length + lostDeals.length) > 0 ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100) : 0}%
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${wonDeals.length} 贏 / ${lostDeals.length} 輸</div>
          </div>
          ${avgWinDays > 60 ? '<div style="margin-top:8px;padding:10px;background:rgba(245,158,11,.1);border-left:3px solid var(--warning);border-radius:6px;font-size:12px;">⚠️ 平均成交週期偏長，建議檢查跟進頻率</div>' : ''}
        </div>
      </div>

      <div class="card mt-3">
        <div class="card-title">👥 團隊績效對比</div>
        ${teamPerf.length === 0 ? '<div class="muted" style="padding:20px;text-align:center;">尚無團隊資料</div>' : ''}
        <div class="table-wrap" style="border:none;">
          <table class="table">
            <thead>
              <tr>
                <th>業務</th>
                <th class="num">商機數</th>
                <th class="num">成交</th>
                <th class="num">失敗</th>
                <th class="num">贏率</th>
                <th class="num">互動紀錄</th>
                <th class="num">任務完成</th>
                <th class="num">累計撥打</th>
                <th class="num">累計拜訪</th>
              </tr>
            </thead>
            <tbody>
              ${teamPerf.map(p => `
                <tr>
                  <td><b>${escapeHtml(p.owner)}</b></td>
                  <td class="num">${p.deals}</td>
                  <td class="num"><span class="text-success">${p.won}</span></td>
                  <td class="num"><span class="text-danger">${p.lost}</span></td>
                  <td class="num"><b>${p.conversionRate}%</b></td>
                  <td class="num">${p.activities}</td>
                  <td class="num">${p.tasks}</td>
                  <td class="num">${p.calls}</td>
                  <td class="num">${p.visits}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <p class="muted" style="margin-top:12px;font-size:11px;">💡 客觀評估工作質量：互動紀錄數 + 贏率，而非單看運氣</p>
      </div>

      <div class="dashboard-row" style="margin-top:24px;">
        <div class="list-card">
          <h3>⭐ A+ 級客戶 <span class="badge">${aPlusCompanies.length}</span></h3>
          ${aPlusCompanies.length === 0 ? '<div class="muted" style="padding:20px;text-align:center;">尚未標記 A+ 級客戶</div>' : ''}
          ${aPlusCompanies.map(c => `
            <div class="list-item">
              <div class="list-item-title">
                ${escapeHtml(c.name)}
                <span class="list-item-amount">NT$ ${(c.dealAmount / 10000).toFixed(0)}萬</span>
              </div>
              <div class="list-item-meta">
                ${c.industry || '—'} · ${c.employeeCount ? c.employeeCount.toLocaleString() + ' 人' : ''} · ${c.region || ''} · ${c.dealCount} 筆商機
              </div>
            </div>
          `).join('')}
          <p class="muted" style="margin-top:8px;font-size:11px;">
            💡 A+ 規則：員工&gt;100人 AND 行業=高科技/金融 AND 職位=C-Level
          </p>
        </div>

        <div class="list-card">
          <h3>💸 贏單排行</h3>
          ${wonDeals.length === 0 ? '<div class="muted" style="padding:20px;text-align:center;">尚未成交</div>' : ''}
          ${[...wonDeals].sort((a, b) => (b.amount || 0) - (a.amount || 0)).map(d => {
            const c = data.companies.find(co => co.id === d.companyId);
            return `
              <div class="list-item">
                <div class="list-item-title">
                  ${escapeHtml(d.name)}
                  <span class="list-item-amount">NT$ ${(d.amount || 0).toLocaleString()}</span>
                </div>
                <div class="list-item-meta">${escapeHtml(c?.name || '—')} · ${d.prob}% · ${escapeHtml(d.owner || '—')}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="card mt-3">
        <div class="card-title">📋 系統設定執行清單</div>
        <table class="table">
          <tbody>
            <tr>
              <td>✅ 「有效溝通」定義標準</td>
              <td>通話時間 &gt; 2 分鐘 / Email 往來 &gt; 3 封</td>
              <td><span class="tag a-plus">已啟用</span></td>
            </tr>
            <tr>
              <td>✅ 「高潛力客戶」標籤規則</td>
              <td>員工&gt;100人 AND 行業=高科技/金融 AND 職位=C-Level → A+</td>
              <td><span class="tag a-plus">已啟用</span></td>
            </tr>
            <tr>
              <td>✅ 自動化跟進序列</td>
              <td>Day 1 / Day 3 / Day 7 / Day 14 預設腳本</td>
              <td><span class="tag a-plus">已啟用</span></td>
            </tr>
            <tr>
              <td>✅ 風險評估必填欄位</td>
              <td>客戶顧慮 / 競爭態勢 / 阻斷因子</td>
              <td><span class="tag a-plus">已啟用</span></td>
            </tr>
            <tr>
              <td>☐ 夕會復盤強制填寫</td>
              <td>每日 18:00 彈窗提醒</td>
              <td><span class="tag">瀏覽器通知需授權</span></td>
            </tr>
            <tr>
              <td>✅ 跨裝置雲端同步</td>
              <td>剪貼簿一鍵同步 / JSON 備份 / 微型連結</td>
              <td><span class="tag a-plus">已啟用</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('mainView').innerHTML = html;
  };

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  return { render };
})();

window.Analytics = Analytics;