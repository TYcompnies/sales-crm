/**
 * Tasks - 任務管理（驅動銷售進度的引擎）
 */

const Tasks = (() => {

  const render = () => {
    const data = Store.load();
    const tasks = data.tasks;

    const open = tasks.filter(t => t.status !== 'completed');
    const completed = tasks.filter(t => t.status === 'completed');
    const overdue = open.filter(t => t.dueDate && new Date(t.dueDate) < new Date());

    const html = `
      <div class="view-header">
        <div>
          <h2 class="view-title">✅ 任務與行動</h2>
          <p class="view-subtitle">驅動銷售進度的引擎 · ${open.length} 進行中 · ${overdue.length} 逾期 · ${completed.length} 已完成</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" id="btnAutoSequence">🤖 套用跟進序列</button>
          <button class="btn-primary" id="btnAddTask">＋ 新增任務</button>
        </div>
      </div>

      <div class="filter-bar">
        <select id="filterOwner">
          <option value="">全部負責業務</option>
          ${Store.teamMembers(data).map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('')}
        </select>
        <select id="filterPriority">
          <option value="">全部優先級</option>
          <option value="P1">P1 緊急</option>
          <option value="P2">P2 中等</option>
          <option value="P3">P3 普通</option>
        </select>
        <select id="filterStatus">
          <option value="open">未完成</option>
          <option value="completed">已完成</option>
          <option value="">全部</option>
        </select>
        <input type="text" id="filterSearch" placeholder="搜尋任務…">
      </div>

      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
        <div class="stat-card danger">
          <div class="stat-label">逾期任務</div>
          <div class="stat-value">${overdue.length}</div>
          <div class="stat-target">${overdue.length > 0 ? '需要立即處理' : '一切準時'}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">P1 緊急</div>
          <div class="stat-value">${open.filter(t => t.priority === 'P1').length}</div>
          <div class="stat-target">本週必完成</div>
        </div>
        <div class="stat-card info">
          <div class="stat-label">P2 中等</div>
          <div class="stat-value">${open.filter(t => t.priority === 'P2').length}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">已完成</div>
          <div class="stat-value">${completed.length}</div>
        </div>
      </div>

      <div class="card mt-3">
        <div class="card-title">📋 任務清單</div>
        <div id="taskList">
          ${renderTasks(tasks, data)}
        </div>
      </div>
    `;

    document.getElementById('mainView').innerHTML = html;
    bindEvents();
    bindFilters();
  };

  const renderTasks = (tasks, data) => {
    if (tasks.length === 0) {
      return '<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">點擊右上「新增任務」或「套用跟進序列」</div></div>';
    }
    const sorted = [...tasks].sort((a, b) => {
      const order = { P1: 0, P2: 1, P3: 2 };
      const pa = order[a.priority] ?? 9;
      const pb = order[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      return new Date(a.dueDate || '9999') - new Date(b.dueDate || '9999');
    });

    return sorted.map(t => {
      const deal = data.deals.find(d => d.id === t.dealId);
      const company = deal ? data.companies.find(c => c.id === deal.companyId) : null;
      const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed';
      return `
        <div class="task-item" data-priority="${t.priority}" data-task-id="${t.id}" ${t.status === 'completed' ? 'style="opacity:.5;"' : ''}>
          <div class="task-check ${t.status === 'completed' ? 'checked' : ''}" data-action="toggle">${t.status === 'completed' ? '✓' : ''}</div>
          <div class="task-content">
            <div class="task-title" style="${t.status === 'completed' ? 'text-decoration:line-through;' : ''}">${escapeHtml(t.title)}</div>
            <div class="task-meta">
              ${deal ? `📌 ${escapeHtml(deal.name)}` : ''}
              ${company ? ` · ${escapeHtml(company.name)}` : ''}
              ${t.dueDate ? ` · 截止 ${t.dueDate}${overdue ? ' <span style="color:var(--danger);">(逾期)</span>' : ''}` : ''}
              ${t.owner ? ` · 👤 ${escapeHtml(t.owner)}` : ''}
            </div>
          </div>
          <span class="task-priority ${t.priority}">${t.priority}</span>
          <div class="row-actions">
            <button class="btn-icon" data-action="edit">✏️</button>
            <button class="btn-icon danger" data-action="del">🗑</button>
          </div>
        </div>
      `;
    }).join('');
  };

  const bindEvents = () => {
    document.getElementById('btnAddTask')?.addEventListener('click', () => openForm());
    document.getElementById('btnAutoSequence')?.addEventListener('click', autoSequence);

    document.querySelectorAll('.task-item').forEach(el => {
      const id = el.dataset.taskId;
      el.querySelector('[data-action="toggle"]')?.addEventListener('click', () => toggle(id));
      el.querySelector('[data-action="edit"]')?.addEventListener('click', () => openForm(id));
      el.querySelector('[data-action="del"]')?.addEventListener('click', async () => {
        const ok = await App.confirm('確定刪除此任務？');
        if (ok) del(id);
      });
    });
  };

  const bindFilters = () => {
    const apply = () => {
      const owner = document.getElementById('filterOwner').value;
      const priority = document.getElementById('filterPriority').value;
      const status = document.getElementById('filterStatus').value;
      const search = document.getElementById('filterSearch').value.toLowerCase();
      const data = Store.load();
      let list = [...data.tasks];
      if (owner) list = list.filter(t => t.owner === owner);
      if (priority) list = list.filter(t => t.priority === priority);
      if (status === 'open') list = list.filter(t => t.status !== 'completed');
      else if (status === 'completed') list = list.filter(t => t.status === 'completed');
      if (search) list = list.filter(t => t.title.toLowerCase().includes(search));
      document.getElementById('taskList').innerHTML = renderTasks(list, data);
      bindEvents();
    };
    document.getElementById('filterOwner').addEventListener('change', apply);
    document.getElementById('filterPriority').addEventListener('change', apply);
    document.getElementById('filterStatus').addEventListener('change', apply);
    document.getElementById('filterSearch').addEventListener('input', apply);
  };

  const toggle = (taskId) => {
    const data = Store.load();
    const t = data.tasks.find(x => x.id === taskId);
    if (t) {
      t.status = t.status === 'completed' ? 'open' : 'completed';
      t.completedAt = t.status === 'completed' ? new Date().toISOString() : null;
      Store.save(data);
      Sync.broadcast(data);
      App.render();
    }
  };

  const openForm = (taskId = null, dealId = null) => {
    const data = Store.load();
    const task = taskId ? data.tasks.find(t => t.id === taskId) : null;
    const isEdit = !!task;
    const preselectedDeal = dealId || task?.dealId || '';

    const html = `
      <form id="taskForm" class="form-grid">
        <div class="form-field full">
          <label>行動內容 *</label>
          <input name="title" required value="${escapeHtml(task?.title || '')}" placeholder="例：準備保固成本分析與議價對策">
        </div>
        <div class="form-field">
          <label>關聯商機</label>
          <select name="dealId">
            <option value="">— 選擇 —</option>
            ${data.deals.map(d => `<option value="${d.id}" ${preselectedDeal === d.id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>責任人</label>
          <select name="owner">
            ${Store.ownerOptionsHtml(data, task?.owner || Store.me())}
          </select>
        </div>
        <div class="form-field">
          <label>截止日期</label>
          <input type="date" name="dueDate" value="${task?.dueDate || ''}">
        </div>
        <div class="form-field">
          <label>優先級</label>
          <select name="priority">
            <option value="P1" ${task?.priority === 'P1' ? 'selected' : ''}>P1 緊急</option>
            <option value="P2" ${task?.priority === 'P2' || !task ? 'selected' : ''}>P2 中等</option>
            <option value="P3" ${task?.priority === 'P3' ? 'selected' : ''}>P3 普通</option>
          </select>
        </div>
        <div class="form-field full">
          <label>狀態</label>
          <select name="status">
            <option value="open" ${task?.status !== 'completed' ? 'selected' : ''}>未完成</option>
            <option value="completed" ${task?.status === 'completed' ? 'selected' : ''}>已完成</option>
          </select>
        </div>
      </form>

      <div class="form-actions">
        ${isEdit ? '<button class="btn-danger" id="btnFormDelete">🗑 刪除</button>' : ''}
        <button class="btn-secondary" data-close>取消</button>
        <button class="btn-primary" id="btnFormSave">${isEdit ? '💾 更新' : '✨ 建立'}</button>
      </div>
    `;

    document.getElementById('editModalTitle').textContent = isEdit ? '編輯任務' : '新增任務';
    document.getElementById('editModalBody').innerHTML = html;
    App.openModal('editModal');

    document.getElementById('btnFormSave').addEventListener('click', () => save(taskId));
    if (isEdit) {
      document.getElementById('btnFormDelete').addEventListener('click', async () => {
        const ok = await App.confirm('確定刪除此任務？');
        if (ok) {
          App.closeModal('editModal');
          del(taskId);
        }
      });
    }
  };

  const save = (taskId) => {
    const form = document.getElementById('taskForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const obj = Object.fromEntries(new FormData(form).entries());
    if (!obj.owner) obj.owner = Store.me() || '未指派';

    const data = Store.load();
    if (taskId) {
      const idx = data.tasks.findIndex(t => t.id === taskId);
      if (idx >= 0) data.tasks[idx] = { ...data.tasks[idx], ...obj };
    } else {
      data.tasks.push({
        id: Store.uid('tk'),
        ...obj,
        createdAt: new Date().toISOString()
      });
    }
    Store.save(data);
    Sync.broadcast(data);
    App.closeModal('editModal');
    App.toast(taskId ? '任務已更新' : '任務已建立', 'success');
    App.render();
  };

  const del = (taskId) => {
    const data = Store.load();
    data.tasks = data.tasks.filter(t => t.id !== taskId);
    Store.save(data);
    Sync.broadcast(data);
    App.toast('任務已刪除', 'success');
    App.render();
  };

  // 自動跟進序列：針對初步溝通/方案報價階段的商機，自動建立 Day 1/3/7/14 任務
  const autoSequence = async () => {
    const data = Store.load();
    const targetDeals = data.deals.filter(d => ['contact', 'quote', 'needs'].includes(d.stage));
    if (targetDeals.length === 0) {
      App.toast('沒有符合自動跟進條件的商機（需在初步溝通 / 需求確認 / 方案報價階段）', 'warning');
      return;
    }

    const ok = await App.confirm(`將為 ${targetDeals.length} 筆商機建立自動化跟進序列（Day 1/3/7/14），共 ${targetDeals.length * 4} 個任務。確定嗎？`);
    if (!ok) return;

    const today = new Date();
    const day = (n) => {
      const d = new Date(today);
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };

    targetDeals.forEach(deal => {
      // 避免重複
      const existing = data.tasks.filter(t => t.dealId === deal.id && t.title.includes('[自動跟進]'));
      if (existing.length > 0) return;

      const owner = deal.owner || Store.me() || '未指派';
      const seq = [
        { day: 1, title: '發送初次感謝信 + 案例分享', priority: 'P2' },
        { day: 3, title: '致電詢問是否收到資料，挖掘潛在顧慮', priority: 'P2' },
        { day: 7, title: '發送產業白皮書或邀請參加線上研討會', priority: 'P3' },
        { day: 14, title: '若未回應，發送降溫信並將商機退回潛在客戶池', priority: 'P3' }
      ];
      seq.forEach(s => {
        data.tasks.push({
          id: Store.uid('tk'),
          dealId: deal.id,
          title: `[自動跟進 Day ${s.day}] ${s.title}`,
          owner,
          dueDate: day(s.day),
          priority: s.priority,
          status: 'open',
          createdAt: new Date().toISOString()
        });
      });
    });

    Store.save(data);
    Sync.broadcast(data);
    App.toast('已自動建立跟進序列', 'success');
    App.render();
  };

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  return { render, openForm };
})();

window.Tasks = Tasks;