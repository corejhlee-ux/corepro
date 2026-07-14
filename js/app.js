(function () {
  const { loadConfig, loadPredictions, addPrediction, computeStats } = window.WCStore;

  let config = loadConfig();
  let draft = { finalists: [], winner: null, scoreA: 0, scoreB: 0, penalty: null };

  const screens = document.querySelectorAll('.screen');
  const progressWrap = document.getElementById('progressWrap');
  const progressSteps = document.querySelectorAll('#progress li');

  function showScreen(name) {
    screens.forEach((s) => {
      s.hidden = s.dataset.screen !== name;
    });
    if (['predict', 'userinfo', 'complete'].includes(name)) {
      progressWrap.hidden = false;
      progressSteps.forEach((li) => {
        li.classList.toggle('active', li.dataset.step === name);
        const order = ['predict', 'userinfo', 'complete'];
        li.classList.toggle('done', order.indexOf(li.dataset.step) < order.indexOf(name));
      });
    } else {
      progressWrap.hidden = true;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => showScreen(el.dataset.nav));
  });

  /* ---------- 메인 화면 ---------- */
  function renderMain() {
    document.getElementById('heroEyebrow').textContent = config.eyebrow;
    document.getElementById('heroDesc').innerHTML = config.description.replace(/\n/g, '<br>');
    document.title = config.title;

    const matchDate = new Date(config.matchDateTime);
    const metaFmt = new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit'
    });
    document.getElementById('matchMeta').textContent =
      `⏰ ${metaFmt.format(matchDate)} · 📍 ${config.stadium}`;

    renderHeroChips();
    renderSemifinalGrid();
    renderMainStats();
    renderParticipantCount();
  }

  function renderHeroChips() {
    document.getElementById('heroChips').innerHTML = config.semifinalTeams
      .map((t) => `<span class="hero-chip">${t.flag} ${t.name}</span>`)
      .join('');
  }

  function renderParticipantCount() {
    const count = loadPredictions().length;
    document.getElementById('participantCountLine').textContent = `지금까지 ${count.toLocaleString()}명이 참여했어요`;
  }

  const FILL_CLASSES = ['fill-1', 'fill-2', 'fill-3', 'fill-4'];

  function teamBarsHTML(stats) {
    return stats.winnerBreakdown.map((t) => {
      const idx = config.semifinalTeams.findIndex((s) => s.name === t.name);
      const fillClass = FILL_CLASSES[idx >= 0 ? idx % FILL_CLASSES.length : 0];
      return `
      <div class="team-bar-row">
        <span class="team-bar-name">${t.flag} ${t.name}</span>
        <div class="team-bar-track"><div class="team-bar-fill ${fillClass}" style="width:${t.pct}%"></div></div>
        <span class="team-bar-pct">${t.pct}%</span>
      </div>`;
    }).join('');
  }

  function renderMainStats() {
    const stats = computeStats(loadPredictions(), config);
    document.getElementById('mainStatsChart').innerHTML = stats.total
      ? teamBarsHTML(stats)
      : '<p class="empty-note">아직 예측 데이터가 없어요. 첫 번째 참여자가 되어보세요!</p>';
  }

  document.getElementById('btnJoin').addEventListener('click', () => {
    resetDraftUI();
    showScreen('predict');
  });

  /* ---------- 예측 입력: 4강 진출팀 중 결승 진출 2팀 선택 ---------- */
  function renderSemifinalGrid() {
    const grid = document.getElementById('semifinalGrid');
    grid.innerHTML = config.semifinalTeams.map((t, idx) => `
      <button type="button" class="team-card semifinal-card" data-idx="${idx}">
        <span class="team-flag">${t.flag}</span>
        <span class="team-name">${t.name}</span>
        <span class="team-check"></span>
      </button>`).join('');
  }

  function resetDraftUI() {
    draft = { finalists: [], winner: null, scoreA: 0, scoreB: 0, penalty: null };
    renderSemifinalGrid();
    document.getElementById('pickCount').textContent = '(0/2)';
    document.getElementById('matchupFields').hidden = true;
    document.getElementById('scoreA').value = 0;
    document.getElementById('scoreB').value = 0;
    document.getElementById('penaltyField').hidden = true;
    document.querySelectorAll('input[name="penalty"]').forEach((r) => (r.checked = false));
    clearErrors();
  }

  function clearErrors() {
    document.querySelectorAll('.field-error').forEach((e) => (e.hidden = true));
  }

  document.getElementById('semifinalGrid').addEventListener('click', (e) => {
    const card = e.target.closest('.semifinal-card');
    if (!card) return;
    const idx = parseInt(card.dataset.idx, 10);
    const team = config.semifinalTeams[idx];
    const existingPos = draft.finalists.findIndex((t) => t.idx === idx);

    if (existingPos >= 0) {
      draft.finalists.splice(existingPos, 1);
    } else if (draft.finalists.length < 2) {
      draft.finalists.push({ idx, ...team });
    } else {
      showToast('결승 진출팀은 최대 2팀까지 선택할 수 있어요.');
      return;
    }

    document.getElementById('errFinalists').hidden = true;
    syncSemifinalGrid();
    syncMatchupFields();
  });

  function syncSemifinalGrid() {
    const selectedIdx = draft.finalists.map((t) => t.idx);
    document.querySelectorAll('.semifinal-card').forEach((card) => {
      const idx = parseInt(card.dataset.idx, 10);
      const pos = selectedIdx.indexOf(idx);
      card.classList.toggle('selected', pos >= 0);
      card.classList.toggle('disabled', pos < 0 && selectedIdx.length >= 2);
      card.querySelector('.team-check').textContent = pos >= 0 ? String(pos + 1) : '';
    });
    document.getElementById('pickCount').textContent = `(${selectedIdx.length}/2)`;
  }

  function syncMatchupFields() {
    const ready = draft.finalists.length === 2;
    document.getElementById('matchupFields').hidden = !ready;
    if (!ready) return;

    const [teamA, teamB] = draft.finalists;
    document.getElementById('winnerFlagA').textContent = teamA.flag;
    document.getElementById('winnerNameA').textContent = teamA.name;
    document.getElementById('winnerFlagB').textContent = teamB.flag;
    document.getElementById('winnerNameB').textContent = teamB.name;
    document.getElementById('scoreLabelA').textContent = `${teamA.flag} ${teamA.name}`;
    document.getElementById('scoreLabelB').textContent = `${teamB.flag} ${teamB.name}`;
    document.getElementById('penaltyNameA').textContent = `${teamA.flag} ${teamA.name}`;
    document.getElementById('penaltyNameB').textContent = `${teamB.flag} ${teamB.name}`;

    draft.winner = null;
    draft.scoreA = 0;
    draft.scoreB = 0;
    draft.penalty = null;
    document.getElementById('scoreA').value = 0;
    document.getElementById('scoreB').value = 0;
    document.getElementById('penaltyField').hidden = true;
    document.querySelectorAll('#winnerPick .team-card').forEach((c) => c.classList.remove('selected'));
    document.querySelectorAll('input[name="penalty"]').forEach((r) => (r.checked = false));
  }

  document.getElementById('winnerPick').addEventListener('click', (e) => {
    const card = e.target.closest('.team-card');
    if (!card) return;
    draft.winner = card.dataset.slot;
    document.querySelectorAll('#winnerPick .team-card').forEach((c) => c.classList.toggle('selected', c === card));
    document.getElementById('errWinner').hidden = true;
  });

  document.querySelectorAll('.stepper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.stepTarget;
      const input = document.getElementById(targetId);
      const delta = parseInt(btn.dataset.delta, 10);
      const next = Math.min(20, Math.max(0, parseInt(input.value, 10) + delta));
      input.value = next;
      draft[targetId] = next;
      togglePenaltyField();
    });
  });

  function togglePenaltyField() {
    const field = document.getElementById('penaltyField');
    const tie = draft.scoreA === draft.scoreB;
    field.hidden = !tie;
    if (!tie) {
      draft.penalty = null;
      document.querySelectorAll('input[name="penalty"]').forEach((r) => (r.checked = false));
    }
  }

  document.getElementById('penaltyPick').addEventListener('change', (e) => {
    if (e.target.name === 'penalty') {
      draft.penalty = e.target.value;
      document.getElementById('errPenalty').hidden = true;
    }
  });

  document.getElementById('predictForm').addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors();
    let ok = true;
    if (draft.finalists.length !== 2) {
      document.getElementById('errFinalists').hidden = false;
      ok = false;
    } else if (!draft.winner) {
      document.getElementById('errWinner').hidden = false;
      ok = false;
    }
    if (draft.finalists.length === 2 && draft.scoreA === draft.scoreB && !draft.penalty) {
      document.getElementById('errPenalty').hidden = false;
      ok = false;
    }
    if (!ok) return;
    showScreen('userinfo');
  });

  /* ---------- 참여자 정보 ---------- */
  const consentModal = document.getElementById('consentModal');
  document.getElementById('btnConsentDetail').addEventListener('click', () => (consentModal.hidden = false));
  document.getElementById('btnConsentClose').addEventListener('click', () => (consentModal.hidden = true));
  consentModal.addEventListener('click', (e) => {
    if (e.target === consentModal) consentModal.hidden = true;
  });

  const PHONE_RE = /^01[0-9]-?\d{3,4}-?\d{4}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  document.getElementById('userForm').addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors();
    let ok = true;

    const name = document.getElementById('userName').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const consent = document.getElementById('userConsent').checked;

    if (!name) {
      document.getElementById('errName').hidden = false;
      ok = false;
    }
    if (!PHONE_RE.test(phone)) {
      document.getElementById('errPhone').hidden = false;
      ok = false;
    }
    if (!EMAIL_RE.test(email)) {
      document.getElementById('errEmail').hidden = false;
      ok = false;
    }
    if (!consent) {
      document.getElementById('errConsent').hidden = false;
      ok = false;
    }
    if (!ok) return;

    const [teamA, teamB] = draft.finalists;
    const record = addPrediction({
      name,
      phone,
      email,
      teamAName: teamA.name,
      teamAFlag: teamA.flag,
      teamBName: teamB.name,
      teamBFlag: teamB.flag,
      winner: draft.winner,
      scoreA: draft.scoreA,
      scoreB: draft.scoreB,
      penalty: draft.penalty
    });

    renderComplete(record);
    document.getElementById('userForm').reset();
    showScreen('complete');
    showToast('참여가 완료됐어요! 🎉');
  });

  /* ---------- 참여 완료 ---------- */
  function renderComplete(record) {
    document.getElementById('completeGreeting').textContent =
      `${record.name}님의 예측이 정상적으로 접수되었습니다.`;

    const winnerLabel = record.winner === 'A'
      ? `${record.teamAFlag} ${record.teamAName}`
      : `${record.teamBFlag} ${record.teamBName}`;

    let rows = [
      ['결승 진출팀', `${record.teamAFlag} ${record.teamAName} vs ${record.teamBFlag} ${record.teamBName}`],
      ['예상 우승팀', winnerLabel],
      ['예상 스코어', `${record.teamAName} ${record.scoreA} : ${record.scoreB} ${record.teamBName}`]
    ];
    if (record.penalty) {
      const penLabel = record.penalty === 'A' ? record.teamAName : record.teamBName;
      rows.push(['승부차기 승리팀', penLabel]);
    }
    rows.push(['참여자', record.name]);
    rows.push(['접수 시각', new Date(record.createdAt).toLocaleString('ko-KR')]);

    document.getElementById('resultGrid').innerHTML = rows
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join('');
  }

  /* ---------- 통계 ---------- */
  function renderStats() {
    const list = loadPredictions();
    const stats = computeStats(list, config);

    document.getElementById('statTotal').textContent = stats.total.toLocaleString();
    document.getElementById('statTop').textContent = stats.total && stats.winnerBreakdown[0].count
      ? stats.winnerBreakdown[0].name
      : '-';

    document.getElementById('statsTeamBars').innerHTML = stats.total
      ? teamBarsHTML(stats)
      : '<p class="empty-note">아직 예측 데이터가 없어요.</p>';

    document.getElementById('top5List').innerHTML = stats.top5.length
      ? stats.top5.map((row) => `
          <li>
            <div class="top5-label">${row.label}</div>
            <div class="top5-meta">
              <div class="top5-track"><div class="top5-fill" style="width:${row.pct}%"></div></div>
              <span class="top5-count">${row.count}표 (${row.pct}%)</span>
            </div>
          </li>`).join('')
      : '<li class="empty-note">아직 예측 데이터가 없어요.</li>';
  }

  document.querySelectorAll('[data-nav="stats"]').forEach((el) => {
    el.addEventListener('click', renderStats);
  });

  /* ---------- 카운트다운 ---------- */
  function tickCountdown() {
    const target = new Date(config.matchDateTime).getTime();
    const now = Date.now();
    const diff = Math.max(0, target - now);

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    document.getElementById('cdDays').textContent = String(days).padStart(2, '0');
    document.getElementById('cdHours').textContent = String(hours).padStart(2, '0');
    document.getElementById('cdMinutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('cdSeconds').textContent = String(seconds).padStart(2, '0');

    if (diff <= 0) {
      document.getElementById('countdown').classList.add('kickoff');
    }
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
  function init() {
    config = loadConfig();
    renderMain();
    showScreen('main');
    tickCountdown();
    setInterval(tickCountdown, 1000);
    window.addEventListener('storage', () => {
      config = loadConfig();
      renderMain();
    });
  }

  init();
})();
