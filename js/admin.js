(function () {
  const { loadConfig, saveConfig, loadPredictions, deletePrediction, computeStats } = window.WCStore;

  const SESSION_KEY = 'wc_admin_authed';
  let config = loadConfig();

  const loginScreen = document.getElementById('loginScreen');
  const dashboardScreen = document.getElementById('dashboardScreen');
  const btnLogout = document.getElementById('btnLogout');

  function isAuthed() {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  }

  function enterDashboard() {
    loginScreen.hidden = true;
    dashboardScreen.hidden = false;
    btnLogout.hidden = false;
    fillEventForm();
    renderParticipants();
    renderStats();
  }

  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = document.getElementById('adminPass').value;
    config = loadConfig();
    if (pass === config.adminPasscode) {
      sessionStorage.setItem(SESSION_KEY, '1');
      document.getElementById('loginError').hidden = true;
      enterDashboard();
    } else {
      document.getElementById('loginError').hidden = false;
    }
  });

  btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  });

  /* ---------- 탭 ---------- */
  document.getElementById('adminTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.admin-tab');
    if (!tab) return;
    document.querySelectorAll('.admin-tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.admin-panel').forEach((p) => {
      p.hidden = p.dataset.panel !== tab.dataset.tab;
    });
    if (tab.dataset.tab === 'participants') renderParticipants();
    if (tab.dataset.tab === 'stats') renderStats();
  });

  /* ---------- 이벤트 관리 ---------- */
  function toDatetimeLocal(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fillEventForm() {
    document.getElementById('cfgTitle').value = config.title;
    document.getElementById('cfgEyebrow').value = config.eyebrow;
    document.getElementById('cfgDesc').value = config.description;
    document.getElementById('cfgDate').value = toDatetimeLocal(config.matchDateTime);
    document.getElementById('cfgStadium').value = config.stadium;
    document.getElementById('cfgFlagA').value = config.teamA.flag;
    document.getElementById('cfgNameA').value = config.teamA.name;
    document.getElementById('cfgFlagB').value = config.teamB.flag;
    document.getElementById('cfgNameB').value = config.teamB.name;
  }

  document.getElementById('eventForm').addEventListener('submit', (e) => {
    e.preventDefault();
    config = {
      ...config,
      title: document.getElementById('cfgTitle').value.trim(),
      eyebrow: document.getElementById('cfgEyebrow').value.trim(),
      description: document.getElementById('cfgDesc').value,
      matchDateTime: document.getElementById('cfgDate').value,
      stadium: document.getElementById('cfgStadium').value.trim(),
      teamA: {
        flag: document.getElementById('cfgFlagA').value.trim() || '🏳️',
        name: document.getElementById('cfgNameA').value.trim() || '팀 A'
      },
      teamB: {
        flag: document.getElementById('cfgFlagB').value.trim() || '🏳️',
        name: document.getElementById('cfgNameB').value.trim() || '팀 B'
      }
    };
    saveConfig(config);
    const msg = document.getElementById('eventSaveMsg');
    msg.hidden = false;
    showToast('이벤트 정보가 저장되었습니다.');
    setTimeout(() => (msg.hidden = true), 2000);
  });

  /* ---------- 참여자 관리 ---------- */
  function renderParticipants(filter) {
    config = loadConfig();
    const list = loadPredictions().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const q = (filter || document.getElementById('participantSearch').value || '').trim().toLowerCase();
    const filtered = q
      ? list.filter((p) => [p.name, p.phone, p.email].some((v) => v.toLowerCase().includes(q)))
      : list;

    const tbody = document.getElementById('participantsBody');
    document.getElementById('participantsEmpty').hidden = filtered.length !== 0;

    tbody.innerHTML = filtered.map((p) => {
      const winnerName = p.winner === 'A' ? config.teamA.name : config.teamB.name;
      const penalty = p.penalty ? (p.penalty === 'A' ? config.teamA.name : config.teamB.name) : '-';
      return `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.phone)}</td>
          <td>${escapeHtml(p.email)}</td>
          <td>${escapeHtml(winnerName)}</td>
          <td>${p.scoreA} : ${p.scoreB}</td>
          <td>${escapeHtml(penalty)}</td>
          <td>${new Date(p.createdAt).toLocaleString('ko-KR')}</td>
          <td><button type="button" class="row-delete" data-id="${p.id}">삭제</button></td>
        </tr>`;
    }).join('');
  }

  document.getElementById('participantSearch').addEventListener('input', (e) => renderParticipants(e.target.value));

  document.getElementById('participantsBody').addEventListener('click', (e) => {
    const btn = e.target.closest('.row-delete');
    if (!btn) return;
    if (!confirm('이 참여자 데이터를 삭제할까요?')) return;
    deletePrediction(btn.dataset.id);
    renderParticipants();
    renderStats();
    showToast('삭제되었습니다.');
  });

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /* ---------- CSV 다운로드 ---------- */
  document.getElementById('btnDownloadCsv').addEventListener('click', () => {
    config = loadConfig();
    const list = loadPredictions();
    const header = ['참여자명', '휴대폰', '이메일', '예상 우승팀', '스코어', '승부차기', '접수시각'];
    const rows = list.map((p) => [
      p.name,
      p.phone,
      p.email,
      p.winner === 'A' ? config.teamA.name : config.teamB.name,
      `${p.scoreA}:${p.scoreB}`,
      p.penalty ? (p.penalty === 'A' ? config.teamA.name : config.teamB.name) : '',
      new Date(p.createdAt).toLocaleString('ko-KR')
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `참여자목록_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  /* ---------- 통계 ---------- */
  function teamBarsHTML(stats) {
    return `
      <div class="team-bar-row">
        <span class="team-bar-name">${config.teamA.flag} ${config.teamA.name}</span>
        <div class="team-bar-track"><div class="team-bar-fill fill-a" style="width:${stats.pctA}%"></div></div>
        <span class="team-bar-pct">${stats.pctA}%</span>
      </div>
      <div class="team-bar-row">
        <span class="team-bar-name">${config.teamB.flag} ${config.teamB.name}</span>
        <div class="team-bar-track"><div class="team-bar-fill fill-b" style="width:${stats.pctB}%"></div></div>
        <span class="team-bar-pct">${stats.pctB}%</span>
      </div>`;
  }

  function renderStats() {
    config = loadConfig();
    const list = loadPredictions();
    const stats = computeStats(list, config);

    document.getElementById('adminStatTotal').textContent = stats.total.toLocaleString();
    document.getElementById('adminStatTop').textContent = stats.total
      ? (stats.pctA >= stats.pctB ? config.teamA.name : config.teamB.name)
      : '-';

    document.getElementById('adminTeamBars').innerHTML = stats.total
      ? teamBarsHTML(stats)
      : '<p class="empty-note">아직 예측 데이터가 없어요.</p>';

    document.getElementById('adminTop5List').innerHTML = stats.top5.length
      ? stats.top5.map((row) => `
          <li>
            <span class="top5-score">${row.score}</span>
            <div class="top5-track"><div class="top5-fill" style="width:${row.pct}%"></div></div>
            <span class="top5-count">${row.count}표 (${row.pct}%)</span>
          </li>`).join('')
      : '<li class="empty-note">아직 예측 데이터가 없어요.</li>';
  }

  /* ---------- 토스트 ---------- */
  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => (toast.hidden = true), 250);
    }, 2200);
  }

  /* ---------- init ---------- */
  if (isAuthed()) enterDashboard();
})();
