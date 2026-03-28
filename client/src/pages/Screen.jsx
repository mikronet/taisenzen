import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import Bracket from '../components/Bracket';

// Animated particle network background
function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const NUM = 55;
    const MAX_DIST = 130;
    const particles = Array.from({ length: NUM }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 1.5 + 0.8,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(233,69,96,0.7)';
        ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(233,69,96,${(1 - dist / MAX_DIST) * 0.25})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return (
    <canvas ref={canvasRef} style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      opacity: 0.35, pointerEvents: 'none', zIndex: 0,
    }} />
  );
}

const HYPE_MESSAGES = [
  'PREPÁRATE PARA LA BATALLA',
  'QUE GANE EL MEJOR',
  'EL ESCENARIO ES TUYO',
  'SOLO UNO SE LLEVA LA CORONA',
  'LA DANZA HABLA POR SÍ SOLA',
];

function IdleScreen({ name, logoPath }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % HYPE_MESSAGES.length);
        setVisible(true);
      }, 450);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <style>{`
        @keyframes idle-glow-pulse {
          0%, 100% { text-shadow: 0 0 40px rgba(233,69,96,0.7), 0 0 80px rgba(233,69,96,0.3), 0 2px 4px rgba(0,0,0,0.8); }
          50%       { text-shadow: 0 0 80px rgba(233,69,96,1),   0 0 160px rgba(233,69,96,0.6), 0 2px 4px rgba(0,0,0,0.8); }
        }
        @keyframes idle-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes idle-line-left {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
        @keyframes idle-line-right {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
      `}</style>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: logoPath ? 'flex-start' : 'center',
        flexDirection: 'column', gap: '36px', textAlign: 'center',
        padding: logoPath ? '6vh 40px 40px' : '40px',
      }}>
        {/* Logo imagen si está configurado */}
        {logoPath && (
          <img
            src={`/uploads/${logoPath}`}
            alt="logo"
            style={{ maxHeight: '160px', maxWidth: '500px', objectFit: 'contain', opacity: 0.95 }}
          />
        )}
        {/* Nombre del torneo */}
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(5rem, 14vw, 10rem)',
          color: '#ffffff',
          letterSpacing: '12px',
          margin: 0,
          lineHeight: 1,
          animation: 'idle-glow-pulse 3s ease-in-out infinite',
        }}>{name}</p>

        {/* Mensaje rotante en dorado con líneas decorativas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', width: '100%', maxWidth: '900px', justifyContent: 'center' }}>
          <div style={{
            flex: 1, height: '1px',
            background: 'linear-gradient(to left, var(--accent), transparent)',
            transformOrigin: 'right',
            animation: 'idle-line-left 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }} />
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.1rem, 2.4vw, 2rem)',
            color: 'var(--gold)',
            letterSpacing: '6px',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.45s ease',
            minHeight: '3rem',
            margin: 0,
            whiteSpace: 'nowrap',
          }}>
            {HYPE_MESSAGES[msgIdx]}
          </p>
          <div style={{
            flex: 1, height: '1px',
            background: 'linear-gradient(to right, var(--accent), transparent)',
            transformOrigin: 'left',
            animation: 'idle-line-right 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }} />
        </div>

        {/* Indicador "COMENZAMOS PRONTO" */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
          <span style={{
            width: '9px', height: '9px', borderRadius: '50%',
            background: 'var(--accent)', display: 'inline-block',
            animation: 'idle-dot-pulse 1.8s ease-in-out infinite',
          }} />
          <p style={{
            color: 'rgba(255,255,255,0.32)', fontSize: 'clamp(0.8rem, 1.5vw, 1.1rem)',
            letterSpacing: '4px', margin: 0, fontFamily: 'var(--font-display)',
          }}>COMENZAMOS PRONTO</p>
        </div>
      </div>
    </>
  );
}

export default function Screen() {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [phases, setPhases] = useState([]);
  const [matches, setMatches] = useState([]);
  const [liveMatch, setLiveMatch] = useState(null);
  const [voteCount, setVoteCount] = useState({ totalVotes: 0, totalJudges: 0 });
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [champion, setChampion] = useState(null);
  // Filtros-specific state
  const [filtrosRanking, setFiltrosRanking] = useState(null);
  const [showFiltrosRanking, setShowFiltrosRanking] = useState(false);
  // Prepare state (PREPARAR button pressed — show upcoming participants)
  const [prepareMatch, setPrepareMatch] = useState(null);
  // Ticker message (scrolling text set by organizer)
  const [ticker, setTicker] = useState('');
  // Waiting screen overlay (admin/organizer manually triggers)
  const [isWaiting, setIsWaiting] = useState(false);
  // Bracket overlay (admin/organizer manually triggers)
  const [showBracketOverlay, setShowBracketOverlay] = useState(false);
  // Timer state from speaker
  const [timerState, setTimerState] = useState({ status: 'idle', startAt: null, remainingS: null, durationS: 60 });
  const [timerDisplay, setTimerDisplay] = useState('');
  const [timerFinished, setTimerFinished] = useState(false);
  // 7toSmoke global timer
  const [globalTimerState, setGlobalTimerState] = useState({ status: 'idle', startAt: null, remainingS: null, durationS: 3600 });
  const [globalTimerDisplay, setGlobalTimerDisplay] = useState('');
  const [globalTimerFinished, setGlobalTimerFinished] = useState(false);
  const socket = useSocket();

  useEffect(() => {
    const fetchTournament = () =>
      fetch(`/api/tournament/${tournamentId}`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => {
          if (!data.tournament) { setNotFound(true); return; }
          setTournament(data.tournament);
          setPhases(data.phases);
          setMatches(data.matches);
          if (data.tournament.ticker_message) setTicker(data.tournament.ticker_message);
          if (data.tournament.waiting_screen) setIsWaiting(true);
          if (data.tournament.bracket_screen) setShowBracketOverlay(true);
          if (data.tournament.status === 'finished') {
            const finalPhase = data.phases[data.phases.length - 1];
            if (finalPhase) {
              const finalMatch = data.matches.find(m => m.phase_id === finalPhase.id && m.winner_name);
              if (finalMatch) setChampion(finalMatch.winner_name);
            }
          }
        })
        .catch(() => setNotFound(true));

    fetchTournament();

    // Re-join room on every connect (initial + reconnects).
    // The server will emit screen:restore which restores live display state.
    const handleConnect = () => {
      socket.emit('join:screen', parseInt(tournamentId));
    };
    socket.on('connect', handleConnect);
    // If already connected, join immediately
    if (socket.connected) handleConnect();

    socket.on('screen:restore', (state) => {
      setIsWaiting(state.isWaiting || false);
      setShowBracketOverlay(state.bracketScreen || false);
      if (state.timer) setTimerState(state.timer);
      if (state.globalTimer) setGlobalTimerState(state.globalTimer);
      if (state.mode === 'prepare') {
        setPrepareMatch(state.match);
        setLiveMatch(null);
        setResult(null);
        setShowResult(false);
        setShowFiltrosRanking(false);
      } else if (state.mode === 'live') {
        setPrepareMatch(null);
        setLiveMatch(state.match);
        setVoteCount({ totalVotes: state.totalVotes || 0, totalJudges: state.totalJudges || 0 });
        setResult(null);
        setShowResult(false);
        setShowFiltrosRanking(false);
      } else if (state.mode === 'result') {
        setPrepareMatch(null);
        setResult(state.resultData);
        setShowResult(true);
        setLiveMatch(null);
        setShowFiltrosRanking(false);
      } else if (state.mode === 'ranking') {
        setPrepareMatch(null);
        setFiltrosRanking(state.ranking);
        setShowFiltrosRanking(true);
        setLiveMatch(null);
        setResult(null);
        setShowResult(false);
      } else if (state.mode === 'finished') {
        setPrepareMatch(null);
        if (state.winnerName) setChampion(state.winnerName);
      } else {
        // idle
        setPrepareMatch(null);
        setLiveMatch(null);
        setResult(null);
        setShowResult(false);
        setShowFiltrosRanking(false);
      }
    });

    socket.on('match:prepare', (match) => {
      setPrepareMatch(match);
      setLiveMatch(null);
      setResult(null);
      setShowResult(false);
      setShowFiltrosRanking(false);
    });

    socket.on('match:started', (match) => {
      setPrepareMatch(null);
      setLiveMatch(match);
      // Preserve judge count from previous state — it's the same throughout the tournament
      setVoteCount(prev => ({ totalVotes: 0, totalJudges: prev.totalJudges }));
      setResult(null);
      setShowResult(false);
      setShowFiltrosRanking(false);
    });

    socket.on('vote:count', (data) => {
      setVoteCount({ totalVotes: data.totalVotes, totalJudges: data.totalJudges });
    });

    socket.on('match:result', (r) => {
      // Only for elimination phases
      setResult(r);
      setShowResult(true);
      setLiveMatch(null);

      if (r.match.winner_name) {
        fetch(`/api/tournament/${tournamentId}`)
          .then(res => res.json())
          .then(data => {
            if (data.tournament.status === 'finished') {
              // Clear the GANADOR overlay before showing PRIMER PUESTO
              setTimeout(() => {
                setShowResult(false);
                setResult(null);
                setChampion(r.match.winner_name);
              }, 5000);
              return; // skip the generic 8s hide below
            }
            setTimeout(() => setShowResult(false), 8000);
          });
      } else {
        setTimeout(() => setShowResult(false), 8000);
      }
    });

    socket.on('round:closed', () => {
      // Filtros round closed — just clear live match, no result shown
      setLiveMatch(null);
    });

    socket.on('filtros:ranking', (data) => {
      // All Filtros rounds done — show ranking (names only, no scores)
      setFiltrosRanking(data.ranking);
      setShowFiltrosRanking(true);
      setLiveMatch(null);
    });

    socket.on('filtros:advance', () => {
      // Filtros advance happened — hide ranking, bracket will show
      setShowFiltrosRanking(false);
      setFiltrosRanking(null);
    });

    socket.on('tournament:updated', (data) => {
      setPhases(data.phases || []);
      setMatches(data.matches || []);
    });

    socket.on('match:restarted', () => {
      setLiveMatch(null);
      setResult(null);
      setShowResult(false);
    });

    socket.on('tournament:finished', () => {
      setTournament(prev => prev ? { ...prev, status: 'finished' } : prev);
    });

    socket.on('ticker:update', ({ message }) => {
      setTicker(message || '');
    });

    socket.on('screen:waiting', ({ active }) => {
      setIsWaiting(active);
    });

    socket.on('timer:update', (data) => {
      setTimerState(data);
    });

    socket.on('global-timer:update', (data) => {
      setGlobalTimerState(data);
    });

    socket.on('phase:renamed', () => {
      fetch(`/api/tournament/${tournamentId}`)
        .then(r => r.json())
        .then(data => setPhases(data.phases));
    });

    socket.on('tournament:logo-updated', (data) => {
      setTournament(prev => prev ? { ...prev, logo_path: data.logo_path } : prev);
    });

    socket.on('screen:bracket', (data) => {
      setShowBracketOverlay(data.active);
    });

    return () => {
      socket.off('match:prepare');
      socket.off('match:started');
      socket.off('vote:count');
      socket.off('match:result');
      socket.off('round:closed');
      socket.off('filtros:ranking');
      socket.off('filtros:advance');
      socket.off('tournament:updated');
      socket.off('match:restarted');
      socket.off('tournament:finished');
      socket.off('phase:renamed');
      socket.off('screen:waiting');
      socket.off('timer:update');
      socket.off('global-timer:update');
      socket.off('tournament:logo-updated');
      socket.off('screen:bracket');
    };
  }, [tournamentId, socket]);

  // Timer display — ticks when running, static when paused/idle
  useEffect(() => {
    const fmt = (s) => {
      const m = Math.floor(Math.abs(s) / 60);
      const sec = Math.floor(Math.abs(s) % 60);
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };
    if (timerState.status !== 'running') {
      const r = timerState.status === 'paused' ? (timerState.remainingS || 0) : (timerState.durationS || 60);
      setTimerDisplay(fmt(r));
      setTimerFinished(timerState.status === 'paused' && r <= 0);
      return;
    }
    const tick = () => {
      const elapsed = timerState.startAt ? (Date.now() - timerState.startAt) / 1000 : 0;
      const remaining = Math.max(0, (timerState.remainingS || 0) - elapsed);
      setTimerDisplay(fmt(remaining));
      setTimerFinished(remaining <= 0);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [timerState]);

  // Global timer display for 7toSmoke
  useEffect(() => {
    const fmt = (s) => {
      const m = Math.floor(Math.abs(s) / 60);
      const sec = Math.floor(Math.abs(s) % 60);
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };
    if (globalTimerState.status !== 'running') {
      const r = globalTimerState.status === 'paused' ? (globalTimerState.remainingS || 0) : (globalTimerState.durationS || 3600);
      setGlobalTimerDisplay(fmt(r));
      setGlobalTimerFinished(globalTimerState.status === 'paused' && r <= 0);
      return;
    }
    const tick = () => {
      const elapsed = globalTimerState.startAt ? (Date.now() - globalTimerState.startAt) / 1000 : 0;
      const remaining = Math.max(0, (globalTimerState.remainingS || 0) - elapsed);
      setGlobalTimerDisplay(fmt(remaining));
      setGlobalTimerFinished(remaining <= 0);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [globalTimerState]);

  if (notFound) return (
    <div className="screen-bg" style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <p style={{ fontSize: 'clamp(5rem, 14vw, 10rem)', fontFamily: 'var(--font-display)', letterSpacing: '0.2em', color: '#fff', lineHeight: 1, margin: 0, textShadow: '0 0 40px rgba(233,69,96,0.7)' }}>TAISEN</p>
      <p style={{ fontSize: 'clamp(1rem, 3vw, 2rem)', fontFamily: 'var(--font-display)', letterSpacing: '0.3em', color: 'var(--accent)', margin: 0 }}>TORNEO NO ENCONTRADO</p>
    </div>
  );
  if (!tournament) return (
    <div className="screen-bg" style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <p style={{ fontSize: 'clamp(5rem, 14vw, 10rem)', fontFamily: 'var(--font-display)', letterSpacing: '0.2em', color: '#fff', lineHeight: 1, margin: 0, textShadow: '0 0 40px rgba(233,69,96,0.7)' }}>TAISEN</p>
      <p style={{ fontSize: 'clamp(1rem, 3vw, 2rem)', fontFamily: 'var(--font-display)', letterSpacing: '0.3em', color: '#555', margin: 0 }}>CARGANDO...</p>
    </div>
  );

  // Determine current phase and state
  const currentPhase = phases.find(p => p.status === 'active');
  const isFiltrosActive = currentPhase?.phase_type === 'filtros' || liveMatch?.phase_type === 'filtros';
  const phaseName = liveMatch?.phase_name || currentPhase?.name || '';
  // 7toSmoke data
  const smokePhaseData = phases.find(p => p.phase_type === '7tosmoke' && p.status === 'active');
  const is7toSmoke = tournament.tournament_type === '7tosmoke';
  const smokeSorted = smokePhaseData?.smoke_points || [];
  const smokeQueue = (() => { try { return JSON.parse(smokePhaseData?.queue_state || '[]'); } catch { return []; } })();
  const smokeMatches = matches.filter(m => m.phase_type === '7tosmoke');
  const isSmokeActive = !!smokePhaseData;

  let stateLabel = 'PREPARACIÓN';
  let stateClass = 'pending';
  if (tournament.status === 'finished') {
    stateLabel = 'FINALIZADO';
    stateClass = 'finished';
  } else if (showResult) {
    stateLabel = 'RESULTADO';
    stateClass = 'result';
  } else if (showFiltrosRanking) {
    stateLabel = 'RANKING';
    stateClass = 'result';
  } else if (liveMatch) {
    if (voteCount.totalVotes > 0 && voteCount.totalVotes < voteCount.totalJudges) {
      stateLabel = 'VOTACIÓN';
      stateClass = 'voting';
    } else {
      stateLabel = 'BATTLE!';
      stateClass = 'live';
    }
  }

  return (
    <div className="screen-bg" style={{ position: 'relative' }}>
      <ParticleCanvas />
      {/* Scanlines — broadcast feel */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 999, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)',
      }} />
      {/* Waiting screen overlay — covers everything when admin activates it */}
      {isWaiting && (
        <>
          <style>{`
            @keyframes waiting-overlay-in {
              from { background: rgba(0, 0, 0, 0); }
              to   { background: rgba(0, 0, 0, 0.95); }
            }
            @keyframes waiting-content-in {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
          `}</style>
          <div style={{
            position: 'absolute', inset: 0, zIndex: 100,
            display: 'flex', flexDirection: 'column',
            animation: 'waiting-overlay-in 0.9s ease forwards',
          }}>
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              opacity: 0,
              animation: 'waiting-content-in 0.5s ease 0.8s forwards',
            }}>
              <IdleScreen name={tournament.name} logoPath={tournament.logo_path} />
            </div>
          </div>
        </>
      )}
      {/* Elimination result overlay */}
      {showResult && result && (
        <div className="result-reveal">
          <div style={{ textAlign: 'center' }}>
            {result.match.winner_name ? (
              <>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', color: 'var(--text-muted)', marginBottom: '20px', letterSpacing: '6px' }}>GANADOR</p>
                <p className="winner-name">{result.match.winner_name}</p>
                <div style={{ marginTop: '40px', display: 'flex', gap: '60px', justifyContent: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '3.5rem', fontWeight: 700, color: result.summary.participant1 > result.summary.participant2 ? 'var(--gold)' : 'var(--text-muted)' }}>
                      {result.summary.participant1}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.4rem' }}>{result.match.participant1_name}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '3.5rem', fontWeight: 700, color: result.summary.participant2 > result.summary.participant1 ? 'var(--gold)' : 'var(--text-muted)' }}>
                      {result.summary.participant2}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.4rem' }}>{result.match.participant2_name}</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '6rem', color: 'var(--warning)' }}>EMPATE</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Champion overlay */}
      {champion && (
        <div className="result-reveal" style={{ background: 'radial-gradient(ellipse, rgba(255,215,0,0.1) 0%, rgba(0,0,0,0.98) 70%)' }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', height: '90vh' }}>
            <p className="winner-name" style={{ fontSize: 'clamp(6rem, 16vw, 18rem)', marginTop: '5vh' }}>{champion}</p>
            <div style={{ paddingBottom: '6vh' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 5rem)', color: 'var(--text-muted)', letterSpacing: '10px', marginBottom: '16px' }}>PRIMER PUESTO</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: 'var(--text-muted)' }}>{tournament.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Bracket overlay */}
      {showBracketOverlay && phases.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.92)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          overflowY: 'auto',
        }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: 'var(--gold)', letterSpacing: '0.2em', marginBottom: '24px' }}>
            {tournament.name}
          </p>
          <Bracket
            phases={phases}
            matches={matches}
            currentMatchId={null}
            isAdmin={false}
            large
            maxHeight={window.innerHeight * 0.85}
          />
        </div>
      )}

      {/* Header with badge system */}
      <div style={{ padding: '24px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #222', position: 'relative' }}>
        <style>{`
          @keyframes header-name-in {
            from { opacity: 0; letter-spacing: 12px; filter: blur(6px); }
            to   { opacity: 1; letter-spacing: 3px;  filter: blur(0); }
          }
          @keyframes header-name-glow {
            0%, 100% { text-shadow: 0 0 24px rgba(233,69,96,0.65), 0 0 50px rgba(233,69,96,0.25); }
            50%       { text-shadow: 0 0 40px rgba(233,69,96,0.95), 0 0 90px rgba(233,69,96,0.45); }
          }
        `}</style>
        {/* Left: tournament name + phase name below */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1
            key={tournament?.name}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 4vw, 3.5rem)',
              color: '#ffffff',
              letterSpacing: '3px',
              margin: 0,
              animation: 'header-name-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards, header-name-glow 3.5s ease-in-out 1s infinite',
            }}
          >
            {tournament?.name || 'TAISEN'}
          </h1>
          {phaseName && (() => {
            const filtrosMatches = matches.filter(m => m.phase_type === 'filtros');
            const totalRounds = filtrosMatches.length;
            const currentRoundIdx = liveMatch?.phase_type === 'filtros'
              ? filtrosMatches.findIndex(m => m.id === liveMatch.id)
              : filtrosMatches.findIndex(m => m.status !== 'finished');
            const currentRoundNum = currentRoundIdx >= 0 ? currentRoundIdx + 1 : totalRounds || null;
            return (
              <>
                <style>{`
                  @keyframes phase-glow {
                    0%, 100% { text-shadow: 0 0 18px rgba(255,215,0,0.45), 0 0 40px rgba(255,215,0,0.15); }
                    50%       { text-shadow: 0 0 32px rgba(255,215,0,0.75), 0 0 70px rgba(255,215,0,0.3); }
                  }
                `}</style>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(1rem, 1.8vw, 1.5rem)',
                    color: 'var(--gold)',
                    letterSpacing: '5px',
                    textTransform: 'uppercase',
                    animation: 'phase-glow 3s ease-in-out infinite',
                  }}>
                    {phaseName}
                  </span>
                  {isFiltrosActive && currentRoundNum && totalRounds > 0 && (
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(0.8rem, 1.3vw, 1.1rem)',
                      color: 'var(--text-muted)',
                      letterSpacing: '3px',
                    }}>
                      RONDA {currentRoundNum}/{totalRounds}
                    </span>
                  )}
                </div>
              </>
            );
          })()}
        </div>
        {/* Right: timers */}
        {(timerState.status !== 'idle' || (is7toSmoke && globalTimerState.status !== 'idle')) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            {/* Battle timer (per-match) */}
            {timerState.status !== 'idle' && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                padding: '4px 16px', borderRadius: '8px', width: '100%',
                background: timerFinished ? 'rgba(198,40,40,0.2)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${timerFinished ? 'rgba(198,40,40,0.5)' : timerState.status === 'paused' ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.15)'}`,
              }}>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', letterSpacing: '4px',
                  color: timerFinished ? '#ef5350' : timerState.status === 'paused' ? 'var(--gold)' : '#fff',
                }}>
                  {timerDisplay}
                </span>
                {timerState.status === 'paused' && !timerFinished && (
                  <span style={{ fontSize: '0.6rem', color: '#888', letterSpacing: '2px' }}>PAUSADO</span>
                )}
              </div>
            )}
            {/* Global timer — 7toSmoke */}
            {is7toSmoke && globalTimerState.status !== 'idle' && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                padding: '4px 16px', borderRadius: '8px', width: '100%',
                background: globalTimerFinished ? 'rgba(198,40,40,0.2)' : 'rgba(255,215,0,0.08)',
                border: `1px solid ${globalTimerFinished ? 'rgba(198,40,40,0.5)' : 'rgba(255,215,0,0.25)'}`,
              }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '3px' }}>
                  TIEMPO
                </span>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', letterSpacing: '3px',
                  color: globalTimerFinished ? '#ef5350' : globalTimerState.status === 'paused' ? 'var(--gold)' : '#fff',
                }}>
                  {globalTimerDisplay}
                </span>
                {globalTimerFinished && (
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: '#ef5350', letterSpacing: '3px', animation: 'pulse-badge 1s infinite' }}>
                    ¡TIEMPO!
                  </span>
                )}
                {globalTimerState.status === 'paused' && !globalTimerFinished && (
                  <span style={{ fontSize: '0.6rem', color: '#888', letterSpacing: '2px' }}>PAUSADO</span>
                )}
              </div>
            )}
          </div>
        )}
        {/* Logo centrado en el header */}
        {tournament?.logo_path && (
          <img
            src={`/uploads/${tournament.logo_path}`}
            alt="logo"
            style={{ position: 'absolute', left: '50%', top: '24px', bottom: '24px', transform: 'translateX(-50%)', height: 'calc(100% - 48px)', width: 'auto', maxWidth: '220px', objectFit: 'contain', opacity: 0.9, pointerEvents: 'none' }}
          />
        )}
      </div>

      {/* === PREPARE overlay — shown when PREPARAR is pressed === */}
      {prepareMatch && !liveMatch && (() => {
        const isFiltros = prepareMatch.phase_type === 'filtros';
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px', textAlign: 'center' }}>
            <style>{`
              @keyframes prepare-pulse {
                0%, 100% { opacity: 1; }
                50%       { opacity: 0.55; }
              }
            `}</style>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.2rem, 2.5vw, 2rem)',
              color: 'var(--gold)',
              letterSpacing: '8px',
              marginBottom: '36px',
              animation: 'prepare-pulse 1.8s ease-in-out infinite',
            }}>
              ¡PREPARARSE!
            </p>
            {isFiltros && prepareMatch.participants ? (
              (() => {
                const n = prepareMatch.participants.length;
                // Public screen: horizontal mirror of judge's CCW view
                // N=2: P1 left, P2 right. N=3: TR, BR, BL (TL empty). N=4: TR,BR,BL,TL
                const PUBLIC_CCW = n === 2 ? [
                  { gridRow: 1, gridColumn: 1 },  // P1: left
                  { gridRow: 1, gridColumn: 2 },  // P2: right
                ] : n === 3 ? [
                  { gridRow: 1, gridColumn: 2 },  // P1: TR
                  { gridRow: 2, gridColumn: 2 },  // P2: BR
                  { gridRow: 2, gridColumn: 1 },  // P3: BL
                ] : [
                  { gridRow: 1, gridColumn: 2 },  // P1: TR
                  { gridRow: 2, gridColumn: 2 },  // P2: BR
                  { gridRow: 2, gridColumn: 1 },  // P3: BL
                  { gridRow: 1, gridColumn: 1 },  // P4: TL
                ];
                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gridTemplateRows: 'auto auto',
                    gap: 'clamp(12px, 2vw, 32px) clamp(20px, 4vw, 80px)',
                    width: '100%',
                    maxWidth: '1100px',
                  }}>
                    {prepareMatch.participants.map((p, idx) => {
                      const pos = PUBLIC_CCW[idx] || { gridRow: 'auto', gridColumn: 'auto' };
                      const is2v2 = p.member1_name || p.member2_name;
                      return (
                        <div key={p.id} style={{
                          gridRow: pos.gridRow, gridColumn: pos.gridColumn,
                          padding: 'clamp(14px, 2.5vw, 28px)',
                          background: 'rgba(255,215,0,0.06)',
                          borderRadius: 'var(--radius)',
                          border: '1px solid rgba(255,215,0,0.25)',
                          display: 'flex', flexDirection: 'column', gap: '6px',
                        }}>
                          <span style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 'clamp(1.6rem, 3.5vw, 3rem)',
                            color: 'var(--text)',
                            letterSpacing: '2px',
                          }}>{p.name}</span>
                          {is2v2 && p.member1_name && (
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(0.9rem, 1.8vw, 1.5rem)', color: 'var(--text-muted)' }}>{p.member1_name}</span>
                          )}
                          {is2v2 && p.member2_name && (
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(0.9rem, 1.8vw, 1.5rem)', color: 'var(--text-muted)' }}>{p.member2_name}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              <div className="versus-display" style={{ padding: '20px' }}>
                <div className="versus-name" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', color: 'var(--text)' }}>
                  {prepareMatch.participant1_name}
                </div>
                <div className="versus-vs" style={{ fontSize: 'clamp(2rem, 4vw, 4rem)' }}>VS</div>
                <div className="versus-name" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', color: 'var(--text)' }}>
                  {prepareMatch.participant2_name}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* === FILTROS MODE: Live round with N participants listed === */}
      {liveMatch && liveMatch.phase_type === 'filtros' && liveMatch.participants && (() => {
        const n = liveMatch.participants.length;
        // For N<=4: use 2x2 spatial grid (public/audience mirror of judge's CCW view)
        // For N>4: fall back to adaptive column grid
        if (n <= 4) {
          // Public screen (horizontal mirror): N=2 side-by-side; N=3 TR/BR/BL; N=4 TR/BR/BL/TL
          const PUBLIC_CCW = n === 2 ? [
            { gridRow: 1, gridColumn: 1 },
            { gridRow: 1, gridColumn: 2 },
          ] : n === 3 ? [
            { gridRow: 1, gridColumn: 2 },
            { gridRow: 2, gridColumn: 2 },
            { gridRow: 2, gridColumn: 1 },
          ] : [
            { gridRow: 1, gridColumn: 2 },
            { gridRow: 2, gridColumn: 2 },
            { gridRow: 2, gridColumn: 1 },
            { gridRow: 1, gridColumn: 1 },
          ];
          // Uniform font size: driven by the longest name so all names share the same size
          const longestLen = Math.max(1, ...liveMatch.participants.map(p => p.name.length));
          const fontSize = n === 1
            ? `min(${(41 / longestLen).toFixed(1)}vw, 22vh)`
            : n >= 3
              ? `min(${(82 / longestLen).toFixed(1)}vw, 38vh)`
              : `min(${(82 / longestLen).toFixed(1)}vw, 42vh)`;

          if (n === 1) {
            return (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize, color: 'var(--text)', letterSpacing: '2px', lineHeight: 1, textAlign: 'center' }}>
                  {liveMatch.participants[0].name}
                </span>
              </div>
            );
          }

          return (
            <div style={{ flex: 1, position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: n >= 3 ? '1fr 1fr' : '1fr', minHeight: 0 }}>
                {liveMatch.participants.map((p, idx) => {
                const pos = PUBLIC_CCW[idx] || { gridRow: 'auto', gridColumn: 'auto' };
                const is2v2 = p.member1_name || p.member2_name;
                return (
                  <div key={p.id} style={{ gridRow: pos.gridRow, gridColumn: pos.gridColumn, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px, 2vw, 28px)' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize, color: 'var(--text)', letterSpacing: '2px', lineHeight: 1, textAlign: 'center' }}>
                      {p.name}
                    </span>
                    {is2v2 && (p.member1_name || p.member2_name) && (
                      <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
                        {p.member1_name && <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(0.9rem, 1.8vw, 1.6rem)', color: 'var(--text-muted)' }}>{p.member1_name}</span>}
                        {p.member2_name && <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(0.9rem, 1.8vw, 1.6rem)', color: 'var(--text-muted)' }}>{p.member2_name}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }
        // N > 4: adaptive column grid (unchanged)
        const cols = n <= 10 ? 2 : n <= 18 ? 3 : 4;
        const nameFontSize = n <= 8 ? 'clamp(1.8rem, 3.5vw, 3rem)'
          : n <= 14 ? 'clamp(1.4rem, 2.5vw, 2.2rem)'
          : 'clamp(1.1rem, 2vw, 1.8rem)';
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '30px 40px', width: '100%' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 2vw, 1.6rem)', color: 'var(--gold)', letterSpacing: '4px', marginBottom: '24px', textTransform: 'uppercase' }}>
              FILTROS — Ronda en curso
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: '10px 30px',
              width: '100%',
              maxWidth: cols === 2 ? '1000px' : '1400px',
            }}>
              {liveMatch.participants.map((p, idx) => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '10px 18px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid #333',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(0.85rem, 1.4vw, 1.1rem)',
                    color: 'var(--accent)',
                    minWidth: '32px', textAlign: 'center', fontWeight: 700
                  }}>{idx + 1}</span>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: nameFontSize,
                    color: 'var(--text)',
                    letterSpacing: '1px',
                    lineHeight: 1.1,
                  }}>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* === FILTROS MODE: Classified participants display === */}
      {showFiltrosRanking && filtrosRanking && !liveMatch && (() => {
        // Show only advancing (classified) participants
        const advancing = filtrosRanking.filter(p => p.advancing);
        const total = advancing.length;
        // Header ~130px + title ~60px + padding ~60px = ~260px total overhead; each item ~66px
        const availH = window.innerHeight - 260;
        const maxPerCol = Math.max(1, Math.floor(availH / 66));
        const colCount = Math.ceil(total / maxPerCol);
        const perCol = Math.ceil(total / colCount);
        const columns = Array.from({ length: colCount }, (_, i) =>
          advancing.slice(i * perCol, (i + 1) * perCol)
        );
        // Scale text down when more columns are needed
        const nameFontSize = colCount >= 3 ? '1.05rem' : colCount === 2 ? 'clamp(1.05rem, 1.8vw, 1.5rem)' : 'clamp(1.3rem, 2.5vw, 2rem)';
        const rankFontSize = colCount >= 3 ? '0.95rem' : colCount === 2 ? 'clamp(0.95rem, 1.4vw, 1.3rem)' : 'clamp(1.1rem, 2vw, 1.7rem)';
        const itemPadding = colCount >= 2 ? '8px 14px' : '11px 26px';

        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 20px 16px' }}>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: colCount >= 3 ? '1.6rem' : 'clamp(1.6rem, 3vw, 2.6rem)',
              color: 'var(--gold)', marginBottom: '16px', letterSpacing: '6px', flexShrink: 0
            }}>
              PASAN FILTROS
            </p>
            <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'center', alignItems: 'flex-start' }}>
              {columns.map((col, ci) => (
                <div key={ci} style={{ flex: 1, maxWidth: colCount === 1 ? '680px' : undefined }}>
                  {col.map((p) => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: itemPadding, marginBottom: '3px',
                      background: 'rgba(0,200,83,0.08)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid rgba(0,200,83,0.3)'
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: rankFontSize,
                        color: 'var(--gold)',
                        minWidth: '36px', textAlign: 'center', fontWeight: 700, flexShrink: 0
                      }}>
                        #{p.rank}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: nameFontSize,
                        color: 'var(--text)', letterSpacing: '1px'
                      }}>
                        {p.name}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* === 7toSmoke MODE: persistent display with queue + points + global timer === */}
      {isSmokeActive && !showFiltrosRanking && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 32px', gap: '16px' }}>
          {/* Current VS / idle */}
          {liveMatch && liveMatch.phase_type === '7tosmoke' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
              <div className="versus-display" style={{ padding: '20px' }}>
                <div className="versus-name" style={{ color: 'var(--accent)', fontSize: 'clamp(2.5rem, 5vw, 5rem)' }}>
                  {liveMatch.participant1_name}
                </div>
                <div className="versus-vs" style={{ fontSize: 'clamp(2rem, 4vw, 4rem)' }}>VS</div>
                <div className="versus-name" style={{ color: 'var(--text)', fontSize: 'clamp(2.5rem, 5vw, 5rem)' }}>
                  {liveMatch.participant2_name}
                </div>
              </div>
            </div>
          ) : !prepareMatch && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 2vw, 1.4rem)', color: '#444', letterSpacing: '4px' }}>
                Esperando próxima batalla...
              </p>
            </div>
          )}

          {/* Queue + Leaderboard */}
          {smokeQueue.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1 }}>
              {/* Queue */}
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--text-muted)', letterSpacing: '4px', marginBottom: '10px' }}>
                  COLA
                </p>
                {smokeQueue.map((pid, idx) => {
                  const sp = smokeSorted.find(s => s.participant_id === pid);
                  const name = sp?.name || `#${pid}`;
                  const isOnStage = idx === 0;
                  const isNext = idx === 1;
                  return (
                    <div key={pid} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: 'clamp(6px, 1vw, 10px) clamp(10px, 1.5vw, 16px)',
                      marginBottom: '4px', borderRadius: '8px',
                      background: isOnStage ? 'rgba(233,69,96,0.12)' : isNext ? 'rgba(255,215,0,0.07)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isOnStage ? 'rgba(233,69,96,0.35)' : isNext ? 'rgba(255,215,0,0.25)' : '#1a1a1a'}`,
                    }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 1.8vw, 1.4rem)', minWidth: '30px', color: isOnStage ? 'var(--accent)' : isNext ? 'var(--gold)' : '#444' }}>
                        {isOnStage ? '🎤' : isNext ? '▶' : idx + 1}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 2vw, 1.6rem)', letterSpacing: '1px',
                        color: isOnStage ? 'var(--accent)' : isNext ? 'var(--gold)' : 'var(--text)',
                        fontWeight: isOnStage || isNext ? 700 : 400, flex: 1,
                      }}>
                        {name}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Leaderboard */}
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--text-muted)', letterSpacing: '4px', marginBottom: '10px' }}>
                  PUNTOS
                </p>
                {(() => {
                  const sorted = [...smokeSorted].sort((a, b) => b.points - a.points || b.consecutive_points - a.consecutive_points);
                  const targetPts = smokeQueue.length;
                  return sorted.map((sp, idx) => (
                    <div key={sp.participant_id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: 'clamp(6px, 1vw, 10px) clamp(10px, 1.5vw, 16px)',
                      marginBottom: '4px', borderRadius: '8px',
                      background: idx === 0 && sp.points > 0 ? 'rgba(255,215,0,0.06)' : 'transparent',
                    }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(0.8rem, 1.4vw, 1.1rem)', color: 'var(--gold)', minWidth: '30px' }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 2vw, 1.6rem)', color: idx === 0 ? 'var(--gold)' : 'var(--text)', flex: 1, letterSpacing: '1px' }}>
                        {sp.name}
                      </span>
                      {/* Progress bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '60px', height: '5px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, Math.round((sp.points / Math.max(targetPts, 1)) * 100))}%`, height: '100%', background: idx === 0 ? 'var(--gold)' : 'var(--accent)', borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 1.8vw, 1.4rem)', color: idx === 0 ? 'var(--gold)' : 'var(--text)', fontWeight: 700, minWidth: '50px' }}>
                          {sp.points}/{targetPts}
                        </span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === ELIMINATION MODE: Live VS display === */}
      {liveMatch && liveMatch.phase_type !== 'filtros' && liveMatch.phase_type !== '7tosmoke' && (() => {
        const ps = [];
        if (liveMatch.participant1_name) ps.push({ id: 'p1', name: liveMatch.participant1_name });
        if (liveMatch.participant2_name) ps.push({ id: 'p2', name: liveMatch.participant2_name });
        if (ps.length === 0) return null;
        const longestLen = Math.max(1, ...ps.map(p => p.name.length));
        const fontSize = ps.length === 1
          ? `min(${(41 / longestLen).toFixed(1)}vw, 22vh)`
          : `min(${(82 / longestLen).toFixed(1)}vw, 42vh)`;
        if (ps.length === 1) {
          return (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize, color: 'var(--text)', letterSpacing: '2px', lineHeight: 1 }}>
                {ps[0].name}
              </span>
            </div>
          );
        }
        return (
          <div key={liveMatch.id} style={{ flex: 1, position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr', minHeight: 0 }}>
            <style>{`
              @keyframes slide-from-left {
                from { opacity: 0; transform: translateX(-60px); }
                to   { opacity: 1; transform: translateX(0); }
              }
              @keyframes slide-from-right {
                from { opacity: 0; transform: translateX(60px); }
                to   { opacity: 1; transform: translateX(0); }
              }
              @keyframes vs-pop {
                from { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
                to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
              }
              @keyframes fire-flicker {
                0%,100% { transform: translate(-50%,-50%) scaleY(1)   scaleX(1);    opacity: 1;    filter: blur(8px); }
                25%     { transform: translate(-50%,-50%) scaleY(1.08) scaleX(0.94); opacity: 0.85; filter: blur(10px); }
                50%     { transform: translate(-50%,-50%) scaleY(0.95) scaleX(1.05); opacity: 1;    filter: blur(7px); }
                75%     { transform: translate(-50%,-50%) scaleY(1.05) scaleX(0.97); opacity: 0.9;  filter: blur(9px); }
              }
              @keyframes fire-flicker2 {
                0%,100% { transform: translate(-50%,-50%) scaleY(1)    scaleX(1);    opacity: 0.6;  filter: blur(14px); }
                33%     { transform: translate(-50%,-50%) scaleY(1.12)  scaleX(0.92); opacity: 0.45; filter: blur(18px); }
                66%     { transform: translate(-50%,-50%) scaleY(0.92)  scaleX(1.08); opacity: 0.65; filter: blur(12px); }
              }
              @keyframes vs-glow-pulse {
                0%,100% { text-shadow: 0 0 20px #ff6a00, 0 0 40px #ff4500, 0 0 70px rgba(255,69,0,0.5); }
                50%     { text-shadow: 0 0 30px #ffb347, 0 0 60px #ff6a00, 0 0 100px rgba(255,69,0,0.7); }
              }
              .vs-fire-wrap { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); zIndex: 10; }
            `}</style>
            <div style={{ gridRow: 1, gridColumn: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(12px, 2vw, 32px)' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize, color: 'var(--text)', letterSpacing: '2px', lineHeight: 1, textAlign: 'center', animation: 'slide-from-left 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}>
                {liveMatch.participant1_name}
              </span>
            </div>
            <div style={{ gridRow: 1, gridColumn: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(12px, 2vw, 32px)' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize, color: 'var(--text)', letterSpacing: '2px', lineHeight: 1, textAlign: 'center', animation: 'slide-from-right 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}>
                {liveMatch.participant2_name}
              </span>
            </div>
            {/* VS with fire effect */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, animation: 'vs-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both' }}>
              {/* Fire glow layers */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', width: '2.2em', height: '2.2em', borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 70%, #ff6a00 0%, #ff4500 35%, transparent 70%)', animation: 'fire-flicker 0.9s ease-in-out infinite', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', width: '3em', height: '3em', borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 65%, rgba(255,140,0,0.5) 0%, rgba(255,69,0,0.25) 45%, transparent 70%)', animation: 'fire-flicker2 1.3s ease-in-out infinite', pointerEvents: 'none' }} />
              {/* VS text */}
              <span style={{ position: 'relative', fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 5rem)', color: '#fff', letterSpacing: '4px', lineHeight: 1, animation: 'vs-glow-pulse 1.4s ease-in-out infinite' }}>
                VS
              </span>
            </div>
          </div>
        );
      })()}

      {/* === Bracket (only for bracket tournaments, no live match) === */}
      {!liveMatch && !showFiltrosRanking && !prepareMatch && !isFiltrosActive && !isSmokeActive && phases.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 30px' }}>
          <Bracket
            phases={phases.filter(p => p.phase_type === 'elimination')}
            matches={matches.filter(m => m.phase_type === 'elimination')}
            large
            maxHeight={window.innerHeight - 160}
          />
        </div>
      )}

      {/* Idle during Filtros (no live match, no ranking shown yet) */}
      {!liveMatch && !showFiltrosRanking && !prepareMatch && isFiltrosActive && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 5vw, 4rem)', color: 'var(--gold)', letterSpacing: '4px' }}>
            FILTROS
          </p>
          <p style={{ color: '#444', fontSize: '1.3rem' }}>Esperando siguiente ronda...</p>
        </div>
      )}

      {/* Waiting state - no phases generated yet */}
      {!liveMatch && !showFiltrosRanking && phases.length === 0 && (
        <IdleScreen name={tournament.name} />
      )}


      {/* Ticker bar — visible when a message is set and no match is in progress (PREPARACIÓN state) */}
      {/* Vote indicator — fixed bottom-left, subtle dots only */}
      {liveMatch && voteCount.totalJudges > 0 && (
        <div style={{
          position: 'fixed', bottom: '22px', left: '24px',
          display: 'flex', gap: '7px', alignItems: 'center', zIndex: 50,
        }}>
          {Array.from({ length: voteCount.totalJudges }, (_, i) => {
            const allVoted = voteCount.totalVotes >= voteCount.totalJudges;
            const voted = i < voteCount.totalVotes;
            return (
              <div key={i} style={{
                width: '9px', height: '9px', borderRadius: '50%',
                transition: 'background 0.3s, box-shadow 0.3s',
                background: voted
                  ? (allVoted ? '#4caf50' : '#e94560')
                  : 'rgba(255,255,255,0.12)',
                border: voted ? 'none' : '1px solid rgba(255,255,255,0.18)',
                boxShadow: voted
                  ? (allVoted ? '0 0 5px rgba(76,175,80,0.6)' : '0 0 5px rgba(233,69,96,0.6)')
                  : 'none',
              }} />
            );
          })}
        </div>
      )}

      {ticker && !liveMatch && tournament.status !== 'finished' && (
        <>
          <style>{`
            @keyframes ticker-scroll {
              0%   { transform: translateX(100vw) translateY(-50%); }
              100% { transform: translateX(-100%) translateY(-50%); }
            }
          `}</style>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: '50px',
            background: 'rgba(10,10,15,0.92)',
            borderTop: '1px solid rgba(233,69,96,0.3)',
            display: 'flex', alignItems: 'center',
            overflow: 'hidden',
          }}>
            {/* Label fijo */}
            <div style={{
              flexShrink: 0, padding: '0 18px',
              fontFamily: 'var(--font-display)', fontSize: '0.9rem',
              color: 'var(--accent)', letterSpacing: '3px',
              borderRight: '1px solid rgba(233,69,96,0.3)',
              height: '100%', display: 'flex', alignItems: 'center',
              background: 'rgba(233,69,96,0.08)',
            }}>
              INFO
            </div>
            {/* Texto animado */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%' }}>
              <p style={{
                position: 'absolute', whiteSpace: 'nowrap', top: '50%',
                fontFamily: 'var(--font-display)', fontSize: '1.15rem',
                color: '#e8e8e8', letterSpacing: '3px', margin: 0,
                animation: `ticker-scroll ${Math.max(12, ticker.length * 0.22)}s linear infinite`,
              }}>
                {ticker}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
