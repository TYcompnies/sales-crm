/**
 * Deals - 商機管理（CRUD + 列表 + 詳情）
 */

const Deals = (() => {

  const render = () => {
    const data = Store.load();
    const deals = [...data.deals].map(d => ({ ...d, heat: Store.calcHeat(d) }))
      .sort((a, b) => b.heat.score - a.heat.score);

    const html = `
      <div class="view-header">
        <div>
          <h2 class="view-title">💰 商機管理</h2>
          <p class="view-subtitle">所有商機按熱度指數自動排序 · 點擊查看詳情 · 熱度 = 機率 × 金額 ÷ 剩餘天數</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" id="btnFilter">🔍 篩選</button>
          <button class="btn-primary" id="btnAddDeal">＋ 新增商機</button>
        </div>
      </div>

      <div class="filter-bar" id="filterBar" style="display:none;">
        <select id="filterStage">
          <option value="">全部階段</option>
          ${Store.PIPELINE_STAGES.map(s => `<option value="${s.key}">${s.name}</option>`).join('')}
        </select>
        <select id="filterOwner">
          <option value="">全部負責人</option>
          ${[...new Set(data.deals.map(d => d.owner).filter(Boolean))].map(o => `<option value="${o}">${escapeHtml(o)}</option>`).join('')}
        </select>
        <input type="text" id="filterSearch" placeholder="搜尋商機名稱 / 客戶 / 產品…">
        <button class="btn-secondary" id="btnClearFilter">清除</button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>熱度</th>
              <th>商機名稱</th>
              <th>客戶</th>
              <th>階段</th>
              <th class="num">金額</th>
              <th>機率</th>
              <th>截止日</th>
              <th>負責人</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="dealsTbody">
            ${renderRows(deals, data)}
          </tbody>
        </table>
      </div>

      ${deals.length === 0 ? '<div class="empty" style="margin-top:24px;"><div class="empty-icon">💼</div><div class="empty-text">點擊右上「新增商機」開始建立你的第一筆商機</div></div>' : ''}
    `;

    document.getElementById('mainView').innerHTML = html;
    bindEvents();
    bindFilters();
  };

  const renderRows = (deals, data) => {
    return deals.map(d => {
      const company = data.companies.find(c => c.id === d.companyId);
      const daysLeft = d.dueDate ? Math.ceil((new Date(d.dueDate) - new Date()) / (1000*60*60*24)) : null;
      return `
        <tr data-deal-id="${d.id}">
          <td>
            <div class="heat-cell">
              <div class="heat-bar"><div class="heat-fill" style="width:${d.heat.score}%;"></div></div>
              <span style="font-size:11px;color:var(--warning);font-weight:700;">${d.heat.score}</span>
            </div>
          </td>
          <td><b>${escapeHtml(d.name)}</b><br><span style="font-size:11px;color:var(--text-muted);">${escapeHtml(d.product || '')}</span></td>
          <td>${escapeHtml(company?.name || '未綁定')}</td>
          <td><span class="stage-badge stage-${d.stage}">${Store.STAGE_MAP[d.stage]?.name}</span></td>
          <td class="num"><b>${(d.amount || 0).toLocaleString()}</b></td>
          <td class="num">${d.prob}%</td>
          <td>${d.dueDate || '—'} ${daysLeft !== null ? (daysLeft >= 0 ? `<br><span style="font-size:11px;color:var(--text-muted);">剩 ${daysLeft} 天</span>` : `<br><span style="font-size:11px;color:var(--danger);">逾期</span>`) : ''}</td>
          <td>${escapeHtml(d.owner || '—')}</td>
          <td>
            <div class="row-actions">
              <button class="btn-icon" data-action="view" title="查看">👁</button>
              <button class="btn-icon" data-action="edit" title="編輯">✏️</button>
              <button class="btn-icon danger" data-action="del" title="刪除">🗑</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  const bindEvents = () => {
    document.getElementById('btnAddDeal')?.addEventListener('click', () => openForm());
    document.getElementById('btnFilter')?.addEventListener('click', () => {
      const bar = document.getElementById('filterBar');
      bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
    });

    document.querySelectorAll('#dealsTbody tr').forEach(tr => {
      const id = tr.dataset.dealId;
      tr.querySelector('[data-action="view"]').addEventListener('click', (e) => { e.stopPropagation(); openDetail(id); });
      tr.querySelector('[data-action="edit"]').addEventListener('click', (e) => { e.stopPropagation(); openForm(id); });
      tr.querySelector('[data-action="del"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await App.confirm('確定要刪除此商機？相關的互動紀錄與任務會一併移除。');
        if (ok) del(id);
      });
      tr.addEventListener('click', () => openDetail(id));
    });
  };

  const bindFilters = () => {
    const applyFilter = () => {
      const stage = document.getElementById('filterStage').value;
      const owner = document.getElementById('filterOwner').value;
      const search = document.getElementById('filterSearch').value.toLowerCase();
      const data = Store.load();
      let deals = [...data.deals];
      if (stage) deals = deals.filter(d => d.stage === stage);
      if (owner) deals = deals.filter(d => d.owner === owner);
      if (search) {
        deals = deals.filter(d => {
          const company = data.companies.find(c => c.id === d.companyId);
          return [d.name, d.product, company?.name].some(s => s && s.toLowerCase().includes(search));
        });
      }
      deals = deals.map(d => ({ ...d, heat: Store.calcHeat(d) }))
        .sort((a, b) => b.heat.score - a.heat.score);
      document.getElementById('dealsTbody').innerHTML = renderRows(deals, data);
      bindEvents();
    };

    document.getElementById('filterStage').addEventListener('change', applyFilter);
    document.getElementById('filterOwner').addEventListener('change', applyFilter);
    document.getElementById('filterSearch').addEventListener('input', applyFilter);
    document.getElementById('btnClearFilter').addEventListener('click', () => {
      document.getElementById('filterStage').value = '';
      document.getElementById('filterOwner').value = '';
      document.getElementById('filterSearch').value = '';
      applyFilter();
    });
  };

  // ===== 表單 =====
  const openForm = (dealId = null) => {
    const data = Store.load();
    const deal = dealId ? data.deals.find(d => d.id === dealId) : null;
    const isEdit = !!deal;

    const html = `
      <form id="dealForm" class="form-grid">
        <div class="form-field full">
          <label>商機名稱 *</label>
          <input name="name" required value="${escapeHtml(deal?.name || '')}" placeholder="例：5G基站散熱模組">
        </div>

        <div class="form-field">
          <label>綁定客戶 *</label>
          <select name="companyId" required>
            <option value="">— 選擇客戶 —</option>
            ${data.companies.map(c => `<option value="${c.id}" ${deal?.companyId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
          ${data.companies.length === 0 ? '<span class="hint" style="color:var(--warning);">⚠️ 請先到「客戶」頁籤建立客戶</span>' : ''}
        </div>

        <div class="form-field">
          <label>主要聯絡人</label>
          <select name="contactId">
            <option value="">— 選擇聯絡人 —</option>
            ${deal ? data.contacts.filter(c => c.companyId === deal.companyId).map(c => `<option value="${c.id}" ${deal?.contactId === c.id ? 'selected' : ''}>${escapeHtml(c.name)} · ${escapeHtml(c.position || '')}</option>`).join('') : ''}
          </select>
        </div>

        <div class="form-field">
          <label>產品 / 服務</label>
          <input name="product" value="${escapeHtml(deal?.product || '')}" placeholder="例：均熱板+風扇模組">
        </div>

        <div class="form-field">
          <label>競爭對手</label>
          <input name="competitor" value="${escapeHtml(deal?.competitor || '')}" placeholder="例：奇鋐科技">
        </div>

        <div class="form-field">
          <label>銷售階段 *</label>
          <select name="stage" required>
            ${Store.PIPELINE_STAGES.map(s => `<option value="${s.key}" ${deal?.stage === s.key ? 'selected' : ''}>${s.name}（${s.prob}%）</option>`).join('')}
          </select>
        </div>

        <div class="form-field">
          <label>成交機率 (%)</label>
          <input type="number" name="prob" min="0" max="100" value="${deal?.prob ?? 20}">
        </div>

        <div class="form-field">
          <label>預估成交金額</label>
          <input type="number" name="amount" min="0" value="${deal?.amount || 0}">
          <span class="hint">單位：NT$（預設）</span>
        </div>

        <div class="form-field">
          <label>預計成交日</label>
          <input type="date" name="dueDate" value="${deal?.dueDate || ''}">
        </div>

        <div class="form-field">
          <label>負責業務</label>
          <input name="owner" value="${escapeHtml(deal?.owner || '林業務')}">
        </div>

        <div class="form-field full">
          <label>客戶即時反饋</label>
          <textarea name="feedback" placeholder="對效能滿意，但要求提供3年保固…">${escapeHtml(deal?.feedback || '')}</textarea>
        </div>

        <div class="form-field">
          <label>客戶顧慮</label>
          <select name="concerns">
            <option value="">—</option>
            <option ${deal?.concerns === '價格過高' ? 'selected' : ''}>價格過高</option>
            <option ${deal?.concerns === '現有合約未到期' ? 'selected' : ''}>現有合約未到期</option>
            <option ${deal?.concerns === '內部決策者意見不合' ? 'selected' : ''}>內部決策者意見不合</option>
            <option ${deal?.concerns === '預算上限明確' ? 'selected' : ''}>預算上限明確</option>
            <option ${deal?.concerns === '內部阻力' ? 'selected' : ''}>內部阻力</option>
          </select>
        </div>

        <div class="form-field">
          <label>阻斷因子</label>
          <input name="riskFactor" value="${escapeHtml(deal?.riskFactor || '')}" placeholder="需高層授權特惠價…">
        </div>

        <div class="form-field full">
          <label>統一標籤（逗號分隔）</label>
          <input name="tags" value="${escapeHtml((deal?.tags || []).join(','))}" placeholder="例：高金額, 緊急, A+">
        </div>
      </form>

      <div class="form-actions">
        ${isEdit ? '<button class="btn-danger" id="btnFormDelete">🗑 刪除</button>' : ''}
        <button class="btn-secondary" data-close>取消</button>
        <button class="btn-primary" id="btnFormSave">${isEdit ? '💾 更新商機' : '✨ 建立商機'}</button>
      </div>
    `;

    document.getElementById('editModalTitle').textContent = isEdit ? '編輯商機' : '新增商機';
    document.getElementById('editModalBody').innerHTML = html;
    App.openModal('editModal');

    // 綁定聯絡人聯動
    document.querySelector('[name="companyId"]').addEventListener('change', (e) => {
      const companyId = e.target.value;
      const contactSelect = document.querySelector('[name="contactId"]');
      contactSelect.innerHTML = '<option value="">— 選擇聯絡人 —</option>' +
        data.contacts.filter(c => c.companyId === companyId).map(c =>
          `<option value="${c.id}">${escapeHtml(c.name)} · ${escapeHtml(c.position || '')}</option>`
        ).join('');
    });

    document.getElementById('btnFormSave').addEventListener('click', () => save(dealId));
    if (isEdit) {
      document.getElementById('btnFormDelete').addEventListener('click', async () => {
        const ok = await App.confirm('確定要刪除此商機？');
        if (ok) {
          App.closeModal('editModal');
          del(dealId);
        }
      });
    }
  };

  const save = (dealId) => {
    const form = document.getElementById('dealForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const fd = new FormData(form);
    const obj = Object.fromEntries(fd.entries());

    const data = Store.load();
    // 自動同步機率（基於階段）
    if (Store.STAGE_MAP[obj.stage]) {
      obj.prob = Number(obj.prob) || Store.STAGE_MAP[obj.stage].prob;
    }

    if (dealId) {
      const idx = data.deals.findIndex(d => d.id === dealId);
      if (idx >= 0) {
        data.deals[idx] = { ...data.deals[idx], ...obj, amount: Number(obj.amount), prob: Number(obj.prob), tags: obj.tags ? obj.tags.split(',').map(s => s.trim()).filter(Boolean) : [] };
      }
    } else {
      const newDeal = {
        id: Store.uid('dl'),
        ...obj,
        amount: Number(obj.amount),
        prob: Number(obj.prob),
        tags: obj.tags ? obj.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
        lastDate: new Date().toISOString().slice(0, 10),
        lastMethod: '—',
        lastType: '—',
        createdAt: new Date().toISOString()
      };
      data.deals.push(newDeal);
    }

    Store.save(data);
    Sync.broadcast(data);
    App.closeModal('editModal');
    App.toast(dealId ? '商機已更新' : '商機已建立', 'success');
    App.render();
  };

  const del = (dealId) => {
    const data = Store.load();
    data.deals = data.deals.filter(d => d.id !== dealId);
    data.activities = data.activities.filter(a => a.dealId !== dealId);
    data.tasks = data.tasks.filter(t => t.dealId !== dealId);
    Store.save(data);
    Sync.broadcast(data);
    App.toast('商機已刪除', 'success');
    App.render();
  };

  // ===== 詳情 =====
  const openDetail = (dealId) => {
    const data = Store.load();
    const deal = data.deals.find(d => d.id === dealId);
    if (!deal) return;

    const company = data.companies.find(c => c.id === deal.companyId);
    const contact = data.contacts.find(c => c.id === deal.contactId);
    const activities = Store.activitiesByDeal(data, dealId);
    const tasks = Store.tasksByDeal(data, dealId);
    const heat = Store.calcHeat(deal);
    const daysLeft = deal.dueDate ? Math.ceil((new Date(deal.dueDate) - new Date()) / (1000*60*60*24)) : null;

    const html = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px;">
            <div>
              <h3 style="font-size:18px;margin-bottom:4px;">${escapeHtml(deal.name)}</h3>
              <p class="muted">${escapeHtml(deal.product || '')}</p>
            </div>
            <span class="stage-badge stage-${deal.stage}" style="font-size:13px;padding:6px 14px;">${Store.STAGE_MAP[deal.stage]?.name}</span>
          </div>

          <table class="table">
            <tbody>
              <tr><td>客戶</td><td><b>${escapeHtml(company?.name || '未綁定')}</b></td></tr>
              <tr><td>聯絡人</td><td>${escapeHtml(contact?.name || '—')}（${escapeHtml(contact?.position || '—')}）</td></tr>
              <tr><td>預估金額</td><td class="num"><b style="color:var(--success);">NT$ ${(deal.amount || 0).toLocaleString()}</b></td></tr>
              <tr><td>成交機率</td><td>${deal.prob}%</td></tr>
              <tr><td>預計成交日</td><td>${deal.dueDate || '—'} ${daysLeft !== null ? (daysLeft >= 0 ? `（剩 ${daysLeft} 天）` : `（逾期 ${Math.abs(daysLeft)} 天）`) : ''}</td></tr>
              <tr><td>競爭對手</td><td>${escapeHtml(deal.competitor || '—')}</td></tr>
              <tr><td>負責業務</td><td>${escapeHtml(deal.owner || '—')}</td></tr>
              <tr><td>客戶顧慮</td><td>${escapeHtml(deal.concerns || '—')}</td></tr>
              <tr><td>阻斷因子</td><td>${escapeHtml(deal.riskFactor || '—')}</td></tr>
              <tr><td>熱度指數</td><td><span class="heat-bar"><span class="heat-fill" style="width:${heat.score}%;"></span></span> <b style="color:var(--warning);">${heat.score}/100</b></td></tr>
            </tbody>
          </table>

          ${deal.feedback ? `
            <div style="margin-top:14px;padding:12px;background:rgba(245,158,11,.1);border-left:3px solid var(--warning);border-radius:6px;">
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;">客戶即時反饋</div>
              <div style="font-size:13px;">${escapeHtml(deal.feedback)}</div>
            </div>
          ` : ''}
        </div>

        <div>
          <h4 style="font-size:13px;margin-bottom:10px;color:var(--text-secondary);">💬 互動時間軸（${activities.length}）</h4>
          ${activities.length === 0 ? '<div class="empty" style="padding:20px;"><div class="empty-text">尚無互動紀錄</div></div>' : ''}
          <div class="timeline">
            ${activities.slice(0, 8).map(a => `
              <div class="timeline-item">
                <div class="timeline-date">${a.date}</div>
                <div class="timeline-card">
                  <div class="timeline-title">${a.method} · ${a.type}</div>
                  <div class="timeline-content">${escapeHtml(a.summary || '')}</div>
                  ${a.feedback ? `<div class="timeline-feedback">💡 ${escapeHtml(a.feedback)}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>

          <h4 style="font-size:13px;margin:16px 0 10px;color:var(--text-secondary);">✅ 待辦任務（${tasks.length}）</h4>
          ${tasks.length === 0 ? '<div class="empty" style="padding:20px;"><div class="empty-text">尚無任務</div></div>' : ''}
          ${tasks.slice(0, 5).map(t => `
            <div class="task-item" data-priority="${t.priority}" style="margin-bottom:6px;">
              <div class="task-check ${t.status === 'completed' ? 'checked' : ''}">${t.status === 'completed' ? '✓' : ''}</div>
              <div class="task-content">
                <div class="task-title">${escapeHtml(t.title)}</div>
                <div class="task-meta">${t.dueDate || '無截止'} · ${escapeHtml(t.owner || '—')}</div>
              </div>
              <span class="task-priority ${t.priority}">${t.priority}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="form-actions">
        <button class="btn-secondary" id="btnAddActivity">＋ 記錄互動</button>
        <button class="btn-secondary" id="btnAddTask">＋ 新增任務</button>
        <button class="btn-primary" id="btnEditDeal">✏️ 編輯商機</button>
      </div>
    `;

    document.getElementById('editModalTitle').textContent = '商機詳情';
    document.getElementById('editModalBody').innerHTML = html;
    App.openModal('editModal');

    document.getElementById('btnEditDeal').addEventListener('click', () => openForm(dealId));
    document.getElementById('btnAddActivity').addEventListener('click', () => { App.closeModal('editModal'); Activities.openForm(null, dealId); });
    document.getElementById('btnAddTask').addEventListener('click', () => { App.closeModal('editModal'); Tasks.openForm(null, dealId); });
  };

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  return { render, openForm, openDetail };
})();

window.Deals = Deals;