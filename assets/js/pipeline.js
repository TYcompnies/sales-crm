/**
 * Pipeline - 銷售管線視圖（看板）
 */

const Pipeline = (() => {

  const render = () => {
    const data = Store.load();
    const html = `
      <div class="view-header">
        <div>
          <h2 class="view-title">🚦 銷售管線看板</h2>
          <p class="view-subtitle">拖曳或點擊卡片管理商機進度 · 顏色標記對應階段定義 · 成交機率自動同步</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" id="btnAddDeal">＋ 新增商機</button>
        </div>
      </div>

      <div class="pipeline-board" id="pipelineBoard">
        ${Store.PIPELINE_STAGES.map(stage => renderColumn(data, stage)).join('')}
      </div>

      <div class="card mt-3" style="margin-top:24px;">
        <div class="card-title">📋 階段定義與過關條件</div>
        <table class="table">
          <thead>
            <tr><th>階段</th><th>成交機率</th><th>顏色</th><th>過關條件</th></tr>
          </thead>
          <tbody>
            ${Store.PIPELINE_STAGES.map(s => `
              <tr>
                <td><span class="stage-badge stage-${s.key}">${s.name}</span></td>
                <td class="num">${s.prob}%</td>
                <td><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${s.color};vertical-align:middle;"></span> <code style="font-size:11px;">${s.color}</code></td>
                <td style="font-size:12px;color:var(--text-secondary);">${s.definition}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('mainView').innerHTML = html;
    bindEvents();
  };

  const renderColumn = (data, stage) => {
    const deals = data.deals.filter(d => d.stage === stage.key);
    const totalAmount = deals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    return `
      <div class="pipeline-col" data-stage="${stage.key}">
        <div class="pipeline-col-header">
          <span class="pipeline-col-name" style="color:${stage.color};">${stage.name}</span>
          <span class="pipeline-col-count">${deals.length}</span>
        </div>
        ${deals.length === 0 ? '<div class="empty" style="padding:30px 10px;"><div class="empty-icon">📭</div><div class="empty-text">尚無商機</div></div>' : ''}
        ${deals.map(d => renderCard(d, data)).join('')}
        ${deals.length > 0 ? `
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);font-size:11px;color:var(--text-muted);text-align:right;">
            小計：<b style="color:var(--success);">NT$ ${totalAmount.toLocaleString()}</b>
          </div>
        ` : ''}
      </div>
    `;
  };

  const renderCard = (deal, data) => {
    const company = data.companies.find(c => c.id === deal.companyId);
    const heat = Store.calcHeat(deal);
    const daysLeft = deal.dueDate ? Math.ceil((new Date(deal.dueDate) - new Date()) / (1000*60*60*24)) : null;
    return `
      <div class="pipeline-card" data-stage="${deal.stage}" data-deal-id="${deal.id}">
        <div class="pipeline-card-title">${escapeHtml(deal.name)}</div>
        <div class="pipeline-card-meta">
          ${escapeHtml(company?.name || '未綁定客戶')} · ${deal.prob}%
          ${daysLeft !== null ? ` · ${daysLeft >= 0 ? `剩 ${daysLeft} 天` : `<span style="color:var(--danger);">逾期 ${Math.abs(daysLeft)} 天</span>`}` : ''}
        </div>
        <div>
          <span class="pipeline-card-amount">NT$ ${(deal.amount || 0).toLocaleString()}</span>
          <span class="pipeline-card-heat" title="熱度指數：${heat.score}/100">🔥 ${heat.score}</span>
        </div>
      </div>
    `;
  };

  const bindEvents = () => {
    document.getElementById('btnAddDeal')?.addEventListener('click', () => Deals.openForm());

    document.querySelectorAll('.pipeline-card').forEach(el => {
      el.addEventListener('click', () => {
        const dealId = el.dataset.dealId;
        Deals.openDetail(dealId);
      });
    });
  };

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  return { render };
})();

window.Pipeline = Pipeline;