import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Link usado en el footer

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
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
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
        ctx.fillStyle = 'rgba(233,69,96,0.5)';
        ctx.fill();
      });
      for (let i = 0; i < NUM; i++) for (let j = i + 1; j < NUM; j++) {
        const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(233,69,96,${0.35 * (1 - dist / MAX_DIST)})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, opacity: 0.35 }} />;
}

function LegalModal({ title, children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '20px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#111', border: '1px solid #2a2a3e', borderRadius: '12px',
          padding: '32px', maxWidth: '640px', width: '100%',
          maxHeight: '80vh', overflowY: 'auto', position: 'relative'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', color: '#888',
            fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1
          }}
        >✕</button>
        <h2 style={{ color: 'var(--accent)', marginBottom: '20px', fontSize: '1.2rem', letterSpacing: '2px' }}>
          {title}
        </h2>
        <div style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: '1.7' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function AvisoLegal() {
  return (
    <>
      <p><strong>En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y del Comercio Electrónico (LSSI-CE), se informa:</strong></p>
      <br />
      <p><strong>Titular:</strong> Sergio Segura Medina</p>
      <p><strong>Contacto:</strong> yo@sergiosegura.com</p>
      <p><strong>Sitio web:</strong> taisen.es</p>
      <br />
      <p><strong>Condiciones de uso</strong></p>
      <p>El acceso y uso de este sitio web implica la aceptación de los presentes términos. El titular se reserva el derecho a modificar los contenidos del sitio sin previo aviso.</p>
      <br />
      <p><strong>Propiedad intelectual</strong></p>
      <p>Todos los contenidos del sitio web (textos, imágenes, diseño) son propiedad del titular o dispone de los derechos de uso correspondientes. Queda prohibida su reproducción sin autorización expresa.</p>
      <br />
      <p><strong>Limitación de responsabilidad</strong></p>
      <p>El titular no se hace responsable de los daños que pudieran derivarse del uso del sitio web o de la información contenida en él.</p>
    </>
  );
}

function PoliticaPrivacidad() {
  return (
    <>
      <p><strong>De conformidad con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD), se informa:</strong></p>
      <br />
      <p><strong>Responsable del tratamiento:</strong> Sergio Segura Medina · yo@sergiosegura.com</p>
      <br />
      <p><strong>Datos que se recogen</strong></p>
      <p>Este sitio recoge únicamente nombres artísticos o apodos utilizados en competiciones de baile. No se recogen nombres reales, datos de contacto ni información sensible de los participantes.</p>
      <br />
      <p><strong>Finalidad</strong></p>
      <p>Los datos se utilizan exclusivamente para la gestión y desarrollo de torneos de baile. No se emplean para ninguna otra finalidad.</p>
      <br />
      <p><strong>Conservación</strong></p>
      <p>Los datos se eliminan cuando el torneo al que pertenecen es suprimido de la plataforma. No existe conservación de datos más allá de la duración del evento.</p>
      <br />
      <p><strong>Legitimación</strong></p>
      <p>El tratamiento se basa en el interés legítimo del responsable para la organización de eventos deportivos y el consentimiento implícito de los participantes al inscribirse.</p>
      <br />
      <p><strong>Cesión a terceros</strong></p>
      <p>No se ceden datos a terceros ni se realizan transferencias internacionales.</p>
      <br />
      <p><strong>Derechos</strong></p>
      <p>Puede ejercer sus derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición escribiendo a yo@sergiosegura.com.</p>
      <br />
      <p><strong>Cookies</strong></p>
      <p>Este sitio utiliza únicamente cookies técnicas necesarias para el funcionamiento de la aplicación. No se emplean cookies de seguimiento ni analítica de terceros.</p>
    </>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [activeTournaments, setActiveTournaments] = useState([]);
  const [modal, setModal] = useState(null); // 'legal' | 'privacy' | null
  const [hoveredBtn, setHoveredBtn] = useState(null);
  const [staffModal, setStaffModal] = useState(false);
  const [staffCode, setStaffCode] = useState('');
  const [staffError, setStaffError] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [adminModal, setAdminModal] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    if (!adminPass.trim()) return;
    setAdminLoading(true);
    setAdminError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPass }),
      });
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem('adminToken', data.token);
        navigate('/admin');
      } else {
        setAdminError('Contraseña incorrecta');
      }
    } catch {
      setAdminError('Error de conexión');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    if (!staffCode.trim()) return;
    setStaffLoading(true);
    setStaffError('');
    try {
      const res = await fetch('/api/auth/resolve-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: staffCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setStaffError(data.error || 'Código no reconocido'); return; }
      if (data.type === 'judge') {
        sessionStorage.setItem('judgeSession', JSON.stringify(data.data));
        navigate('/judge');
      } else if (data.type === 'organizer') {
        sessionStorage.setItem('organizerCode', staffCode.trim());
        navigate(`/organizer/tournament/${data.tournament_id}`);
      } else if (data.type === 'speaker') {
        sessionStorage.setItem('speakerCode', staffCode.trim());
        navigate(`/speaker/tournament/${data.tournament_id}`);
      }
    } catch {
      setStaffError('Error de conexión');
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/tournament/active')
      .then(r => r.json())
      .then(data => setActiveTournaments(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #0a0a0f 70%)',
      position: 'relative',
    }}>
      <ParticleCanvas />
      <style>{`
        @keyframes home-glow-pulse {
          0%, 100% { text-shadow: 0 0 40px rgba(233,69,96,0.7), 0 0 80px rgba(233,69,96,0.3), 0 2px 4px rgba(0,0,0,0.8); }
          50%       { text-shadow: 0 0 70px rgba(233,69,96,1),   0 0 140px rgba(233,69,96,0.55), 0 2px 4px rgba(0,0,0,0.8); }
        }
        @keyframes letter-drop {
          from { opacity: 0; transform: translateY(-28px) scaleY(1.2); }
          to   { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        @keyframes tagline-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .access-btn {
          transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
      `}</style>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 20px 40px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Stage light — foco ambiental bajo el logo */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '700px', height: '380px',
          background: 'radial-gradient(ellipse at top, rgba(233,69,96,0.11) 0%, transparent 68%)',
          pointerEvents: 'none',
        }} />
        {/* TAISEN logo — letras con entrada escalonada + glow pulse continuo */}
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(5rem, 18vw, 11rem)',
          letterSpacing: '0.25em',
          lineHeight: 1,
          marginBottom: '4px',
          color: '#ffffff',
          animation: 'home-glow-pulse 3s ease-in-out infinite',
        }}>
          {['T','A','I','S','E','N'].map((l, i) => (
            <span key={i} style={{
              display: 'inline-block',
              opacity: 0,
              animation: `letter-drop 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
              animationDelay: `${i * 0.07}s`,
            }}>{l}</span>
          ))}
        </h1>
        <p style={{
          color: '#888',
          fontSize: 'clamp(0.75rem, 2vw, 1rem)',
          letterSpacing: '0.4em',
          textTransform: 'uppercase',
          marginBottom: '32px',
          opacity: 0,
          animation: 'tagline-in 0.6s ease 0.55s forwards',
        }}>
          Competiciones de Danza Urbana
        </p>

        {/* Divisor decorativo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          marginBottom: '40px',
          opacity: 0,
          animation: 'tagline-in 0.6s ease 0.7s forwards',
        }}>
          <div style={{ width: '48px', height: '1px', background: 'linear-gradient(to left, rgba(233,69,96,0.55), transparent)' }} />
          <span style={{ color: 'rgba(233,69,96,0.65)', fontSize: '0.6rem' }}>✦</span>
          <div style={{ width: '48px', height: '1px', background: 'linear-gradient(to right, rgba(233,69,96,0.55), transparent)' }} />
        </div>

        {/* Active tournaments */}
        {activeTournaments.length > 0 && (
          <div style={{ width: '100%', maxWidth: '500px', marginBottom: '48px' }}>
            <style>{`
              @keyframes pulse-dot {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.4; transform: scale(0.75); }
              }
            `}</style>
            <h2 style={{
              color: '#555', fontSize: '0.7rem',
              letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: '16px',
            }}>
              Torneos en curso
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeTournaments.map((t, idx) => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(233,69,96,0.2)',
                  borderRadius: '10px', padding: '14px 18px',
                  opacity: 0,
                  animation: `card-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${0.9 + idx * 0.1}s forwards`,
                }}>
                  <div style={{ textAlign: 'left' }}>
                    {/* EN VIVO pulsing indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <div style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        background: '#e94560',
                        animation: 'pulse-dot 1.4s ease-in-out infinite',
                      }} />
                      <span style={{ color: '#e94560', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em' }}>EN VIVO</span>
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '1rem', color: '#f0f0f0' }}>{t.name}</span>
                    <span style={{ color: '#666', fontSize: '0.8rem', marginLeft: '10px' }}>
                      {t.tournament_type === 'coreografia' ? 'Coreografía' : t.type}
                    </span>
                    {t.current_phase && (
                      <span style={{ color: '#e94560', fontSize: '0.75rem', marginLeft: '8px', letterSpacing: '0.05em' }}>
                        · {t.current_phase}
                      </span>
                    )}
                  </div>
                  <a
                    href={t.tournament_type === 'coreografia' ? `/coreo-screen/${t.id}` : `/screen/${t.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '7px 16px',
                      background: 'rgba(233,69,96,0.15)',
                      border: '1px solid rgba(233,69,96,0.4)',
                      borderRadius: '6px', color: '#e94560',
                      fontSize: '0.85rem', fontWeight: 600,
                      textDecoration: 'none', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                    }}
                  >
                    Entrar
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Píldoras de acceso — sobre el footer */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', justifyContent: 'center', gap: '8px',
        padding: '0 20px 20px',
      }}>
        <button
          className="access-btn"
          onMouseEnter={() => setHoveredBtn('staff')}
          onMouseLeave={() => setHoveredBtn(null)}
          onClick={() => { setStaffModal(true); setStaffCode(''); setStaffError(''); }}
          style={{
            width: '80px',
            background: hoveredBtn === 'staff' ? 'rgba(233,69,96,0.1)' : 'rgba(255,255,255,0.04)',
            border: hoveredBtn === 'staff' ? '1px solid rgba(233,69,96,0.5)' : '1px solid #2a2a3e',
            color: hoveredBtn === 'staff' ? '#e94560' : '#666',
            boxShadow: hoveredBtn === 'staff' ? '0 0 14px rgba(233,69,96,0.2)' : 'none',
            fontSize: '0.72rem', padding: '7px 0',
            borderRadius: '20px', cursor: 'pointer', letterSpacing: '0.12em', fontWeight: 600,
          }}
        >STAFF</button>
        <button
          className="access-btn"
          onMouseEnter={() => setHoveredBtn('admin')}
          onMouseLeave={() => setHoveredBtn(null)}
          onClick={() => { setAdminModal(true); setAdminPass(''); setAdminError(''); }}
          style={{
            width: '80px',
            background: hoveredBtn === 'admin' ? 'rgba(233,69,96,0.1)' : 'rgba(255,255,255,0.04)',
            border: hoveredBtn === 'admin' ? '1px solid rgba(233,69,96,0.5)' : '1px solid #2a2a3e',
            color: hoveredBtn === 'admin' ? '#e94560' : '#666',
            boxShadow: hoveredBtn === 'admin' ? '0 0 14px rgba(233,69,96,0.2)' : 'none',
            fontSize: '0.72rem', padding: '7px 0',
            borderRadius: '20px', cursor: 'pointer', letterSpacing: '0.12em', fontWeight: 600,
          }}
        >ADMIN</button>
      </div>

      {/* Modal STAFF — resolución de código */}
      {staffModal && (
        <div
          onClick={() => setStaffModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px',
          }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleStaffSubmit}
            style={{
              background: '#111', border: '1px solid #2a2a3e', borderRadius: '14px',
              padding: '32px 28px', maxWidth: '320px', width: '100%', textAlign: 'center',
            }}
          >
            <p style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem',
              letterSpacing: '0.25em', color: '#fff', marginBottom: '4px',
              textShadow: '0 0 20px rgba(233,69,96,0.5)',
            }}>TAISEN</p>
            <h2 style={{ color: '#888', fontSize: '0.8rem', letterSpacing: '0.25em', marginBottom: '24px' }}>
              ACCESO STAFF
            </h2>
            <input
              type="text"
              placeholder="Código de acceso"
              value={staffCode}
              onChange={e => { setStaffCode(e.target.value); setStaffError(''); }}
              autoFocus
              style={{
                width: '100%', marginBottom: '12px', textAlign: 'center',
                fontSize: '1.2rem', letterSpacing: '4px', background: '#0a0a0f',
                border: '1px solid #2a2a3e', borderRadius: '8px', padding: '12px',
                color: '#fff', boxSizing: 'border-box',
              }}
            />
            {staffError && (
              <p style={{ color: 'var(--accent)', marginBottom: '12px', fontSize: '0.85rem' }}>
                {staffError}
              </p>
            )}
            <button
              type="submit"
              disabled={staffLoading}
              className="btn-primary"
              style={{ width: '100%', opacity: staffLoading ? 0.6 : 1 }}
            >
              {staffLoading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </div>
      )}

      {/* Modal ADMIN */}
      {adminModal && (
        <div
          onClick={() => setAdminModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px',
          }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleAdminSubmit}
            style={{
              background: '#111', border: '1px solid #2a2a3e', borderRadius: '14px',
              padding: '32px 28px', maxWidth: '320px', width: '100%', textAlign: 'center',
            }}
          >
            <p style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem',
              letterSpacing: '0.25em', color: '#fff', marginBottom: '4px',
              textShadow: '0 0 20px rgba(233,69,96,0.5)',
            }}>TAISEN</p>
            <h2 style={{ color: '#888', fontSize: '0.8rem', letterSpacing: '0.25em', marginBottom: '24px' }}>
              ADMINISTRADOR
            </h2>
            <input
              type="password"
              placeholder="Contraseña"
              value={adminPass}
              onChange={e => { setAdminPass(e.target.value); setAdminError(''); }}
              autoFocus
              style={{
                width: '100%', marginBottom: '12px', textAlign: 'center',
                fontSize: '1.2rem', letterSpacing: '4px', background: '#0a0a0f',
                border: '1px solid #2a2a3e', borderRadius: '8px', padding: '12px',
                color: '#fff', boxSizing: 'border-box',
              }}
            />
            {adminError && (
              <p style={{ color: 'var(--accent)', marginBottom: '12px', fontSize: '0.85rem' }}>
                {adminError}
              </p>
            )}
            <button
              type="submit"
              disabled={adminLoading}
              className="btn-primary"
              style={{ width: '100%', opacity: adminLoading ? 0.6 : 1 }}
            >
              {adminLoading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #1a1a2e',
        padding: '20px',
        textAlign: 'center',
        display: 'flex',
        position: 'relative', zIndex: 1,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px 20px',
      }}>
        <Link to="/landing" style={{ color: 'var(--accent)', fontSize: '0.8rem', textDecoration: 'none', letterSpacing: '0.08em', fontWeight: 600 }}>
          ¿Qué es TAISEN?
        </Link>
        <span style={{ color: '#2a2a3e' }}>·</span>
        <span style={{ color: '#444', fontSize: '0.8rem' }}>
          &copy; {new Date().getFullYear()} taisen.es
        </span>
        <button
          onClick={() => setModal('legal')}
          style={{
            background: 'none', border: 'none', color: '#555',
            fontSize: '0.8rem', cursor: 'pointer', padding: 0,
            textDecoration: 'underline',
          }}
        >
          Aviso Legal
        </button>
        <button
          onClick={() => setModal('privacy')}
          style={{
            background: 'none', border: 'none', color: '#555',
            fontSize: '0.8rem', cursor: 'pointer', padding: 0,
            textDecoration: 'underline',
          }}
        >
          Política de Privacidad
        </button>
      </footer>

      {/* Legal modals */}
      {modal === 'legal' && (
        <LegalModal title="AVISO LEGAL" onClose={() => setModal(null)}>
          <AvisoLegal />
        </LegalModal>
      )}
      {modal === 'privacy' && (
        <LegalModal title="POLÍTICA DE PRIVACIDAD" onClose={() => setModal(null)}>
          <PoliticaPrivacidad />
        </LegalModal>
      )}
    </div>
  );
}
