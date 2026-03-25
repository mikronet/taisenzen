import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';

const API = '/api/coreo-judge';

function categoryColor(cat) {
  const c = cat?.toLowerCase();
  if (c === 'solo') return '#7ecfff';
  if (c === 'parejas') return '#a78bfa';
  if (c === 'grupo') return '#34d399';
  if (c === 'minicrew') return '#fb923c';
  if (c === 'megacrew') return '#f472b6';
  return '#94a3b8';
}

function apiFetch(url, options = {}) {
  const code = sessionStorage.getItem('coreoJudgeCode') || '';
  return fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-judge-code': code, ...(options.headers || {}) },
  });
}

// ── Login screen ─────────────────────────────────────────────────────────────
function JudgeLogin({ onLogin }) {
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('code') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error'); return; }
      sessionStorage.setItem('coreoJudgeCode', code.trim());
      sessionStorage.setItem('coreoJudgeId', data.judge.id);
      sessionStorage.setItem('coreoJudgeTournamentId', data.judge.tournament_id);
      onLogin(data.judge);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a12' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '380px' }}>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.25em', color: '#7ecfff', marginBottom: '2px' }}>ZEN TAISEN</p>
        <h2 style={{ marginBottom: '20px', color: '#7ecfff', fontSize: '0.85rem', letterSpacing: '0.2em' }}>JUEZ — COREOGRAFÍA</h2>
        <input
          type="text" placeholder="Código de acceso"
          value={code} onChange={e => setCode(e.target.value)}
          style={{ width: '100%', marginBottom: '12px' }}
          autoComplete="off" autoCapitalize="none"
        />
        {error && <p style={{ color: 'var(--accent)', marginBottom: '12px', fontSize: '0.9rem' }}>{error}</p>}
        <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

// ── Score form for one participant ────────────────────────────────────────────
function ScoreForm({ participant, criteria, judgeId, onSaved, onLoaded }) {
  const [scores, setScores] = useState({}); // { criterionId: value }
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0); // retry counter for UI feedback
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    setSaved(false); setError(''); setFetching(true);
    apiFetch(`${API}/scores/${judgeId}/${participant.id}`)
      .then(r => r.json())
      .then(data => {
        const map = {};
        (data.scores || []).forEach(s => { map[s.criterion_id] = s.score; });
        criteria.forEach(c => { if (!(c.id in map)) map[c.id] = 0; });
        setScores(map);
        const hasSaved = data.scores?.length > 0;
        setSaved(hasSaved);
        if (onLoaded) onLoaded(participant.id, map, hasSaved);
      })
      .catch(() => {
        const map = {};
        criteria.forEach(c => { map[c.id] = 0; });
        setScores(map);
      })
      .finally(() => setFetching(false));
  }, [participant.id, judgeId, criteria]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (criterionId, value) => {
    setSaved(false);
    setScores(prev => ({ ...prev, [criterionId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setAttempt(0);
    const payload = criteria.map(c => ({ criterionId: c.id, score: Number(scores[c.id] ?? 0) }));
    const MAX_RETRIES = 3;
    for (let i = 0; i <= MAX_RETRIES; i++) {
      if (i > 0) {
        setAttempt(i);
        await new Promise(r => setTimeout(r, 1000 * i)); // 1s, 2s, 3s backoff
      }
      try {
        const res = await apiFetch(`${API}/scores`, {
          method: 'POST',
          body: JSON.stringify({ participantId: participant.id, scores: payload }),
        });
        if (res.ok) { setSaved(true); onSaved(participant.id, scores); setLoading(false); setAttempt(0); return; }
        // Client error (4xx) → no point retrying
        if (res.status < 500) { const d = await res.json(); setError(d.error || 'Error al guardar'); break; }
      } catch {
        // Network error → retry unless last attempt
        if (i === MAX_RETRIES) setError('Error de red. Comprueba tu conexión.');
      }
    }
    setLoading(false); setAttempt(0);
  };

  if (fetching) return <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>Cargando...</div>;

  return (
    <form onSubmit={handleSubmit}>
      {criteria.map(c => {
        const val = Number(scores[c.id] ?? 0);
        const pct = (val / c.max_score) * 100;
        return (
          <div key={c.id} style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ color: '#ccc', fontSize: '0.9rem', letterSpacing: '0.05em' }}>{c.name}</label>
              <span style={{ color: '#7ecfff', fontWeight: 700, fontSize: '1.1rem', minWidth: '60px', textAlign: 'right' }}>
                {val.toFixed(1)} <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>/ {c.max_score}</span>
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="range" min={0} max={c.max_score} step={0.1}
                value={val}
                onChange={e => handleChange(c.id, parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#7ecfff' }}
              />
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '-2px', pointerEvents: 'none', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: '#7ecfff', transition: 'width 0.1s' }} />
              </div>
            </div>
            {/* Also allow direct numeric input */}
            <input
              type="number" min={0} max={c.max_score} step={0.1}
              value={val}
              onChange={e => {
                const v = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), c.max_score);
                handleChange(c.id, v);
              }}
              style={{ width: '100%', marginTop: '8px', textAlign: 'center', fontSize: '1rem' }}
            />
          </div>
        );
      })}
      {error && <p style={{ color: 'var(--accent)', marginBottom: '12px', fontSize: '0.9rem' }}>{error}</p>}
      <button type="submit" className="btn-primary" style={{ width: '100%', fontSize: '1rem', padding: '14px' }} disabled={loading}>
        {loading
          ? attempt > 0 ? `Reintentando (${attempt}/3)...` : 'Guardando...'
          : saved ? 'Actualizar puntuaciones' : 'Guardar puntuaciones'}
      </button>
      {saved && (
        <p style={{ color: '#34d399', textAlign: 'center', marginTop: '12px', fontSize: '0.9rem', letterSpacing: '0.1em' }}>
          Guardado
        </p>
      )}
    </form>
  );
}

function fmtTimer(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Main judge panel ──────────────────────────────────────────────────────────
function JudgePanel({ judge, onLogout }) {
  const socket = useSocket();
  const [state, setState] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [participantScores, setParticipantScores] = useState({}); // { pid: { criterionId: score } }
  const [onStageId, setOnStageId] = useState(null);
  const [onStageAt, setOnStageAt] = useState(null); // ms timestamp when timer started
  const [nowMs, setNowMs] = useState(Date.now());
  const [glowing, setGlowing] = useState(false); // triggers glow burst on new on-stage event
  const [globalScores, setGlobalScores] = useState({}); // { pid: { globalAvg, judgesVoted } }
  const [totalJudges, setTotalJudges] = useState(0);
  const [sidebarCatCollapsed, setSidebarCatCollapsed] = useState({});
  const itemRefs = useRef({}); // participantId → DOM button ref
  const sidebarRef = useRef(null);

  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const scrollToParticipant = useCallback((pid) => {
    const el = itemRefs.current[pid];
    if (el && sidebarRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  const loadGlobalScores = useCallback(async () => {
    const res = await apiFetch(`${API}/tournament/${judge.tournament_id}/global-scores`);
    if (!res.ok) return;
    const d = await res.json();
    setTotalJudges(d.totalJudges);
    setGlobalScores(d.participantScores || {});
  }, [judge.tournament_id]);

  const load = useCallback(async () => {
    const res = await apiFetch(`${API}/tournament/${judge.tournament_id}/state`);
    if (!res.ok) return;
    const data = await res.json();
    setState(data);
    const onStage = data.participants.find(p => p.on_stage);
    if (onStage) {
      setOnStageId(onStage.id);
      setOnStageAt(onStage.on_stage_at || null);
      setSelectedId(prev => prev ?? onStage.id);
    } else {
      setOnStageAt(null);
    }
  }, [judge.tournament_id]);

  useEffect(() => { load(); loadGlobalScores(); }, [load, loadGlobalScores]);

  // Scroll to on-stage participant whenever it changes
  useEffect(() => {
    if (onStageId) scrollToParticipant(onStageId);
  }, [onStageId, scrollToParticipant]);

  // Auto-collapse sidebar categories: expand only the one containing the on-stage participant
  useEffect(() => {
    if (!state || !onStageId) return;
    const onStageP = state.participants.find(p => p.id === onStageId);
    if (!onStageP) return;
    const activeKey = `${onStageP.round_number || 1}:${onStageP.category || '—'}`;
    const newCollapsed = {};
    for (const p of state.participants) {
      const key = `${p.round_number || 1}:${p.category || '—'}`;
      if (!(key in newCollapsed)) newCollapsed[key] = key !== activeKey;
    }
    setSidebarCatCollapsed(newCollapsed);
  }, [onStageId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socket) return;
    socket.on('coreo:scores-updated', loadGlobalScores);
    return () => socket.off('coreo:scores-updated', loadGlobalScores);
  }, [socket, loadGlobalScores]);

  useEffect(() => {
    if (!socket) return;
    let initialConnect = true;
    const join = () => {
      socket.emit('join:judge', { tournamentId: judge.tournament_id, judgeId: judge.id });
      // On reconnection reload data to catch missed on-stage events and score updates
      if (!initialConnect) { load(); loadGlobalScores(); }
      initialConnect = false;
    };
    join();
    socket.on('connect', join);
    socket.on('coreo:on-stage', ({ participant }) => {
      setState(prev => prev ? {
        ...prev,
        participants: prev.participants.map(p => ({ ...p, on_stage: p.id === participant.id ? 1 : 0 })),
      } : prev);
      setOnStageId(participant.id);
      setOnStageAt(null); // timer not started yet
      setSelectedId(participant.id);
      setGlowing(false);
      setTimeout(() => setGlowing(true), 10);
    });
    socket.on('coreo:off-stage', () => {
      setState(prev => prev ? {
        ...prev,
        participants: prev.participants.map(p => ({ ...p, on_stage: 0 })),
      } : prev);
      setOnStageId(null);
      setOnStageAt(null);
    });
    socket.on('coreo:timer-started', ({ on_stage_at }) => {
      setOnStageAt(on_stage_at);
    });
    socket.on('coreo:timer-stopped', () => {
      setOnStageAt(null);
    });
    return () => {
      socket.off('connect', join);
      socket.off('coreo:on-stage');
      socket.off('coreo:off-stage');
      socket.off('coreo:timer-started');
      socket.off('coreo:timer-stopped');
    };
  }, [socket, judge]);

  if (!state) return <div style={{ minHeight: '100vh', background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>Cargando...</div>;

  const selected = state.participants.find(p => p.id === selectedId);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a12', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid #1a1a2e', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.2em', color: '#7ecfff' }}>ZEN TAISEN</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: '12px', fontSize: '0.8rem' }}>JUEZ: {judge.name}</span>
        </div>
        <button onClick={onLogout} style={{ background: 'none', border: '1px solid #333', color: '#666', fontSize: '0.75rem', padding: '5px 12px', borderRadius: '20px', cursor: 'pointer' }}>Salir</button>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 57px)' }}>
        {/* Sidebar: participant list */}
        <div ref={sidebarRef} style={{ width: '200px', borderRight: '1px solid #1a1a2e', overflowY: 'auto', flexShrink: 0 }}>
          {(() => {
            // Rank map: position within same round+category by avg score
            const pidInfo = {};
            state.participants.forEach(p => { pidInfo[p.id] = { round: p.round_number || 1, cat: p.category || '' }; });
            const groups = {};
            Object.entries(participantScores).forEach(([pid, sc]) => {
              const vals = Object.values(sc);
              const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
              if (avg == null) return;
              const info = pidInfo[Number(pid)];
              if (!info) return;
              const key = `${info.round}|${info.cat}`;
              if (!groups[key]) groups[key] = [];
              groups[key].push({ pid: Number(pid), avg });
            });
            const rankMap = {};
            Object.values(groups).forEach(entries => {
              entries.sort((a, b) => b.avg - a.avg);
              entries.forEach((e, i) => { rankMap[e.pid] = i + 1; });
            });

            const sorted = [...state.participants].sort((a, b) => (a.act_order ?? 9999) - (b.act_order ?? 9999));
            const roundMap = {}; const roundOrder = [];
            for (const p of sorted) {
              const r = p.round_number || 1;
              const cat = p.category || '—';
              if (!roundMap[r]) { roundMap[r] = { catMap: {}, catOrder: [] }; roundOrder.push(r); }
              if (!roundMap[r].catMap[cat]) { roundMap[r].catMap[cat] = []; roundMap[r].catOrder.push(cat); }
              roundMap[r].catMap[cat].push(p);
            }
            let counter = 0;
            return roundOrder.map(r => (
              <div key={r}>
                <div style={{ padding: '6px 12px', fontSize: '0.65rem', letterSpacing: '0.18em', color: '#7ecfff', fontFamily: "'Bebas Neue', sans-serif", background: 'rgba(126,207,255,0.05)', borderBottom: '1px solid #1a1a2e' }}>
                  BLOQUE {r}
                </div>
                {roundMap[r].catOrder.map(cat => {
                  const cKey = `${r}:${cat}`;
                  const catCollapsed = !!sidebarCatCollapsed[cKey];
                  const catParts = roundMap[r].catMap[cat];
                  const hasCatOnStage = catParts.some(p => p.id === onStageId);
                  return (
                    <div key={cat}>
                      <div
                        onClick={() => setSidebarCatCollapsed(prev => ({ ...prev, [cKey]: !prev[cKey] }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', cursor: 'pointer', userSelect: 'none', background: hasCatOnStage ? 'rgba(126,207,255,0.04)' : 'none', borderBottom: '1px solid #1a1a2e' }}
                      >
                        <span style={{ color: categoryColor(cat), fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', flex: 1 }}>{cat === '—' ? 'Sin categoría' : cat}</span>
                        {hasCatOnStage && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#7ecfff', boxShadow: '0 0 5px #7ecfff', display: 'inline-block', animation: 'dotPulse 1.5s ease-in-out infinite' }} />}
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.6rem' }}>{catCollapsed ? '▶' : '▼'}</span>
                      </div>
                      {!catCollapsed && catParts.map(p => {
                        counter++;
                        const pos = counter;
                        const isSelected = p.id === selectedId;
                        const isSaved = savedIds.has(p.id);
                        const isOnStage = p.id === onStageId;
                        return (
                          <button
                            key={p.id}
                            ref={el => { itemRefs.current[p.id] = el; }}
                            onClick={() => setSelectedId(p.id)}
                            style={{
                              width: '100%', padding: '10px 12px', textAlign: 'left',
                              background: isOnStage
                                ? 'rgba(126,207,255,0.1)'
                                : isSelected ? 'rgba(126,207,255,0.05)' : 'none',
                              border: 'none', borderBottom: '1px solid #1a1a2e', cursor: 'pointer',
                              borderLeft: isOnStage
                                ? '3px solid #7ecfff'
                                : isSelected ? '3px solid rgba(126,207,255,0.4)' : '3px solid transparent',
                              transition: 'background 0.2s, box-shadow 0.3s',
                              boxShadow: isOnStage && glowing
                                ? 'inset 0 0 18px rgba(126,207,255,0.18), inset 3px 0 12px rgba(126,207,255,0.3)'
                                : 'none',
                              animation: isOnStage && glowing ? 'sidebarGlow 2.5s ease-out forwards' : 'none',
                              position: 'relative',
                            }}
                          >
                            {isOnStage && (
                              <span style={{
                                position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                                background: '#7ecfff',
                                boxShadow: '0 0 8px #7ecfff, 0 0 16px #7ecfff',
                                animation: glowing ? 'glowBar 2.5s ease-out forwards' : 'none',
                              }} />
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ color: isOnStage ? 'rgba(126,207,255,0.6)' : 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>{pos}.</span>
                              {isOnStage && (
                                <span style={{
                                  width: '7px', height: '7px', borderRadius: '50%',
                                  background: '#7ecfff', display: 'inline-block', flexShrink: 0,
                                  boxShadow: '0 0 6px #7ecfff, 0 0 12px #7ecfff',
                                  animation: 'dotPulse 1.5s ease-in-out infinite',
                                }} />
                              )}
                              {isSaved && <span style={{ color: '#34d399', fontSize: '0.65rem' }}>✓</span>}
                            </div>
                            <div style={{
                              color: isOnStage ? '#fff' : isSelected ? '#fff' : 'rgba(255,255,255,0.65)',
                              fontSize: '0.85rem', marginTop: '2px', lineHeight: 1.3,
                              fontWeight: isOnStage ? 700 : 400,
                              textShadow: isOnStage && glowing ? '0 0 8px rgba(126,207,255,0.5)' : 'none',
                            }}>{p.name}</div>
                            {p.age_group && (
                              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.62rem', marginTop: '2px' }}>{p.age_group}</div>
                            )}
                            {(() => {
                              const gs = globalScores[p.id];
                              const rank = rankMap[p.id];
                              if (!gs && rank == null) return null;
                              const allVoted = gs && totalJudges > 0 && gs.judgesVoted >= totalJudges;
                              return (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
                                  {rank != null && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem', fontWeight: 700 }}>#{rank}</span>}
                                  {gs && (
                                    <span style={{ color: allVoted ? '#7ecfff' : '#ef4444', fontSize: '0.7rem', fontWeight: 700 }}>
                                      ø {gs.globalAvg.toFixed(1)}
                                      <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400, fontSize: '0.58rem', marginLeft: '3px' }}>
                                        {gs.judgesVoted}/{totalJudges}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ));
          })()}
        </div>

        {/* Main area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {!selected ? (
            <div style={{ textAlign: 'center', marginTop: '80px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'inline-block', marginBottom: '20px' }} />
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem', letterSpacing: '0.15em' }}>Esperando al primer participante en escena...</p>
            </div>
          ) : (
            <div style={{ maxWidth: '560px', margin: '0 auto' }}>
              {/* Participant card */}
              <div style={{ marginBottom: '28px' }}>
                {selected.photo_path && (
                  <img
                    src={`/uploads/${selected.photo_path}`}
                    alt={selected.name}
                    style={{ width: '100%', height: '220px', objectFit: 'cover', borderRadius: '10px', border: '2px solid rgba(126,207,255,0.2)', display: 'block', marginBottom: '14px' }}
                  />
                )}
                <div>
                  {selected.id === onStageId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7ecfff', display: 'inline-block', boxShadow: '0 0 8px #7ecfff', animation: 'dotPulse 1.5s ease-in-out infinite' }} />
                      <span style={{ color: '#7ecfff', fontSize: '0.7rem', letterSpacing: '0.2em', fontWeight: 700 }}>EN ESCENA</span>
                      {onStageAt && (
                        <span style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700, color: '#7ecfff', letterSpacing: '0.05em' }}>
                          {fmtTimer(Math.max(0, Math.floor((nowMs - onStageAt) / 1000)))}
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', letterSpacing: '0.05em' }}>{selected.name}</h2>
                    {(() => {
                      const ps = participantScores[selected.id];
                      if (!ps || !state.criteria.length) return null;
                      const vals = Object.values(ps);
                      if (!vals.length) return null;
                      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                      return (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ color: '#7ecfff', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{avg.toFixed(1)}</div>
                          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', letterSpacing: '0.1em', marginTop: '2px' }}>MI NOTA</div>
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                    <span style={{ color: categoryColor(selected.category), fontSize: '0.75rem', letterSpacing: '0.15em', fontWeight: 700 }}>{selected.category}</span>
                    {selected.age_group && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>{selected.age_group}</span>}
                  </div>
                  {selected.members?.length > 0 && (
                    <div style={{ marginTop: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                      {selected.members.join(' · ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Score form */}
              {state.criteria.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.3)' }}>No hay criterios configurados aún.</p>
              ) : (
                <ScoreForm
                  key={selected.id}
                  participant={selected}
                  criteria={state.criteria}
                  judgeId={judge.id}
                  onSaved={(pid, scores) => {
                    setSavedIds(prev => new Set(prev).add(pid));
                    setParticipantScores(prev => ({ ...prev, [pid]: scores }));
                  }}
                  onLoaded={(pid, scores, hasSaved) => {
                    setParticipantScores(prev => ({ ...prev, [pid]: scores }));
                    if (hasSaved) setSavedIds(prev => new Set(prev).add(pid));
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dotPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #7ecfff, 0 0 12px #7ecfff; }
          50%       { opacity: 0.5; box-shadow: 0 0 3px #7ecfff; }
        }
        @keyframes glowBar {
          0%   { box-shadow: 0 0 14px #7ecfff, 0 0 28px #7ecfff, 0 0 48px rgba(126,207,255,0.6); }
          60%  { box-shadow: 0 0 8px #7ecfff, 0 0 16px #7ecfff; }
          100% { box-shadow: 0 0 8px #7ecfff, 0 0 16px #7ecfff; }
        }
        @keyframes sidebarGlow {
          0%   { box-shadow: inset 0 0 32px rgba(126,207,255,0.3), inset 3px 0 20px rgba(126,207,255,0.4); background: rgba(126,207,255,0.18); }
          60%  { box-shadow: inset 0 0 18px rgba(126,207,255,0.15); background: rgba(126,207,255,0.1); }
          100% { box-shadow: inset 0 0 18px rgba(126,207,255,0.1); background: rgba(126,207,255,0.1); }
        }
      `}</style>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
export default function CoreoJudge() {
  const [judge, setJudge] = useState(() => {
    // If the URL carries a ?code= that differs from the stored one, don't restore the old session
    // (multiple judges can open their own link in the same browser without interfering)
    const urlCode = new URLSearchParams(window.location.search).get('code');
    const storedCode = sessionStorage.getItem('coreoJudgeCode');
    if (urlCode && urlCode !== storedCode) return null;

    const id = sessionStorage.getItem('coreoJudgeId');
    const tid = sessionStorage.getItem('coreoJudgeTournamentId');
    const code = storedCode;
    const name = sessionStorage.getItem('coreoJudgeName');
    if (id && tid && code) return { id: Number(id), tournament_id: Number(tid), name: name || 'Juez' };
    return null;
  });

  const handleLogin = (j) => {
    sessionStorage.setItem('coreoJudgeName', j.name);
    setJudge(j);
  };

  const handleLogout = () => {
    ['coreoJudgeCode', 'coreoJudgeId', 'coreoJudgeTournamentId', 'coreoJudgeName'].forEach(k => sessionStorage.removeItem(k));
    setJudge(null);
  };

  if (!judge) return <JudgeLogin onLogin={handleLogin} />;
  return <JudgePanel judge={judge} onLogout={handleLogout} />;
}
