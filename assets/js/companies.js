/**
 * Companies - 客戶主檔管理
 */

const Companies = (() => {

  const render = () => {
    const data = Store.load();
    const companies = data.companies;

    const html = `
      <div class="view-header">
        <div>
          <h2 class="view-title">🏢 客戶主檔</h2>
          <p class="view-subtitle">基礎資料庫 · 以統編 / 域名為唯一鍵 · ${companies.length} 個客戶</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-primary" id="btnAddCompany">＋ 新增客戶</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>客戶名稱</th>
              <th>統編</th>
              <th>行業別</th>
              <th class="num">員工人數</th>
              <th>區域</th>
              <th>客戶來源</th>
              <th>標籤</th>
              <th class="num">商機數</th>
              <th class="num">總金額</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="companiesTbody">
            ${renderRows(companies, data)}
          </tbody>
        </table>
      </div>

      ${companies.length === 0 ? '<div class="empty" style="margin-top:24px;"><div class="empty-icon">🏢</div><div class="empty-text">點擊右上「新增客戶」開始建立客戶主檔</div></div>' : ''}
    `;

    document.getElementById('mainView').innerHTML = html;
    bindEvents();
  };

  const renderRows = (companies, data) => {
    return companies.map(c => {
      const deals = Store.dealsByCompany(data, c.id);
      const totalAmount = deals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
      return `
        <tr data-company-id="${c.id}">
          <td><b>${escapeHtml(c.name)}</b></td>
          <td><code style="font-size:11px;">${escapeHtml(c.taxId || '—')}</code></td>
          <td>${escapeHtml(c.industry || '—')}</td>
          <td class="num">${c.employeeCount ? c.employeeCount.toLocaleString() : '—'}</td>
          <td>${escapeHtml(c.region || '—')}</td>
          <td>${escapeHtml(c.source || '—')}</td>
          <td>${(c.tags || []).map(t => `<span class="tag ${t === 'A+' ? 'a-plus' : ''}">${escapeHtml(t)}</span>`).join('')}</td>
          <td class="num">${deals.length}</td>
          <td class="num"><b style="color:var(--success);">${(totalAmount / 10000).toFixed(0)}萬</b></td>
          <td>
            <div class="row-actions">
              <button class="btn-icon" data-action="edit" title="編輯">✏️</button>
              <button class="btn-icon danger" data-action="del" title="刪除">🗑</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  const bindEvents = () => {
    document.getElementById('btnAddCompany')?.addEventListener('click', () => openForm());
    document.querySelectorAll('#companiesTbody tr').forEach(tr => {
      const id = tr.dataset.companyId;
      tr.querySelector('[data-action="edit"]').addEventListener('click', (e) => { e.stopPropagation(); openForm(id); });
      tr.querySelector('[data-action="del"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await App.confirm('確定刪除此客戶？相關的商機、聯絡人也會被移除。');
        if (ok) del(id);
      });
    });
  };

  const openForm = (companyId = null) => {
    const data = Store.load();
    const company = companyId ? data.companies.find(c => c.id === companyId) : null;
    const isEdit = !!company;

    const html = `
      <form id="companyForm" class="form-grid">
        <div class="form-field full">
          <label>客戶名稱 *</label>
          <input name="name" required value="${escapeHtml(company?.name || '')}" placeholder="智邦科技股份有限公司">
        </div>
        <div class="form-field">
          <label>統一編號</label>
          <input name="taxId" value="${escapeHtml(company?.taxId || '')}" placeholder="12345678">
        </div>
        <div class="form-field">
          <label>客戶來源</label>
          <select name="source">
            <option value="">—</option>
            ${['業務開發', '客戶介紹', '舊客戶回流', '行銷活動', '網站詢價', '陌生拜訪'].map(s => `<option ${company?.source === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>行業別</label>
          <input name="industry" value="${escapeHtml(company?.industry || '')}" placeholder="網通設備製造業">
        </div>
        <div class="form-field">
          <label>員工人數</label>
          <input type="number" name="employeeCount" min="0" value="${company?.employeeCount || ''}">
        </div>
        <div class="form-field">
          <label>資本額（NT$）</label>
          <input type="number" name="capital" min="0" value="${company?.capital || ''}">
        </div>
        <div class="form-field">
          <label>所屬區域</label>
          <input name="region" value="${escapeHtml(company?.region || '')}" placeholder="新竹科學園區">
        </div>
        <div class="form-field">
          <label>官方網站</label>
          <input name="website" value="${escapeHtml(company?.website || '')}" placeholder="https://">
        </div>
        <div class="form-field full">
          <label>統一標籤</label>
          <input name="tags" value="${escapeHtml((company?.tags || []).join(','))}" placeholder="A+, 高科技, 高金額">
          <span class="hint">符合「員工&gt;100人 AND 行業=高科技/金融 AND 職位=C-Level」可標記 A+</span>
        </div>
        <div class="form-field full">
          <label>備註</label>
          <textarea name="notes">${escapeHtml(company?.notes || '')}</textarea>
        </div>
      </form>

      <div class="form-actions">
        ${isEdit ? '<button class="btn-danger" id="btnFormDelete">🗑 刪除</button>' : ''}
        <button class="btn-secondary" data-close>取消</button>
        <button class="btn-primary" id="btnFormSave">${isEdit ? '💾 更新' : '✨ 建立'}</button>
      </div>
    `;

    document.getElementById('editModalTitle').textContent = isEdit ? '編輯客戶' : '新增客戶';
    document.getElementById('editModalBody').innerHTML = html;
    App.openModal('editModal');

    document.getElementById('btnFormSave').addEventListener('click', () => save(companyId));
    if (isEdit) {
      document.getElementById('btnFormDelete').addEventListener('click', async () => {
        const ok = await App.confirm('確定刪除此客戶？');
        if (ok) {
          App.closeModal('editModal');
          del(companyId);
        }
      });
    }
  };

  const save = (companyId) => {
    const form = document.getElementById('companyForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const fd = new FormData(form);
    const obj = Object.fromEntries(fd.entries());

    const data = Store.load();
    if (companyId) {
      const idx = data.companies.findIndex(c => c.id === companyId);
      if (idx >= 0) {
        data.companies[idx] = {
          ...data.companies[idx],
          ...obj,
          employeeCount: Number(obj.employeeCount) || null,
          capital: Number(obj.capital) || null,
          tags: obj.tags ? obj.tags.split(',').map(s => s.trim()).filter(Boolean) : []
        };
      }
    } else {
      // 統編去重檢查
      if (obj.taxId && data.companies.some(c => c.taxId === obj.taxId)) {
        App.toast('已有相同統編的客戶，請檢查是否重複', 'error');
        return;
      }
      data.companies.push({
        id: Store.uid('co'),
        ...obj,
        employeeCount: Number(obj.employeeCount) || null,
        capital: Number(obj.capital) || null,
        tags: obj.tags ? obj.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
        createdAt: new Date().toISOString()
      });
    }

    Store.save(data);
    Sync.broadcast(data);
    App.closeModal('editModal');
    App.toast(companyId ? '客戶已更新' : '客戶已建立', 'success');
    App.render();
  };

  const del = (companyId) => {
    const data = Store.load();
    // 連動刪除相關資料
    data.companies = data.companies.filter(c => c.id !== companyId);
    const relatedDealIds = data.deals.filter(d => d.companyId === companyId).map(d => d.id);
    data.deals = data.deals.filter(d => d.companyId !== companyId);
    data.contacts = data.contacts.filter(c => c.companyId !== companyId);
    data.activities = data.activities.filter(a => !relatedDealIds.includes(a.dealId));
    data.tasks = data.tasks.filter(t => !relatedDealIds.includes(t.dealId));
    Store.save(data);
    Sync.broadcast(data);
    App.toast('客戶與相關資料已刪除', 'success');
    App.render();
  };

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  return { render, openForm };
})();

window.Companies = Companies;