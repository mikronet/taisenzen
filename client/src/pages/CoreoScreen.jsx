import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

// ── Bokeh canvas: large soft glowing orbs drifting slowly ────────────────────
function BokehCanvas({ mode }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const ORBS = [
      { x: 0.12, y: 0.25, r: 320, color: '126,100,255', spd: 0.18 },
      { x: 0.82, y: 0.65, r: 380, color: '233,69,96',   spd: 0.13 },
      { x: 0.48, y: 0.10, r: 300, color: '126,207,255', spd: 0.15 },
      { x: 0.08, y: 0.78, r: 260, color: '52,211,153',  spd: 0.20 },
      { x: 0.88, y: 0.20, r: 220, color: '251,146,60',  spd: 0.16 },
      { x: 0.55, y: 0.88, r: 340, color: '167,139,250', spd: 0.11 },
      { x: 0.35, y: 0.55, r: 200, color: '240,171,252', spd: 0.22 },
    ].map(o => ({
      ...o,
      px: o.x * window.innerWidth,
      py: o.y * window.innerHeight,
      vx: (Math.random() - 0.5) * o.spd * 2,
      vy: (Math.random() - 0.5) * o.spd * 2,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    const draw = () => {
      t += 0.004;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const o of ORBS) {
        o.px += o.vx;
        o.py += o.vy;
        if (o.px < -o.r) o.px = canvas.width + o.r;
        if (o.px > canvas.width + o.r) o.px = -o.r;
        if (o.py < -o.r) o.py = canvas.height + o.r;
        if (o.py > canvas.height + o.r) o.py = -o.r;
        // Pulse opacity with sine wave
        const pulse = 0.5 + 0.5 * Math.sin(t + o.phase);
        const alpha0 = 0.22 + 0.18 * pulse;
        const alpha1 = 0.07 + 0.06 * pulse;
        const grad = ctx.createRadialGradient(o.px, o.py, 0, o.px, o.py, o.r);
        grad.addColorStop(0,   `rgba(${o.color},${alpha0.toFixed(2)})`);
        grad.addColorStop(0.45,`rgba(${o.color},${alpha1.toFixed(2)})`);
        grad.addColorStop(1,   `rgba(${o.color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(o.px, o.py, o.r, 0, Math.PI * 2);
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0,
               opacity: mode === 'stage' ? 0.55 : 0.75, transition: 'opacity 1.5s ease' }}
    />
  );
}

// ── Particle network (subtle, on top of bokeh) ────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const NUM = 45, MAX_DIST = 110;
    const particles = Array.from({ length: NUM }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.2 + 0.6,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200,180,255,0.6)'; ctx.fill();
      });
      for (let i = 0; i < NUM; i++) for (let j = i + 1; j < NUM; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(180,160,255,${0.25 * (1 - dist / MAX_DIST)})`;
          ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, opacity: 0.25 }} />;
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

const IDLE_EFFECTS = ['sweep-h', 'sweep-v', 'pulse-ring', 'scanline', 'corner-burst'];

export default function CoreoScreen() {
  const { id } = useParams();
  const isEmbed = new URLSearchParams(window.location.search).get('embed') === '1';
  const socket = useSocket();
  const [onStage, setOnStage] = useState(null);
  const [tournamentInfo, setTournamentInfo] = useState({ name: '', poster_path: null });
  const [sweepKey, setSweepKey] = useState(0);
  const [idleEffect, setIdleEffect] = useState({ key: 0, type: null });
  const idleEffectIdx = useRef(0);

  // Audio
  const audioRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [musicState, setMusicState] = useState('idle'); // idle | playing | paused

  const enableAudio = () => {
    // Create and immediately suspend a silent AudioContext to unlock autoplay
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume().then(() => ctx.close());
    setAudioEnabled(true);
  };

  // Load audio when participant changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setMusicState('idle');
    if (onStage?.audio_path) {
      audio.src = `/uploads/${onStage.audio_path}`;
      audio.load();
    } else {
      audio.src = '';
    }
  }, [onStage?.id, onStage?.audio_path]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socket || !id) return;
    const join = () => socket.emit('join:screen', Number(id));
    join();
    socket.on('connect', join);
    socket.on('coreo:tournament-info', ({ name, poster_path }) => setTournamentInfo({ name, poster_path }));
    socket.on('coreo:poster-updated', ({ poster_path }) => setTournamentInfo(prev => ({ ...prev, poster_path })));
    socket.on('coreo:on-stage', ({ participant }) => {
      setSweepKey(k => k + 1);
      setOnStage(participant);
    });
    socket.on('coreo:off-stage', () => setOnStage(null));

    socket.on('coreo:music-play', ({ position = 0 }) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (position !== undefined) audio.currentTime = position;
      if (audioEnabled) {
        audio.play().catch(() => {});
      }
      setMusicState('playing');
    });
    socket.on('coreo:music-pause', () => {
      audioRef.current?.pause();
      setMusicState('paused');
    });
    socket.on('coreo:music-stop', () => {
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.currentTime = 0; }
      setMusicState('idle');
    });

    return () => {
      socket.off('connect', join);
      socket.off('coreo:tournament-info');
      socket.off('coreo:poster-updated');
      socket.off('coreo:on-stage');
      socket.off('coreo:off-stage');
      socket.off('coreo:music-play');
      socket.off('coreo:music-pause');
      socket.off('coreo:music-stop');
    };
  }, [socket, id, audioEnabled]);

  // Periodic idle effects — only while no one is on stage
  useEffect(() => {
    if (onStage) return;
    const fire = () => {
      idleEffectIdx.current = (idleEffectIdx.current + 1) % IDLE_EFFECTS.length;
      setIdleEffect(prev => ({ key: prev.key + 1, type: IDLE_EFFECTS[idleEffectIdx.current] }));
    };
    const init = setTimeout(fire, 2500);
    const interval = setInterval(fire, 7000);
    return () => { clearTimeout(init); clearInterval(interval); };
  }, [onStage]);

  const catColor = onStage ? categoryColor(onStage.category) : '#7ecfff';

  return (
    <div style={{ minHeight: '100vh', background: '#06060f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}
      onClick={!audioEnabled ? enableAudio : undefined}
    >
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="auto" style={{ display: 'none' }} onEnded={() => setMusicState('idle')} />


      {/* Audio enable banner — solo en el iframe del admin */}
      {isEmbed && !audioEnabled && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(52,211,153,0.4)',
          borderRadius: '30px', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px',
          cursor: 'pointer', backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontSize: '1rem' }}>🔊</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', letterSpacing: '0.1em' }}>Toca para activar el audio</span>
        </div>
      )}

      {/* Music playing indicator */}
      {musicState === 'playing' && (
        <div style={{
          position: 'fixed', top: '20px', right: '24px', zIndex: 10,
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)',
          borderRadius: '20px', padding: '5px 14px',
        }}>
          <span style={{ color: '#34d399', fontSize: '0.68rem', letterSpacing: '0.15em', fontFamily: "'Bebas Neue', sans-serif" }}>♪ EN REPRODUCCIÓN</span>
        </div>
      )}

      <style>{`
        @keyframes idle-glow-pulse {
          0%, 100% { text-shadow: 0 0 40px rgba(126,207,255,0.5), 0 0 100px rgba(126,207,255,0.2); }
          50%       { text-shadow: 0 0 80px rgba(167,139,250,0.8), 0 0 160px rgba(167,139,250,0.35); }
        }
        @keyframes idle-sub-in {
          from { opacity: 0; letter-spacing: 0.8em; }
          to   { opacity: 1; letter-spacing: 0.4em; }
        }
        @keyframes stage-name-in {
          from { opacity: 0; transform: translateY(40px) scale(0.96); filter: blur(8px); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    filter: blur(0px); }
        }
        @keyframes stage-card-in {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes stage-badge-in {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes sweep-flash {
          0%   { opacity: 0; transform: translateX(-100%); }
          30%  { opacity: 0.55; }
          70%  { opacity: 0.55; }
          100% { opacity: 0; transform: translateX(100%); }
        }
        @keyframes spotlight-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 0.9; transform: scale(1.06); }
        }
        @keyframes name-glow-pulse {
          0%, 100% { text-shadow: 0 0 30px rgba(255,255,255,0.3), 0 0 80px currentColor, 0 0 160px currentColor; }
          50%       { text-shadow: 0 0 60px rgba(255,255,255,0.6), 0 0 140px currentColor, 0 0 280px currentColor; }
        }
        @keyframes idle-name-in {
          from { opacity: 0; transform: scale(1.08); letter-spacing: 0.25em; }
          to   { opacity: 1; transform: scale(1);    letter-spacing: 0.12em; }
        }
        @keyframes poster-cycle {
          0%   { transform: scale(1);     filter: brightness(0.97); box-shadow: 0 12px 80px rgba(0,0,0,0.85); }
          /* — glow burst — */
          12%  { transform: scale(1);     filter: brightness(0.97); box-shadow: 0 12px 80px rgba(0,0,0,0.85); }
          17%  { transform: scale(1.030); filter: brightness(1.08); box-shadow: 0 0 60px rgba(167,139,250,0.8), 0 0 120px rgba(167,139,250,0.4), 0 16px 80px rgba(0,0,0,0.7); }
          24%  { transform: scale(1);     filter: brightness(0.97); box-shadow: 0 12px 80px rgba(0,0,0,0.85); }
          /* — pause — */
          42%  { transform: scale(1);     filter: brightness(0.97); box-shadow: 0 12px 80px rgba(0,0,0,0.85); }
          /* — zoom in — */
          50%  { transform: scale(1.045); filter: brightness(1.05); box-shadow: 0 20px 100px rgba(126,207,255,0.45), 0 0 80px rgba(126,207,255,0.2); }
          58%  { transform: scale(1);     filter: brightness(0.97); box-shadow: 0 12px 80px rgba(0,0,0,0.85); }
          /* — pause — */
          100% { transform: scale(1);     filter: brightness(0.97); box-shadow: 0 12px 80px rgba(0,0,0,0.85); }
        }
        @keyframes poster-shine {
          0%   { transform: translateX(-180%); opacity: 0; }
          62%  { transform: translateX(-180%); opacity: 0; }
          65%  { opacity: 0; }
          72%  { opacity: 1; }
          80%  { transform: translateX(280%);  opacity: 0.6; }
          82%  { opacity: 0; transform: translateX(280%); }
          100% { opacity: 0; transform: translateX(280%); }
        }
        @keyframes idle-sweep-h {
          0%   { opacity: 0; transform: translateX(-110%); }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(110%); }
        }
        @keyframes idle-sweep-v {
          0%   { opacity: 0; transform: translateY(-110%); }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(110%); }
        }
        @keyframes idle-pulse-ring {
          0%   { opacity: 0.7; transform: translate(-50%, -50%) scale(0); }
          60%  { opacity: 0.4; }
          100% { opacity: 0;   transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes idle-scanline {
          0%   { top: -6px; opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 0.9; }
          100% { top: 100vh; opacity: 0; }
        }
        @keyframes idle-corner-burst {
          0%   { opacity: 0; transform: scale(0.5); }
          25%  { opacity: 1; }
          75%  { opacity: 0.6; }
          100% { opacity: 0; transform: scale(1.4); }
        }
      `}</style>

      {/* Poster background blur */}
      {tournamentInfo.poster_path && (
        <img src={`/uploads/${tournamentInfo.poster_path}`} alt=""
          style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.06, pointerEvents: 'none', zIndex: 0, filter: 'blur(4px)' }}
        />
      )}

      {/* Bokeh orbs */}
      <BokehCanvas mode={onStage ? 'stage' : 'idle'} />

      {/* Particle network */}
      <ParticleCanvas />

      {/* Sweep flash on stage entry */}
      {onStage && (
        <div key={sweepKey} style={{
          position: 'fixed', inset: 0, zIndex: 5, pointerEvents: 'none',
          background: `linear-gradient(90deg, transparent 0%, ${catColor}44 40%, ${catColor}66 50%, ${catColor}44 60%, transparent 100%)`,
          animation: 'sweep-flash 1.1s cubic-bezier(0.4, 0, 0.6, 1) forwards',
        }} />
      )}

      {/* Spotlight radial behind content (on-stage only) */}
      {onStage && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
          background: `radial-gradient(ellipse 55% 60% at 50% 50%, ${catColor}18 0%, transparent 70%)`,
          animation: 'spotlight-pulse 3s ease-in-out infinite',
        }} />
      )}

      {/* ── Periodic idle effects ── */}
      {!onStage && idleEffect.type && (() => {
        const k = idleEffect.key;
        const t = idleEffect.type;
        if (t === 'sweep-h') return (
          <div key={k} style={{
            position: 'fixed', inset: 0, zIndex: 4, pointerEvents: 'none', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: 0, bottom: 0, width: '45%',
              background: 'linear-gradient(90deg, transparent 0%, rgba(167,139,250,0.18) 30%, rgba(255,255,255,0.28) 50%, rgba(126,207,255,0.18) 70%, transparent 100%)',
              animation: 'idle-sweep-h 1.6s cubic-bezier(0.4,0,0.6,1) forwards',
            }} />
          </div>
        );
        if (t === 'sweep-v') return (
          <div key={k} style={{
            position: 'fixed', inset: 0, zIndex: 4, pointerEvents: 'none', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', left: 0, right: 0, height: '40%',
              background: 'linear-gradient(180deg, transparent 0%, rgba(52,211,153,0.14) 25%, rgba(255,255,255,0.22) 50%, rgba(52,211,153,0.14) 75%, transparent 100%)',
              animation: 'idle-sweep-v 1.8s cubic-bezier(0.4,0,0.6,1) forwards',
            }} />
          </div>
        );
        if (t === 'pulse-ring') return (
          <div key={k} style={{
            position: 'fixed', inset: 0, zIndex: 4, pointerEvents: 'none', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', left: '50%', top: '50%',
              width: '80vmax', height: '80vmax',
              border: '2px solid rgba(255,255,255,0.35)',
              borderRadius: '50%',
              boxShadow: '0 0 40px rgba(167,139,250,0.4), inset 0 0 40px rgba(167,139,250,0.15)',
              animation: 'idle-pulse-ring 2s cubic-bezier(0,0,0.4,1) forwards',
            }} />
          </div>
        );
        if (t === 'scanline') return (
          <div key={k} style={{
            position: 'fixed', inset: 0, zIndex: 4, pointerEvents: 'none', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', left: 0, right: 0, height: '6px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(126,207,255,0.5) 20%, rgba(255,255,255,0.9) 50%, rgba(126,207,255,0.5) 80%, transparent 100%)',
              boxShadow: '0 0 20px rgba(126,207,255,0.8), 0 0 60px rgba(126,207,255,0.4)',
              animation: 'idle-scanline 1.4s linear forwards',
            }} />
          </div>
        );
        if (t === 'corner-burst') return (
          <div key={k} style={{
            position: 'fixed', inset: 0, zIndex: 4, pointerEvents: 'none',
          }}>
            {[
              { top: '-15%', left: '-15%', bg: 'rgba(233,69,96,0.22)' },
              { top: '-15%', right: '-15%', bg: 'rgba(251,146,60,0.18)' },
              { bottom: '-15%', left: '-15%', bg: 'rgba(167,139,250,0.20)' },
              { bottom: '-15%', right: '-15%', bg: 'rgba(52,211,153,0.18)' },
            ].map((pos, i) => (
              <div key={i} style={{
                position: 'absolute', ...pos,
                width: '55vmax', height: '55vmax', borderRadius: '50%',
                background: `radial-gradient(circle, ${pos.bg} 0%, transparent 65%)`,
                animation: `idle-corner-burst 2.2s ease-out ${i * 0.08}s forwards`,
              }} />
            ))}
          </div>
        );
        return null;
      })()}

      {!onStage ? (
        // ── IDLE ──────────────────────────────────────────────────────────────
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '36px' }}>

          {tournamentInfo.poster_path && (
            <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
              <img src={`/uploads/${tournamentInfo.poster_path}`} alt="Cartel"
                style={{ maxHeight: 'clamp(300px, 55vh, 640px)', maxWidth: 'clamp(300px, 60vw, 900px)', objectFit: 'contain', borderRadius: '14px', display: 'block',
                  animation: 'poster-cycle 20s ease-in-out infinite' }}
              />
              {/* Shine sweep overlay */}
              <div style={{ position: 'absolute', inset: 0, borderRadius: '14px', overflow: 'hidden', pointerEvents: 'none' }}>
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, width: '35%',
                  background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0.12) 60%, transparent 100%)',
                  animation: 'poster-shine 20s ease-in-out infinite',
                }} />
              </div>
            </div>
          )}

          <p style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(3rem, 10vw, 7.5rem)',
            letterSpacing: '0.12em',
            color: '#fff',
            margin: 0, lineHeight: 1,
            animation: 'idle-name-in 1.2s cubic-bezier(0.16,1,0.3,1) forwards, idle-glow-pulse 4s ease-in-out 1.2s infinite',
          }}>
            {tournamentInfo.name || ''}
          </p>

          <p style={{
            color: 'rgba(255,255,255,0.3)', margin: 0,
            fontSize: 'clamp(0.7rem, 1.8vw, 1rem)', letterSpacing: '0.4em',
            animation: 'idle-sub-in 1s ease 0.6s both',
          }}>
            COMPETICIÓN COREOGRÁFICA
          </p>
        </div>

      ) : (
        // ── ON STAGE ──────────────────────────────────────────────────────────
        <div key={onStage.id} style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', padding: '48px 40px', maxWidth: '900px', width: '100%', textAlign: 'center' }}>

          {/* Category + age badges */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{
              background: `${catColor}18`, border: `1px solid ${catColor}88`,
              color: catColor, borderRadius: '6px', padding: '6px 24px',
              fontSize: 'clamp(0.75rem, 1.8vw, 1.1rem)', letterSpacing: '0.35em', fontWeight: 700,
              animation: 'stage-badge-in 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.15s both',
            }}>
              {onStage.category?.toUpperCase()}
            </span>
            {onStage.age_group && (
              <span style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.5)', borderRadius: '6px', padding: '6px 24px',
                fontSize: 'clamp(0.75rem, 1.8vw, 1.1rem)', letterSpacing: '0.35em', fontWeight: 700,
                animation: 'stage-badge-in 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.25s both',
              }}>
                {onStage.age_group?.toUpperCase()}
              </span>
            )}
          </div>

          {/* Group / performer name */}
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(3.5rem, 12vw, 9rem)',
            letterSpacing: '0.06em', color: '#fff',
            margin: 0, lineHeight: 1,
            animation: 'stage-name-in 0.8s cubic-bezier(0.16,1,0.3,1) 0.3s both, name-glow-pulse 3s ease-in-out 1.2s infinite',
            '--tw-text-opacity': 1,
            textShadow: `0 0 40px rgba(255,255,255,0.25), 0 0 100px ${catColor}55`,
            color: catColor === '#94a3b8' ? '#fff' : `color-mix(in srgb, #fff 82%, ${catColor})`,
          }}>
            {onStage.name}
          </h1>

          {/* Academia + Localidad */}
          {(onStage.academia || onStage.localidad) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', animation: 'stage-card-in 0.7s ease 0.7s both' }}>
              {onStage.academia && (
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 'clamp(1.1rem, 3.2vw, 2rem)', letterSpacing: '0.08em', margin: 0, fontWeight: 500 }}>
                  {onStage.academia}
                </p>
              )}
              {onStage.localidad && (
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 'clamp(0.8rem, 2.2vw, 1.3rem)', letterSpacing: '0.2em', margin: 0 }}>
                  {onStage.localidad.toUpperCase()}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
