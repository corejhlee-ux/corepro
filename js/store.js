/* 이벤트 데이터 저장소 (localStorage 기반 데모용 — 실서비스 전환 시 이 파일의 함수만 API 호출로 교체) */
(function (global) {
  const CONFIG_KEY = 'wc_event_config_v1';
  const PREDICTIONS_KEY = 'wc_predictions_v1';

  const DEFAULT_CONFIG = {
    title: '월드컵 결승전 팀/스코어 맞추기',
    eyebrow: '2026 FIFA WORLD CUP',
    description: '결승 진출팀의 승자와 정확한 스코어를 예측하고\n추첨을 통해 푸짐한 경품을 받아가세요!',
    matchDateTime: '2026-07-19T15:00:00',
    stadium: 'MetLife Stadium (미국 뉴저지)',
    teamA: { name: 'A팀 (미정)', flag: '🏳️' },
    teamB: { name: 'B팀 (미정)', flag: '🏳️' },
    adminPasscode: 'admin1234'
  };

  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch (e) {
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  function loadPredictions() {
    try {
      const raw = localStorage.getItem(PREDICTIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function savePredictions(list) {
    localStorage.setItem(PREDICTIONS_KEY, JSON.stringify(list));
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
    const countA = list.filter((p) => p.winner === 'A').length;
    const countB = list.filter((p) => p.winner === 'B').length;
    const pctA = total ? Math.round((countA / total) * 100) : 0;
    const pctB = total ? Math.round((countB / total) * 100) : 0;

    const scoreMap = new Map();
    list.forEach((p) => {
      const key = `${p.scoreA}:${p.scoreB}`;
      scoreMap.set(key, (scoreMap.get(key) || 0) + 1);
    });
    const top5 = [...scoreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([score, count]) => ({ score, count, pct: total ? Math.round((count / total) * 100) : 0 }));

    return { total, countA, countB, pctA, pctB, top5 };
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
    DEFAULT_CONFIG
  };
})(window);
