(function () {
  const { loadConfig, saveConfig, loadPredictions, deletePrediction, clearAllPredictions, computeStats, getSafeStorage } = window.WCStore;
  const sessionStore = getSafeStorage('sessionStorage');

  const SESSION_KEY = 'wc_admin_authed';
  let config = loadConfig();

  const loginScreen = document.getElementById('loginScreen');
  const dashboardScreen = document.getElementById('dashboardScreen');
  const btnLogout = document.getElementById('btnLogout');

  function isAuthed() {
    try {
      return sessionStore.getItem(SESSION_KEY) === '1';
    } catch (e) {
      return false;
    }
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
      try { sessionStore.setItem(SESSION_KEY, '1'); } catch (e) { /* stays authed for this page load only */ }
      document.getElementById('loginError').hidden = true;
      enterDashboard();
    } else {
      document.getElementById('loginError').hidden = false;
    }
  });

  btnLogout.addEventListener('click', () => {
    try { sessionStore.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
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
    document.getElementById('cfgThirdPlaceDate').value = config.thirdPlaceDate || '';
    config.semifinalTeams.forEach((team, idx) => {
      document.getElementById(`cfgFlag${idx}`).value = team.flag;
      document.getElementById(`cfgName${idx}`).value = team.name;
    });
    (config.semifinalResults || []).forEach((result, idx) => {
      document.getElementById(`cfgResultDate${idx}`).value = result.date || '';
      document.getElementById(`cfgResultScoreA${idx}`).value = result.scoreA ?? '';
      document.getElementById(`cfgResultScoreB${idx}`).value = result.scoreB ?? '';
    });
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
      thirdPlaceDate: document.getElementById('cfgThirdPlaceDate').value,
      semifinalTeams: [0, 1, 2, 3].map((idx) => ({
        flag: document.getElementById(`cfgFlag${idx}`).value.trim() || '🏳️',
        name: document.getElementById(`cfgName${idx}`).value.trim() || `4강팀 ${idx + 1}`
      })),
      semifinalResults: [0, 1].map((idx) => {
        const scoreARaw = document.getElementById(`cfgResultScoreA${idx}`).value;
        const scoreBRaw = document.getElementById(`cfgResultScoreB${idx}`).value;
        return {
          date: document.getElementById(`cfgResultDate${idx}`).value,
          scoreA: scoreARaw === '' ? null : parseInt(scoreARaw, 10),
          scoreB: scoreBRaw === '' ? null : parseInt(scoreBRaw, 10)
        };
      })
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
      ? list.filter((p) => p.name.toLowerCase().includes(q))
      : list;

    const tbody = document.getElementById('participantsBody');
    document.getElementById('participantsEmpty').hidden = filtered.length !== 0;

    tbody.innerHTML = filtered.map((p) => {
      const winnerName = p.winner === 'A' ? p.teamAName : p.teamBName;
      const penalty = p.penalty ? (p.penalty === 'A' ? p.teamAName : p.teamBName) : '-';
      const finalists = `${p.teamAFlag} ${p.teamAName} vs ${p.teamBFlag} ${p.teamBName}`;
      return `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${finalists}</td>
          <td>${escapeHtml(winnerName)}</td>
          <td>${p.scoreA} : ${p.scoreB}</td>
          <td>${escapeHtml(penalty)}</td>
          <td>${new Date(p.createdAt).toLocaleString('ko-KR')}</td>
          <td><button type="button" class="row-delete" data-id="${p.id}">삭제</button></td>
        </tr>`;
    }).join('');
  }

  document.getElementById('participantSearch').addEventListener('input', (e) => renderParticipants(e.target.value));

  document.getElementById('participantsBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('.row-delete');
    if (!btn) return;
    const ok = await showConfirm('이 참여자 데이터를 삭제할까요?');
    if (!ok) return;
    deletePrediction(btn.dataset.id);
    renderParticipants();
    renderStats();
    showToast('삭제되었습니다.');
  });

  document.getElementById('btnResetParticipants').addEventListener('click', async () => {
    const list = loadPredictions();
    if (!list.length) {
      showToast('초기화할 참여이력이 없습니다.');
      return;
    }
    const ok = await showConfirm(`참여이력 전체(${list.length}건)를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`);
    if (!ok) return;
    clearAllPredictions();
    renderParticipants();
    renderStats();
    showToast('참여이력이 초기화되었습니다.');
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
    const header = ['참여자명', '결승 진출팀', '예상 우승팀', '스코어', '승부차기', '접수시각'];
    const rows = list.map((p) => [
      p.name,
      `${p.teamAName} vs ${p.teamBName}`,
      p.winner === 'A' ? p.teamAName : p.teamBName,
      `${p.scoreA}:${p.scoreB}`,
      p.penalty ? (p.penalty === 'A' ? p.teamAName : p.teamBName) : '',
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
    const maxCount = Math.max(0, ...stats.winnerBreakdown.map((t) => t.count));
    return stats.winnerBreakdown.map((t) => {
      const isTop = maxCount > 0 && t.count === maxCount;
      return `
      <div class="stat-bar-row">
        <span class="stat-bar-flag">${t.flag}</span>
        <span class="stat-bar-name${isTop ? ' top' : ''}">${t.name}</span>
        <div class="stat-bar-track"><div class="stat-bar-fill${isTop ? ' top' : ''}" style="width:${t.pct}%"></div></div>
        <span class="stat-bar-pct${isTop ? ' top' : ''}">${t.pct}%</span>
      </div>`;
    }).join('');
  }

  function renderStats() {
    config = loadConfig();
    const list = loadPredictions();
    const stats = computeStats(list, config);

    document.getElementById('adminStatTotal').textContent = stats.total.toLocaleString();
    document.getElementById('adminStatTop').textContent = stats.total && stats.winnerBreakdown[0].count
      ? stats.winnerBreakdown[0].name
      : '-';

    document.getElementById('adminTeamBars').innerHTML = stats.total
      ? teamBarsHTML(stats)
      : '<p class="empty-note">아직 예측 데이터가 없어요.</p>';

    document.getElementById('adminTop5List').innerHTML = stats.top5.length
      ? stats.top5.map((row, i) => `
          <li>
            <div class="top5-row-head">
              <span class="top5-label">${i === 0 ? '<span class="top5-rank">1위</span>' : ''}${row.label}</span>
              <span class="top5-count${i === 0 ? ' top' : ''}">${row.count}표 (${row.pct}%)</span>
            </div>
            <div class="top5-track"><div class="top5-fill${i === 0 ? ' top' : ''}" style="width:${row.pct}%"></div></div>
          </li>`).join('')
      : '<li class="empty-note">아직 예측 데이터가 없어요.</li>';
  }

  /* ---------- 커스텀 확인 모달 (샌드박스 환경에서 window.confirm이 막히는 문제 우회) ---------- */
  function showConfirm(message) {
    const overlay = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmModalMsg');
    const okBtn = document.getElementById('confirmModalOk');
    const cancelBtn = document.getElementById('confirmModalCancel');
    msgEl.textContent = message;
    overlay.hidden = false;
    return new Promise((resolve) => {
      function cleanup(result) {
        overlay.hidden = true;
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlay);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onOverlay(e) { if (e.target === overlay) cleanup(false); }
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlay);
    });
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
