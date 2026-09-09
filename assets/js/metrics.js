/**
 * Metrics - 每日量化指標追蹤
 */

const Metrics = (() => {

  const render = () => {
    const data = Store.load();
    const metrics = [...data.dailyMetrics].sort((a, b) => b.date.localeCompare(a.date));
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);

    // 本月彙總
    const monthMetrics = metrics.filter(m => m.date.startsWith(thisMonth));
    const monthSum = monthMetrics.reduce((sum, m) => ({
      contactCount: sum.contactCount + (m.contactCount || 0),
      effectiveTalks: sum.effectiveTalks + (m.effectiveTalks || 0),
      newLeads: sum.newLeads + (m.newLeads || 0),
      callCount: sum.callCount + (m.callCount || 0),
      visitCount: sum.visitCount + (m.visitCount || 0),
      closedToday: sum.closedToday + (m.closedToday || 0)
    }), { contactCount: 0, effectiveTalks: 0, newLeads: 0, callCount: 0, visitCount: 0, closedToday: 0 });

    const html = `
      <div class="view-header">
        <div>
          <h2 class="view-title">📈 每日量化指標</h2>
          <p class="view-subtitle">個人/團隊績效復盤 · 用數字取代感覺 · 共 ${metrics.length} 天紀錄</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-primary" id="btnFillToday">📅 填寫今日（${today}）</button>
        </div>
      </div>

      <h3 style="font-size:14px;margin-bottom:12px;color:var(--text-secondary);">📊 本月 (${thisMonth}) 彙總</h3>
      <div class="stats-grid">
        ${renderSumCard('累計撥打', monthSum.callCount, '通', 'info')}
        ${renderSumCard('累計拜訪', monthSum.visitCount, '次', 'purple')}
        ${renderSumCard('累計接觸', monthSum.contactCount, '人', 'warning')}
        ${renderSumCard('累計有效對話', monthSum.effectiveTalks, '通', 'success')}
        ${renderSumCard('本月成交', monthSum.closedToday, '單', 'success')}
        ${renderSumCard('新增潛客', monthSum.newLeads, '個', 'info')}
      </div>

      <div class="card mt-3">
        <div class="card-title">📅 每日數據記錄</div>
        <div class="filter-bar">
          <select id="metricFilterOwner">
            <option value="">全部責任人</option>
            ${Store.teamMembers(data).map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join('')}
          </select>
          <input type="date" id="metricFilterDate" title="按日期篩選">
        </div>
        <div class="table-wrap" style="border:none;">
          <table class="table">
            <thead>
              <tr>
                <th>日期</th>
                <th>責任人</th>
                <th class="num">接觸</th>
                <th class="num">有效對話</th>
                <th class="num">撥打</th>
                <th class="num">拜訪</th>
                <th class="num">新增潛客</th>
                <th class="num">成交</th>
                <th>轉化率</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="metricsTbody">
              ${renderTableRows(metrics, data, today)}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card mt-3">
        <div class="card-title">🌅 近期復盤學習</div>
        ${metrics.filter(m => m.learning).slice(0, 5).map(m => `
          <div style="padding:12px;border-bottom:1px solid var(--border);">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">${m.date} · ${escapeHtml(m.owner || '—')}</div>
            <div style="font-size:13px;margin-bottom:6px;"><b>💡 學習：</b>${escapeHtml(m.learning || '')}</div>
            ${m.topThree ? `<div style="font-size:12px;color:var(--text-secondary);white-space:pre-wrap;"><b>🎯 明日三目標：</b>${escapeHtml(m.topThree)}</div>` : ''}
          </div>
        `).join('')}
        ${metrics.filter(m => m.learning).length === 0 ? '<div class="muted" style="padding:20px;text-align:center;">尚無復盤內容</div>' : ''}
      </div>
    `;

    document.getElementById('mainView').innerHTML = html;
    bindEvents();
  };

  const renderSumCard = (label, value, unit, variant) => {
    return `
      <div class="stat-card ${variant}">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value} <span style="font-size:14px;color:var(--text-muted);">${unit}</span></div>
      </div>
    `;
  };

  const renderTableRows = (list, data, today) => {
    if (list.length === 0) {
      return '<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text-muted);">尚無數據，點擊右上「填寫今日」開始</td></tr>';
    }
    return list.map(m => {
      const rate = m.contactCount > 0 ? Math.round((m.effectiveTalks / m.contactCount) * 100) : 0;
      return `
        <tr data-metric-id="${m.id}">
          <td><b>${m.date}</b>${m.date === today ? ' <span class="tag hot">今日</span>' : ''}</td>
          <td><span class="owner-tag">👤 ${escapeHtml(m.owner || '—')}</span></td>
          <td class="num">${m.contactCount || 0}</td>
          <td class="num">${m.effectiveTalks || 0}</td>
          <td class="num">${m.callCount || 0}</td>
          <td class="num">${m.visitCount || 0}</td>
          <td class="num">${m.newLeads || 0}</td>
          <td class="num">${m.closedToday || 0}</td>
          <td><b style="color:${rate < 20 ? 'var(--danger)' : 'var(--success)'};">${rate}%</b></td>
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
    document.getElementById('btnFillToday')?.addEventListener('click', () => openForm());
    document.querySelectorAll('[data-metric-id]').forEach(tr => {
      const id = tr.dataset.metricId;
      tr.querySelector('[data-action="edit"]')?.addEventListener('click', () => openForm(id));
      tr.querySelector('[data-action="del"]')?.addEventListener('click', async () => {
        const ok = await App.confirm('確定刪除此日指標？');
        if (ok) del(id);
      });
    });
    document.getElementById('metricFilterOwner')?.addEventListener('change', applyMetricFilter);
    document.getElementById('metricFilterDate')?.addEventListener('change', applyMetricFilter);
  };

  const applyMetricFilter = () => {
    const owner = document.getElementById('metricFilterOwner').value;
    const date = document.getElementById('metricFilterDate').value;
    const data = Store.load();
    const today = new Date().toISOString().slice(0, 10);
    let list = [...data.dailyMetrics].sort((a, b) => b.date.localeCompare(a.date));
    if (owner) list = list.filter(m => m.owner === owner);
    if (date) list = list.filter(m => m.date === date);
    document.getElementById('metricsTbody').innerHTML = renderTableRows(list, data, today);
    bindEvents();
  };

  const openForm = (metricId = null) => {
    const data = Store.load();
    const today = new Date().toISOString().slice(0, 10);
    const me = Store.me();
    const metric = metricId
      ? data.dailyMetrics.find(m => m.id === metricId)
      : data.dailyMetrics.find(m => m.date === today && m.owner === me);

    const isEdit = !!metric;

    const html = `
      <form id="metricForm" class="form-grid">
        <div class="form-field">
          <label>日期 *</label>
          <input type="date" name="date" required value="${metric?.date || today}" ${metric ? '' : ''}>
        </div>
        <div class="form-field">
          <label>責任人</label>
          <select name="owner">
            ${Store.ownerOptionsHtml(data, metric?.owner || me)}
          </select>
        </div>

        <div class="form-field">
          <label>今日接觸總次數</label>
          <input type="number" name="contactCount" min="0" value="${metric?.contactCount || 0}">
        </div>
        <div class="form-field">
          <label>有效對話數（通話&gt;2分鐘 或 Email&gt;3封）</label>
          <input type="number" name="effectiveTalks" min="0" value="${metric?.effectiveTalks || 0}">
        </div>

        <div class="form-field">
          <label>今日撥打量</label>
          <input type="number" name="callCount" min="0" value="${metric?.callCount || 0}">
          <span class="hint">目標：${metric?.targetCall || 15}</span>
        </div>
        <div class="form-field">
          <label>目標撥打量</label>
          <input type="number" name="targetCall" min="0" value="${metric?.targetCall || 15}">
        </div>

        <div class="form-field">
          <label>今日拜訪量</label>
          <input type="number" name="visitCount" min="0" value="${metric?.visitCount || 0}">
          <span class="hint">目標：${metric?.targetVisit || 5}</span>
        </div>
        <div class="form-field">
          <label>目標拜訪量</label>
          <input type="number" name="targetVisit" min="0" value="${metric?.targetVisit || 5}">
        </div>

        <div class="form-field">
          <label>新增潛在客戶數</label>
          <input type="number" name="newLeads" min="0" value="${metric?.newLeads || 0}">
        </div>
        <div class="form-field">
          <label>當日成交數</label>
          <input type="number" name="closedToday" min="0" value="${metric?.closedToday || 0}">
        </div>

        <div class="form-field full">
          <label>🌅 今日最大學習點</label>
          <textarea name="learning" placeholder="今天最大的收穫…">${escapeHtml(metric?.learning || '')}</textarea>
        </div>
        <div class="form-field full">
          <label>🎯 明日三個首要目標</label>
          <textarea name="topThree" placeholder="1. ...&#10;2. ...&#10;3. ...">${escapeHtml(metric?.topThree || '')}</textarea>
        </div>
      </form>

      <div class="form-actions">
        ${isEdit ? '<button class="btn-danger" id="btnFormDelete">🗑 刪除</button>' : ''}
        <button class="btn-secondary" data-close>取消</button>
        <button class="btn-primary" id="btnFormSave">${isEdit ? '💾 更新' : '✨ 儲存'}</button>
      </div>
    `;

    document.getElementById('editModalTitle').textContent = isEdit ? '編輯每日指標' : '填寫每日指標';
    document.getElementById('editModalBody').innerHTML = html;
    App.openModal('editModal');

    document.getElementById('btnFormSave').addEventListener('click', () => save(metricId));
    if (isEdit) {
      document.getElementById('btnFormDelete').addEventListener('click', async () => {
        const ok = await App.confirm('確定刪除？');
        if (ok) {
          App.closeModal('editModal');
          del(metricId);
        }
      });
    }
  };

  const save = (metricId) => {
    const form = document.getElementById('metricForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const obj = Object.fromEntries(new FormData(form).entries());
    if (!obj.owner) obj.owner = Store.me() || '未指派';
    Object.keys(obj).forEach(k => {
      if (['contactCount', 'effectiveTalks', 'callCount', 'visitCount', 'newLeads', 'closedToday', 'targetCall', 'targetVisit'].includes(k)) {
        obj[k] = Number(obj[k]) || 0;
      }
    });

    const data = Store.load();
    if (metricId) {
      const idx = data.dailyMetrics.findIndex(m => m.id === metricId);
      if (idx >= 0) data.dailyMetrics[idx] = { ...data.dailyMetrics[idx], ...obj };
    } else {
      // 同日期 + 同責任人才視為同一筆（多位業務各自填寫）
      const existIdx = data.dailyMetrics.findIndex(m => m.date === obj.date && m.owner === obj.owner);
      if (existIdx >= 0) {
        data.dailyMetrics[existIdx] = { ...data.dailyMetrics[existIdx], ...obj };
      } else {
        data.dailyMetrics.push({
          id: Store.uid('mt'),
          ...obj,
          createdAt: new Date().toISOString()
        });
      }
    }

    Store.save(data);
    Sync.broadcast(data);
    App.closeModal('editModal');
    App.toast('已儲存', 'success');
    App.render();
  };

  const del = (metricId) => {
    const data = Store.load();
    data.dailyMetrics = data.dailyMetrics.filter(m => m.id !== metricId);
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

window.Metrics = Metrics;