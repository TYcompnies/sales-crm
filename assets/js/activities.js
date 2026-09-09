/**
 * Activities - 互動紀錄時間軸
 */

const Activities = (() => {

  const render = () => {
    const data = Store.load();
    const activities = [...data.activities].sort((a, b) => new Date(b.date) - new Date(a.date));

    const html = `
      <div class="view-header">
        <div>
          <h2 class="view-title">💬 互動紀錄</h2>
          <p class="view-subtitle">所有溝通時間軸 · 強制勾選顧慮、競爭、阻斷 · 共 ${activities.length} 筆</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-primary" id="btnAddActivity">＋ 記錄互動</button>
        </div>
      </div>

      <div class="filter-bar">
        <select id="filterOwner">
          <option value="">全部負責業務</option>
          ${Store.teamMembers(data).map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('')}
        </select>
        <select id="filterDeal">
          <option value="">全部商機</option>
          ${data.deals.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}
        </select>
        <select id="filterMethod">
          <option value="">全部方式</option>
          <option>當面拜訪</option>
          <option>電話</option>
          <option>視訊會議</option>
          <option>Email</option>
          <option>Line</option>
          <option>WeChat</option>
        </select>
        <input type="date" id="filterFrom" title="起始日期">
        <input type="date" id="filterTo" title="結束日期">
      </div>

      <div class="card" style="max-width:800px;">
        <div class="timeline" id="activityTimeline">
          ${activities.length === 0 ? '<div class="empty"><div class="empty-icon">💬</div><div class="empty-text">點擊右上「記錄互動」開始累積客戶接觸</div></div>' : ''}
          ${renderTimeline(activities, data)}
        </div>
      </div>
    `;

    document.getElementById('mainView').innerHTML = html;
    bindEvents();
    bindFilters();
  };

  const renderTimeline = (activities, data) => {
    return activities.map(a => {
      const deal = data.deals.find(d => d.id === a.dealId);
      const company = deal ? data.companies.find(c => c.id === deal.companyId) : null;
      const contact = data.contacts.find(c => c.id === a.contactId);
      return `
        <div class="timeline-item" data-activity-id="${a.id}">
          <div class="timeline-date">${a.date}</div>
          <div class="timeline-card">
            <div class="timeline-title">
              ${a.method} · ${a.type}
              <span style="float:right;font-size:11px;color:var(--text-muted);font-weight:400;">
                ${escapeHtml(company?.name || '')}${deal ? ` · ${escapeHtml(deal.name)}` : ''}
              </span>
            </div>
            <div class="timeline-meta">
              對象：${escapeHtml(contact?.name || '—')}（${escapeHtml(contact?.position || '—')}）
              ${a.owner ? ` · 👤 ${escapeHtml(a.owner)}` : ''}
              ${a.competitor ? ` · 競爭對手：${escapeHtml(a.competitor)}` : ''}
            </div>
            <div class="timeline-content">${escapeHtml(a.summary || '')}</div>
            ${a.feedback ? `<div class="timeline-feedback">💡 客戶反饋：${escapeHtml(a.feedback)}</div>` : ''}
            ${a.concerns ? `<div class="timeline-feedback" style="border-left-color:var(--danger);background:rgba(239,68,68,.1);">⚠️ 顧慮：${escapeHtml(a.concerns)}</div>` : ''}
            <div class="row-actions" style="margin-top:8px;">
              <button class="btn-icon" data-action="edit">✏️</button>
              <button class="btn-icon danger" data-action="del">🗑</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  const bindEvents = () => {
    document.getElementById('btnAddActivity')?.addEventListener('click', () => openForm());
    document.querySelectorAll('.timeline-item').forEach(el => {
      const id = el.dataset.activityId;
      el.querySelector('[data-action="edit"]')?.addEventListener('click', () => openForm(id));
      el.querySelector('[data-action="del"]')?.addEventListener('click', async () => {
        const ok = await App.confirm('確定刪除此互動紀錄？');
        if (ok) del(id);
      });
    });
  };

  const bindFilters = () => {
    const apply = () => {
      const owner = document.getElementById('filterOwner').value;
      const dealId = document.getElementById('filterDeal').value;
      const method = document.getElementById('filterMethod').value;
      const from = document.getElementById('filterFrom').value;
      const to = document.getElementById('filterTo').value;
      const data = Store.load();
      let list = [...data.activities];
      if (owner) list = list.filter(a => a.owner === owner);
      if (dealId) list = list.filter(a => a.dealId === dealId);
      if (method) list = list.filter(a => a.method === method);
      if (from) list = list.filter(a => a.date >= from);
      if (to) list = list.filter(a => a.date <= to);
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
      document.getElementById('activityTimeline').innerHTML = renderTimeline(list, data);
      bindEvents();
    };
    document.getElementById('filterOwner').addEventListener('change', apply);
    document.getElementById('filterDeal').addEventListener('change', apply);
    document.getElementById('filterMethod').addEventListener('change', apply);
    document.getElementById('filterFrom').addEventListener('change', apply);
    document.getElementById('filterTo').addEventListener('change', apply);
  };

  const openForm = (activityId = null, dealId = null, preset = {}) => {
    const data = Store.load();
    const act = activityId ? data.activities.find(a => a.id === activityId) : null;
    const isEdit = !!act;
    const preselectedDeal = dealId || act?.dealId || '';
    const presetDate = preset.date || '';
    const presetType = preset.type || '';
    const presetMethod = preset.method || '';
    const presetOwner = preset.owner || act?.owner || Store.me();

    // 本地日期（避免 UTC 跳日）；present/edit 預設今天
    const todayStr = (() => {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    })();

    if (data.deals.length === 0 && !isEdit) {
      App.toast('請先建立商機才能記錄互動', 'warning');
      return;
    }

    const typeOpts = ['首次接觸', '初步溝通', '需求確認', '方案演示', '報價溝通', '議價', '簽約', '售後服務', '拜訪', '後續跟進', '其他'];
    const methodOpts = ['當面拜訪', '電話', '視訊會議', 'Email', 'Line', 'WeChat', '其他'];

    const html = `
      <form id="activityForm" class="form-grid">
        <div class="form-field">
          <label>互動日期 *</label>
          <input type="date" name="date" required value="${act?.date || presetDate || todayStr}">
        </div>
        <div class="form-field">
          <label>關聯商機 *</label>
          <select name="dealId" required>
            <option value="">— 選擇商機 —</option>
            ${data.deals.map(d => `<option value="${d.id}" ${preselectedDeal === d.id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>聯絡人</label>
          <select name="contactId">
            <option value="">— 選擇 —</option>
            ${act ? data.contacts.filter(c => {
              const deal = data.deals.find(d => d.id === act.dealId);
              return c.companyId === deal?.companyId;
            }).map(c => `<option value="${c.id}" ${act.contactId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('') : ''}
          </select>
        </div>
        <div class="form-field">
          <label>互動方式</label>
          <select name="method">
            ${methodOpts.map(m => `<option ${(act?.method || presetMethod) === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>記錄人（負責業務）</label>
          <select name="owner">
            ${Store.ownerOptionsHtml(data, presetOwner)}
          </select>
        </div>
        <div class="form-field">
          <label>互動類型</label>
          <select name="type">
            ${typeOpts.map(t => `<option ${(act?.type || presetType) === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>競爭對手</label>
          <input name="competitor" value="${escapeHtml(act?.competitor || '')}" placeholder="A公司 / B公司 / 內部自建">
        </div>
        <div class="form-field full">
          <label>溝通摘要（質性描述）</label>
          <textarea name="summary" required placeholder="今天談了什麼、客戶提到什麼、討論了哪些重點…">${escapeHtml(act?.summary || '')}</textarea>
        </div>
        <div class="form-field full">
          <label>客戶即時反饋 ⚠️</label>
          <textarea name="feedback" placeholder="客戶的反應、想法、疑慮、要求…">${escapeHtml(act?.feedback || '')}</textarea>
          <span class="hint" style="color:var(--warning);">必填，這是決策推進的核心資訊</span>
        </div>
        <div class="form-field">
          <label>客戶顧慮</label>
          <select name="concerns">
            <option value="">—</option>
            <option ${act?.concerns === '價格過高' ? 'selected' : ''}>價格過高</option>
            <option ${act?.concerns === '現有合約未到期' ? 'selected' : ''}>現有合約未到期</option>
            <option ${act?.concerns === '內部決策者意見不合' ? 'selected' : ''}>內部決策者意見不合</option>
            <option ${act?.concerns === '預算上限明確' ? 'selected' : ''}>預算上限明確</option>
            <option ${act?.concerns === '內部阻力' ? 'selected' : ''}>內部阻力</option>
          </select>
        </div>
      </form>

      <div class="form-actions">
        ${isEdit ? '<button class="btn-danger" id="btnFormDelete">🗑 刪除</button>' : ''}
        <button class="btn-secondary" data-close>取消</button>
        <button class="btn-primary" id="btnFormSave">${isEdit ? '💾 更新' : '✨ 記錄'}</button>
      </div>
    `;

    document.getElementById('editModalTitle').textContent = isEdit ? '編輯互動紀錄' : '記錄互動';
    document.getElementById('editModalBody').innerHTML = html;
    App.openModal('editModal');

    // 聯絡人聯動
    document.querySelector('[name="dealId"]').addEventListener('change', (e) => {
      const deal = data.deals.find(d => d.id === e.target.value);
      const contactSelect = document.querySelector('[name="contactId"]');
      contactSelect.innerHTML = '<option value="">— 選擇 —</option>' +
        (deal ? data.contacts.filter(c => c.companyId === deal.companyId).map(c =>
          `<option value="${c.id}">${escapeHtml(c.name)}</option>`
        ).join('') : '');
    });

    document.getElementById('btnFormSave').addEventListener('click', () => save(activityId));
    if (isEdit) {
      document.getElementById('btnFormDelete').addEventListener('click', async () => {
        const ok = await App.confirm('確定刪除此互動紀錄？');
        if (ok) {
          App.closeModal('editModal');
          del(activityId);
        }
      });
    }
  };

  const save = (activityId) => {
    const form = document.getElementById('activityForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const obj = Object.fromEntries(new FormData(form).entries());
    if (!obj.owner) obj.owner = Store.me() || '未指派';

    const data = Store.load();
    if (activityId) {
      const idx = data.activities.findIndex(a => a.id === activityId);
      if (idx >= 0) data.activities[idx] = { ...data.activities[idx], ...obj };
    } else {
      data.activities.push({
        id: Store.uid('act'),
        ...obj,
        createdAt: new Date().toISOString()
      });
      // 同步更新商機的「最後互動」資訊
      const deal = data.deals.find(d => d.id === obj.dealId);
      if (deal) {
        deal.lastDate = obj.date;
        deal.lastMethod = obj.method;
        deal.lastType = obj.type;
        deal.feedback = obj.feedback || deal.feedback;
        deal.summary = obj.summary || deal.summary;
        deal.concerns = obj.concerns || deal.concerns;
        deal.competitor = obj.competitor || deal.competitor;
      }
    }

    Store.save(data);
    Sync.broadcast(data);
    App.closeModal('editModal');
    App.toast(activityId ? '互動已更新' : '互動已記錄', 'success');
    App.render();
  };

  const del = (activityId) => {
    const data = Store.load();
    data.activities = data.activities.filter(a => a.id !== activityId);
    Store.save(data);
    Sync.broadcast(data);
    App.toast('已刪除', 'success');
    App.render();
  };

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  return { render, openForm };
})();

window.Activities = Activities;