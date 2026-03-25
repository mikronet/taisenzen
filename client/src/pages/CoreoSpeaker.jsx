import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';

const API = '/api/coreo';

function apiFetch(url, options = {}) {
  const code = localStorage.getItem('coreoSpeakerCode') || '';
  return fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-speaker-code': code, ...(options.headers || {}) },
  });
}

function categoryColor(cat) {
  const c = cat?.toLowerCase();
  if (c === 'solo') return '#7ecfff';
  if (c === 'parejas') return '#a78bfa';
  if (c === 'grupo') return '#34d399';
  if (c === 'minicrew') return '#fb923c';
  if (c === 'megacrew') return '#f472b6';
  return '#94a3b8';
}

// ── Login ──────────────────────────────────────────────────────────────────────
function SpeakerLogin({ onLogin }) {
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('code') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/speaker-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Código no válido'); return; }
      localStorage.setItem('coreoSpeakerCode', code.trim());
      localStorage.setItem('coreoSpeakerTournamentId', data.tournament.id);
      if (data.speaker?.name) localStorage.setItem('coreoSpeakerName', data.speaker.name);
      onLogin(data);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a12' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '380px' }}>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.25em', color: '#7ecfff', marginBottom: '2px' }}>ZEN.TAISEN</p>
        <h2 style={{ marginBottom: '8px', color: '#fb923c', fontSize: '0.85rem', letterSpacing: '0.2em' }}>STAFF — COREOGRAFÍA</h2>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginBottom: '16px' }}>Introduce tu código de acceso</p>
        <input
          type="text" placeholder="Código de acceso"
          value={code} onChange={e => setCode(e.target.value)}
          style={{ width: '100%', marginBottom: '12px' }}
          autoComplete="off" autoCapitalize="none"
        />
        {error && <p style={{ color: 'var(--accent)', marginBottom: '12px', fontSize: '0.9rem' }}>{error}</p>}
        <button type="submit" className="btn-primary" style={{ width: '100%', background: 'linear-gradient(135deg, #fb923c, #ea580c)' }} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

// ── Ranking block display ──────────────────────────────────────────────────────
function RankingBlock({ ranking }) {
  if (!ranking?.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {ranking.map((block, bi) => (
        <div key={bi}>
          {ranking.length > 1 && (
            <div style={{ color: '#fb923c', fontSize: '0.7rem', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '8px' }}>
              BLOQUE {block.round}
            </div>
          )}
          {block.categories.map((cat, ci) => (
            <div key={ci} style={{ marginBottom: '10px' }}>
              <div style={{ color: categoryColor(cat.category), fontSize: '0.65rem', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>
                {cat.category}
              </div>
              {cat.top3.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem',
                    color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : '#cd7f32',
                    minWidth: '24px', textAlign: 'center', lineHeight: 1,
                  }}>{i + 1}</span>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{entry.name}</span>
                  {entry.total != null && (
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>{entry.total.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Timing helpers (speaker) ──────────────────────────────────────────────────
function fmtDuration(seconds) {
  if (seconds == null || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`;
  if (m === 0) return `${s}s`;
  return `${m}min${s > 0 ? ' ' + s + 's' : ''}`;
}

function computeCategory(timingParticipants, category, round, now = Date.now()) {
  const pts = timingParticipants.filter(p => (p.round_number || 1) === round && (p.category || '—') === category);
  if (!pts.length) return null;
  const performed = pts.filter(p => p.on_stage_duration_s > 0 && !p.on_stage);
  const inProgress = pts.find(p => p.on_stage) ?? null;
  const pending = pts.filter(p => !p.on_stage && !(p.on_stage_duration_s > 0));
  const catAvg = performed.length
    ? performed.reduce((s, p) => s + p.on_stage_duration_s, 0) / performed.length
    : null;
  const avg = catAvg;
  if (avg == null) return { done: performed.length, total: pts.length, avg: null, remaining: null };
  let inProgRem = 0;
  if (inProgress?.on_stage_at) inProgRem = Math.max(0, avg - (now - inProgress.on_stage_at) / 1000);
  else if (inProgress) inProgRem = avg;
  const remaining = inProgRem + pending.length * avg;
  return { done: performed.length, total: pts.length, avg, remaining };
}

// ── Main panel ─────────────────────────────────────────────────────────────────
function SpeakerPanel({ tournament, participants: initialParticipants, speakerName }) {
  const socket = useSocket();
  const [participants, setParticipants] = useState(initialParticipants);
  const [onStageId, setOnStageId] = useState(() => initialParticipants.find(p => p.on_stage)?.id ?? null);
  const [thread, setThread] = useState([]); // { dir:'in'|'out', text, type, ranking, from, sentAt }
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [timing, setTiming] = useState({ started_at: tournament.started_at, participants: initialParticipants });
  const [nowTick, setNowTick] = useState(Date.now());
  const chatBottomRef = useRef(null);
  const tournamentId = tournament.id;

  useEffect(() => {
    const iv = setInterval(() => setNowTick(Date.now()), 15000); // refresh estimate every 15s
    return () => clearInterval(iv);
  }, []);

  const addIncoming = useCallback((msg) => {
    setThread(prev => [...prev, { dir: 'in', ...msg }]);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  useEffect(() => {
    if (!socket || !tournamentId) return;
    const join = () => socket.emit('join:coreo-speaker', Number(tournamentId));
    join();
    socket.on('connect', join);
    socket.on('coreo:on-stage', ({ participant }) => {
      setOnStageId(participant.id);
      setParticipants(prev => prev.map(p => ({ ...p, on_stage: p.id === participant.id ? 1 : 0 })));
    });
    socket.on('coreo:off-stage', () => {
      setOnStageId(null);
      setParticipants(prev => prev.map(p => ({ ...p, on_stage: 0 })));
    });
    socket.on('coreo:speaker-update', addIncoming);
    socket.on('coreo:timing-updated', setTiming);
    socket.on('coreo:round-changed', ({ participants: newParts }) => {
      setParticipants(newParts);
      setOnStageId(newParts.find(p => p.on_stage)?.id ?? null);
      setTiming(prev => ({ ...prev, participants: newParts }));
    });
    return () => {
      socket.off('connect', join);
      socket.off('coreo:on-stage');
      socket.off('coreo:off-stage');
      socket.off('coreo:speaker-update', addIncoming);
      socket.off('coreo:timing-updated', setTiming);
      socket.off('coreo:round-changed');
    };
  }, [socket, tournamentId, addIncoming]);

  const sendMsg = async () => {
    const text = msgText.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await apiFetch(`${API}/speaker/message`, {
        method: 'POST', body: JSON.stringify({ text }),
      });
      if (res.ok) {
        setThread(prev => [...prev, { dir: 'out', type: 'message', text, sentAt: Date.now() }]);
        setMsgText('');
      }
    } finally { setSending(false); }
  };

  // Group participants by round → category, sorted by act_order
  const rounds = (() => {
    const sorted = [...participants].sort((a, b) => (a.act_order ?? 9999) - (b.act_order ?? 9999));
    const roundMap = {}; const roundOrder = [];
    for (const p of sorted) {
      const r = p.round_number || 1;
      const cat = p.category || '—';
      if (!roundMap[r]) { roundMap[r] = { catMap: {}, catOrder: [] }; roundOrder.push(r); }
      if (!roundMap[r].catMap[cat]) { roundMap[r].catMap[cat] = []; roundMap[r].catOrder.push(cat); }
      roundMap[r].catMap[cat].push(p);
    }
    return roundOrder.map(r => ({
      round: r,
      participants: roundMap[r].catOrder.flatMap(cat => roundMap[r].catMap[cat]), // kept for other code
      categories: roundMap[r].catOrder.map(cat => ({ cat, participants: roundMap[r].catMap[cat] })),
    }));
  })();

  const [collapsedBlocks, setCollapsedBlocks] = useState({});
  const [collapsedCats, setCollapsedCats] = useState({});

  const onStage = participants.find(p => p.id === onStageId) ?? null;

  // Auto-collapse: expand block+category of active participant (or next idle), collapse the rest
  useEffect(() => {
    const sorted = [...participants].sort((a, b) => (a.act_order ?? 9999) - (b.act_order ?? 9999));
    const focal = onStage ?? sorted.find(p => !p.on_stage && !(p.on_stage_duration_s > 0)) ?? null;
    if (!focal) return;
    const focalRound = focal.round_number || 1;
    const focalKey = `${focalRound}:${focal.category || '—'}`;

    const newBlocks = {};
    for (const { round } of rounds) {
      newBlocks[round] = round !== focalRound;
    }
    setCollapsedBlocks(newBlocks);

    const newCats = {};
    for (const p of participants) {
      const key = `${p.round_number || 1}:${p.category || '—'}`;
      if (!(key in newCats)) newCats[key] = key !== focalKey;
    }
    setCollapsedCats(newCats);
  }, [onStageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Find next participant after on-stage
  const allSorted = rounds.flatMap(r => r.participants);
  const onStageIdx = onStage ? allSorted.findIndex(p => p.id === onStage.id) : -1;
  const nextUp = onStageIdx >= 0 ? allSorted[onStageIdx + 1] ?? null : null;

  // Category timing estimate (current or next category)
  const refParticipant = onStage ?? allSorted.find(p => !p.on_stage_duration_s && !p.on_stage) ?? null;
  const catStats = refParticipant
    ? computeCategory(timing.participants, refParticipant.category || '—', refParticipant.round_number || 1, nowTick)
    : null;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a12', color: '#fff', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes pulse-stage { 0%,100%{box-shadow:0 0 0 0 rgba(251,146,60,0.4)} 50%{box-shadow:0 0 0 8px rgba(251,146,60,0)} }
      `}</style>

      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid #1a1a2e', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '0.25em', color: '#7ecfff' }}>ZEN.TAISEN</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '10px', fontSize: '0.8rem' }}>{tournament.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {speakerName && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>{speakerName}</span>}
          <span style={{ color: '#fb923c', fontSize: '0.7rem', border: '1px solid rgba(251,146,60,0.4)', borderRadius: '4px', padding: '2px 8px', letterSpacing: '0.1em' }}>STAFF</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* On stage card */}
        <div style={{
          background: onStage ? 'rgba(251,146,60,0.07)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${onStage ? 'rgba(251,146,60,0.4)' : '#1a1a2e'}`,
          borderRadius: '12px', padding: '16px',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', letterSpacing: '0.2em', marginBottom: '8px' }}>EN ESCENA</div>
          {onStage ? (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%', background: '#fb923c', flexShrink: 0,
                animation: 'pulse-stage 1.6s ease-in-out infinite',
              }} />
              {onStage.photo_path && (
                <img src={`/uploads/${onStage.photo_path}`} alt="" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.15rem', lineHeight: 1.2 }}>{onStage.name}</div>
                <div style={{ color: categoryColor(onStage.category), fontSize: '0.7rem', letterSpacing: '0.12em', marginTop: '4px', fontWeight: 700 }}>
                  {onStage.category?.toUpperCase()}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.9rem' }}>Escenario libre</div>
          )}

          {nextUp && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem', letterSpacing: '0.15em' }}>SIGUIENTE</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: 600 }}>{nextUp.name}</span>
              <span style={{ color: categoryColor(nextUp.category), fontSize: '0.65rem', marginLeft: '2px' }}>{nextUp.category?.toUpperCase()}</span>
            </div>
          )}
        </div>

        {/* Category timing estimate */}
        {catStats && refParticipant && (
          <div style={{ background: 'rgba(251,146,60,0.04)', border: '1px solid rgba(251,146,60,0.15)', borderRadius: '10px', padding: '12px 16px' }}>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.62rem', letterSpacing: '0.18em', marginBottom: '6px' }}>
              EST. RESTANTE · {(refParticipant.category || '—').toUpperCase()}
              {catStats.avg != null && (
                <span style={{ marginLeft: '8px', color: 'rgba(255,255,255,0.2)' }}>
                  · media {fmtDuration(catStats.avg)}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ color: catStats.remaining != null ? '#fb923c' : 'rgba(255,255,255,0.2)', fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 }}>
                {catStats.remaining != null ? fmtDuration(catStats.remaining) : '—'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
                {catStats.done}/{catStats.total} actuados
              </span>
            </div>
          </div>
        )}

        {/* Participant order list */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a2e', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a2e' }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', letterSpacing: '0.2em' }}>ORDEN DE ACTUACIÓN</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(() => {
              let globalCounter = 0;
              return rounds.map(({ round, categories }) => {
                const bCollapsed = !!collapsedBlocks[round];
                return (
                  <div key={round}>
                    {/* Block header */}
                    <div
                      onClick={() => setCollapsedBlocks(prev => ({ ...prev, [round]: !prev[round] }))}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', background: 'rgba(126,207,255,0.05)', borderBottom: '1px solid #1a1a2e', cursor: 'pointer', userSelect: 'none' }}
                    >
                      <span style={{ color: '#7ecfff', fontSize: '0.68rem', letterSpacing: '0.2em', fontWeight: 700, flex: 1, fontFamily: "'Bebas Neue', sans-serif" }}>BLOQUE {round}</span>
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>{categories.reduce((n, c) => n + c.participants.length, 0)}</span>
                      <span style={{ color: 'rgba(126,207,255,0.4)', fontSize: '0.65rem' }}>{bCollapsed ? '▶' : '▼'}</span>
                    </div>
                    {!bCollapsed && categories.map(({ cat, participants: cps }) => {
                      const cKey = `${round}:${cat}`;
                      const cCollapsed = !!collapsedCats[cKey];
                      const hasCatOnStage = cps.some(p => p.id === onStageId);
                      return (
                        <div key={cat}>
                          {/* Category header */}
                          <div
                            onClick={() => setCollapsedCats(prev => ({ ...prev, [cKey]: !prev[cKey] }))}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 16px 7px 20px', background: hasCatOnStage ? `${categoryColor(cat)}0a` : 'rgba(255,255,255,0.01)', borderBottom: '1px solid #1a1a2e', cursor: 'pointer', userSelect: 'none' }}
                          >
                            <span style={{ color: categoryColor(cat), fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.14em', flex: 1, textTransform: 'uppercase' }}>{cat === '—' ? 'Sin categoría' : cat}</span>
                            {hasCatOnStage && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fb923c', boxShadow: '0 0 5px #fb923c', display: 'inline-block', animation: 'pulse-stage 1.6s ease-in-out infinite' }} />}
                            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.62rem' }}>{cps.length}</span>
                            <span style={{ color: `${categoryColor(cat)}66`, fontSize: '0.6rem' }}>{cCollapsed ? '▶' : '▼'}</span>
                          </div>
                          {!cCollapsed && cps.map(p => {
                            globalCounter++;
                            const num = globalCounter;
                            const isNow = p.id === onStageId;
                            return (
                              <div key={p.id} style={{
                                display: 'flex', gap: '10px', alignItems: 'center',
                                padding: '10px 16px 10px 24px', borderBottom: '1px solid #111',
                                background: isNow ? 'rgba(251,146,60,0.08)' : 'transparent',
                              }}>
                                <span style={{ color: isNow ? '#fb923c' : 'rgba(255,255,255,0.2)', minWidth: '20px', fontSize: '0.8rem', fontWeight: isNow ? 700 : 400 }}>{num}</span>
                                {p.photo_path
                                  ? <img src={`/uploads/${p.photo_path}`} alt="" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '5px', flexShrink: 0 }} />
                                  : <div style={{ width: '36px', height: '36px', borderRadius: '5px', background: '#1a1a2e', flexShrink: 0 }} />
                                }
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: isNow ? 700 : 500, fontSize: '0.9rem', color: isNow ? '#fb923c' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                  {(p.academia || p.localidad) && (
                                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {[p.academia, p.localidad].filter(Boolean).join(' · ')}
                                    </div>
                                  )}
                                </div>
                                {isNow && (
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fb923c', animation: 'pulse-stage 1.6s ease-in-out infinite', flexShrink: 0 }} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Chat */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1a1a2e', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a1a2e' }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem', letterSpacing: '0.2em' }}>COMUNICACIÓN</span>
          </div>
          <div style={{ padding: '12px', minHeight: '100px', maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {thread.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.8rem', margin: 'auto', textAlign: 'center' }}>Sin mensajes aún</p>
            )}
            {thread.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.dir === 'out' ? 'flex-end' : 'flex-start' }}>
                {m.dir === 'in' && (
                  <span style={{ color: '#7ecfff', fontSize: '0.62rem', fontWeight: 700, marginBottom: '3px', letterSpacing: '0.08em' }}>ORGANIZACIÓN</span>
                )}
                <div style={{
                  maxWidth: '85%',
                  background: m.dir === 'out' ? 'rgba(251,146,60,0.12)' : 'rgba(126,207,255,0.08)',
                  border: `1px solid ${m.dir === 'out' ? 'rgba(251,146,60,0.3)' : 'rgba(126,207,255,0.2)'}`,
                  borderRadius: m.dir === 'out' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                  padding: '8px 12px',
                }}>
                  {m.type === 'ranking' ? (
                    <div>
                      <div style={{ color: '#7ecfff', fontSize: '0.7rem', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '10px' }}>RANKING FINAL</div>
                      <RankingBlock ranking={m.ranking} />
                    </div>
                  ) : (
                    <span style={{ color: '#f0f0f0', fontSize: '0.95rem', lineHeight: 1.45 }}>{m.text}</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid #1a1a2e', display: 'flex', gap: '8px' }}>
            <input
              value={msgText} onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
              placeholder="Escribe un mensaje…"
              style={{ flex: 1, background: '#0a0a12', border: '1px solid #2a2a3e', borderRadius: '8px', color: '#fff', padding: '9px 12px', fontSize: '0.9rem' }}
            />
            <button
              onClick={sendMsg} disabled={sending || !msgText.trim()}
              style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', padding: '9px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700 }}
            >
              {sending ? '…' : '→'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function CoreoSpeaker() {
  const [session, setSession] = useState(() => {
    const urlCode = new URLSearchParams(window.location.search).get('code');
    const storedCode = localStorage.getItem('coreoSpeakerCode');
    // If the URL carries a different code, don't restore the old session
    if (urlCode && urlCode !== storedCode) return null;
    const tid = localStorage.getItem('coreoSpeakerTournamentId');
    const code = storedCode;
    return tid && code ? { tournamentId: tid, code } : null;
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!session);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch(`${API}/speaker-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: session.code }),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setData(d))
      .catch(() => { localStorage.removeItem('coreoSpeakerCode'); localStorage.removeItem('coreoSpeakerTournamentId'); setSession(null); })
      .finally(() => setLoading(false));
  }, [session]);

  if (loading) return <div style={{ minHeight: '100vh', background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Cargando...</div>;

  if (!session || !data) {
    return <SpeakerLogin onLogin={(d) => { setData(d); setSession({ tournamentId: d.tournament.id, code: localStorage.getItem('coreoSpeakerCode') }); }} />;
  }

  const speakerName = data.speaker?.name || localStorage.getItem('coreoSpeakerName') || '';
  return <SpeakerPanel tournament={data.tournament} participants={data.participants} speakerName={speakerName} />;
}
