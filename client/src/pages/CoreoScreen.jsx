import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const NUM = 55, MAX_DIST = 130;
    const particles = Array.from({ length: NUM }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.8,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(126,207,255,0.5)'; ctx.fill();
      });
      for (let i = 0; i < NUM; i++) for (let j = i + 1; j < NUM; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(126,207,255,${0.3 * (1 - dist / MAX_DIST)})`; ctx.lineWidth = 0.7; ctx.stroke();
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, opacity: 0.3 }} />;
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

export default function CoreoScreen() {
  const { id } = useParams();
  const socket = useSocket();
  const [onStage, setOnStage] = useState(null);
  const [tournamentInfo, setTournamentInfo] = useState({ name: '', poster_path: null });

  useEffect(() => {
    if (!socket || !id) return;

    const join = () => socket.emit('join:screen', Number(id));
    join();
    socket.on('connect', join);

    socket.on('coreo:tournament-info', ({ name, poster_path }) => setTournamentInfo({ name, poster_path }));
    socket.on('coreo:poster-updated', ({ poster_path }) => setTournamentInfo(prev => ({ ...prev, poster_path })));
    socket.on('coreo:on-stage', ({ participant }) => setOnStage(participant));
    socket.on('coreo:off-stage', () => setOnStage(null));

    return () => {
      socket.off('connect', join);
      socket.off('coreo:tournament-info');
      socket.off('coreo:poster-updated');
      socket.off('coreo:on-stage');
      socket.off('coreo:off-stage');
    };
  }, [socket, id]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>

      {/* Poster background */}
      {tournamentInfo.poster_path && (
        <img
          src={`/uploads/${tournamentInfo.poster_path}`}
          alt=""
          style={{
            position: 'fixed', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', opacity: 0.08, pointerEvents: 'none', zIndex: 0,
          }}
        />
      )}

      <ParticleCanvas />

      {/* ZEN TAISEN watermark — top left */}
      <div style={{
        position: 'fixed', top: '24px', left: '32px', zIndex: 2,
        display: 'flex', alignItems: 'baseline', gap: '6px',
      }}>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(0.85rem, 1.8vw, 1.1rem)',
          letterSpacing: '0.25em',
          color: 'rgba(126,207,255,0.5)',
          lineHeight: 1,
        }}>ZEN TAISEN</span>
      </div>

      {!onStage ? (
        // Idle screen
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>

          {/* Poster */}
          {tournamentInfo.poster_path && (
            <img
              src={`/uploads/${tournamentInfo.poster_path}`}
              alt="Cartel"
              style={{
                maxHeight: 'clamp(180px, 30vh, 340px)',
                maxWidth: 'clamp(160px, 22vw, 260px)',
                objectFit: 'contain',
                borderRadius: '10px',
                boxShadow: '0 8px 48px rgba(0,0,0,0.7)',
                filter: 'brightness(0.95)',
              }}
            />
          )}

          {/* Tournament name */}
          {tournamentInfo.name && (
            <p style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(2.8rem, 9vw, 6.5rem)',
              letterSpacing: '0.12em',
              color: '#fff',
              textShadow: '0 0 60px rgba(126,207,255,0.4)',
              margin: 0, lineHeight: 1,
            }}>
              {tournamentInfo.name}
            </p>
          )}

          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 'clamp(0.7rem, 1.8vw, 1rem)', letterSpacing: '0.4em', margin: 0 }}>COMPETICIÓN COREOGRÁFICA</p>
        </div>
      ) : (
        // On-stage display
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px', padding: '48px 40px', maxWidth: '860px', width: '100%', textAlign: 'center' }}>

          {/* Category + age badges */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{
              background: `${categoryColor(onStage.category)}22`,
              border: `1px solid ${categoryColor(onStage.category)}`,
              color: categoryColor(onStage.category),
              borderRadius: '6px', padding: '5px 20px',
              fontSize: 'clamp(0.7rem, 1.8vw, 1rem)', letterSpacing: '0.3em', fontWeight: 700,
            }}>
              {onStage.category?.toUpperCase()}
            </span>
            {onStage.age_group && (
              <span style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.5)', borderRadius: '6px', padding: '5px 20px',
                fontSize: 'clamp(0.7rem, 1.8vw, 1rem)', letterSpacing: '0.3em', fontWeight: 700,
              }}>
                {onStage.age_group?.toUpperCase()}
              </span>
            )}
          </div>

          {/* Group name */}
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(3rem, 10vw, 7rem)',
            letterSpacing: '0.08em', color: '#fff',
            textShadow: '0 0 40px rgba(255,255,255,0.25)',
            margin: 0, lineHeight: 1,
          }}>
            {onStage.name}
          </h1>

          {/* Academia + Localidad */}
          {(onStage.academia || onStage.localidad) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              {onStage.academia && (
                <p style={{
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: 'clamp(1rem, 3vw, 1.8rem)',
                  letterSpacing: '0.08em', margin: 0, fontWeight: 500,
                }}>
                  {onStage.academia}
                </p>
              )}
              {onStage.localidad && (
                <p style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 'clamp(0.8rem, 2.2vw, 1.3rem)',
                  letterSpacing: '0.15em', margin: 0,
                }}>
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
