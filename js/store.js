/* 이벤트 데이터 저장소 (localStorage 기반 데모용 — 실서비스 전환 시 이 파일의 함수만 API 호출로 교체) */
(function (global) {
  const CONFIG_KEY = 'wc_event_config_v1';
  const PREDICTIONS_KEY = 'wc_predictions_v1';

  function createMemoryStorage() {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); }
    };
  }

  function getSafeStorage(kind) {
    try {
      const s = global[kind];
      const probeKey = '__wc_probe__';
      s.setItem(probeKey, '1');
      s.removeItem(probeKey);
      return s;
    } catch (e) {
      return createMemoryStorage();
    }
  }

  const storage = getSafeStorage('localStorage');

  const DEFAULT_CONFIG = {
    title: '월드컵 결승전 팀/스코어 맞추기',
    eyebrow: '2026 FIFA WORLD CUP',
    description: '4강 진출팀 중 결승에 오를 두 팀과 정확한 스코어를 예측하고\n추첨을 통해 푸짐한 경품을 받아가세요!',
    matchDateTime: '2026-07-19T15:00:00',
    stadium: 'MetLife Stadium (미국 뉴저지)',
    semifinalTeams: [
      { name: '4강팀 1 (미정)', flag: '🏳️' },
      { name: '4강팀 2 (미정)', flag: '🏳️' },
      { name: '4강팀 3 (미정)', flag: '🏳️' },
      { name: '4강팀 4 (미정)', flag: '🏳️' }
    ],
    adminPasscode: 'admin1234'
  };

  function loadConfig() {
    try {
      const raw = storage.getItem(CONFIG_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch (e) {
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig(config) {
    try {
      storage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (e) { /* storage unavailable — change stays in memory for this session only */ }
  }

  function loadPredictions() {
    try {
      const raw = storage.getItem(PREDICTIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function savePredictions(list) {
    try {
      storage.setItem(PREDICTIONS_KEY, JSON.stringify(list));
    } catch (e) { /* storage unavailable — change stays in memory for this session only */ }
  }

  function addPrediction(entry) {
    const list = loadPredictions();
    const record = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      createdAt: new Date().toISOString(),
      ...entry
    };
    list.push(record);
    savePredictions(list);
    return record;
  }

  function deletePrediction(id) {
    const list = loadPredictions().filter((p) => p.id !== id);
    savePredictions(list);
  }

  function clearAllPredictions() {
    savePredictions([]);
  }

  function computeStats(list, config) {
    const total = list.length;

    const winnerTally = new Map();
    list.forEach((p) => {
      const name = p.winner === 'A' ? p.teamAName : p.teamBName;
      const flag = p.winner === 'A' ? p.teamAFlag : p.teamBFlag;
      const cur = winnerTally.get(name) || { flag, count: 0 };
      cur.count += 1;
      winnerTally.set(name, cur);
    });

    const winnerBreakdown = (config ? config.semifinalTeams : [])
      .map((team) => {
        const tally = winnerTally.get(team.name);
        const count = tally ? tally.count : 0;
        return { name: team.name, flag: team.flag, count, pct: total ? Math.round((count / total) * 100) : 0 };
      })
      .sort((a, b) => b.count - a.count);

    const scoreMap = new Map();
    list.forEach((p) => {
      const key = `${p.teamAFlag} ${p.teamAName} ${p.scoreA} : ${p.scoreB} ${p.teamBName} ${p.teamBFlag}`;
      scoreMap.set(key, (scoreMap.get(key) || 0) + 1);
    });
    const top5 = [...scoreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count, pct: total ? Math.round((count / total) * 100) : 0 }));

    return { total, winnerBreakdown, top5 };
  }

  global.WCStore = {
    loadConfig,
    saveConfig,
    loadPredictions,
    savePredictions,
    addPrediction,
    deletePrediction,
    clearAllPredictions,
    computeStats,
    getSafeStorage,
    DEFAULT_CONFIG
  };
})(window);
