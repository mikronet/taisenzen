import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';

/** Devuelve true si algún participante tiene miembros nombrados (torneo 2vs2) */
const is2v2 = (participants) => participants?.some(p => p.member1_name || p.member2_name) ?? false;

export default function Judge() {
  const [judge, setJudge] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [match, setMatch] = useState(null);
  const [selected, setSelected] = useState(null);
  const [voted, setVoted] = useState(false);
  const [result, setResult] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [scores, setScores] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voteError, setVoteError] = useState('');
  const [isLockedOut, setIsLockedOut] = useState(false); // true when this judge can't vote in a tiebreaker
  const [tournamentFinished, setTournamentFinished] = useState(false);
  const [scoreRangeError, setScoreRangeError] = useState('');
  const [touchedScores, setTouchedScores] = useState({});
  // Use ref to store pendingAction so it survives re-renders without triggering them
  const pendingActionRef = useRef(null);
  const socket = useSocket();

  // Restore session on mount (judge closed tab and came back)
  // ?code= in the URL always takes priority over any saved session
  useEffect(() => {
    const urlCode = new URLSearchParams(window.location.search).get('code');
    if (urlCode) {
      fetch('/api/judge/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: urlCode })
      }).then(r => r.ok ? r.json() : null).then(data => {
        if (data) {
          localStorage.setItem('judgeSession', JSON.stringify(data));
          setJudge(data);
        } else {
          setError('Código inválido');
        }
      });
      return;
    }
    const saved = localStorage.getItem('judgeSession');
    if (saved) {
      try { setJudge(JSON.parse(saved)); } catch (e) { localStorage.removeItem('judgeSession'); }
    }
  }, []);

  const login = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/judge/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('judgeSession', JSON.stringify(data));
      setJudge(data);
      setError('');
    } else {
      setError('Código inválido');
    }
  };

  useEffect(() => {
    if (!judge) return;

    const joinAndFetch = () => {
      socket.emit('join:judge', { tournamentId: judge.tournament_id, judgeId: judge.id });

      fetch(`/api/tournament/${judge.tournament_id}/live-match?judgeId=${judge.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.tournamentFinished) {
            setTournamentFinished(true);
          }
          if (data.match) {
            setMatch(data.match);
            setResult(null);
            if (data.match.is_tiebreaker && data.match.allowed_judge_ids) {
              setIsLockedOut(!data.match.allowed_judge_ids.includes(judge.id));
            }
            if (data.hasVoted) {
              setVoted(true);
              setWaiting(true);
              if (data.myVote) setSelected(data.myVote);
            } else if (data.match.phase_type === 'filtros' && data.match.participants) {
              const initial = {};
              const team = is2v2(data.match.participants);
              data.match.participants.forEach(p => {
                if (team) { initial[`${p.id}_m1`] = 2.5; initial[`${p.id}_m2`] = 2.5; }
                else { initial[p.id] = 5.0; }
              });
              const saved = localStorage.getItem(`filtrosScores_${data.match.id}`);
              if (saved) { try { setScores(JSON.parse(saved)); setTouchedScores(Object.fromEntries(Object.keys(initial).map(k => [k, true]))); } catch { setScores(initial); setTouchedScores({}); } }
              else { setScores(initial); setTouchedScores({}); }
            }
          } else {
            // No live match on reconnect — reset transient state
            setMatch(null);
            setVoted(false);
            setWaiting(false);
          }
        });
    };

    // Join on connect (covers both initial connect and reconnects)
    socket.on('connect', joinAndFetch);
    if (socket.connected) joinAndFetch();

    socket.on('match:started', (m) => {
      setMatch(m);
      setSelected(null);
      setVoted(false);
      setResult(null);
      setWaiting(false);
      setShowConfirm(false);
      pendingActionRef.current = null;
      // Tiebreaker: check if this judge is excluded (voted for a participant, not EMPATE)
      if (m.is_tiebreaker && m.allowed_judge_ids) {
        setIsLockedOut(!m.allowed_judge_ids.includes(judge.id));
      } else {
        setIsLockedOut(false);
      }
      if (m.phase_type === 'filtros' && m.participants) {
        const initial = {};
        const team = is2v2(m.participants);
        m.participants.forEach(p => {
          if (team) { initial[`${p.id}_m1`] = 2.5; initial[`${p.id}_m2`] = 2.5; }
          else { initial[p.id] = 5.0; }
        });
        setScores(initial);
        setTouchedScores({});
      }
    });

    socket.on('match:result', (r) => {
      setResult(r);
      setWaiting(false);
      setIsLockedOut(false);
    });

    socket.on('round:closed', () => {
      setMatch(prev => { if (prev?.id) localStorage.removeItem(`filtrosScores_${prev.id}`); return null; });
      setVoted(false);
      setWaiting(false);
      setResult(null);
      setShowConfirm(false);
      setIsLockedOut(false);
      setVoteError('');
      pendingActionRef.current = null;
    });

    socket.on('match:restarted', () => {
      // Clear saved filtros scores for the current match so judge starts fresh
      setMatch(prev => {
        if (prev?.id && prev.phase_type === 'filtros') {
          localStorage.removeItem(`filtrosScores_${prev.id}`);
        }
        return prev;
      });
      setSelected(null);
      setVoted(false);
      setResult(null);
      setWaiting(false);
      setShowConfirm(false);
      setIsLockedOut(false);
      setVoteError('');
      pendingActionRef.current = null;
    });

    socket.on('tournament:finished', () => {
      setTournamentFinished(true);
    });

    return () => {
      socket.off('connect', joinAndFetch);
      socket.off('match:started');
      socket.off('match:result');
      socket.off('match:restarted');
      socket.off('round:closed');
      socket.off('tournament:finished');
    };
  }, [judge, socket]);

  // Persist filtros scores to localStorage whenever they change
  useEffect(() => {
    if (match?.phase_type === 'filtros' && match?.id && Object.keys(scores).length > 0) {
      localStorage.setItem(`filtrosScores_${match.id}`, JSON.stringify(scores));
    }
  }, [scores, match?.id, match?.phase_type]);

  // --- Confirmation handlers using ref (no stale closures) ---
  const requestConfirm = (action) => {
    pendingActionRef.current = action;
    setShowConfirm(true);
  };

  const confirmAction = async () => {
    const action = pendingActionRef.current;
    if (!action || submitting) return;
    setVoteError('');
    setSubmitting(true);
    await action();
    setSubmitting(false);
  };

  const cancelConfirm = () => {
    if (submitting) return;
    pendingActionRef.current = null;
    setShowConfirm(false);
    setSelected(null);
    setVoteError('');
  };

  // Elimination vote — only opens dialog, does NOT send
  const doVote = (choice) => {
    setSelected(choice);
    setVoteError('');
    requestConfirm(async () => {
      const res = await fetch('/api/judge/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, judgeId: judge.id, choice })
      });
      if (res.ok) {
        pendingActionRef.current = null;
        setShowConfirm(false);
        setVoted(true);
        setWaiting(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setVoteError(data.error || 'Error al registrar el voto');
        setSelected(null);
      }
    });
  };

  // Filtros score submit — only opens dialog, does NOT send
  const doSubmitScores = () => {
    setVoteError('');
    requestConfirm(async () => {
      const team = is2v2(match.participants);
      const scoresArray = team
        ? match.participants.map(p => ({
            participantId: p.id,
            score: Number(scores[`${p.id}_m1`] ?? 2.5) + Number(scores[`${p.id}_m2`] ?? 2.5)
          }))
        : Object.entries(scores).map(([participantId, score]) => ({
            participantId: Number(participantId),
            score: Number(score)
          }));
      const res = await fetch('/api/judge/score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: match.id, judgeId: judge.id, scores: scoresArray })
      });
      if (res.ok) {
        pendingActionRef.current = null;
        setShowConfirm(false);
        localStorage.removeItem(`filtrosScores_${match.id}`);
        setVoted(true);
        setWaiting(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setVoteError(data.error || 'Error al enviar puntuaciones');
      }
    });
  };

  const updateScore = (participantId, value) => {
    setScores(prev => ({ ...prev, [participantId]: value }));
    setTouchedScores(prev => ({ ...prev, [participantId]: true }));
  };

  // --- Build confirmation content ---
  const getConfirmText = () => {
    if (!match) return '';
    const choiceText = selected === 'tie' ? 'EMPATE' :
      selected === 'participant1' ? match.participant1_name : match.participant2_name;
    return `¿Confirmar voto por ${choiceText}?`;
  };

  const isFiltrosConfirm = match && match.phase_type === 'filtros' && match.participants;

  // --- Confirmation dialog as inline JSX ---
  const confirmDialog = showConfirm ? (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '30px',
        maxWidth: '400px', width: '100%', textAlign: 'center', border: '1px solid #333'
      }}>
        {isFiltrosConfirm ? (
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '14px', lineHeight: 1.5 }}>¿Confirmar puntuaciones?</p>
            <div style={{ textAlign: 'left', display: 'inline-block' }}>
              {(() => {
                const team = is2v2(match.participants);
                return match.participants.map(p => {
                  if (team) {
                    const m1 = Number(scores[`${p.id}_m1`] ?? 2.5);
                    const m2 = Number(scores[`${p.id}_m2`] ?? 2.5);
                    return (
                      <div key={p.id} style={{ marginBottom: '10px' }}>
                        <p style={{ fontSize: '1rem', color: 'var(--text)', fontWeight: 600, marginBottom: '2px' }}>{p.name}</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: '8px' }}>
                          {p.member1_name || 'Miembro 1'}: <span style={{ color: 'var(--accent)' }}>{m1.toFixed(1)}</span>
                          {'  ·  '}
                          {p.member2_name || 'Miembro 2'}: <span style={{ color: 'var(--accent)' }}>{m2.toFixed(1)}</span>
                          {'  '}
                          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>= {(m1 + m2).toFixed(1)}</span>
                        </p>
                      </div>
                    );
                  }
                  return (
                    <p key={p.id} style={{ fontSize: '1rem', lineHeight: 1.8, color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>{p.name}</span>
                      {' — '}
                      <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{Number(scores[p.id]).toFixed(1)}</span>
                    </p>
                  );
                });
              })()}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: '1.1rem', marginBottom: '24px', lineHeight: 1.5 }}>{getConfirmText()}</p>
        )}
        {voteError && (
          <p style={{ color: 'var(--accent)', fontSize: '0.9rem', marginBottom: '14px', marginTop: '-8px' }}>
            {voteError}
          </p>
        )}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button className="btn-danger" onClick={cancelConfirm} disabled={submitting}
            style={{ padding: '12px 30px', fontSize: '1rem', opacity: submitting ? 0.5 : 1 }}>
            NO
          </button>
          <button className="btn-gold" onClick={confirmAction} disabled={submitting}
            style={{ padding: '12px 30px', fontSize: '1rem', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Enviando...' : 'SÍ, CONFIRMAR'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const logout = () => {
    localStorage.removeItem('judgeSession');
    setJudge(null);
    setMatch(null);
    setVoted(false);
    setWaiting(false);
    setSelected(null);
    setResult(null);
    setScores({});
    setTournamentFinished(false);
    setIsLockedOut(false);
  };

  const judgeRoleBadge = judge ? (
    <div style={{ position: 'fixed', top: '14px', right: '18px', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 200 }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.15em', fontWeight: 600 }}>
        JURADO · {judge.name}
      </span>
      <button onClick={logout} style={{ fontSize: '0.65rem', color: '#555', background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', letterSpacing: '0.1em' }}>
        cambiar
      </button>
    </div>
  ) : null;

  // --- Login screen ---
  if (!judge) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={login} className="card" style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.25em', color: '#fff', marginBottom: '2px', textShadow: '0 0 20px rgba(77,197,224,0.6)' }}>TAISEN</p>
          <h2 style={{ marginBottom: '20px', color: '#4dc5e0', fontSize: '0.9rem', letterSpacing: '0.2em' }}>JURADO</h2>
          <input type="text" placeholder="Código de acceso" value={code}
            onChange={e => setCode(e.target.value)}
            style={{ width: '100%', marginBottom: '12px', textAlign: 'center', fontSize: '1.3rem', letterSpacing: '4px' }} />
          {error && <p style={{ color: '#4dc5e0', marginBottom: '12px', fontSize: '0.9rem' }}>{error}</p>}
          <button type="submit" style={{
            width: '100%', padding: '12px', border: 'none', borderRadius: 'var(--radius)',
            background: '#4dc5e0', color: '#0a0a0f', fontWeight: 700,
            fontSize: '1rem', letterSpacing: '0.1em', cursor: 'pointer',
          }}>Entrar</button>
        </form>
      </div>
    );
  }

  // --- Tournament finished screen ---
  if (tournamentFinished) {
    return (
      <div className="judge-vote-panel" style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', letterSpacing: '0.3em', color: 'var(--gold)', marginBottom: '8px' }}>
          TAISEN
        </p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '0.25em', color: 'var(--text-muted)' }}>
          FINALIZADO
        </p>
      </div>
    );
  }

  // --- Result screen (elimination only) ---
  if (result) {
    return (
      <div className="judge-vote-panel">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '4px', marginBottom: '16px' }}>RESULTADO</p>
        <div style={{ textAlign: 'center' }}>
          {result.match.winner_name ? (
            <>
              <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '2px' }}>GANADOR</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 12vw, 5.5rem)', color: 'var(--gold)', lineHeight: 1, letterSpacing: '2px' }}>
                {result.match.winner_name}
              </p>
            </>
          ) : (
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 10vw, 4.5rem)', color: 'var(--warning)', letterSpacing: '4px' }}>EMPATE</p>
          )}
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '20px', lineHeight: 1.8 }}>
            <span style={{ color: 'var(--text)' }}>{result.match.participant1_name}</span>
            <span style={{ color: '#444', margin: '0 8px' }}>({result.summary.participant1})</span>
            <span style={{ color: '#444' }}>—</span>
            <span style={{ color: '#444', margin: '0 8px' }}>({result.summary.participant2})</span>
            <span style={{ color: 'var(--text)' }}>{result.match.participant2_name}</span>
            {result.summary.ties > 0 && <span style={{ display: 'block', color: '#555', fontSize: '0.8rem', marginTop: '4px' }}>Empates: {result.summary.ties}</span>}
          </p>
        </div>
        <p style={{ color: '#444', fontSize: '0.82rem', marginTop: '24px', letterSpacing: '1px' }}>
          {tournamentFinished ? 'Torneo finalizado.' : 'Esperando la siguiente batalla...'}
        </p>
      </div>
    );
  }

  // --- Locked out of tiebreaker (judge voted for a participant in the tied round) ---
  if (isLockedOut) {
    return (
      <div className="judge-vote-panel">
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <h2 style={{ color: 'var(--warning)', letterSpacing: '2px', marginBottom: '6px' }}>DESEMPATE</h2>
        {match && (
          <p style={{ color: 'var(--text)', fontSize: '1.1rem', marginBottom: '20px', fontWeight: 700, letterSpacing: '1px' }}>
            {match.participant1_name}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, margin: '0 10px', fontSize: '0.9rem' }}>vs</span>
            {match.participant2_name}
          </p>
        )}
        <div style={{
          margin: '4px 0 20px', padding: '20px 24px',
          background: 'rgba(255,152,0,0.07)', borderRadius: 'var(--radius)',
          border: '1px solid rgba(255,152,0,0.25)', textAlign: 'center', lineHeight: 1.7,
        }}>
          <p style={{ color: 'var(--text)', fontSize: '1rem', marginBottom: '10px' }}>
            No participas en este desempate.
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Como votaste por uno de los participantes, solo los jueces
            que marcaron <strong style={{ color: 'var(--gold)' }}>EMPATE</strong> pueden
            decidir el ganador ahora.
          </p>
        </div>
        <p style={{ color: '#555', fontSize: '0.85rem', lineHeight: 1.6 }}>
          El resultado aparecerá aquí en cuanto se resuelva.
        </p>
        <p style={{ color: '#444', fontSize: '0.78rem', marginTop: '6px' }}>No cierres esta página.</p>
        <div style={{ width: '40px', height: '40px', border: '3px solid #333', borderTopColor: 'var(--warning)', borderRadius: '50%', animation: 'spin 1.2s linear infinite', margin: '20px auto 0' }} />
      </div>
    );
  }

  // --- Waiting for match ---
  if (!match || match.status !== 'live') {
    return (
      <div className="judge-vote-panel">
        {judgeRoleBadge}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--accent)', marginBottom: '4px', letterSpacing: '2px' }}>
          {judge.name}
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '44px', letterSpacing: '1px' }}>
          {judge.tournament_name}
        </p>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '60px', height: '60px', border: '3px solid #333', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 28px' }} />
          <p style={{ color: 'var(--text)', fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px' }}>
            Esperando la siguiente batalla...
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.7, maxWidth: '300px', margin: '0 auto' }}>
            Cuando el organizador inicie un enfrentamiento, tu pantalla cambiará sola.
          </p>
          <p style={{ color: '#444', fontSize: '0.78rem', marginTop: '20px' }}>
            No cierres esta página.
          </p>
        </div>
      </div>
    );
  }

  // --- Vote registered, waiting ---
  if (waiting) {
    const isFiltros = match.phase_type === 'filtros';
    const votedForName = !isFiltros && selected
      ? (selected === 'tie' ? 'EMPATE' : selected === 'participant1' ? match.participant1_name : match.participant2_name)
      : null;
    return (
      <div className="judge-vote-panel">
        {judgeRoleBadge}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: '2.8rem', marginBottom: '10px', color: 'var(--success)' }}>✓</div>
        <h2 style={{ color: 'var(--success)', marginBottom: '14px' }}>
          {isFiltros ? 'PUNTUACIÓN ENVIADA' : 'VOTO REGISTRADO'}
        </h2>
        {votedForName && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '6px' }}>
            Votaste por{' '}
            <strong style={{ color: 'var(--text)', fontSize: '1.05rem' }}>{votedForName}</strong>
          </p>
        )}
        {!isFiltros && match && (
          <p style={{ color: '#444', fontSize: '0.85rem', marginTop: '4px', marginBottom: '0' }}>
            {match.participant1_name}
            <span style={{ color: 'var(--accent)', margin: '0 6px', fontSize: '0.8rem' }}>vs</span>
            {match.participant2_name}
          </p>
        )}
        <p style={{ color: '#555', fontSize: '0.85rem', marginTop: '16px', lineHeight: 1.7 }}>
          Esperando a que voten todos los jueces...
        </p>
        <div style={{ width: '32px', height: '32px', border: '3px solid #333', borderTopColor: 'var(--success)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '24px auto 0' }} />
      </div>
    );
  }

  // --- Filtros: score N participants ---
  if (match.phase_type === 'filtros' && match.participants) {
    const team = is2v2(match.participants);
    // CCW positions from judge's perspective: TL, BL, BR, TR
    // N=2: side-by-side (P2 left / P1 right). N=3: TL, BL, BR (TR empty). N=4: TL, BL, BR, TR
    const n = match.participants.length;
    const JUDGE_CCW = n === 2 ? [
      { gridRow: 1, gridColumn: 2 },  // P1: right
      { gridRow: 1, gridColumn: 1 },  // P2: left
    ] : n === 3 ? [
      { gridRow: 1, gridColumn: 1 },  // P1: TL
      { gridRow: 2, gridColumn: 1 },  // P2: BL
      { gridRow: 2, gridColumn: 2 },  // P3: BR
    ] : [
      { gridRow: 1, gridColumn: 1 },  // P1: TL
      { gridRow: 2, gridColumn: 1 },  // P2: BL
      { gridRow: 2, gridColumn: 2 },  // P3: BR
      { gridRow: 1, gridColumn: 2 },  // P4: TR
    ];
    return (
      <div className="judge-vote-panel" style={{ paddingBottom: '40px' }}>
        {judgeRoleBadge}
        {confirmDialog}
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2px' }}>{judge.name} &mdash; {match.phase_name || 'Filtros'}</p>
        <p style={{ color: 'var(--gold)', fontSize: '0.75rem', marginBottom: '14px' }}>
          {team ? 'Puntúa a cada miembro por separado (0 – 5)' : 'Puntúa a cada participante (0 – 10)'}
        </p>

        {/* 2×2 spatial grid — CCW from judge's perspective */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: 'auto auto',
          gap: '10px',
          width: '100%',
        }}>
          {match.participants.map((p, idx) => {
            const pos = JUDGE_CCW[idx] || { gridRow: 'auto', gridColumn: 'auto' };
            if (team) {
              const m1 = scores[`${p.id}_m1`] ?? 2.5;
              const m2 = scores[`${p.id}_m2`] ?? 2.5;
              const total = Number(m1) + Number(m2);
              return (
                <div key={p.id} style={{
                  gridRow: pos.gridRow, gridColumn: pos.gridColumn,
                  padding: '10px 10px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 'var(--radius)', border: '1px solid #222',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', margin: 0 }}>{p.name}</p>
                    <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '1rem' }}>{total.toFixed(1)}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{p.member1_name || 'M1'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="range" min="0" max="5" step="0.1" value={m1}
                        onChange={e => updateScore(`${p.id}_m1`, parseFloat(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--accent)' }} />
                      <span style={{ width: '34px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)', fontSize: '0.9rem' }}>{Number(m1).toFixed(1)}</span>
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{p.member2_name || 'M2'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="range" min="0" max="5" step="0.1" value={m2}
                        onChange={e => updateScore(`${p.id}_m2`, parseFloat(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--accent)' }} />
                      <span style={{ width: '34px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)', fontSize: '0.9rem' }}>{Number(m2).toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              );
            }
            // 1vs1 mode — single slider 0-10
            return (
              <div key={p.id} style={{
                gridRow: pos.gridRow, gridColumn: pos.gridColumn,
                padding: '12px 10px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius)', border: '1px solid #222',
                display: 'flex', flexDirection: 'column', gap: '10px',
              }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', textAlign: 'center', margin: 0 }}>{p.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="range" min="0" max="10" step="0.1"
                    value={scores[p.id] || 5}
                    onChange={e => updateScore(p.id, parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }} />
                  <input type="number" min="0" max="10" step="0.1"
                    value={scores[p.id] ?? 5}
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) {
                        if (v < 0 || v > 10) {
                          setScoreRangeError('La puntuación debe estar entre 0 y 10');
                          updateScore(p.id, Math.max(0, Math.min(10, v)));
                        } else {
                          if (scoreRangeError) setScoreRangeError('');
                          updateScore(p.id, v);
                        }
                      }
                    }}
                    onBlur={e => {
                      // Clamp and clear error when judge leaves the field
                      const v = parseFloat(e.target.value);
                      const clamped = isNaN(v) ? 5 : Math.max(0, Math.min(10, v));
                      updateScore(p.id, clamped);
                      setScoreRangeError('');
                    }}
                    style={{ width: '64px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 700 }} />
                </div>
              </div>
            );
          })}
        </div>

        {scoreRangeError && (
          <p style={{ color: 'var(--warning)', fontSize: '0.85rem', marginTop: '8px', textAlign: 'center', width: '100%' }}>
            ⚠ {scoreRangeError}
          </p>
        )}
        {(() => {
          const allTouched = Object.keys(scores).every(k => touchedScores[k]);
          const canSubmit = allTouched && !scoreRangeError;
          return (
            <button className="btn-gold" onClick={doSubmitScores} disabled={!canSubmit}
              style={{ width: '100%', marginTop: '14px', opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
              title={!allTouched ? 'Mueve todas las barras antes de enviar' : ''}>
              ENVIAR PUNTUACIONES
            </button>
          );
        })()}
      </div>
    );
  }

  // --- Elimination: winner pick mode ---
  // P2 is on the judge's LEFT (physically), P1 on the judge's RIGHT
  return (
    <div className="judge-vote-panel">
      {judgeRoleBadge}
      {confirmDialog}
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>{judge.name} &mdash; {match.phase_name || 'Battle'}</p>

      <div className="judge-vote-row">
        {/* P2 — judge's LEFT */}
        <button
          className={`judge-option ${selected === 'participant2' ? 'selected' : ''}`}
          onClick={() => doVote('participant2')}
        >
          <span>{match.participant2_name}</span>
          {match.participant2_member1 && <span style={{ fontSize: '0.85rem', opacity: 0.7, fontFamily: 'sans-serif', fontWeight: 400, marginTop: '4px' }}>{match.participant2_member1}</span>}
          {match.participant2_member2 && <span style={{ fontSize: '0.85rem', opacity: 0.7, fontFamily: 'sans-serif', fontWeight: 400 }}>{match.participant2_member2}</span>}
        </button>

        {/* EMPATE — center */}
        <button
          className={`judge-option tie-btn ${selected === 'tie' ? 'selected' : ''}`}
          onClick={() => doVote('tie')}
        >
          EMPATE
        </button>

        {/* P1 — judge's RIGHT */}
        <button
          className={`judge-option ${selected === 'participant1' ? 'selected' : ''}`}
          onClick={() => doVote('participant1')}
        >
          <span>{match.participant1_name}</span>
          {match.participant1_member1 && <span style={{ fontSize: '0.85rem', opacity: 0.7, fontFamily: 'sans-serif', fontWeight: 400, marginTop: '4px' }}>{match.participant1_member1}</span>}
          {match.participant1_member2 && <span style={{ fontSize: '0.85rem', opacity: 0.7, fontFamily: 'sans-serif', fontWeight: 400 }}>{match.participant1_member2}</span>}
        </button>
      </div>
    </div>
  );
}
