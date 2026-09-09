/**
 * Contacts - 聯絡人管理
 */

const Contacts = (() => {

  const render = () => {
    const data = Store.load();
    const contacts = data.contacts;

    const html = `
      <div class="view-header">
        <div>
          <h2 class="view-title">👤 聯絡人</h2>
          <p class="view-subtitle">每個客戶可有多個聯絡人 · 標註決策影響力 · ${contacts.length} 位聯絡人</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-primary" id="btnAddContact">＋ 新增聯絡人</button>
        </div>
      </div>

      <div class="filter-bar">
        <select id="filterCompany">
          <option value="">全部客戶</option>
          ${data.companies.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <select id="filterOwner">
          <option value="">全部負責業務</option>
          ${Store.teamMembers(data).map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('')}
        </select>
        <select id="filterInfluence">
          <option value="">全部影響力</option>
          <option>關鍵決策者</option>
          <option>使用者</option>
          <option>守門人</option>
        </select>
        <input type="text" id="filterSearch" placeholder="搜尋姓名 / 職位 / Email…">
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>客戶</th>
              <th>職位</th>
              <th>影響力</th>
              <th>負責業務</th>
              <th>手機</th>
              <th>Email</th>
              <th>Line</th>
              <th>生日</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody id="contactsTbody">
            ${renderRows(contacts, data)}
          </tbody>
        </table>
      </div>

      ${contacts.length === 0 ? '<div class="empty" style="margin-top:24px;"><div class="empty-icon">👤</div><div class="empty-text">點擊右上「新增聯絡人」開始建立</div></div>' : ''}
    `;

    document.getElementById('mainView').innerHTML = html;
    bindEvents();
    bindFilters();
  };

  const renderRows = (contacts, data) => {
    return contacts.map(c => {
      const company = data.companies.find(co => co.id === c.companyId);
      const influenceColor = c.influence === '關鍵決策者' ? 'a-plus' : c.influence === '守門人' ? 'hot' : '';
      return `
        <tr data-contact-id="${c.id}">
          <td><b>${escapeHtml(c.name)}</b></td>
          <td>${escapeHtml(company?.name || '未綁定')}</td>
          <td>${escapeHtml(c.position || '—')}</td>
          <td>${c.influence ? `<span class="tag ${influenceColor}">${escapeHtml(c.influence)}</span>` : '—'}</td>
          <td>${c.owner ? `<span class="owner-tag">👤 ${escapeHtml(c.owner)}</span>` : '<span class="muted">—</span>'}</td>
          <td>${escapeHtml(c.phone || '—')}</td>
          <td style="font-size:12px;">${escapeHtml(c.email || '—')}</td>
          <td>${escapeHtml(c.line || '—')}</td>
          <td>${c.birthday || '—'}</td>
          <td>
            <div class="row-actions">
              <button class="btn-icon" data-action="edit">✏️</button>
              <button class="btn-icon danger" data-action="del">🗑</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  const bindEvents = () => {
    document.getElementById('btnAddContact')?.addEventListener('click', () => openForm());
    document.querySelectorAll('#contactsTbody tr').forEach(tr => {
      const id = tr.dataset.contactId;
      tr.querySelector('[data-action="edit"]').addEventListener('click', (e) => { e.stopPropagation(); openForm(id); });
      tr.querySelector('[data-action="del"]').addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await App.confirm('確定刪除此聯絡人？');
        if (ok) del(id);
      });
    });
  };

  const bindFilters = () => {
    const apply = () => {
      const companyId = document.getElementById('filterCompany').value;
      const owner = document.getElementById('filterOwner').value;
      const influence = document.getElementById('filterInfluence').value;
      const search = document.getElementById('filterSearch').value.toLowerCase();
      const data = Store.load();
      let list = [...data.contacts];
      if (companyId) list = list.filter(c => c.companyId === companyId);
      if (owner) list = list.filter(c => c.owner === owner);
      if (influence) list = list.filter(c => c.influence === influence);
      if (search) {
        list = list.filter(c =>
          [c.name, c.position, c.email, c.phone].some(s => s && s.toLowerCase().includes(search))
        );
      }
      document.getElementById('contactsTbody').innerHTML = renderRows(list, data);
      bindEvents();
    };
    document.getElementById('filterCompany').addEventListener('change', apply);
    document.getElementById('filterOwner').addEventListener('change', apply);
    document.getElementById('filterInfluence').addEventListener('change', apply);
    document.getElementById('filterSearch').addEventListener('input', apply);
  };

  const openForm = (contactId = null) => {
    const data = Store.load();
    const contact = contactId ? data.contacts.find(c => c.id === contactId) : null;
    const isEdit = !!contact;

    const html = `
      <form id="contactForm" class="form-grid">
        <div class="form-field">
          <label>姓名 *</label>
          <input name="name" required value="${escapeHtml(contact?.name || '')}">
        </div>
        <div class="form-field">
          <label>所屬客戶 *</label>
          <select name="companyId" required>
            <option value="">— 選擇 —</option>
            ${data.companies.map(c => `<option value="${c.id}" ${contact?.companyId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>職位</label>
          <input name="position" value="${escapeHtml(contact?.position || '')}" placeholder="技術長 / 採購經理">
        </div>
        <div class="form-field">
          <label>決策影響力</label>
          <select name="influence">
            <option value="">—</option>
            <option ${contact?.influence === '關鍵決策者' ? 'selected' : ''}>關鍵決策者</option>
            <option ${contact?.influence === '使用者' ? 'selected' : ''}>使用者</option>
            <option ${contact?.influence === '守門人' ? 'selected' : ''}>守門人</option>
          </select>
        </div>
        <div class="form-field">
          <label>負責業務</label>
          <select name="owner">
            ${Store.ownerOptionsHtml(data, contact?.owner || Store.me())}
          </select>
        </div>
        <div class="form-field">
          <label>手機</label>
          <input name="phone" value="${escapeHtml(contact?.phone || '')}" placeholder="0928-777-666">
        </div>
        <div class="form-field">
          <label>Email</label>
          <input type="email" name="email" value="${escapeHtml(contact?.email || '')}">
        </div>
        <div class="form-field">
          <label>Line ID</label>
          <input name="line" value="${escapeHtml(contact?.line || '')}" placeholder="@lineid">
        </div>
        <div class="form-field">
          <label>生日</label>
          <input type="date" name="birthday" value="${contact?.birthday || ''}">
        </div>
        <div class="form-field full">
          <label>備註</label>
          <textarea name="notes">${escapeHtml(contact?.notes || '')}</textarea>
        </div>
      </form>

      <div class="form-actions">
        ${isEdit ? '<button class="btn-danger" id="btnFormDelete">🗑 刪除</button>' : ''}
        <button class="btn-secondary" data-close>取消</button>
        <button class="btn-primary" id="btnFormSave">${isEdit ? '💾 更新' : '✨ 建立'}</button>
      </div>
    `;

    document.getElementById('editModalTitle').textContent = isEdit ? '編輯聯絡人' : '新增聯絡人';
    document.getElementById('editModalBody').innerHTML = html;
    App.openModal('editModal');

    document.getElementById('btnFormSave').addEventListener('click', () => save(contactId));
    if (isEdit) {
      document.getElementById('btnFormDelete').addEventListener('click', async () => {
        const ok = await App.confirm('確定刪除此聯絡人？');
        if (ok) {
          App.closeModal('editModal');
          del(contactId);
        }
      });
    }
  };

  const save = (contactId) => {
    const form = document.getElementById('contactForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const obj = Object.fromEntries(new FormData(form).entries());
    if (!obj.owner) obj.owner = Store.me() || '未指派';

    const data = Store.load();
    if (contactId) {
      const idx = data.contacts.findIndex(c => c.id === contactId);
      if (idx >= 0) data.contacts[idx] = { ...data.contacts[idx], ...obj };
    } else {
      data.contacts.push({
        id: Store.uid('ct'),
        ...obj,
        createdAt: new Date().toISOString()
      });
    }
    Store.save(data);
    Sync.broadcast(data);
    App.closeModal('editModal');
    App.toast(contactId ? '聯絡人已更新' : '聯絡人已建立', 'success');
    App.render();
  };

  const del = (contactId) => {
    const data = Store.load();
    data.contacts = data.contacts.filter(c => c.id !== contactId);
    Store.save(data);
    Sync.broadcast(data);
    App.toast('聯絡人已刪除', 'success');
    App.render();
  };

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  return { render, openForm };
})();

window.Contacts = Contacts;