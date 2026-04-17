// ═══════════════════════════════════════════════════════════════
// ASHVAREN GAMES — Shared Championship Engine
// Loaded by all game pages via <script src="ashvaren.js">
// ═══════════════════════════════════════════════════════════════

const ACV = (() => {

  // ── Storage keys ────────────────────────────────────────────
  const K_PLAYERS = "acv-players";
  const K_RESULTS = "acv-results";   // array of result objects
  const K_ELO     = "acv-elo";       // { playerId: rating }

  // ── Default player set ───────────────────────────────────────
  const DEFAULT_PLAYERS = [
    { id:"mike",      name:"Mike",      colour:"#2e6fc4", initial:"M"  },
    { id:"lucy",      name:"Lucy",      colour:"#9b6fc4", initial:"L"  },
    { id:"benjamin",  name:"Benjamin",  colour:"#e05c3a", initial:"B"  },
    { id:"joel",      name:"Joel",      colour:"#50c878", initial:"J"  },
    { id:"charlotte", name:"Charlotte", colour:"#c8924a", initial:"C"  },
  ];

  // ── Players ──────────────────────────────────────────────────
  function getPlayers() {
    try {
      const raw = localStorage.getItem(K_PLAYERS);
      return raw ? JSON.parse(raw) : DEFAULT_PLAYERS.map(p => ({...p}));
    } catch { return DEFAULT_PLAYERS.map(p => ({...p})); }
  }
  function savePlayers(players) {
    localStorage.setItem(K_PLAYERS, JSON.stringify(players));
  }
  function addPlayer(name, colour) {
    const players = getPlayers();
    const id = name.toLowerCase().replace(/\s+/g,"_") + "_" + Date.now();
    players.push({ id, name: name.trim(), colour, initial: name.trim()[0].toUpperCase() });
    savePlayers(players);
    return id;
  }
  function removePlayer(id) {
    const players = getPlayers().filter(p => p.id !== id);
    savePlayers(players);
  }

  // ── Elo ──────────────────────────────────────────────────────
  const ELO_K = 32;
  const ELO_DEFAULT = 1000;

  function getElo() {
    try { return JSON.parse(localStorage.getItem(K_ELO) || "{}"); }
    catch { return {}; }
  }
  function saveElo(elo) { localStorage.setItem(K_ELO, JSON.stringify(elo)); }

  function playerElo(id) {
    const elo = getElo();
    return elo[id] ?? ELO_DEFAULT;
  }

  function updateElo(winnerId, loserId, isDraw) {
    const elo = getElo();
    const ra  = elo[winnerId] ?? ELO_DEFAULT;
    const rb  = elo[loserId]  ?? ELO_DEFAULT;
    const ea  = 1 / (1 + Math.pow(10, (rb - ra) / 400));
    const eb  = 1 - ea;
    const sa  = isDraw ? 0.5 : 1;
    const sb  = isDraw ? 0.5 : 0;
    elo[winnerId] = Math.round(ra + ELO_K * (sa - ea));
    elo[loserId]  = Math.round(rb + ELO_K * (sb - eb));
    saveElo(elo);
  }

  // ── Results ──────────────────────────────────────────────────
  function getResults() {
    try { return JSON.parse(localStorage.getItem(K_RESULTS) || "[]"); }
    catch { return []; }
  }
  function saveResults(r) { localStorage.setItem(K_RESULTS, JSON.stringify(r)); }

  // game: "dots"|"hex"|"mines"
  // players: array of { id, name } (1 or 2)
  // winnerId: id string or null for draw
  // meta: optional object (e.g. { time: 42 } for minesweeper)
  function recordResult({ game, players, winnerId, meta }) {
    const results = getResults();
    const entry = {
      id:        Date.now() + Math.random(),
      game,
      players:   players.map(p => p.id),
      names:     players.map(p => p.name),
      winnerId:  winnerId ?? null,
      ts:        Date.now(),
      meta:      meta || {},
    };
    results.unshift(entry);
    if (results.length > 200) results.length = 200;
    saveResults(results);

    // Update Elo (two-player games only)
    if (players.length === 2) {
      const [a, b] = players.map(p => p.id);
      if (winnerId === a)       updateElo(a, b, false);
      else if (winnerId === b)  updateElo(b, a, false);
      else                      updateElo(a, b, true);
    }
    return entry;
  }

  // ── Stats helpers ────────────────────────────────────────────
  function statsFor(playerId) {
    const results = getResults().filter(r => r.players.includes(playerId));
    const byGame  = { dots:{w:0,l:0,d:0}, hex:{w:0,l:0,d:0}, mines:{w:0,l:0,d:0} };
    let   total   = { w:0, l:0, d:0 };
    let   streak  = 0, currentStreak = 0;

    results.forEach(r => {
      const g = r.game;
      if (!byGame[g]) byGame[g] = {w:0,l:0,d:0};
      if (r.winnerId === null) {
        byGame[g].d++; total.d++;
      } else if (r.winnerId === playerId) {
        byGame[g].w++; total.w++;
      } else {
        byGame[g].l++; total.l++;
      }
    });

    // Current streak (most recent results)
    for (const r of results) {
      if (r.players.length < 2) break;
      if (r.winnerId === playerId) currentStreak++;
      else { break; }
    }

    return { byGame, total, streak: currentStreak, elo: playerElo(playerId) };
  }

  function headToHead(idA, idB) {
    const results = getResults().filter(r =>
      r.players.includes(idA) && r.players.includes(idB)
    );
    let wA=0, wB=0, d=0;
    results.forEach(r => {
      if (r.winnerId===idA) wA++;
      else if (r.winnerId===idB) wB++;
      else d++;
    });
    return { wA, wB, d, total: results.length };
  }

  function leaderboard() {
    const players = getPlayers();
    const elo     = getElo();
    return players
      .map(p => ({
        ...p,
        elo:   elo[p.id] ?? ELO_DEFAULT,
        stats: statsFor(p.id),
      }))
      .sort((a,b) => b.elo - a.elo);
  }

  function recentResults(n=12) {
    const players = getPlayers();
    const pMap    = Object.fromEntries(players.map(p => [p.id, p]));
    return getResults().slice(0, n).map(r => ({ ...r, pMap }));
  }

  function clearAll() {
    localStorage.removeItem(K_RESULTS);
    localStorage.removeItem(K_ELO);
  }

  // ── Game name display ────────────────────────────────────────
  const GAME_LABELS = { dots:"Dots & Boxes", hex:"Hex", mines:"Minefield" };
  const GAME_COLOURS = { dots:"#e05c3a", hex:"#c8924a", mines:"#2e6fc4" };

  // ── Public API ───────────────────────────────────────────────
  return {
    getPlayers, savePlayers, addPlayer, removePlayer,
    recordResult, getResults, statsFor, headToHead,
    leaderboard, recentResults, playerElo, clearAll,
    GAME_LABELS, GAME_COLOURS, DEFAULT_PLAYERS,
  };
})();
