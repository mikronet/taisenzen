import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api/coreo';

// Landing page for organizers: they enter their code and get redirected
// to the CoreoAdmin panel for their specific tournament.
export default function CoreoOrganizer() {
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('code') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/organizer-login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Código no válido'); return; }
      sessionStorage.setItem('coreoOrgCode', code.trim());
      navigate(`/coreo-admin/${data.organizer.tournament_id}`);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '380px' }}>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.25em', color: '#7ecfff', marginBottom: '2px' }}>ZEN TAISEN</p>
        <h2 style={{ marginBottom: '8px', color: '#a78bfa', fontSize: '0.85rem', letterSpacing: '0.2em' }}>ORGANIZADOR</h2>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginBottom: '20px' }}>
          Introduce el código que te ha dado el administrador del evento.
        </p>
        <input
          placeholder="Código de acceso"
          value={code} onChange={e => setCode(e.target.value)}
          style={{ width: '100%', marginBottom: '12px' }}
          autoCapitalize="none" autoComplete="off"
        />
        {error && <p style={{ color: 'var(--accent)', marginBottom: '12px', fontSize: '0.9rem' }}>{error}</p>}
        <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
