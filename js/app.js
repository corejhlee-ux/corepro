(function () {
  const { loadConfig, loadPredictions, addPrediction, computeStats } = window.WCStore;

  let config = loadConfig();
  /* finalists[0] = 4강 1경기 승자, finalists[1] = 4강 2경기 승자 */
  let draft = { name: '', finalists: [null, null], scoreA: 0, scoreB: 0, penalty: null };

  const screens = document.querySelectorAll('.screen');
  const progressWrap = document.getElementById('progressWrap');
  const progressSteps = document.querySelectorAll('#progress li');

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function showScreen(name) {
    screens.forEach((s) => {
      s.hidden = s.dataset.screen !== name;
    });
    if (['predict', 'complete'].includes(name)) {
      progressWrap.hidden = false;
      progressSteps.forEach((li) => {
        li.classList.toggle('active', li.dataset.step === name);
        const order = ['predict', 'complete'];
        li.classList.toggle('done', order.indexOf(li.dataset.step) < order.indexOf(name));
      });
    } else {
      progressWrap.hidden = true;
    }
    if (name === 'main') renderMain();
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
    const dateFmt = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
    document.getElementById('matchDateLine').textContent = dateFmt.format(matchDate);
    document.getElementById('matchStadiumLine').textContent = config.stadium;

    renderHeroChips();
    renderMatchRows();
    renderSemifinalResults();
    renderMainStats();
    renderParticipantCount();
    renderPicksList();
  }

  function renderSemifinalResults() {
    const dateFmt = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    const results = config.semifinalResults || [];
    const el = document.getElementById('semifinalResultsList');

    const semifinalRows = [0, 1].map((matchIdx) => {
      const teamA = config.semifinalTeams[matchIdx * 2];
      const teamB = config.semifinalTeams[matchIdx * 2 + 1];
      const result = results[matchIdx] || {};
      const played = result.scoreA !== null && result.scoreA !== undefined && result.scoreB !== null && result.scoreB !== undefined;
      const dateLabel = result.date ? dateFmt.format(new Date(result.date)) : '일정 미정';

      if (!played) {
        return `
          <div class="result-item">
            <span class="result-date">${dateLabel}</span> : ${teamA.flag} ${teamA.name} vs ${teamB.flag} ${teamB.name} <span class="result-date">(경기 예정)</span>
          </div>`;
      }

      const aWins = result.scoreA > result.scoreB;
      const bWins = result.scoreB > result.scoreA;
      const winIcon = '<span class="win-icon">🏆</span>';

      return `
        <div class="result-item">
          <span class="result-date">${dateLabel}</span> : <span class="result-team${aWins ? ' win' : ''}">${teamA.flag} ${teamA.name}${aWins ? winIcon : ''}</span> <span class="result-score">${result.scoreA} : ${result.scoreB}</span> <span class="result-team${bWins ? ' win' : ''}">${teamB.name} ${teamB.flag}${bWins ? winIcon : ''}</span>
        </div>`;
    });

    const thirdPlaceRow = config.thirdPlaceDate ? `
      <div class="result-item">
        <span class="result-date">${dateFmt.format(new Date(config.thirdPlaceDate))}</span> : 3·4위전 <span class="result-date">(예정)</span>
      </div>` : '';

    el.innerHTML = semifinalRows.join('') + thirdPlaceRow;
  }

  function renderPicksList() {
    const list = loadPredictions().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const el = document.getElementById('picksList');
    el.innerHTML = list.length
      ? list.map((p) => `
          <div class="picks-item">
            <span class="picks-name">${escapeHtml(p.name)}</span>의 선택은! ${p.teamAFlag} ${p.teamAName} <span class="picks-score">${p.scoreA} : ${p.scoreB}</span> ${p.teamBName} ${p.teamBFlag}
          </div>`).join('')
      : '<p class="empty-note">아직 참여자가 없어요. 첫 번째 참여자가 되어보세요!</p>';
  }

  function getWinPctByName() {
    const stats = computeStats(loadPredictions(), config);
    return new Map(stats.winnerBreakdown.map((t) => [t.name, t.pct]));
  }

  function renderHeroChips() {
    const pctByName = getWinPctByName();
    let topName = null;
    let topPct = -1;
    pctByName.forEach((pct, name) => { if (pct > topPct) { topPct = pct; topName = name; } });

    document.getElementById('heroChips').innerHTML = config.semifinalTeams
      .map((t) => {
        const pct = pctByName.get(t.name) || 0;
        const isTop = t.name === topName && pct > 0;
        return `<span class="hero-chip${isTop ? ' top' : ''}">${t.flag} ${t.name} <span class="hero-chip-pct">${pct}%</span></span>`;
      })
      .join('');
  }

  function renderParticipantCount() {
    const count = loadPredictions().length;
    document.getElementById('participantCountLine').innerHTML = `지금까지 <strong>${count.toLocaleString()}명</strong>이 참여했어요`;
  }

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

  function renderMainStats() {
    const stats = computeStats(loadPredictions(), config);
    document.getElementById('mainStatsChart').innerHTML = stats.total
      ? teamBarsHTML(stats)
      : '<p class="empty-note">아직 예측 데이터가 없어요. 첫 번째 참여자가 되어보세요!</p>';
  }

  document.getElementById('btnJoin').addEventListener('click', () => {
    const name = document.getElementById('mainUserName').value.trim();
    document.getElementById('errMainName').hidden = !!name;
    if (!name) return;
    resetDraftUI();
    draft.name = name;
    showScreen('predict');
  });

  /* ---------- 예측 입력: 4강 두 경기에서 각각 승자 선택 ---------- */
  function renderMatchRows() {
    const pctByName = getWinPctByName();
    const rows = [0, 1].map((matchIdx) => {
      const teams = [config.semifinalTeams[matchIdx * 2], config.semifinalTeams[matchIdx * 2 + 1]];
      const cards = teams.map((t, slot) => {
        const globalIdx = matchIdx * 2 + slot;
        const pct = pctByName.get(t.name) || 0;
        return `
        <button type="button" class="team-card semifinal-card" data-match="${matchIdx}" data-idx="${globalIdx}">
          <span class="team-flag">${t.flag}</span>
          <span class="team-name">${t.name}</span>
          <span class="team-pct">우승확률 ${pct}%</span>
          <span class="pick-badge">${matchIdx + 1}</span>
        </button>`;
      }).join('');
      return `<div class="match-row" data-match="${matchIdx}">${cards}</div>`;
    }).join('');
    document.getElementById('matchRows').innerHTML = rows;
  }

  function resetDraftUI() {
    draft = { name: '', finalists: [null, null], scoreA: 0, scoreB: 0, penalty: null };
    renderMatchRows();
    document.getElementById('pickCount').textContent = '(0/2)';
    document.getElementById('scoreA').value = 0;
    document.getElementById('scoreB').value = 0;
    document.getElementById('penaltyField').hidden = true;
    document.querySelectorAll('input[name="penalty"]').forEach((r) => (r.checked = false));
    syncMatchupFields();
    clearErrors();
  }

  function clearErrors() {
    document.querySelectorAll('.field-error').forEach((e) => (e.hidden = true));
  }

  document.getElementById('matchRows').addEventListener('click', (e) => {
    const card = e.target.closest('.semifinal-card');
    if (!card) return;
    const matchIdx = parseInt(card.dataset.match, 10);
    const idx = parseInt(card.dataset.idx, 10);
    const team = config.semifinalTeams[idx];
    draft.finalists[matchIdx] = { idx, ...team };

    document.getElementById('errFinalists').hidden = true;
    document.querySelectorAll(`.semifinal-card[data-match="${matchIdx}"]`).forEach((c) => {
      c.classList.toggle('selected', parseInt(c.dataset.idx, 10) === idx);
    });
    document.getElementById('pickCount').textContent = `(${draft.finalists.filter(Boolean).length}/2)`;
    syncMatchupFields();
  });

  function syncMatchupFields() {
    const [f0, f1] = draft.finalists;

    document.getElementById('scoreLabelA').innerHTML = f0 ? `${f0.flag} ${f0.name}` : '팀 1';
    document.getElementById('scoreLabelB').innerHTML = f1 ? `${f1.flag} ${f1.name}` : '팀 2';
    document.getElementById('penaltyNameA').innerHTML = f0 ? `${f0.flag} ${f0.name}` : '팀 1';
    document.getElementById('penaltyNameB').innerHTML = f1 ? `${f1.flag} ${f1.name}` : '팀 2';
  }

  function computeWinner() {
    if (draft.scoreA > draft.scoreB) return 'A';
    if (draft.scoreB > draft.scoreA) return 'B';
    return draft.penalty;
  }

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
    const [f0, f1] = draft.finalists;
    if (!f0 || !f1) {
      document.getElementById('errFinalists').hidden = false;
      ok = false;
    }
    if (f0 && f1 && draft.scoreA === draft.scoreB && !draft.penalty) {
      document.getElementById('errPenalty').hidden = false;
      ok = false;
    }
    if (!ok) return;

    const [teamA, teamB] = draft.finalists;
    const record = addPrediction({
      name: draft.name,
      teamAName: teamA.name,
      teamAFlag: teamA.flag,
      teamBName: teamB.name,
      teamBFlag: teamB.flag,
      winner: computeWinner(),
      scoreA: draft.scoreA,
      scoreB: draft.scoreB,
      penalty: draft.penalty
    });

    renderComplete(record);
    document.getElementById('mainUserName').value = '';
    showScreen('complete');
    showToast('참여가 완료됐어요! 🎉');
  });

  /* ---------- 참여 완료 (통계 요약 포함) ---------- */
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
    rows.push(['참여자', escapeHtml(record.name)]);
    rows.push(['접수 시각', new Date(record.createdAt).toLocaleString('ko-KR')]);

    document.getElementById('resultGrid').innerHTML = rows
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
      .join('');

    paintStats({
      total: 'statTotal', top: 'statTop', bars: 'completeTeamBars', top5: 'completeTop5List'
    });
  }

  /* ---------- 통계 ---------- */
  function paintStats(ids) {
    const list = loadPredictions();
    const stats = computeStats(list, config);

    document.getElementById(ids.total).textContent = stats.total.toLocaleString();
    document.getElementById(ids.top).textContent = stats.total && stats.winnerBreakdown[0].count
      ? stats.winnerBreakdown[0].name
      : '-';

    document.getElementById(ids.bars).innerHTML = stats.total
      ? teamBarsHTML(stats)
      : '<p class="empty-note">아직 예측 데이터가 없어요.</p>';

    document.getElementById(ids.top5).innerHTML = stats.top5.length
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

  function renderStats() {
    paintStats({ total: 'statTotal2', top: 'statTop2', bars: 'statsTeamBars', top5: 'top5List' });
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
