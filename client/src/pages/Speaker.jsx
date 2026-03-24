import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { TournamentManager } from './Admin';

const API = '/api/admin';

function SpeakerLogin() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const urlCode = new URLSearchParams(window.location.search).get('code');
    if (!urlCode) return;
    fetch(`${API}/speaker-login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: urlCode })
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (data) {
        sessionStorage.setItem('speakerCode', urlCode);
        navigate(`/speaker/tournament/${data.tournament_id}`);
      } else {
        setError('Código de speaker inválido');
      }
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    const res = await fetch(`${API}/speaker-login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() })
    });
    if (res.ok) {
      const data = await res.json();
      sessionStorage.setItem('speakerCode', code.trim());
      navigate(`/speaker/tournament/${data.tournament_id}`);
    } else {
      setError('Código de speaker inválido');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.25em', color: '#fff', marginBottom: '2px', textShadow: '0 0 20px rgba(255,200,0,0.6)' }}>TAISEN</p>
        <h2 style={{ marginBottom: '20px', color: 'var(--gold)', fontSize: '0.9rem', letterSpacing: '0.2em' }}>SPEAKER</h2>
        <input
          type="text"
          placeholder="Código de acceso"
          value={code}
          onChange={e => setCode(e.target.value)}
          style={{ width: '100%', marginBottom: '12px', textAlign: 'center', fontSize: '1.3rem', letterSpacing: '4px' }}
          autoFocus
        />
        {error && <p style={{ color: 'var(--gold)', marginBottom: '12px', fontSize: '0.9rem' }}>{error}</p>}
        <button type="submit" className="btn-gold" style={{ width: '100%' }}>Entrar</button>
      </form>
    </div>
  );
}

function SpeakerTournament() {
  return <TournamentManager role="speaker" />;
}

export default function Speaker() {
  return (
    <Routes>
      <Route path="/" element={<SpeakerLogin />} />
      <Route path="/tournament/:id" element={<SpeakerTournament />} />
    </Routes>
  );
}
