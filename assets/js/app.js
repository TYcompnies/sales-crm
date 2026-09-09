/**
 * App - 主程式（路由、初始化、工具函數）
 */

const App = (() => {

  let currentView = 'dashboard';

  const views = {
    dashboard: () => Dashboard.render(),
    pipeline: () => Pipeline.render(),
    deals: () => Deals.render(),
    companies: () => Companies.render(),
    contacts: () => Contacts.render(),
    activities: () => Activities.render(),
    tasks: () => Tasks.render(),
    metrics: () => Metrics.render(),
    analytics: () => Analytics.render()
  };

  const init = async () => {
    // 1. 首次使用：載入種子資料
    const data = Store.load();
    if (!data.meta.seeded) {
      const seed = Seed.seedData();
      Store.replace(seed);
      console.log('[App] 已載入範例資料');
    }

    // 2. 檢查分享連結
    const share = Sync.parseShareLink();
    if (share) {
      showSharePreview(share);
    }

    // 3. 綁定全域事件
    bindNavTabs();
    bindGlobalEvents();

    // 4. 初始化同步
    Sync.init();
    Sync.updateIndicator();

    // 5. 更新右上角身份顯示
    renderProfileUI();

    // 6. 渲染當前視圖
    render();

    console.log('[App] CRM 已啟動，資料：', Store.load());
  };

  const render = () => {
    if (views[currentView]) views[currentView]();
  };

  const switchView = (view) => {
    if (!views[view]) return;
    currentView = view;
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === view);
    });
    render();
    window.scrollTo(0, 0);
  };

  const bindNavTabs = () => {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });
  };

  const bindGlobalEvents = () => {
    // 同步按鈕
    document.getElementById('btnSync').addEventListener('click', () => openModal('syncModal'));

    // Modal 關閉
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        if (modal) closeModal(modal.id);
      });
    });
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal.id);
      });
    });

    // 同步 Modal 內部
    document.querySelectorAll('.sync-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sync-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sync-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`[data-sync-panel="${tab.dataset.syncTab}"]`).classList.add('active');
      });
    });

    document.getElementById('btnCopySync').addEventListener('click', Sync.copySyncCode);
    document.getElementById('btnPasteSync').addEventListener('click', Sync.pasteSyncCode);
    document.getElementById('btnExportJson').addEventListener('click', Sync.exportJson);
    document.getElementById('fileImportJson').addEventListener('change', (e) => {
      if (e.target.files[0]) Sync.importJson(e.target.files[0]);
    });
    document.getElementById('btnGenLink').addEventListener('click', Sync.generateShareLink);
    document.getElementById('btnCopyLink').addEventListener('click', Sync.copyShareLink);

    // 身份選擇（多業務）
    document.getElementById('btnUser').addEventListener('click', openProfileModal);
    document.getElementById('btnProfileCreate').addEventListener('click', createProfile);
    document.getElementById('profileNewName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') createProfile();
    });

    // 確認 Modal
    document.getElementById('confirmCancel').addEventListener('click', () => {
      closeModal('confirmModal');
      if (window.__confirmReject) window.__confirmReject();
    });
    document.getElementById('confirmOk').addEventListener('click', () => {
      closeModal('confirmModal');
      if (window.__confirmResolve) window.__confirmResolve(true);
    });

    // FAB
    document.getElementById('fabBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('fabMenu').classList.toggle('open');
    });
    document.querySelectorAll('[data-fab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.fab;
        document.getElementById('fabMenu').classList.remove('open');
        handleFab(type);
      });
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.fab') && !e.target.closest('.fab-menu')) {
        document.getElementById('fabMenu').classList.remove('open');
      }
    });

    // 跨 tab 同步
    window.addEventListener('crm:dataChanged', () => {
      if (currentView) render();
    });

    // 鍵盤快捷鍵
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal.open').forEach(m => closeModal(m.id));
        document.getElementById('fabMenu').classList.remove('open');
      }
    });
  };

  // ===== 身份（多業務 Profile）=====
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  // 更新右上角身份 chip
  const renderProfileUI = () => {
    const p = Store.getProfile();
    const avatar = document.getElementById('userAvatar');
    const nameEl = document.getElementById('userName');
    if (p?.name) {
      avatar.textContent = p.name.trim().charAt(0) || '?';
      nameEl.textContent = p.name;
    } else {
      avatar.textContent = '👤';
      nameEl.textContent = '未登入';
    }
  };

  // 開啟身份選擇 Modal（渲染團隊成員清單：點名字切身份、🗑 刪除）
  const openProfileModal = () => {
    const data = Store.load();
    const me = Store.me();
    const list = document.getElementById('profileMemberList');
    const team = Store.teamMembers(data);
    list.innerHTML = team.map(m => `
      <div class="profile-member ${m.name === me ? 'active' : ''}">
        <button class="pm-select" data-name="${escapeHtml(m.name)}" title="切換到此身份">
          <span class="pm-avatar">${escapeHtml(m.name.trim().charAt(0) || '?')}</span>
          <span style="flex:1;min-width:0;">
            <span class="pm-name">${escapeHtml(m.name)}</span>
            <div class="pm-sub">${m.name === me ? '✓ 目前身份' : '點此切換身份'}</div>
          </span>
          ${m.name === me ? '<span class="pm-check">✓</span>' : ''}
        </button>
        <button class="pm-del" data-name="${escapeHtml(m.name)}" title="刪除業務：${escapeHtml(m.name)}">🗑</button>
      </div>
    `).join('');
    if (team.length === 0) {
      list.innerHTML = '<div class="muted" style="padding:12px;text-align:center;">團隊清單是空的 — 在下方輸入姓名新增第一位業務。</div>';
    }
    list.querySelectorAll('.pm-select').forEach(btn => {
      btn.addEventListener('click', () => selectProfile(btn.dataset.name));
    });
    list.querySelectorAll('.pm-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeProfile(btn.dataset.name);
      });
    });
    openModal('profileModal');
  };

  // 切換身份到指定業務
  const selectProfile = (name) => {
    if (!name) return;
    const data = Store.load();
    Store.ensureMember(data, name);
    Store.setProfile({ name, updatedAt: new Date().toISOString() });
    Store.saveNow(data);
    Sync.broadcast(data);
    closeModal('profileModal');
    renderProfileUI();
    render();
    toast(`已切換身份：${name}`, 'success');
  };

  // 建立新業務身份
  const createProfile = () => {
    const input = document.getElementById('profileNewName');
    const name = (input.value || '').trim();
    if (!name) {
      toast('請先輸入姓名', 'warning');
      input.focus();
      return;
    }
    const data = Store.load();
    Store.ensureMember(data, name);
    Store.setProfile({ name, updatedAt: new Date().toISOString() });
    Store.saveNow(data);
    Sync.broadcast(data);
    input.value = '';
    closeModal('profileModal');
    renderProfileUI();
    render();
    toast(`已建立身份：${name}`, 'success');
  };

  // 刪除業務身份（名下資料保留，owner 欄位不動）
  const removeProfile = async (name) => {
    if (!name) return;
    const data = Store.load();
    const team = Store.teamMembers(data);
    if (team.length <= 1) {
      toast('團隊至少需保留一位業務', 'warning');
      return;
    }
    if (!team.some(m => m.name === name)) {
      toast('查無此業務', 'warning');
      return;
    }
    const label = { companies: '客戶', contacts: '聯絡人', deals: '商機', activities: '互動', tasks: '任務' };
    const stats = {
      companies: data.companies.filter(c => c.owner === name).length,
      contacts: data.contacts.filter(c => c.owner === name).length,
      deals: data.deals.filter(d => d.owner === name).length,
      activities: data.activities.filter(a => a.owner === name).length,
      tasks: data.tasks.filter(t => t.owner === name).length
    };
    const parts = Object.entries(stats).filter(([, v]) => v > 0)
      .map(([k, v]) => `${label[k] || k} ${v} 筆`);
    const isMe = Store.me() === name;
    const msg =
      `確定刪除業務「${name}」？` +
      (parts.length
        ? ` 該業務名下仍有 ${parts.join('、')}。刪除後這些資料不會消失（負責人欄位保留原名），只是無法再以該身份登入。`
        : ' 該業務名下沒有資料，可直接移除。') +
      (isMe ? '（這是你的目前身份，刪除後將自動登出。）' : '');
    const ok = await confirm(msg);
    if (!ok) return;
    const final = Store.load(); // 重新讀取，避免 await 期間資料變動
    const res = Store.removeMember(final, name);
    if (!res.removed) {
      toast('刪除失敗：查無此業務', 'error');
      return;
    }
    if (Store.me() === name) Store.setProfile(null); // 刪除的是目前身份 → 登出
    Store.saveNow(final); // 立即落庫（save 為 100ms debounce，會讓後續畫面刷新讀到舊資料）
    Sync.broadcast(final);
    renderProfileUI();
    render();
    const modal = document.getElementById('profileModal');
    if (modal.classList.contains('open')) openProfileModal(); // 刷新成員清單
    toast(`已刪除業務：${name}`, 'success');
  };

  const handleFab = (type) => {
    switch (type) {
      case 'visit':
        if (Store.load().deals.length === 0) {
          toast('請先建立商機才能記錄拜訪', 'warning');
          Deals.openForm();
        } else {
          Activities.openForm(null, null, { type: '拜訪', method: '當面拜訪', owner: Store.me() || '' });
        }
        break;
      case 'deal': Deals.openForm(); break;
      case 'company': Companies.openForm(); break;
      case 'contact': Contacts.openForm(); break;
      case 'activity': Activities.openForm(); break;
      case 'task': Tasks.openForm(); break;
      case 'metric': Metrics.openForm(); break;
    }
  };

  // ===== Modal =====
  const openModal = (id) => {
    document.getElementById(id).classList.add('open');
  };

  const closeModal = (id) => {
    document.getElementById(id).classList.remove('open');
  };

  // ===== 確認對話框 =====
  const confirm = (message) => {
    return new Promise((resolve, reject) => {
      document.getElementById('confirmMessage').textContent = message;
      openModal('confirmModal');
      window.__confirmResolve = resolve;
      window.__confirmReject = () => resolve(false);
    });
  };

  // ===== Toast =====
  const toast = (message, type = 'info', duration = 3000) => {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity .3s';
      setTimeout(() => el.remove(), 300);
    }, duration);
  };

  // ===== 分享連結預覽 =====
  const showSharePreview = (share) => {
    const html = `
      <div style="background:var(--bg-secondary);padding:16px;border-radius:8px;border-left:3px solid var(--accent);">
        <h3 style="margin-bottom:12px;">🔗 同事分享的商機</h3>
        <table class="table">
          <tbody>
            <tr><td>商機</td><td><b>${share.name}</b></td></tr>
            <tr><td>客戶</td><td>${share.company || '—'}</td></tr>
            <tr><td>階段</td><td><span class="stage-badge stage-${share.stage}">${Store.STAGE_MAP[share.stage]?.name || share.stage}</span></td></tr>
            <tr><td>金額</td><td><b style="color:var(--success);">NT$ ${(share.amount || 0).toLocaleString()}</b></td></tr>
            <tr><td>機率</td><td>${share.prob}%</td></tr>
            <tr><td>截止日</td><td>${share.dueDate || '—'}</td></tr>
            <tr><td>產品</td><td>${share.product || '—'}</td></tr>
            <tr><td>競爭對手</td><td>${share.competitor || '—'}</td></tr>
            <tr><td>客戶反饋</td><td>${share.feedback || '—'}</td></tr>
          </tbody>
        </table>
        <div style="margin-top:14px;text-align:right;">
          <button class="btn-secondary" id="btnCloseShare">關閉</button>
          <button class="btn-primary" id="btnImportShare">📥 匯入到我的 CRM</button>
        </div>
      </div>
    `;
    document.getElementById('editModalTitle').textContent = '分享連結';
    document.getElementById('editModalBody').innerHTML = html;
    openModal('editModal');

    document.getElementById('btnCloseShare').addEventListener('click', () => {
      closeModal('editModal');
      // 移除 URL 中的 share 參數
      const url = new URL(window.location.href);
      url.searchParams.delete('share');
      window.history.replaceState({}, '', url.toString());
    });

    document.getElementById('btnImportShare').addEventListener('click', async () => {
      const data = Store.load();
      // 檢查是否有同名客戶
      let company = data.companies.find(c => c.name === share.company);
      if (!company) {
        company = {
          id: Store.uid('co'),
          name: share.company,
          taxId: '',
          industry: '',
          employeeCount: null,
          region: '',
          source: '分享連結',
          tags: [],
          notes: `從分享連結匯入（${new Date().toLocaleDateString('zh-TW')}）`,
          createdAt: new Date().toISOString()
        };
        data.companies.push(company);
      }
      const newDeal = {
        id: Store.uid('dl'),
        companyId: company.id,
        contactId: null,
        name: share.name,
        product: share.product || '',
        stage: share.stage || 'contact',
        prob: share.prob || 20,
        amount: share.amount || 0,
        currency: 'NT$',
        dueDate: share.dueDate || '',
        competitor: share.competitor || '',
        feedback: share.feedback || '',
        concerns: '',
        riskFactor: '',
        lastDate: new Date().toISOString().slice(0, 10),
        lastMethod: '分享連結',
        lastType: '導入',
        owner: '',
        tags: ['分享'],
        createdAt: new Date().toISOString()
      };
      data.deals.push(newDeal);
      Store.save(data);
      Sync.broadcast(data);
      closeModal('editModal');
      const url = new URL(window.location.href);
      url.searchParams.delete('share');
      window.history.replaceState({}, '', url.toString());
      toast('已匯入商機到你的 CRM', 'success');
      switchView('deals');
    });
  };

  return {
    init,
    render,
    switchView,
    openModal,
    closeModal,
    confirm,
    toast
  };
})();

window.App = App;

// 啟動
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});