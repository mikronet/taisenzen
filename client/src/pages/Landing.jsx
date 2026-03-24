import { Link } from 'react-router-dom';
import { useState } from 'react';

const FEATURES = [
  {
    icon: '📺',
    title: 'Pantalla pública en tiempo real',
    desc: 'Proyecta el bracket, ranking y resultados en cualquier TV o proyector — y en coreografía, muestra quién está en escena sin revelar nunca las puntuaciones. Todo se actualiza solo, sin recargar.',
  },
  {
    icon: '📱',
    title: 'Jueces desde el móvil',
    desc: 'Cada juez entra con un código único desde su teléfono. Sin apps, sin cuentas, sin configuración. En batallas elige al ganador con un toque; en coreografía puntúa cada criterio con un deslizador.',
  },
  {
    icon: '🎭',
    title: 'Coreografía por criterios',
    desc: 'Crea criterios de puntuación personalizados (técnica, musicalidad, originalidad…) con puntuación máxima ajustable. Los jueces puntúan cada criterio de forma independiente desde el móvil.',
  },
  {
    icon: '🎤',
    title: 'Panel de Speaker (MC)',
    desc: 'El maestro de ceremonias tiene su propio panel optimizado para móvil. Inicia rondas, controla cronómetros, avanza fases y avisa al público — sin tocar la admin y sin información irrelevante.',
  },
  {
    icon: '⏱️',
    title: 'Cronómetro automático',
    desc: 'El cronómetro arranca solo al iniciar cada batalla y se muestra en la pantalla pública. Speaker puede pausarlo, reanudarlo o resetearlo en cualquier momento.',
  },
  {
    icon: '🔔',
    title: 'Aviso de preparación',
    desc: 'Antes de cada batalla, el speaker activa una pantalla "¡PREPARARSE!" con los nombres de los participantes. El público y los competidores saben quién sigue antes de que empiece.',
  },
  {
    icon: '🏆',
    title: 'Bracket automático',
    desc: 'Fase de Filtros clasificatoria seguida de eliminación directa. El seeding se genera automáticamente según puntuaciones, para cualquier número de clasificados. Cero trabajo manual.',
  },
  {
    icon: '🔥',
    title: '7toSmoke',
    desc: 'Formato de batalla continua: cola dinámica, el ganador se queda en pista, el perdedor va al final. Timer global con cuenta atrás. Gana quien acumule más puntos al acabar el tiempo.',
  },
  {
    icon: '👥',
    title: '1vs1 y 2vs2',
    desc: 'En modalidad 2vs2 cada juez puntúa a los dos miembros del equipo por separado (0–5 cada uno). El sistema suma las notas automáticamente.',
  },
  {
    icon: '⚖️',
    title: 'Desempate automático',
    desc: 'Si una batalla acaba en empate, el sistema lanza automáticamente una ronda de desempate donde solo votan los jueces que marcaron EMPATE.',
  },
];

const ROLES = [
  {
    tag: 'ADMIN',
    color: '#e94560',
    title: 'Administrador',
    desc: 'Control total: crea torneos de batallas o coreografía, gestiona participantes y jueces, configura criterios, edita el bracket y finaliza el evento.',
    items: ['Crear torneos de batalla o coreografía', 'Configurar criterios y categorías coreo', 'Gestionar participantes y jueces', 'Editar cruces de eliminatorias', 'Finalizar el evento'],
  },
  {
    tag: 'ORGANIZADOR',
    color: '#ffd700',
    title: 'Organizador',
    desc: 'Acceso por código. Gestiona el día a día: añade participantes, controla rondas, maneja la pantalla pública y la lista de orden en coreografía.',
    items: ['Añadir participantes en el momento', 'Iniciar y cerrar rondas', 'Gestionar "en escena" en coreo', 'Ver puntuaciones y ranking'],
  },
  {
    tag: 'SPEAKER',
    color: '#4dc5e0',
    title: 'Speaker / MC',
    desc: 'El rol pensado para el maestro de ceremonias. Acceso por código propio. Flujo completo de torneo de batallas desde el escenario, sin distracciones.',
    items: ['Avisar "¡PREPARARSE!" en pantalla', 'Iniciar rondas y batallas', 'Controlar el cronómetro', 'Avanzar a eliminatorias'],
  },
  {
    tag: 'JURADO',
    color: '#9c88ff',
    title: 'Jurado',
    desc: 'Acceso instantáneo por código desde cualquier móvil. En batallas vota al ganador; en coreografía puntúa cada criterio con un deslizador y puede corregir puntuaciones libremente.',
    items: ['Sin app ni registro', 'Voto eliminatoria con confirmación', 'Sliders por criterio en coreografía', 'Navegación libre entre participantes'],
  },
];

function FeatureCard({ icon, title, desc }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid #1e1e30',
        borderRadius: '14px',
        padding: '28px 24px',
        flex: '1 1 220px',
        maxWidth: '300px',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(233,69,96,0.35)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#1e1e30'}
    >
      <div style={{ fontSize: '2rem', marginBottom: '14px' }}>{icon}</div>
      <h3 style={{ color: '#f0f0f0', fontSize: '0.95rem', letterSpacing: '0.05em', marginBottom: '10px' }}>{title}</h3>
      <p style={{ color: '#666', fontSize: '0.85rem', lineHeight: '1.65' }}>{desc}</p>
    </div>
  );
}

function RoleCard({ tag, color, title, desc, items }) {
  return (
    <div style={{
      flex: '1 1 220px', maxWidth: '260px',
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${color}22`,
      borderRadius: '14px', padding: '28px 22px',
      transition: 'border-color 0.2s, background 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}55`; e.currentTarget.style.background = `${color}08`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = `${color}22`; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
    >
      <div style={{
        display: 'inline-block', padding: '3px 10px',
        background: `${color}18`, border: `1px solid ${color}44`,
        borderRadius: '6px', marginBottom: '14px',
      }}>
        <span style={{ color, fontWeight: 800, fontSize: '0.78rem', letterSpacing: '0.12em', fontFamily: "'Bebas Neue', sans-serif" }}>{tag}</span>
      </div>
      <h3 style={{ color: '#f0f0f0', fontSize: '1rem', marginBottom: '10px' }}>{title}</h3>
      <p style={{ color: '#555', fontSize: '0.83rem', lineHeight: '1.6', marginBottom: '16px' }}>{desc}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map(item => (
          <li key={item} style={{ color: '#888', fontSize: '0.8rem', padding: '3px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color, fontSize: '0.6rem' }}>◆</span>{item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactForm() {
  const [fields, setFields] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | ok | error

  const set = (k, v) => setFields(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      setStatus(res.ok ? 'ok' : 'error');
    } catch {
      setStatus('error');
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2a3e',
    borderRadius: '8px', color: '#f0f0f0', fontSize: '0.95rem',
    fontFamily: "'Inter', sans-serif", outline: 'none',
    transition: 'border-color 0.2s',
  };

  if (status === 'ok') return (
    <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(0,200,83,0.06)', border: '1px solid rgba(0,200,83,0.25)', borderRadius: '14px' }}>
      <p style={{ fontSize: '2rem', marginBottom: '12px' }}>✓</p>
      <p style={{ color: '#00c853', fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>Mensaje enviado</p>
      <p style={{ color: '#555', fontSize: '0.9rem' }}>Te respondemos en menos de 24 h.</p>
    </div>
  );

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px' }}>
          <label style={{ display: 'block', color: '#555', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '6px' }}>NOMBRE</label>
          <input
            type="text" required maxLength={200}
            value={fields.name} onChange={e => set('name', e.target.value)}
            placeholder="Tu nombre"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'rgba(233,69,96,0.5)'}
            onBlur={e => e.target.style.borderColor = '#2a2a3e'}
          />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <label style={{ display: 'block', color: '#555', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '6px' }}>EMAIL</label>
          <input
            type="email" required maxLength={200}
            value={fields.email} onChange={e => set('email', e.target.value)}
            placeholder="tu@email.com"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'rgba(233,69,96,0.5)'}
            onBlur={e => e.target.style.borderColor = '#2a2a3e'}
          />
        </div>
      </div>
      <div>
        <label style={{ display: 'block', color: '#555', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '6px' }}>MENSAJE</label>
        <textarea
          required maxLength={2000} rows={5}
          value={fields.message} onChange={e => set('message', e.target.value)}
          placeholder="Cuéntanos tu evento, el estilo de baile, número aproximado de participantes..."
          style={{ ...inputStyle, resize: 'vertical', minHeight: '120px' }}
          onFocus={e => e.target.style.borderColor = 'rgba(233,69,96,0.5)'}
          onBlur={e => e.target.style.borderColor = '#2a2a3e'}
        />
      </div>
      {status === 'error' && (
        <p style={{ color: '#e94560', fontSize: '0.85rem', margin: 0 }}>
          Error al enviar. Prueba de nuevo o escríbenos a yo@sergiosegura.com
        </p>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        style={{
          padding: '14px', background: 'linear-gradient(135deg, #e94560, #c0392b)',
          border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700,
          fontSize: '0.95rem', letterSpacing: '0.08em', cursor: status === 'sending' ? 'default' : 'pointer',
          opacity: status === 'sending' ? 0.7 : 1, transition: 'opacity 0.2s',
        }}
      >
        {status === 'sending' ? 'Enviando...' : 'Enviar mensaje'}
      </button>
    </form>
  );
}

export default function Landing() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: '#0a0a0f', color: '#f0f0f0',
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 40px', borderBottom: '1px solid #111',
        position: 'sticky', top: 0, background: 'rgba(10,10,15,0.92)',
        backdropFilter: 'blur(10px)', zIndex: 50,
      }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '1.6rem', letterSpacing: '0.2em', color: '#fff',
            textShadow: '0 0 20px rgba(126,207,255,0.5)',
          }}>TAISEN ZEN</span>
        </Link>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <a href="#contacto" style={{
            padding: '8px 20px',
            background: 'rgba(233,69,96,0.15)', border: '1px solid rgba(233,69,96,0.4)',
            borderRadius: '20px', color: '#e94560',
            fontSize: '0.85rem', fontWeight: 600,
            textDecoration: 'none', letterSpacing: '0.05em',
          }}>
            Contactar
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '90px 24px 70px',
        background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #0a0a0f 65%)',
      }}>
        <div style={{
          display: 'inline-block', padding: '5px 14px',
          background: 'rgba(233,69,96,0.1)', border: '1px solid rgba(233,69,96,0.3)',
          borderRadius: '20px', marginBottom: '24px',
        }}>
          <span style={{ color: '#7ecfff', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.15em' }}>
            SOFTWARE DE COMPETICIÓN DE BAILE URBANO
          </span>
        </div>
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(3.5rem, 12vw, 8rem)',
          letterSpacing: '0.2em', lineHeight: 1, marginBottom: '8px',
          color: '#fff',
          textShadow: '0 0 40px rgba(126,207,255,0.6), 0 0 80px rgba(126,207,255,0.2)',
        }}>
          TAISEN ZEN
        </h1>
        <p style={{
          color: '#888', fontSize: 'clamp(0.75rem, 2vw, 1rem)',
          letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: '32px',
        }}>
          Batallas · Coreográficos
        </p>
        <p style={{
          color: '#bbb', fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
          maxWidth: '700px', lineHeight: 1.65, marginBottom: '48px',
        }}>
          Gestiona torneos de batalla y competiciones coreográficas en un solo sistema. Pantalla en directo para el público, jueces en el móvil, brackets automáticos, criterios configurables y Speaker panel — todo sin instalar nada.
        </p>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '60px' }}>
          <a href="#contacto" style={{
            padding: '14px 32px',
            background: 'linear-gradient(135deg, #3b9edd, #1a6fa8)',
            borderRadius: '8px', color: '#fff', fontWeight: 700,
            fontSize: '0.95rem', textDecoration: 'none', letterSpacing: '0.05em',
            boxShadow: '0 4px 20px rgba(126,207,255,0.3)',
          }}>
            Quiero TAISEN ZEN en mi torneo
          </a>
        </div>

        {/* Stats strip */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '12px 32px',
          justifyContent: 'center', alignItems: 'center',
          borderTop: '1px solid #1a1a2e', paddingTop: '36px',
          width: '100%', maxWidth: '900px',
        }}>
          {[
            { val: '4 roles', sub: 'Admin · Organizador · Speaker · Jurado' },
            { val: 'Sin instalación', sub: 'Acceso por código desde el móvil' },
            { val: 'Tiempo real', sub: 'Pantalla, jueces y speaker sincronizados' },
            { val: '2 tipos', sub: 'Torneos de batalla y coreografía' },
            { val: '3 formatos', sub: '1vs1 · 2vs2 · 7toSmoke' },
          ].map(s => (
            <div key={s.val} style={{ textAlign: 'center' }}>
              <p style={{ color: '#e94560', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.05em', marginBottom: '2px' }}>{s.val}</p>
              <p style={{ color: '#444', fontSize: '0.72rem' }}>{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section style={{ padding: '80px 24px', borderTop: '1px solid #111', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <p style={{ color: '#555', fontSize: '0.75rem', letterSpacing: '0.35em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '12px' }}>
            Roles
          </p>
          <h2 style={{ color: '#f0f0f0', fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', textAlign: 'center', marginBottom: '12px' }}>
            Cada persona, su panel
          </h2>
          <p style={{ color: '#555', fontSize: '0.9rem', textAlign: 'center', maxWidth: '560px', margin: '0 auto 48px', lineHeight: 1.6 }}>
            Admin, Organizador, Speaker y Jurado tienen acceso separado con código propio. Nadie toca lo que no le corresponde.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
            {ROLES.map(r => <RoleCard key={r.tag} {...r} />)}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <p style={{ color: '#555', fontSize: '0.75rem', letterSpacing: '0.35em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '12px' }}>
          Funcionalidades
        </p>
        <h2 style={{ color: '#f0f0f0', fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', textAlign: 'center', marginBottom: '48px', letterSpacing: '0.03em' }}>
          Todo lo que necesitas, nada que no uses
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
          {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {/* Modalities */}
      <section style={{ padding: '70px 24px', borderTop: '1px solid #111', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <p style={{ color: '#555', fontSize: '0.75rem', letterSpacing: '0.35em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '12px' }}>Modalidades</p>
          <h2 style={{ color: '#f0f0f0', fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', textAlign: 'center', marginBottom: '40px' }}>
            Diseñado para el baile urbano
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
            {[
              {
                tag: '1VS1',
                color: '#e94560',
                title: 'Batalla individual',
                desc: 'Cada juez vota por un participante o marca empate. Desempate automático. Bracket eliminatorio para cualquier número de clasificados — no tiene que ser potencia de 2.',
                styles: 'Breaking · Popping · Locking · House · Hip Hop · Waacking · Voguing',
              },
              {
                tag: '2VS2',
                color: '#e94560',
                title: 'Batalla por equipos',
                desc: 'Los equipos compiten con nombre propio. En la fase de Filtros, los jueces puntúan a cada miembro del equipo por separado (0–5), sumándose la nota del equipo.',
                styles: 'Breaking · Hip Hop · Popping · Cualquier estilo en pareja',
              },
              {
                tag: '7TOSMOKE',
                color: '#e94560',
                title: 'Formato 7toSmoke',
                desc: 'Fase de Filtros para clasificar, luego cola dinámica: el ganador se queda en pista, el perdedor va al final. Timer global configurable — gana quien más puntos acumule al acabar el tiempo. Configurable en modo puntos acumulados o racha.',
                styles: 'Todos los estilos · Especialmente popular en Breaking y Hip Hop',
              },
              {
                tag: 'COREOGRAFÍA',
                color: '#7ecfff',
                title: 'Competición coreográfica',
                desc: 'Participantes salen al escenario uno a uno según el orden configurado. Los jueces puntúan cada criterio (técnica, musicalidad, originalidad…) desde el móvil con un deslizador. La pantalla pública muestra quién está en escena — nunca las puntuaciones.',
                styles: 'Solo · Dúo · Grupo · Minicrew · Megacrew · Todos los estilos',
              },
            ].map(m => (
              <div key={m.tag} style={{
                flex: '1 1 360px', maxWidth: '420px',
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${(m.color || '#e94560')}22`,
                borderRadius: '14px', padding: '32px 28px',
              }}>
                <div style={{
                  display: 'inline-block', padding: '4px 12px',
                  background: `${(m.color || '#e94560')}18`, border: `1px solid ${(m.color || '#e94560')}44`,
                  borderRadius: '6px', marginBottom: '16px',
                }}>
                  <span style={{ color: m.color || '#e94560', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.1em', fontFamily: "'Bebas Neue', sans-serif" }}>
                    {m.tag}
                  </span>
                </div>
                <h3 style={{ color: '#f0f0f0', fontSize: '1.1rem', marginBottom: '12px' }}>{m.title}</h3>
                <p style={{ color: '#666', fontSize: '0.88rem', lineHeight: '1.65', marginBottom: '16px' }}>{m.desc}</p>
                <p style={{ color: '#444', fontSize: '0.78rem', letterSpacing: '0.05em' }}>{m.styles}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '70px 24px', borderTop: '1px solid #111', borderBottom: '1px solid #111', background: 'rgba(233,69,96,0.02)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: '#555', fontSize: '0.75rem', letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: '12px' }}>
            ¿Cómo funciona?
          </p>
          <h2 style={{ color: '#f0f0f0', fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', marginBottom: '48px' }}>
            Listo en minutos, no en horas
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', justifyContent: 'center' }}>
            {[
              { n: '01', t: 'Configura tu torneo', d: 'Crea el evento, añade participantes y jueces, configura las fases. En 5 minutos tienes el bracket y los códigos de acceso listos.' },
              { n: '02', t: 'Cada uno en su rol', d: 'Admin gestiona, el Organizador añade participantes in situ, el Speaker lleva el hilo del evento y el Jurado puntúa desde el móvil.' },
              { n: '03', t: 'El público lo vive', d: 'Proyecta la pantalla: bracket, ranking, avisos de preparación y cronómetro en tiempo real. Sin recargar, sin cámaras lentas.' },
            ].map(s => (
              <div key={s.n} style={{ flex: '1 1 180px', maxWidth: '220px' }}>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.5rem',
                  color: 'rgba(233,69,96,0.3)', letterSpacing: '0.1em', marginBottom: '10px',
                }}>{s.n}</div>
                <p style={{ color: '#f0f0f0', fontWeight: 600, marginBottom: '8px', fontSize: '0.95rem' }}>{s.t}</p>
                <p style={{ color: '#666', fontSize: '0.85rem', lineHeight: '1.6' }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section style={{ padding: '60px 24px', textAlign: 'center', background: 'radial-gradient(ellipse at center, rgba(233,69,96,0.07) 0%, transparent 70%)' }}>
        <h2 style={{
          color: '#f0f0f0', fontSize: 'clamp(1.5rem, 4vw, 2.4rem)',
          fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.1em', marginBottom: '16px',
        }}>
          ¿Tienes un torneo en mente?
        </h2>
        <p style={{ color: '#666', marginBottom: '32px', fontSize: '1rem', maxWidth: '500px', margin: '0 auto 32px' }}>
          Cuéntanos tu evento. Te configuramos TAISEN ZEN a tu medida y te acompañamos el día del torneo.
        </p>
        <a href="#contacto" style={{
          padding: '15px 40px',
          background: 'linear-gradient(135deg, #3b9edd, #1a6fa8)',
          borderRadius: '8px', color: '#fff', fontWeight: 700,
          fontSize: '1rem', textDecoration: 'none', letterSpacing: '0.08em',
          boxShadow: '0 4px 24px rgba(126,207,255,0.3)',
        }}>
          Contactar ahora
        </a>
      </section>

      {/* Contact */}
      <section id="contacto" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <p style={{ color: '#555', fontSize: '0.75rem', letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: '12px', textAlign: 'center' }}>
            Contacto
          </p>
          <h2 style={{ color: '#f0f0f0', fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: '12px', letterSpacing: '0.05em', textAlign: 'center' }}>
            ¿Quieres TAISEN ZEN en tu torneo?
          </h2>
          <p style={{ color: '#555', marginBottom: '36px', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.6 }}>
            Cuéntanos tu evento y te configuramos todo. Te respondemos en menos de 24 h.
          </p>
          <ContactForm />
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #111', padding: '28px 24px',
        display: 'flex', flexWrap: 'wrap', gap: '10px 24px',
        alignItems: 'center', justifyContent: 'center', background: '#080808',
      }}>
        <a href="https://taisen.es" style={{ color: '#444', fontSize: '0.8rem', textDecoration: 'none' }}>taisen.es</a>
        <span style={{ color: '#222' }}>·</span>
        <span style={{ color: '#333', fontSize: '0.8rem' }}>© {new Date().getFullYear()} taisen.es</span>
      </footer>
    </div>
  );
}
