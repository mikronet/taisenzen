import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import Bracket from '../components/Bracket';
// MatchupEditor removed — seeding is automatic from Filtros
import PhaseConfigurator from '../components/PhaseConfigurator';
import { QRCodeSVG } from 'qrcode.react';

const API = '/api/admin';

// Wrapper that automatically includes auth headers in every request.
// Sends admin token, organizer code, or speaker code depending on who is logged in.
function apiFetch(url, options = {}) {
  const token = sessionStorage.getItem('adminToken') || '';
  const organizerCode = sessionStorage.getItem('organizerCode') || '';
  const speakerCode = sessionStorage.getItem('speakerCode') || '';
  const isFormData = options.body instanceof FormData;
  return fetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      'x-admin-token': token,
      'x-organizer-code': organizerCode,
      'x-speaker-code': speakerCode,
      ...(options.headers || {}),
    },
  });
}

function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await apiFetch(`${API}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      const data = await res.json();
      sessionStorage.setItem('adminToken', data.token);
      onLogin();
    } else {
      setError('Contraseña incorrecta');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '380px' }}>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.25em', color: '#fff', marginBottom: '2px', textShadow: '0 0 20px rgba(233,69,96,0.6)' }}>TAISEN</p>
        <h2 style={{ marginBottom: '20px', color: 'var(--accent)', fontSize: '0.9rem', letterSpacing: '0.2em' }}>ADMINISTRACIÓN</h2>
        <input type="password" placeholder="Contraseña" value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', marginBottom: '12px' }} />
        {error && <p style={{ color: 'var(--accent)', marginBottom: '12px', fontSize: '0.9rem' }}>{error}</p>}
        <button type="submit" className="btn-primary" style={{ width: '100%' }}>Entrar</button>
      </form>
    </div>
  );
}

function TournamentList({ onLogout }) {
  const [tournaments, setTournaments] = useState([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('1vs1');
  const [tournamentType, setTournamentType] = useState('bracket');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const res = await apiFetch(`${API}/tournaments`);
    setTournaments(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await apiFetch(`${API}/tournaments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, tournament_type: tournamentType })
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || 'Error al crear el torneo'); return; }
      setName('');
      // For coreografía, navigate directly to its admin panel
      if (tournamentType === 'coreografia') {
        navigate(`/coreo-admin/${data.id}`);
      } else {
        load();
      }
    } catch {
      setCreateError('Error de conexión con el servidor');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id) => {
    const t = tournaments.find(t => t.id === id);
    const msg = t?.status === 'active'
      ? `⚠️ Este torneo está ACTIVO ahora mismo.\n\nEliminarlo borrará todos los datos y la pantalla pública quedará sin contenido.\n\n¿Seguro que quieres eliminarlo?`
      : '¿Eliminar este torneo? Esta acción no se puede deshacer.';
    if (!confirm(msg)) return;
    await apiFetch(`${API}/tournaments/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.25em', color: '#fff', marginBottom: '2px', textShadow: '0 0 20px rgba(233,69,96,0.6)' }}>TAISEN</p>
          <h1 style={{ color: 'var(--accent)', fontSize: '1rem', letterSpacing: '0.15em' }}>TORNEOS</h1>
        </div>
        {onLogout && (
          <button onClick={onLogout} style={{
            background: 'none', border: '1px solid #333', color: '#666',
            fontSize: '0.78rem', padding: '6px 14px', borderRadius: '20px',
            cursor: 'pointer', letterSpacing: '0.05em',
          }}>Salir</button>
        )}
      </div>
      <form onSubmit={create} style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <input placeholder="Nombre del torneo" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1, minWidth: '200px' }} />
        <select value={tournamentType} onChange={e => { setTournamentType(e.target.value); if (e.target.value === 'coreografia') setType('n/a'); }}>
          <option value="bracket">Battle — Bracket</option>
          <option value="7tosmoke">Battle — 7toSmoke</option>
          <option value="coreografia">Coreografía</option>
        </select>
        {tournamentType !== 'coreografia' && (
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="1vs1">1vs1</option>
            <option value="2vs2">2vs2</option>
            <option value="teams">Equipos</option>
          </select>
        )}
        <button type="submit" className="btn-primary" disabled={creating}>
          {creating ? 'Creando...' : 'Crear'}
        </button>
      </form>
      {createError && <p style={{ color: 'var(--accent)', fontSize: '0.85rem', marginBottom: '12px' }}>{createError}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {tournaments.map(t => (
          <div key={t.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <strong style={{ fontSize: '1.1rem' }}>{t.name}</strong>
              <span className={`badge badge-${t.status === 'active' ? 'live' : t.status === 'finished' ? 'finished' : 'pending'}`} style={{ marginLeft: '10px' }}>
                {t.status === 'setup' ? 'Configuración' : t.status === 'active' ? 'En curso' : 'Finalizado'}
              </span>
              <span style={{ color: 'var(--text-muted)', marginLeft: '10px', fontSize: '0.85rem' }}>{t.type}</span>
              {t.tournament_type === '7tosmoke' && (
                <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.05em' }}>7toSmoke</span>
              )}
              {t.tournament_type === 'coreografia' && (
                <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: '#7ecfff', fontWeight: 700, letterSpacing: '0.05em' }}>COREO</span>
              )}
              {t.created_at && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '3px' }}>
                  {new Date(t.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {t.tournament_type === 'coreografia' ? (
                <>
                  <button className="btn-secondary" onClick={() => navigate(`/coreo-admin/${t.id}`)}>Gestionar</button>
                  <button className="btn-secondary" onClick={() => window.open(`/coreo-screen/${t.id}`, '_blank')}>Pantalla</button>
                </>
              ) : (
                <>
                  <button className="btn-secondary" onClick={() => navigate(`/admin/tournament/${t.id}`)}>Gestionar</button>
                  <button className="btn-secondary" onClick={() => window.open(`/screen/${t.id}`, '_blank')}>Pantalla</button>
                </>
              )}
              <button className="btn-danger" onClick={() => remove(t.id)}>Eliminar</button>
            </div>
          </div>
        ))}
        {tournaments.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No hay torneos. Crea uno para empezar.</p>}
      </div>
    </div>
  );
}

export function TournamentManager({ role = 'admin', onLogout }) {
  const [tournament, setTournament] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [judges, setJudges] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [phases, setPhases] = useState([]);
  const [matches, setMatches] = useState([]);
  const [newParticipant, setNewParticipant] = useState('');
  const [newMember1, setNewMember1] = useState('');
  const [newMember2, setNewMember2] = useState('');
  const [newJudge, setNewJudge] = useState('');
  const [newOrganizer, setNewOrganizer] = useState('');
  const [voteStatus, setVoteStatus] = useState({});
  const [scores, setScores] = useState([]);
  const [showScores, setShowScores] = useState(() => sessionStorage.getItem('showScores') === 'true');
  const [showRondas, setShowRondas] = useState(() => sessionStorage.getItem('showRondas') !== 'false');
  const [editingScore, setEditingScore] = useState(null); // { id, value }
  const [showHistory, setShowHistory] = useState(() => sessionStorage.getItem('showHistory') === 'true');
  const [history, setHistory] = useState([]);
  const [tickerInput, setTickerInput] = useState('');
  const [tickerActive, setTickerActive] = useState('');
  const [waitingScreen, setWaitingScreen] = useState(false);
  const [bracketScreen, setBracketScreen] = useState(false);
  const [logoPath, setLogoPath] = useState(null);
  const [phaseConfigSaved, setPhaseConfigSaved] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [qrModal, setQrModal] = useState(null); // { url, label }
  const [timerState, setTimerState] = useState({ status: 'idle', startAt: null, remainingS: null, durationS: 60 });
  const [timerDurationInput, setTimerDurationInput] = useState(60);
  const [timerDisplay, setTimerDisplay] = useState('01:00');
  const [timerFinished, setTimerFinished] = useState(false);
  // 7toSmoke: global timer state
  const [globalTimerState, setGlobalTimerState] = useState({ status: 'idle', startAt: null, remainingS: null, durationS: 3600 });
  const [globalTimerDurationInput, setGlobalTimerDurationInput] = useState(3600);
  const [globalTimerDisplay, setGlobalTimerDisplay] = useState('60:00');
  const [globalTimerFinished, setGlobalTimerFinished] = useState(false);
  // Track which match has been "prepared" (screen shown) so Iniciar is gated
  const [preparedMatchId, setPreparedMatchId] = useState(null);
  // Filtros queue reorder mode
  const [reorderMode, setReorderMode] = useState(false);
  const [pendingQueue, setPendingQueue] = useState([]);
  const reorderDragItem = useRef(null);
  const reorderDragOver = useRef(null);
  const socket = useSocket();

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 2500);
  };

  const id = window.location.pathname.split('/').pop();
  const navigate = useNavigate();

  const loadAll = useCallback(async () => {
    const [tRes, pRes, jRes, oRes, bRes, liveRes] = await Promise.all([
      apiFetch(`${API}/tournaments/${id}`),
      apiFetch(`${API}/tournaments/${id}/participants`),
      apiFetch(`${API}/tournaments/${id}/judges`),
      apiFetch(`${API}/tournaments/${id}/organizers`),
      fetch(`/api/tournament/${id}`),
      fetch(`/api/tournament/${id}/live-match`),
    ]);
    // If the server rejects our credentials for this tournament (e.g. speaker
    // code belongs to a different tournament), redirect back to the login page.
    if (tRes.status === 401) {
      if (role === 'speaker') { sessionStorage.removeItem('speakerCode'); navigate('/speaker'); }
      else if (role === 'organizer') { sessionStorage.removeItem('organizerCode'); navigate('/organizer'); }
      else { sessionStorage.removeItem('adminToken'); navigate('/admin'); }
      return;
    }
    const tData = await tRes.json();
    setTournament(tData);
    if (tData.ticker_message) { setTickerActive(tData.ticker_message); setTickerInput(tData.ticker_message); }
    setWaitingScreen(!!tData.waiting_screen);
    setBracketScreen(!!tData.bracket_screen);
    setLogoPath(tData.logo_path || null);
    if (tData.timer_status !== undefined) {
      const ts = { status: tData.timer_status || 'idle', startAt: tData.timer_start_at, remainingS: tData.timer_remaining_s, durationS: tData.timer_duration_s || 60 };
      setTimerState(ts);
      if (ts.status === 'idle') setTimerDurationInput(ts.durationS);
    }
    if (tData.global_timer_status !== undefined) {
      const gt = { status: tData.global_timer_status || 'idle', startAt: tData.global_timer_start_at, remainingS: tData.global_timer_remaining_s, durationS: tData.global_timer_duration_s || 3600 };
      setGlobalTimerState(gt);
      if (gt.status === 'idle') setGlobalTimerDurationInput(gt.durationS);
    }
    // If tournament already has a saved phase_config, consider it "saved" so
    // the "Generar Cuadro" button appears correctly even after a page reload
    if (tData.phase_config) setPhaseConfigSaved(true);
    setParticipants(await pRes.json());
    setJudges(await jRes.json());
    setOrganizers(await oRes.json());
    const bracket = await bRes.json();
    setPhases(bracket.phases);
    setMatches(bracket.matches);
    // Restore vote status so CERRAR RONDA / REVELAR RESULTADO button survives navigation.
    // Always populate — even with 0 votes — so the tiebreaker totalJudges is never wrong.
    const liveData = await liveRes.json();
    if (liveData.match) {
      setVoteStatus(prev => ({
        ...prev,
        [liveData.match.id]: {
          matchId: liveData.match.id,
          totalVotes: liveData.totalVotes,
          totalJudges: liveData.totalJudges,
          allVoted: liveData.allVoted,
        },
      }));
    }
  }, [id]);

  const loadScores = useCallback(async () => {
    const res = await apiFetch(`${API}/tournaments/${id}/scores`);
    setScores(await res.json());
  }, [id]);

  useEffect(() => {
    const rejoin = () => {
      socket.emit('join:admin', parseInt(id));
      loadAll();
    };

    loadAll();
    socket.emit('join:admin', parseInt(id));
    // Re-join room and reload data on reconnect (handles network drops)
    socket.on('connect', rejoin);

    socket.on('vote:received', (data) => {
      setVoteStatus(prev => ({ ...prev, [data.matchId]: data }));
    });
    socket.on('match:result', () => { loadAll(); loadScores(); });
    socket.on('round:closed', () => { loadAll(); loadScores(); });
    socket.on('tournament:updated', () => { setVoteStatus({}); loadAll(); setReorderMode(false); });
    socket.on('timer:update', (data) => { setTimerState(data); });
    socket.on('global-timer:update', (data) => { setGlobalTimerState(data); });
    socket.on('tournament:logo-updated', (data) => { setLogoPath(data.logo_path || null); });
    socket.on('screen:bracket', (data) => { setBracketScreen(data.active); });

    return () => {
      socket.off('connect', rejoin);
      socket.off('vote:received');
      socket.off('match:result');
      socket.off('round:closed');
      socket.off('tournament:updated');
      socket.off('timer:update');
      socket.off('global-timer:update');
      socket.off('tournament:logo-updated');
      socket.off('screen:bracket');
    };
  }, [id, socket, loadAll, loadScores]);

  // Timer display — computes MM:SS from timerState on every tick (when running) or change
  useEffect(() => {
    const fmt = (s) => {
      const m = Math.floor(Math.abs(s) / 60);
      const sec = Math.floor(Math.abs(s) % 60);
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };
    if (timerState.status === 'idle') {
      setTimerDisplay(fmt(timerDurationInput || timerState.durationS || 60));
      setTimerFinished(false);
      return;
    }
    if (timerState.status === 'paused') {
      const r = timerState.remainingS != null ? timerState.remainingS : (timerState.durationS || 60);
      setTimerDisplay(fmt(r));
      setTimerFinished(r <= 0);
      return;
    }
    // running — tick every 250ms
    const tick = () => {
      const elapsed = timerState.startAt ? (Date.now() - timerState.startAt) / 1000 : 0;
      const remaining = Math.max(0, (timerState.remainingS || 0) - elapsed);
      setTimerDisplay(fmt(remaining));
      setTimerFinished(remaining <= 0);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [timerState, timerDurationInput]);

  // Global timer display for 7toSmoke
  useEffect(() => {
    const fmt = (s) => {
      const m = Math.floor(Math.abs(s) / 60);
      const sec = Math.floor(Math.abs(s) % 60);
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };
    if (globalTimerState.status === 'idle') {
      setGlobalTimerDisplay(fmt(globalTimerDurationInput || globalTimerState.durationS || 3600));
      setGlobalTimerFinished(false);
      return;
    }
    if (globalTimerState.status === 'paused') {
      const r = globalTimerState.remainingS != null ? globalTimerState.remainingS : (globalTimerState.durationS || 3600);
      setGlobalTimerDisplay(fmt(r));
      setGlobalTimerFinished(r <= 0);
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
  }, [globalTimerState, globalTimerDurationInput]);

  // Persist panel open/close state across page reloads
  useEffect(() => { sessionStorage.setItem('showRondas', showRondas); }, [showRondas]);
  useEffect(() => { sessionStorage.setItem('showScores', showScores); }, [showScores]);
  useEffect(() => { sessionStorage.setItem('showHistory', showHistory); }, [showHistory]);

  const addParticipant = async (e) => {
    e.preventDefault();
    if (!newParticipant.trim()) return;
    const is2v2 = tournament?.type === '2vs2';
    const res = await apiFetch(`${API}/tournaments/${id}/participants`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newParticipant,
        member1_name: is2v2 ? newMember1.trim() : '',
        member2_name: is2v2 ? newMember2.trim() : '',
      })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Error al añadir participante', true);
      return;
    }
    setNewParticipant('');
    setNewMember1('');
    setNewMember2('');
    loadAll();
  };

  const removeParticipant = async (pid, name) => {
    if (!confirm(`¿Eliminar a "${name}"? Esta acción no se puede deshacer.`)) return;
    await apiFetch(`${API}/participants/${pid}`, { method: 'DELETE' });
    loadAll();
  };

  const addJudge = async (e) => {
    e.preventDefault();
    if (!newJudge.trim()) return;
    const res = await apiFetch(`${API}/tournaments/${id}/judges`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newJudge })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Error al añadir juez', true);
      return;
    }
    setNewJudge('');
    loadAll();
  };

  const removeJudge = async (jid, name) => {
    if (!confirm(`¿Eliminar al juez "${name}"?`)) return;
    const res = await apiFetch(`${API}/judges/${jid}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Error al eliminar juez', true);
      return;
    }
    loadAll();
  };

  const addOrganizer = async (e) => {
    e.preventDefault();
    if (!newOrganizer.trim()) return;
    const res = await apiFetch(`${API}/tournaments/${id}/organizers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newOrganizer })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Error al añadir organizador', true);
      return;
    }
    setNewOrganizer('');
    loadAll();
  };

  const removeOrganizer = async (oid, name) => {
    if (!confirm(`¿Eliminar al organizador "${name}"?`)) return;
    await apiFetch(`${API}/organizers/${oid}`, { method: 'DELETE' });
    loadAll();
  };

  const savePhaseConfig = async (config, advanceCount, groupSize, timerDurationS, globalTimerDurationS, pointsMode) => {
    await apiFetch(`${API}/tournaments/${id}/phase-config`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phaseConfig: config, filtrosAdvanceCount: advanceCount, groupSize, timerDurationS: timerDurationS || 60, globalTimerDurationS: globalTimerDurationS || 3600, pointsMode: pointsMode || 'accumulated' })
    });
    setPhaseConfigSaved(true);
    // Auto-generate (or re-generate) bracket immediately after saving config, if conditions are met
    if (participants.length >= 2 && judges.length >= 1) {
      await apiFetch(`${API}/tournaments/${id}/generate-phases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
    }
    loadAll();
  };

  const generatePhases = async () => {
    await apiFetch(`${API}/tournaments/${id}/generate-phases`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    loadAll();
    loadScores();
  };

  const prepareMatch = async (matchId) => {
    const res = await apiFetch(`${API}/matches/${matchId}/prepare`, { method: 'POST' });
    if (res.ok) { setPreparedMatchId(matchId); showToast('Pantalla preparada ✓'); }
    else { const err = await res.json().catch(() => ({})); showToast(err.error || 'Error al preparar', true); }
  };

  const startMatch = async (matchId) => {
    setActionLoading(true);
    setPreparedMatchId(null);
    const res = await apiFetch(`${API}/matches/${matchId}/start`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Error al iniciar la ronda', true);
      setActionLoading(false);
      return;
    }
    // Reset timer to idle — speaker/organizer starts it manually with the TIEMPO button
    const resetRes = await apiFetch(`${API}/tournaments/${id}/timer/reset`, { method: 'POST' });
    if (resetRes.ok) setTimerState(await resetRes.json());
    await loadAll();
    setActionLoading(false);
  };

  const revealResult = async (matchId) => {
    setActionLoading(true);
    const res = await apiFetch(`${API}/matches/${matchId}/reveal`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      alert(`❌ ${err.error}`);
      setActionLoading(false);
      return;
    }
    await loadAll();
    await loadScores();
    setActionLoading(false);
  };

  const closeRound = async (matchId) => {
    setActionLoading(true);
    const res = await apiFetch(`${API}/matches/${matchId}/close-round`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      alert(`❌ ${err.error || 'Error al cerrar la ronda'}`);
    }
    await loadAll();
    await loadScores();
    setActionLoading(false);
  };

  const restartMatch = async (matchId) => {
    setActionLoading(true);
    await apiFetch(`${API}/matches/${matchId}/restart`, { method: 'POST' });
    await loadAll();
    setActionLoading(false);
  };

  const enterReorderMode = () => {
    const queue = filtrosMatches
      .filter(m => m.status === 'pending')
      .flatMap(m => m.participants || []);
    setPendingQueue(queue);
    setReorderMode(true);
  };

  const saveReorder = async () => {
    setActionLoading(true);
    const res = await apiFetch(`${API}/tournaments/${id}/reorder-filtros`, {
      method: 'POST',
      body: JSON.stringify({ participantIds: pendingQueue.map(p => p.id) })
    });
    if (res.ok) {
      setReorderMode(false);
      await loadAll();
      showToast('Orden actualizado ✓');
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Error al reordenar', true);
    }
    setActionLoading(false);
  };

  const startTiebreaker = async (matchId) => {
    setActionLoading(true);
    const res = await apiFetch(`${API}/matches/${matchId}/start-tiebreaker`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      alert(`❌ ${err.error}`);
    } else {
      // Reset timer to idle — speaker/organizer starts it manually with the TIEMPO button
      const resetRes = await apiFetch(`${API}/tournaments/${id}/timer/reset`, { method: 'POST' });
      if (resetRes.ok) setTimerState(await resetRes.json());
    }
    await loadAll();
    setActionLoading(false);
  };

  const advanceFiltros = async () => {
    if (!confirm(`¿Avanzar ${tournament.filtros_advance_count} clasificados a eliminatorias?\n\nEsta acción no se puede deshacer.`)) return;
    const res = await apiFetch(`${API}/tournaments/${id}/advance-filtros`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`Avanzaron ${data.advancing.length} participantes`);
      loadAll();
    } else {
      const err = await res.json();
      alert(`❌ ${err.error}`);
    }
  };

  const advanceToSmoke = async () => {
    if (!confirm(`¿Avanzar ${tournament.filtros_advance_count} participantes a la fase 7toSmoke?\n\nEsta acción no se puede deshacer.`)) return;
    const res = await apiFetch(`${API}/tournaments/${id}/advance-7tosmoke`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`Avanzaron ${data.advancing.length} participantes a 7toSmoke`);
      loadAll();
    } else {
      const err = await res.json();
      alert(`❌ ${err.error}`);
    }
  };

  const globalTimerStart = async () => {
    const body = globalTimerState.status === 'paused' ? {} : { duration_s: globalTimerDurationInput };
    const res = await apiFetch(`${API}/tournaments/${id}/global-timer/start`, { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) setGlobalTimerState(await res.json());
  };

  const globalTimerPause = async () => {
    const res = await apiFetch(`${API}/tournaments/${id}/global-timer/pause`, { method: 'POST' });
    if (res.ok) setGlobalTimerState(await res.json());
  };

  const globalTimerReset = async () => {
    const res = await apiFetch(`${API}/tournaments/${id}/global-timer/reset`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setGlobalTimerState(data);
      setGlobalTimerDurationInput(data.durationS);
    }
  };

  const updateParticipantScore = async (participantId, newScore) => {
    await apiFetch(`${API}/participants/${participantId}/score`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: newScore })
    });
  };

  const refreshRanking = async () => {
    await loadScores();
  };

  const finishTournament = async () => {
    if (!confirm('¿Marcar este torneo como FINALIZADO? La pantalla mostrará el estado final.')) return;
    await apiFetch(`${API}/tournaments/${id}/finish`, { method: 'PUT' });
    loadAll();
  };

  const sendTicker = async (msg) => {
    const message = msg !== undefined ? msg : tickerInput;
    const res = await apiFetch(`${API}/tournaments/${id}/ticker`, {
      method: 'PUT', body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      showToast('No se pudo actualizar el mensaje', true);
      return;
    }
    setTickerActive(message);
  };

  const toggleWaiting = async () => {
    const res = await apiFetch(`${API}/tournaments/${id}/waiting`, { method: 'PUT' });
    const data = await res.json();
    setWaitingScreen(data.active);
  };

  const toggleBracketScreen = async () => {
    const res = await apiFetch(`${API}/tournaments/${id}/bracket-screen`, { method: 'PUT' });
    const data = await res.json();
    setBracketScreen(data.active);
  };

  const loadHistory = useCallback(async () => {
    const res = await apiFetch(`${API}/tournaments/${id}/history`);
    if (res.ok) setHistory(await res.json());
  }, [id]);

  const saveBracket = async (phaseId, matchAssignments) => {
    await apiFetch(`${API}/tournaments/${id}/phases/${phaseId}/bracket`, {
      method: 'PUT', body: JSON.stringify({ matches: matchAssignments }),
    });
    loadAll();
  };

  const renamePhase = async (phaseId, name) => {
    await apiFetch(`${API}/phases/${phaseId}/name`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    loadAll();
  };

  const timerStart = async () => {
    const body = timerState.status === 'paused' ? {} : { duration_s: timerDurationInput };
    const res = await apiFetch(`${API}/tournaments/${id}/timer/start`, { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) setTimerState(await res.json());
  };

  const timerPause = async () => {
    const res = await apiFetch(`${API}/tournaments/${id}/timer/pause`, { method: 'POST' });
    if (res.ok) setTimerState(await res.json());
  };

  const timerReset = async () => {
    const res = await apiFetch(`${API}/tournaments/${id}/timer/reset`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setTimerState(data);
      setTimerDurationInput(data.durationS);
    }
  };

  if (!tournament) return <div className="container"><p>Cargando...</p></div>;

  const liveMatch = matches.find(m => m.status === 'live');
  const filtrosPhase = phases.find(p => p.phase_type === 'filtros');
  const filtrosDone = filtrosPhase && filtrosPhase.status === 'finished';
  const nextPhaseReady = filtrosDone && phases.find(p => p.phase_order === 2 && p.status === 'pending');
  const myOrgCode = sessionStorage.getItem('organizerCode') || '';
  const filtrosMatches = matches.filter(m => m.phase_type === 'filtros');
  const eliminationPhases = phases.filter(p => p.phase_type === 'elimination');
  const eliminationMatches = matches.filter(m => m.phase_type === 'elimination');
  const smokePhaseData = phases.find(p => p.phase_type === '7tosmoke');
  const smokeMatches = matches.filter(m => m.phase_type === '7tosmoke');
  const smokeSorted = smokePhaseData?.smoke_points || [];
  const smokeQueue = (() => { try { return JSON.parse(smokePhaseData?.queue_state || '[]'); } catch { return []; } })();
  const currentSmokeMatch = smokeMatches.find(m => m.status === 'pending' || m.status === 'live' || m.status === 'tie');
  const is7toSmoke = tournament.tournament_type === '7tosmoke';
  // A tie match awaiting tiebreaker (only one can exist at a time; no live match running)
  const tieMatch = !liveMatch ? [...eliminationMatches, ...smokeMatches].find(m => m.status === 'tie') : null;
  // The one active match in elimination: first non-finished (ordered by phase_order, match_order)
  const currentElimMatch = eliminationMatches.find(m => m.status !== 'finished');

  return (
    <div className="container">
      {/* QR modal */}
      {qrModal && (
        <div onClick={() => setQrModal(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '32px',
            textAlign: 'center', border: '1px solid #333', maxWidth: '340px', width: '100%'
          }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.12em', marginBottom: '16px' }}>{qrModal.label}</p>
            <div style={{ background: '#fff', display: 'inline-block', padding: '12px', borderRadius: '8px' }}>
              <QRCodeSVG value={qrModal.url} size={220} />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '14px', wordBreak: 'break-all' }}>{qrModal.url}</p>
            <button onClick={() => setQrModal(null)} className="btn-danger" style={{ marginTop: '18px', padding: '8px 24px' }}>Cerrar</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          {role === 'admin' ? (
            <Link to="/admin" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>&larr; Volver a torneos</Link>
          ) : role === 'speaker' ? (
            <Link to="/speaker" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>&larr; Inicio</Link>
          ) : (
            <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>&larr; Inicio</Link>
          )}
          <h1 style={{ color: 'var(--accent)' }}>{tournament.name}</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', letterSpacing: '0.05em' }}>
              ID: <span style={{ color: 'var(--text)', fontWeight: 600 }}>#{id}</span>
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>·</span>
            <span className={`badge badge-${tournament.status === 'active' ? 'live' : tournament.status === 'finished' ? 'finished' : 'pending'}`}>
              {tournament.status === 'active' ? 'Activo' : tournament.status === 'finished' ? 'Finalizado' : 'Configuración'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {role === 'speaker' && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.18em', fontWeight: 600 }}>SPEAKER</span>
          )}
          {role === 'organizer' && (
            <>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.18em', fontWeight: 600 }}>ORGANIZADOR</span>
              <button className="btn-secondary" onClick={() => window.open(`/screen/${id}`, '_blank')}>Pantalla</button>
            </>
          )}
          {role === 'admin' && onLogout && (
            <button className="btn-ghost" onClick={onLogout}>Salir</button>
          )}
          {role !== 'speaker' && tournament.status === 'setup' && phaseConfigSaved && phases.length === 0 && participants.length >= 2 && judges.length >= 1 && (
            <button className="btn-gold" onClick={generatePhases}>Generar Cuadro</button>
          )}
          {role === 'admin' && tournament.status !== 'setup' && (
            <button className="btn-secondary" onClick={() => {
              if (confirm('⚠️ REINICIAR TORNEO\n\nEsto borrará todas las rondas, votos y resultados actuales. Los participantes y jueces se conservarán.\n\n¿Estás seguro?')) generatePhases();
            }}>Reiniciar Torneo</button>
          )}
          {tournament.status === 'active' && role !== 'speaker' && (
            <button className="btn-danger" onClick={finishTournament}>Finalizar torneo</button>
          )}
        </div>
      </div>

      {/* Guía de pasos — solo visible para el organizador */}
      {role === 'organizer' && (() => {
        const s1 = participants.length >= 2 && judges.length >= 1;
        const s2 = phases.length > 0;
        const s3 = !!filtrosDone;
        const s4 = tournament.status === 'finished';
        const steps = [
          {
            label: 'Preparar',
            sub: `${participants.length} participante${participants.length !== 1 ? 's' : ''} · ${judges.length} juez${judges.length !== 1 ? 'ces' : ''}`,
            done: s1,
          },
          {
            label: 'Configurar',
            sub: phases.length > 0 ? 'Cuadro generado' : 'Pendiente',
            done: s2,
          },
          {
            label: 'Filtros',
            sub: filtrosDone
              ? 'Completado'
              : filtrosPhase
                ? `${filtrosMatches.filter(m => m.status === 'finished').length} / ${filtrosMatches.length} rondas`
                : 'Pendiente',
            done: s3,
          },
          {
            label: is7toSmoke ? '7toSmoke' : 'Eliminatorias',
            sub: s4 ? 'Completado' : (is7toSmoke ? smokeMatches : eliminationMatches).length > 0 ? 'En curso' : 'Pendiente',
            done: s4,
          },
        ];
        const current = steps.findIndex(s => !s.done);
        const hints = [
          'Añade al menos 2 participantes y 1 juez en las listas de abajo',
          'Guarda la configuración de fases para generar el cuadro del torneo',
          'Inicia cada ronda de Filtros y ciérrala cuando todos los jueces hayan puntuado',
          is7toSmoke
            ? 'Cuando terminen los Filtros, avanza los participantes a la fase 7toSmoke'
            : 'Cuando terminen los Filtros, avanza los clasificados y gestiona los matches de eliminatorias',
        ];
        return (
          <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              {steps.map((step, idx) => {
                const isDone = step.done;
                const isCurrent = idx === current;
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    {idx > 0 && (
                      <div style={{
                        position: 'absolute', top: '14px', right: '50%', width: '100%',
                        height: '2px',
                        background: isDone ? '#00c853' : isCurrent ? 'var(--accent)' : '#2a2a2a',
                        zIndex: 0,
                      }} />
                    )}
                    <div className={isCurrent ? 'pulse-glow-circle' : ''} style={{
                      width: '28px', height: '28px', borderRadius: '50%', zIndex: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
                      background: isDone ? '#00c853' : isCurrent ? 'var(--accent)' : '#1a1a1a',
                      border: `2px solid ${isDone ? '#00c853' : isCurrent ? 'var(--accent)' : '#333'}`,
                      color: isDone || isCurrent ? '#fff' : '#555',
                    }}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '6px', padding: '0 4px' }}>
                      <div style={{
                        fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em',
                        color: isDone ? '#00c853' : isCurrent ? 'var(--accent)' : '#444',
                      }}>{step.label}</div>
                      <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '2px' }}>{step.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {current >= 0 && current < steps.length && (
              <div style={{
                marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #222',
                fontSize: '0.82rem', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'flex-start', gap: '8px',
              }}>
                <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>SIGUIENTE:</span>
                <span>{hints[current]}</span>
              </div>
            )}
            {current === -1 && (
              <div style={{
                marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #222',
                fontSize: '0.82rem', color: '#00c853', fontWeight: 700, textAlign: 'center',
              }}>
                ✓ Torneo completado
              </div>
            )}
          </div>
        );
      })()}

      {/* Phase configurator — visible until the first filtros round starts.
          Once any round is live or finished, config is locked and widget disappears. */}
      {role !== 'speaker' && !filtrosMatches.some(m => m.status !== 'pending') && (
        <PhaseConfigurator
          tournament={tournament}
          participantCount={participants.length}
          judgeCount={judges.length}
          onSave={savePhaseConfig}
          savedOk={phaseConfigSaved}
          onDirty={() => setPhaseConfigSaved(false)}
        />
      )}


      {/* ── SPEAKER: CRONÓMETRO — siempre arriba del todo ── */}
      {role === 'speaker' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          {/* Global timer (7toSmoke) */}
          {is7toSmoke && (
            <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #1e1e1e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: 'var(--gold)', fontSize: '0.72rem', letterSpacing: '0.18em', fontWeight: 700 }}>TIEMPO TOTAL</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', letterSpacing: '3px', lineHeight: 1, color: globalTimerFinished ? '#ef5350' : globalTimerState.status === 'paused' ? 'var(--gold)' : '#fff' }}>
                    {globalTimerDisplay}
                  </span>
                  {globalTimerFinished && <span className="badge badge-live" style={{ background: '#ef5350' }}>¡TIEMPO!</span>}
                  {globalTimerState.status === 'paused' && !globalTimerFinished && <span style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '2px' }}>PAUSADO</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {globalTimerState.status === 'idle' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="number" min={60} max={7200} value={globalTimerDurationInput}
                        onChange={e => setGlobalTimerDurationInput(Number(e.target.value))}
                        style={{ width: '80px', textAlign: 'center' }} />
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>seg</span>
                    </div>
                    <button className="btn-primary" onClick={globalTimerStart}>▶ INICIAR TIEMPO</button>
                  </>
                )}
                {globalTimerState.status === 'running' && <button className="btn-secondary" onClick={globalTimerPause}>❚❚ PAUSAR</button>}
                {globalTimerState.status === 'paused' && <button className="btn-primary" onClick={globalTimerStart}>▶ REANUDAR</button>}
                {globalTimerState.status !== 'idle' && <button className="btn-danger" onClick={globalTimerReset}>↺ RESET</button>}
              </div>
            </div>
          )}
          {/* Título + display */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: timerState.status !== 'idle' ? '12px' : '10px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ marginBottom: 0 }}>CRONÓMETRO</h3>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', letterSpacing: '4px', lineHeight: 1, color: timerFinished ? '#ef5350' : timerState.status === 'paused' ? 'var(--gold)' : '#fff' }}>
              {timerDisplay}
            </span>
          </div>
          {/* Botones timer de ronda: mismo control para bracket y 7toSmoke */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {timerState.status === 'idle' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <input type="number" min={5} max={3600} value={timerDurationInput}
                    onChange={e => setTimerDurationInput(Number(e.target.value))}
                    style={{ flex: 1, textAlign: 'center' }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>seg</span>
                </div>
                <button className="btn-primary" onClick={timerStart}
                  style={{ width: '100%', padding: '12px', fontSize: '1rem', letterSpacing: '0.1em' }}>
                  ▶ TIEMPO
                </button>
              </>
            )}
            {timerState.status !== 'idle' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {timerState.status === 'running' && (
                  <button className="btn-secondary" onClick={timerPause} style={{ padding: '12px', fontSize: '0.95rem' }}>❚❚ PAUSAR</button>
                )}
                {timerState.status === 'paused' && (
                  <button className="btn-primary" onClick={timerStart} style={{ padding: '12px', fontSize: '0.95rem' }}>▶ REANUDAR</button>
                )}
                <button className="btn-danger" onClick={timerReset} style={{ padding: '12px', fontSize: '0.95rem' }}>↺ RESETEAR</button>
              </div>
            )}
            {timerState.status === 'paused' && (
              <span style={{ color: '#888', fontSize: '0.75rem', letterSpacing: '2px', textAlign: 'center' }}>PAUSADO</span>
            )}
          </div>
        </div>
      )}

      {/* Speaker: vista mínima de filtros — solo botones, sin nombres ni texto */}
      {role === 'speaker' && filtrosPhase && filtrosMatches.length > 0 && !filtrosDone && (() => {
        const firstPendingIdx = filtrosMatches.findIndex(m => m.status !== 'finished');
        if (firstPendingIdx === -1) return null;
        const m = filtrosMatches[firstPendingIdx];
        return (
          <div className="card" style={{ marginBottom: '20px' }}>
            {m.status === 'pending' && !liveMatch ? (
              <div>
                <button
                  className="btn-primary"
                  style={{ width: '100%', padding: '22px 0', fontSize: '1.05rem', letterSpacing: '0.08em' }}
                  disabled={actionLoading}
                  onClick={() => startMatch(m.id)}
                >
                  INICIAR
                </button>
              </div>
            ) : m.status === 'live' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <span className="badge badge-live" style={{ fontSize: '0.95rem', padding: '8px 28px' }}>EN CURSO</span>
                </div>
                {voteStatus[m.id]?.allVoted && (
                  <button
                    className="btn-gold"
                    style={{ width: '100%', padding: '18px', fontSize: '1.05rem', letterSpacing: '0.08em' }}
                    disabled={actionLoading}
                    onClick={() => closeRound(m.id)}
                  >
                    {actionLoading ? 'Procesando...' : 'CERRAR RONDA'}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        );
      })()}

      {/* SIGUIENTE RONDA se renderiza al final del layout del speaker (ver abajo) */}

      {/* Filtros rounds management — admin / organizer only */}
      {filtrosPhase && filtrosMatches.length > 0 && role !== 'speaker' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showRondas ? '12px' : '0' }}>
            <h3>FILTROS — Rondas</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className={`badge badge-${filtrosPhase.status === 'finished' ? 'finished' : 'live'}`}>
                {filtrosPhase.status === 'finished' ? 'COMPLETADO' : 'EN CURSO'}
              </span>
              {!filtrosDone && !reorderMode && filtrosMatches.some(m => m.status === 'pending') && (
                <button className="btn-secondary" onClick={enterReorderMode}>
                  Reordenar
                </button>
              )}
              <button className="btn-secondary" onClick={() => { setShowRondas(v => !v); if (reorderMode) setReorderMode(false); }}>
                {showRondas ? 'Ocultar' : 'Ver Rondas'}
              </button>
            </div>
          </div>
          {showRondas && (reorderMode ? (
            <>
              {/* Non-pending rounds: locked */}
              {filtrosMatches.filter(m => m.status !== 'pending').map((m, idx) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 14px', marginBottom: '4px', opacity: 0.55,
                  background: m.status === 'live' ? 'rgba(233,69,96,0.06)' : 'rgba(0,200,83,0.04)',
                  borderRadius: 'var(--radius)', border: '1px solid #222'
                }}>
                  <strong style={{ color: 'var(--text-muted)', minWidth: '72px' }}>Ronda {idx + 1}</strong>
                  {m.participants?.map(p => <span key={p.id} style={{ fontSize: '0.9rem' }}>{p.name}</span>)}
                  <span className={`badge badge-${m.status === 'live' ? 'live' : 'finished'}`} style={{ marginLeft: 'auto' }}>
                    {m.status === 'live' ? 'EN CURSO' : 'FINALIZADA'}
                  </span>
                </div>
              ))}
              {/* Flat draggable list of pending participants */}
              {pendingQueue.length > 0 && (() => {
                const pendingMatches = filtrosMatches.filter(m => m.status === 'pending');
                const lockedCount = filtrosMatches.length - pendingMatches.length;
                // Precompute round number for each slot in the flat queue
                const queueRounds = [];
                pendingMatches.forEach((m, mi) => {
                  (m.participants || []).forEach(() => queueRounds.push(lockedCount + mi + 1));
                });
                return (
                  <>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '10px 0 6px', textAlign: 'center' }}>
                      Arrastra para cambiar el orden · las rondas se recalculan automáticamente
                    </p>
                    {pendingQueue.map((p, idx) => {
                      const roundNum = queueRounds[idx];
                      const showDivider = idx === 0 || queueRounds[idx] !== queueRounds[idx - 1];
                      return (
                        <div key={p.id}>
                          {showDivider && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '6px 14px 2px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Ronda {roundNum}
                            </div>
                          )}
                          <div
                            draggable
                            onDragStart={() => { reorderDragItem.current = idx; }}
                            onDragEnter={() => { reorderDragOver.current = idx; }}
                            onDragEnd={() => {
                              if (reorderDragItem.current === null || reorderDragOver.current === null) return;
                              const q = [...pendingQueue];
                              const dragged = q.splice(reorderDragItem.current, 1)[0];
                              q.splice(reorderDragOver.current, 0, dragged);
                              setPendingQueue(q);
                              reorderDragItem.current = null;
                              reorderDragOver.current = null;
                            }}
                            onDragOver={e => e.preventDefault()}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '8px 14px', marginBottom: '3px',
                              background: 'rgba(255,255,255,0.03)',
                              borderRadius: 'var(--radius)', border: '1px solid #333', cursor: 'grab'
                            }}
                          >
                            <span style={{ color: 'var(--text-muted)', fontSize: '1rem', userSelect: 'none' }}>⠿</span>
                            <span style={{ fontWeight: 500 }}>{p.name}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                      <button className="btn-primary" disabled={actionLoading} onClick={saveReorder}>
                        {actionLoading ? '...' : 'Guardar orden'}
                      </button>
                      <button className="btn-secondary" onClick={() => setReorderMode(false)}>
                        Cancelar
                      </button>
                    </div>
                  </>
                );
              })()}
            </>
          ) : (
            (() => {
              // Only the first non-finished round is actionable — prevent accidental skips
              const firstPendingIdx = filtrosMatches.findIndex(m => m.status !== 'finished');
              return filtrosMatches.map((m, idx) => {
                const isCurrentRound = idx === firstPendingIdx;
                return (
                  <div key={m.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', marginBottom: '6px',
                    background: m.status === 'live' ? 'rgba(233,69,96,0.08)' : m.status === 'finished' ? 'rgba(0,200,83,0.05)' : 'transparent',
                    borderRadius: 'var(--radius)', border: '1px solid #222'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ color: 'var(--text-muted)' }}>Ronda {idx + 1}</strong>
                      {m.participants && m.participants.map(p => (
                        <span key={p.id} style={{ fontSize: '0.95rem' }}>{p.name}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {m.status === 'pending' && !liveMatch && isCurrentRound && (
                        <button className="btn-primary" disabled={actionLoading} onClick={() => startMatch(m.id)}>
                          {actionLoading ? '...' : 'Iniciar'}
                        </button>
                      )}
                      {m.status === 'live' && (
                        <span className="badge badge-live">EN CURSO</span>
                      )}
                      {m.status === 'finished' && (
                        <span className="badge badge-finished">Hecho</span>
                      )}
                      {m.status === 'finished' && !liveMatch && role !== 'speaker' && (
                        <button className="btn-secondary" onClick={() => restartMatch(m.id)}>
                          Repetir
                        </button>
                      )}
                    </div>
                  </div>
                );
              });
            })()
          ))}
        </div>
      )}

      {/* Scores table for Filtros */}
      {/* Speaker sees ranking+advance button for 7toSmoke while smoke phase is still pending */}
      {filtrosPhase && role !== 'speaker' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showScores ? '12px' : '0' }}>
            <div>
              <h3 style={{ marginBottom: 0 }}>PUNTUACIONES FILTROS</h3>
              {showScores && scores.length > 0 && tournament.filtros_advance_count > 0 && (
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem' }}>
                  <span style={{ color: '#00c853', fontWeight: 600 }}>▲ {Math.min(tournament.filtros_advance_count, scores.length)} pasan</span>
                  <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>·</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>▼ {Math.max(0, scores.length - tournament.filtros_advance_count)} no pasan</span>
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {showScores && (
                <button className="btn-ghost" onClick={refreshRanking} title="Actualizar puntuaciones" style={{ padding: '4px 8px', fontSize: '0.85rem' }}>
                  ↻ Actualizar
                </button>
              )}
              <button className="btn-secondary" onClick={() => { loadScores(); setShowScores(!showScores); }}>
                {showScores ? 'Ocultar' : 'Ver Ranking'}
              </button>
            </div>
          </div>
          {showScores && scores.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              {(() => {
                const advCount = tournament.filtros_advance_count || 999;
                const items = [];
                scores.forEach((p, idx) => {
                  const isEditing = editingScore && editingScore.id === p.id;
                  const wouldAdvance = idx < advCount;

                  // Separador de corte: fila completa entre clasificados y no clasificados
                  if (idx === advCount && idx > 0) {
                    items.push(
                      <div key="cutline" style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        margin: '6px 0', padding: '8px 12px',
                        background: 'rgba(255,215,0,0.06)',
                        borderTop: '2px solid rgba(255,215,0,0.4)',
                        borderBottom: '2px solid rgba(255,215,0,0.4)',
                        borderRadius: '4px',
                      }}>
                        <span style={{ color: 'var(--gold)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em' }}>
                          — HASTA AQUÍ PASAN {is7toSmoke ? 'A 7toSmoke' : 'A ELIMINATORIAS'} ({advCount}) —
                        </span>
                      </div>
                    );
                  }

                  items.push(
                    <div key={p.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderBottom: '1px solid #222',
                      background: p.eliminated ? 'rgba(198,40,40,0.1)' : wouldAdvance ? 'rgba(0,200,83,0.08)' : 'transparent'
                    }}>
                      <span style={{ flex: 1 }}>
                        <span style={{ color: 'var(--text-muted)', marginRight: '10px', fontWeight: 700 }}>#{idx + 1}</span>
                        {p.name}
                        {p.eliminated ? <span style={{ color: 'var(--accent)', marginLeft: '8px', fontSize: '0.8rem' }}>ELIMINADO</span> : ''}
                      </span>
                      {isEditing ? (
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          await updateParticipantScore(p.id, parseFloat(editingScore.value) || 0);
                          setEditingScore(null);
                          loadScores();
                        }} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input
                            type="number"
                            step="0.1"
                            value={editingScore.value}
                            onChange={e => setEditingScore({ ...editingScore, value: e.target.value })}
                            style={{ width: '70px', textAlign: 'center', fontSize: '0.9rem', padding: '4px' }}
                            autoFocus
                          />
                          <button type="submit" className="btn-primary">OK</button>
                          <button type="button" className="btn-secondary" onClick={() => setEditingScore(null)}>X</button>
                        </form>
                      ) : role !== 'speaker' ? (
                        <span
                          onClick={() => setEditingScore({ id: p.id, value: (p.total_score || 0).toFixed(1) })}
                          style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', border: '1px solid transparent' }}
                          title="Clic para editar puntuación"
                          onMouseEnter={e => e.target.style.borderColor = 'var(--gold)'}
                          onMouseLeave={e => e.target.style.borderColor = 'transparent'}
                        >
                          {(p.total_score || 0).toFixed(1)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '1.1rem', padding: '2px 6px' }}>
                          {(p.total_score || 0).toFixed(1)}
                        </span>
                      )}
                    </div>
                  );
                });
                return items;
              })()}
            </div>
          )}
          {nextPhaseReady && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: showScores ? '0' : '4px' }}>
              {is7toSmoke ? (
                <button className="btn-gold" onClick={() => advanceToSmoke()}>
                  ▶ Avanzar a 7toSmoke ({tournament.filtros_advance_count} participantes)
                </button>
              ) : (
                <button className="btn-gold" onClick={() => advanceFiltros()}>
                  ▶ Avanzar desde Filtros ({tournament.filtros_advance_count} clasificados)
                </button>
              )}
            </div>
          )}
        </div>
      )}


      {/* Botón AVANZAR para el speaker (la card de puntuaciones está oculta para él) */}
      {role === 'speaker' && nextPhaseReady && (
        <div className="card" style={{ marginBottom: '20px', textAlign: 'center' }}>
          {is7toSmoke ? (
            <button className="btn-gold" style={{ width: '100%', padding: '16px' }} onClick={() => advanceToSmoke()}>
              ▶ Avanzar a 7toSmoke ({tournament.filtros_advance_count} participantes)
            </button>
          ) : (
            <button className="btn-gold" style={{ width: '100%', padding: '16px' }} onClick={() => advanceFiltros()}>
              ▶ Avanzar desde Filtros ({tournament.filtros_advance_count} clasificados)
            </button>
          )}
        </div>
      )}

      {/* Historial de battles (eliminatorias completadas) */}
      {eliminationMatches.filter(m => m.status === 'finished').length > 0 && role !== 'speaker' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showHistory ? '12px' : '0' }}>
            <h3>HISTORIAL DE BATTLES</h3>
            <button className="btn-secondary" onClick={() => { setShowHistory(v => !v); if (!showHistory) loadHistory(); }}>
              {showHistory ? 'Ocultar' : 'Ver historial'}
            </button>
          </div>
          {showHistory && (
            <div>
              {history.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '12px' }}>Cargando...</p>
              ) : (
                history.map(m => (
                  <div key={m.match_id} style={{
                    padding: '10px 14px', marginBottom: '6px',
                    background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius)', border: '1px solid #222',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.08em' }}>{m.phase_name}</span>
                      {m.winner_name ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--gold)' }}>★ {m.winner_name}</span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>EMPATE</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontWeight: m.winner_name === m.p1_name ? 700 : 400,
                        color: m.winner_name === m.p1_name ? 'var(--text)' : 'var(--text-muted)',
                        fontSize: '1rem',
                      }}>{m.p1_name}</span>
                      <span style={{ display: 'flex', gap: '6px' }}>
                        {m.votes.map((v, i) => (
                          <span key={i} style={{
                            fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px',
                            background: v.choice === 'participant1' ? 'rgba(233,69,96,0.15)' :
                                        v.choice === 'participant2' ? 'rgba(100,181,246,0.15)' : 'rgba(255,255,255,0.05)',
                            color: v.choice === 'participant1' ? '#e94560' :
                                   v.choice === 'participant2' ? '#64b5f6' : '#666',
                            border: `1px solid ${v.choice === 'participant1' ? 'rgba(233,69,96,0.3)' :
                                                 v.choice === 'participant2' ? 'rgba(100,181,246,0.3)' : '#333'}`,
                          }} title={v.judge_name}>
                            {v.choice === 'participant1' ? '◀' : v.choice === 'participant2' ? '▶' : '='} {v.judge_name}
                          </span>
                        ))}
                      </span>
                      <span style={{
                        fontWeight: m.winner_name === m.p2_name ? 700 : 400,
                        color: m.winner_name === m.p2_name ? 'var(--text)' : 'var(--text-muted)',
                        fontSize: '1rem',
                      }}>{m.p2_name}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          LAYOUT ÚNICO: match en curso + cuadro ancho completo + 3 columnas
      ================================================================ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Match / Ronda en curso — admin/organizer únicamente; speaker usa sus propias cards mínimas */}
      {liveMatch && liveMatch.phase_type !== 'elimination' && !is7toSmoke && role !== 'speaker' && (
        <div className="card" style={{ borderColor: 'var(--accent)', marginBottom: '0' }}>
          <h3 style={{ marginBottom: '10px' }}>
            {liveMatch.phase_type === 'filtros' ? 'RONDA EN CURSO — FILTROS' : 'MATCH EN CURSO'}
          </h3>
          {liveMatch.phase_type === 'filtros' && liveMatch.participants ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              {liveMatch.participants.map(p => (
                <span key={p.id} style={{
                  padding: '4px 12px', background: 'rgba(255,215,0,0.1)',
                  borderRadius: 'var(--radius)', border: '1px solid rgba(255,215,0,0.3)',
                  fontSize: '0.9rem', fontWeight: 600
                }}>{p.name}</span>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1rem', marginBottom: '10px' }}>
              <strong>{liveMatch.participant1_name}</strong>
              <span style={{ color: 'var(--accent)' }}>VS</span>
              <strong>{liveMatch.participant2_name}</strong>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {liveMatch.phase_type === 'filtros' ? 'Puntuaciones' : 'Votos'}: {voteStatus[liveMatch.id]?.totalVotes || 0} / {voteStatus[liveMatch.id]?.totalJudges || judges.length}
            </span>
            {(voteStatus[liveMatch.id]?.allVoted) && (
              liveMatch.phase_type === 'filtros' ? (
                <button className="btn-gold" disabled={actionLoading} onClick={() => closeRound(liveMatch.id)}>
                  {actionLoading ? 'Procesando...' : 'CERRAR RONDA'}
                </button>
              ) : (
                <button className="btn-gold" disabled={actionLoading} onClick={() => revealResult(liveMatch.id)}>
                  {actionLoading ? 'Procesando...' : 'REVELAR RESULTADO'}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Tiebreaker card — speaker: solo botón; admin/org: info completa */}
      {tieMatch && (
        <div className="card" style={{ borderColor: 'var(--warning)', marginBottom: '0' }}>
          {role === 'speaker' ? (
            /* Speaker: solo el botón de desempate, sin nombres ni jueces */
            <button
              className="btn-gold"
              style={{ width: '100%', padding: '22px', fontSize: '1.05rem', letterSpacing: '0.08em' }}
              disabled={actionLoading}
              onClick={() => startTiebreaker(tieMatch.id)}
            >
              {actionLoading ? '...' : '⚖️ INICIAR DESEMPATE'}
            </button>
          ) : (
            /* Admin / Organizer: vista completa con nombres y jueces */
            <>
              <h3 style={{ marginBottom: '10px', color: 'var(--warning)' }}>⚖️ EMPATE — Se requiere desempate</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1rem', marginBottom: '12px' }}>
                <strong>{tieMatch.participant1_name}</strong>
                <span style={{ color: 'var(--warning)' }}>EMPATE</span>
                <strong>{tieMatch.participant2_name}</strong>
              </div>
              {tieMatch.allowed_judges && (() => {
                let tieJudgeIds = [];
                try { tieJudgeIds = JSON.parse(tieMatch.allowed_judges); } catch (e) {}
                const tieJudgeNames = tieJudgeIds.map(jid => {
                  const j = judges.find(jj => jj.id === jid);
                  return j ? j.name : `#${jid}`;
                });
                return tieJudgeNames.length > 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
                    Votan en el desempate ({tieJudgeNames.length}):
                    {' '}<span style={{ color: 'var(--gold)', fontWeight: 600 }}>{tieJudgeNames.join(', ')}</span>
                  </p>
                ) : null;
              })()}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-gold" disabled={actionLoading} onClick={() => startTiebreaker(tieMatch.id)}>
                  {actionLoading ? '...' : '▶ Iniciar Ronda de Desempate'}
                </button>
                <button className="btn-secondary" disabled={actionLoading} onClick={() => restartMatch(tieMatch.id)}>
                  Reiniciar (todos los jueces)
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ====== 7toSmoke — Speaker view (mobile-first, minimal) ====== */}
      {is7toSmoke && smokePhaseData && smokePhaseData.status === 'active' && role === 'speaker' && (
        <div className="card" style={{ marginBottom: '0', borderColor: 'var(--gold)', padding: '20px' }}>
          {/* Current battle */}
          {currentSmokeMatch ? (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', letterSpacing: '0.18em', marginBottom: '10px' }}>
                BATALLA #{smokeMatches.filter(m => m.status === 'finished').length + 1}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <strong style={{ fontSize: '1.6rem' }}>{currentSmokeMatch.participant1_name}</strong>
                <span style={{ color: 'var(--accent)', fontWeight: 900, fontSize: '1.2rem' }}>VS</span>
                <strong style={{ fontSize: '1.6rem' }}>{currentSmokeMatch.participant2_name}</strong>
              </div>
              {currentSmokeMatch.status === 'pending' && !liveMatch && (
                <button
                  className="btn-primary"
                  disabled={actionLoading}
                  onClick={() => startMatch(currentSmokeMatch.id)}
                  style={{ width: '100%', padding: '14px', fontSize: '1.1rem', letterSpacing: '0.08em' }}
                >
                  {actionLoading ? '...' : '▶ INICIAR BATALLA'}
                </button>
              )}
              {currentSmokeMatch.status === 'live' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                    <span className="badge badge-live">EN CURSO</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Votos: {voteStatus[currentSmokeMatch.id]?.totalVotes || 0} / {voteStatus[currentSmokeMatch.id]?.totalJudges || judges.length}
                    </span>
                  </div>
                  {voteStatus[currentSmokeMatch.id]?.allVoted && (
                    <button
                      className="btn-gold"
                      disabled={actionLoading}
                      onClick={() => revealResult(currentSmokeMatch.id)}
                      style={{ width: '100%', padding: '14px', fontSize: '1.1rem', letterSpacing: '0.08em' }}
                    >
                      {actionLoading ? 'Procesando...' : '★ REVELAR RESULTADO'}
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Esperando próxima batalla...</p>
          )}
        </div>
      )}

      {/* ====== 7toSmoke — Admin / Organizer full view ====== */}
      {is7toSmoke && smokePhaseData && smokePhaseData.status === 'active' && role !== 'speaker' && (
        <div className="card" style={{ marginBottom: '0', borderColor: 'var(--gold)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ color: 'var(--gold)', marginBottom: 0 }}>7toSmoke — FASE EN CURSO</h3>
            {/* Global timer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.15em' }}>TIEMPO TOTAL</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '2.2rem', letterSpacing: '3px', lineHeight: 1,
                color: globalTimerFinished ? '#ef5350' : globalTimerState.status === 'paused' ? 'var(--gold)' : '#fff',
              }}>
                {globalTimerDisplay}
              </span>
              {globalTimerState.status === 'idle' && (
                <input
                  type="number" min={60} max={7200} value={globalTimerDurationInput}
                  onChange={e => setGlobalTimerDurationInput(Number(e.target.value))}
                  style={{ width: '80px', textAlign: 'center', fontSize: '0.85rem' }}
                />
              )}
              {globalTimerState.status === 'idle' && (
                <button className="btn-primary" onClick={globalTimerStart}>▶ INICIAR TIEMPO</button>
              )}
              {globalTimerState.status === 'running' && (
                <button className="btn-secondary" onClick={globalTimerPause}>❚❚ PAUSAR</button>
              )}
              {globalTimerState.status === 'paused' && (
                <button className="btn-primary" onClick={globalTimerStart}>▶ REANUDAR</button>
              )}
              {globalTimerState.status !== 'idle' && (
                <button className="btn-danger" onClick={globalTimerReset}>↺ RESET</button>
              )}
              {globalTimerFinished && (
                <span className="badge badge-live" style={{ background: '#ef5350' }}>¡TIEMPO!</span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {/* Cola */}
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.15em', marginBottom: '8px' }}>COLA</p>
              {smokeQueue.map((pid, idx) => {
                const sp = smokeSorted.find(s => s.participant_id === pid);
                const name = sp?.name || `#${pid}`;
                const pts = tournament.points_mode === 'consecutive' ? (sp?.consecutive_points || 0) : (sp?.points || 0);
                const isOnStage = idx === 0;
                const isNext = idx === 1;
                return (
                  <div key={pid} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 10px', marginBottom: '4px', borderRadius: '6px',
                    background: isOnStage ? 'rgba(233,69,96,0.12)' : isNext ? 'rgba(255,215,0,0.06)' : 'transparent',
                    border: `1px solid ${isOnStage ? 'rgba(233,69,96,0.3)' : isNext ? 'rgba(255,215,0,0.2)' : '#222'}`,
                  }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '20px', fontWeight: 700 }}>
                      {isOnStage ? '🎤' : isNext ? '▶' : `${idx + 1}`}
                    </span>
                    <span style={{ flex: 1, fontWeight: isOnStage || isNext ? 700 : 400, color: isOnStage ? 'var(--accent)' : isNext ? 'var(--gold)' : 'var(--text)' }}>
                      {name}
                    </span>
                    <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.9rem' }}>
                      {pts} pts
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Ranking de puntos */}
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.15em', marginBottom: '8px' }}>
                PUNTOS {tournament.points_mode === 'consecutive' ? '(RACHA)' : '(TOTAL)'}
              </p>
              {(() => {
                const sortedByPts = [...smokeSorted].sort((a, b) => b.points - a.points || b.consecutive_points - a.consecutive_points);
                const targetPts = smokeQueue.length;
                return sortedByPts.map((sp, idx) => (
                  <div key={sp.participant_id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '5px 10px', marginBottom: '3px', borderRadius: '6px',
                    background: idx === 0 && sp.points > 0 ? 'rgba(255,215,0,0.06)' : 'transparent',
                  }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '20px' }}>#{idx + 1}</span>
                    <span style={{ flex: 1 }}>{sp.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        height: '6px', width: `${Math.round((sp.points / Math.max(targetPts, 1)) * 80)}px`,
                        background: 'var(--gold)', borderRadius: '3px', minWidth: '2px',
                      }} />
                      <span style={{ color: 'var(--gold)', fontWeight: 700, minWidth: '30px', textAlign: 'right' }}>
                        {sp.points}/{targetPts}
                      </span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Current smoke match controls */}
          {currentSmokeMatch && (
            <div style={{
              padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid #333',
              background: currentSmokeMatch.status === 'live' ? 'rgba(233,69,96,0.06)' : 'transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.1em' }}>
                  BATALLA #{smokeMatches.filter(m => m.status === 'finished').length + 1}
                </span>
                <strong>{currentSmokeMatch.participant1_name}</strong>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>VS</span>
                <strong>{currentSmokeMatch.participant2_name}</strong>
                {currentSmokeMatch.status === 'live' && <span className="badge badge-live">EN CURSO</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {currentSmokeMatch.status === 'live' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Votos: {voteStatus[currentSmokeMatch.id]?.totalVotes || 0} / {voteStatus[currentSmokeMatch.id]?.totalJudges || judges.length}
                    </span>
                    {voteStatus[currentSmokeMatch.id]?.allVoted && (
                      <button className="btn-gold" disabled={actionLoading} onClick={() => revealResult(currentSmokeMatch.id)}>
                        {actionLoading ? 'Procesando...' : 'REVELAR RESULTADO'}
                      </button>
                    )}
                  </div>
                )}
                {currentSmokeMatch.status === 'pending' && !liveMatch && (
                  <button className="btn-primary" disabled={actionLoading} onClick={() => startMatch(currentSmokeMatch.id)}>
                    {actionLoading ? '...' : 'Iniciar Batalla'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Historial de matches 7toSmoke */}
          {smokeMatches.filter(m => m.status === 'finished').length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '6px' }}>
                HISTORIAL ({smokeMatches.filter(m => m.status === 'finished').length} batallas)
              </p>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {smokeMatches.filter(m => m.status === 'finished').slice(-10).reverse().map((m) => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px',
                    fontSize: '0.85rem', borderBottom: '1px solid #1a1a1a',
                  }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: '28px', fontSize: '0.75rem' }}>
                      #{smokeMatches.indexOf(m) + 1}
                    </span>
                    <span style={{ color: m.winner_id === m.participant1_id ? 'var(--text)' : 'var(--text-muted)', flex: 1 }}>
                      {m.participant1_name}
                    </span>
                    <span style={{ color: 'var(--gold)', fontSize: '0.75rem', fontWeight: 700 }}>
                      ★ {m.winner_name}
                    </span>
                    <span style={{ color: m.winner_id === m.participant2_id ? 'var(--text)' : 'var(--text-muted)', flex: 1, textAlign: 'right' }}>
                      {m.participant2_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Speaker view for 7toSmoke is handled by the main 7toSmoke card above (no dedicated card needed) */}

      {/* Cuadro de Eliminatorias — speaker: vista mínima (solo botones); admin/org: bracket completo */}
      {/* Speaker solo ve esto DESPUÉS de pulsar AVANZAR — y solo para torneos bracket */}
      {role === 'speaker' && filtrosDone && !nextPhaseReady && !is7toSmoke && (
        <div className="card">
          {eliminationPhases.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Las eliminatorias aún no han comenzado</p>
          ) : !currentElimMatch ? (
            <p style={{ color: 'var(--gold)', textAlign: 'center', padding: '20px', letterSpacing: '0.1em' }}>🏆 Eliminatorias completadas</p>
          ) : (() => {
            const isPending = currentElimMatch.status === 'pending';
            const isLive = currentElimMatch.status === 'live';
            const hasParticipants = currentElimMatch.participant1_id && currentElimMatch.participant2_id;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {isPending && !liveMatch && hasParticipants && (
                  <div>
                    <button
                      className="btn-primary"
                      style={{ width: '100%', padding: '22px 0', fontSize: '1.05rem', letterSpacing: '0.08em' }}
                      disabled={actionLoading}
                      onClick={() => startMatch(currentElimMatch.id)}
                    >
                      INICIAR
                    </button>
                  </div>
                )}
                {isLive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                      <span className="badge badge-live" style={{ fontSize: '0.95rem', padding: '8px 28px' }}>EN CURSO</span>
                    </div>
                    {voteStatus[currentElimMatch.id]?.allVoted && (
                      <button
                        className="btn-gold"
                        style={{ width: '100%', padding: '18px', fontSize: '1.05rem', letterSpacing: '0.08em' }}
                        disabled={actionLoading}
                        onClick={() => revealResult(currentElimMatch.id)}
                      >
                        {actionLoading ? 'Procesando...' : 'REVELAR RESULTADO'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── SPEAKER: SIGUIENTE — siempre abajo del todo ── */}
      {/* SIGUIENTE RONDA (fase filtros) */}
      {role === 'speaker' && filtrosPhase && filtrosMatches.length > 0 && !filtrosDone && (() => {
        const firstPendingIdx = filtrosMatches.findIndex(m => m.status !== 'finished');
        if (firstPendingIdx === -1 || firstPendingIdx >= filtrosMatches.length - 1) return null;
        const nextMatch = filtrosMatches[firstPendingIdx + 1];
        if (!nextMatch?.participants?.length) return null;
        return (
          <div className="card" style={{ borderColor: 'rgba(255,215,0,0.22)', background: 'rgba(255,215,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ color: 'var(--gold)', fontSize: '0.68rem', letterSpacing: '0.2em', fontWeight: 700 }}>SIGUIENTE RONDA</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,215,0,0.18)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {nextMatch.participants.map(p => (
                <div key={p.id} style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '2px solid rgba(255,215,0,0.3)' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: '#bbb', letterSpacing: '1px' }}>{p.name}</div>
                  {(p.member1_name || p.member2_name) && (
                    <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '2px' }}>
                      {[p.member1_name, p.member2_name].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* SIGUIENTE CRUCE (fase eliminatorias) */}
      {role === 'speaker' && filtrosDone && !nextPhaseReady && !is7toSmoke && currentElimMatch && (() => {
        const currentElimIdx = eliminationMatches.indexOf(currentElimMatch);
        const nextElimMatch = eliminationMatches
          .slice(currentElimIdx + 1)
          .find(m => m.status === 'pending' && m.participant1_id && m.participant2_id);
        if (!nextElimMatch) return null;
        return (
          <div className="card" style={{ borderColor: 'rgba(255,215,0,0.22)', background: 'rgba(255,215,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ color: 'var(--gold)', fontSize: '0.68rem', letterSpacing: '0.2em', fontWeight: 700 }}>SIGUIENTE CRUCE</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,215,0,0.18)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '2px solid rgba(255,215,0,0.3)' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: '#bbb', letterSpacing: '1px' }}>{nextElimMatch.participant1_name}</span>
              </div>
              <div style={{ textAlign: 'center', padding: '3px 0' }}>
                <span style={{ fontSize: '0.65rem', color: '#444', letterSpacing: '0.15em' }}>VS</span>
              </div>
              <div style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: '2px solid rgba(255,215,0,0.3)' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: '#bbb', letterSpacing: '1px' }}>{nextElimMatch.participant2_name}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {role !== 'speaker' && !is7toSmoke && <div className="card" style={{ overflow: 'auto' }}>
        <h3 style={{ marginBottom: '12px' }}>Cuadro de Eliminatorias</h3>
        {/* Match en curso dentro de eliminatorias — votos + botón REVELAR */}
        {liveMatch && liveMatch.phase_type === 'elimination' && currentElimMatch && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '10px', marginBottom: '16px',
            padding: '10px 14px', borderRadius: 'var(--radius)',
            background: 'rgba(77,197,224,0.06)', border: '1px solid rgba(77,197,224,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span className="badge badge-live">EN CURSO</span>
              <span style={{ fontSize: '0.95rem' }}>
                <strong>{currentElimMatch.participant1_name}</strong>
                <span style={{ color: 'var(--accent)', margin: '0 8px' }}>VS</span>
                <strong>{currentElimMatch.participant2_name}</strong>
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Votos: {voteStatus[currentElimMatch.id]?.totalVotes || 0} / {voteStatus[currentElimMatch.id]?.totalJudges || judges.length}
              </span>
            </div>
            {voteStatus[currentElimMatch.id]?.allVoted && (
              <button className="btn-gold" disabled={actionLoading} onClick={() => revealResult(currentElimMatch.id)}>
                {actionLoading ? 'Procesando...' : 'REVELAR RESULTADO'}
              </button>
            )}
          </div>
        )}
        {eliminationPhases.length > 0 ? (
          <Bracket
            phases={eliminationPhases}
            matches={eliminationMatches}
            currentMatchId={currentElimMatch?.id}
            onStartMatch={startMatch}
            onRestartMatch={restartMatch}
            onRenamePhase={renamePhase}
            onSaveBracket={saveBracket}
            isAdmin={true}
          />
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
            {phases.length > 0
              ? 'Las eliminatorias comenzarán después de Filtros'
              : 'Configura las fases, añade participantes y jueces, luego pulsa "Generar Cuadro"'
            }
          </p>
        )}
      </div>}

      {/* Tres columnas: Participantes · Jueces · Organizadores */}
      {role !== 'speaker' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>

        {/* Participantes */}
        <div className={`card${participants.length < 2 && !filtrosDone ? ' pulse-glow' : ''}`}>
          <h3 style={{ marginBottom: '12px' }}>
            Participantes ({participants.length})
            {participants.length < 2 && !filtrosDone && (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 400, marginLeft: '8px' }}>← mín. 2</span>
            )}
          </h3>
          {!filtrosDone && (
            <form onSubmit={addParticipant} style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  placeholder={tournament?.type === '2vs2' ? 'Nombre del equipo' : 'Nombre'}
                  value={newParticipant} onChange={e => setNewParticipant(e.target.value)}
                  style={{ flex: 1 }}
                />
                {tournament?.type !== '2vs2' && (
                  <button type="submit" className="btn-primary">+</button>
                )}
              </div>
              {tournament?.type === '2vs2' && (
                <>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      placeholder="Miembro 1"
                      value={newMember1} onChange={e => setNewMember1(e.target.value)}
                      style={{ flex: 1, minWidth: 0, fontSize: '0.85rem' }}
                    />
                    <input
                      placeholder="Miembro 2"
                      value={newMember2} onChange={e => setNewMember2(e.target.value)}
                      style={{ flex: 1, minWidth: 0, fontSize: '0.85rem' }}
                    />
                    <button type="submit" className="btn-primary">+</button>
                  </div>
                </>
              )}
            </form>
          )}
          {(filtrosDone
            ? [...participants].sort((a, b) => {
                if (a.eliminated !== b.eliminated) return a.eliminated - b.eliminated;
                if (!a.eliminated) return a.seed - b.seed;
                return (b.total_score || 0) - (a.total_score || 0);
              })
            : participants
          ).map(p => {
            const showFiltrosStatus = filtrosDone && p.total_score > 0;
            const hasCompeted = filtrosMatches.some(m =>
              (m.status === 'live' || m.status === 'finished') &&
              m.participants && m.participants.some(mp => mp.id === p.id)
            );
            return (
              <div key={p.id} className="list-item" style={{
                background: showFiltrosStatus ? (p.eliminated ? 'rgba(198,40,40,0.08)' : 'rgba(0,200,83,0.06)') : 'transparent',
                borderRadius: 'var(--radius)', marginBottom: '2px'
              }}>
                <span>
                  <span style={{ color: 'var(--text-muted)', marginRight: '8px', minWidth: '28px', display: 'inline-block' }}>
                    {filtrosDone && !p.eliminated ? `#${p.seed}` : `·`}
                  </span>
                  <span style={{ color: p.eliminated ? 'var(--text-muted)' : 'var(--text)' }}>{p.name}</span>
                  {(p.member1_name || p.member2_name) && (
                    <span style={{ color: '#555', marginLeft: '8px', fontSize: '0.75rem' }}>
                      {[p.member1_name, p.member2_name].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  {showFiltrosStatus && (
                    <span style={{ color: 'var(--gold)', marginLeft: '8px', fontSize: '0.8rem' }}>
                      {p.total_score.toFixed(1)} pts
                    </span>
                  )}
                </span>
                {!filtrosDone && !hasCompeted && (
                  <button className="btn-danger" onClick={() => removeParticipant(p.id, p.name)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>x</button>
                )}
              </div>
            );
          })}
        </div>

        {/* Jueces */}
        <div className={`card${judges.length < 1 && !filtrosDone ? ' pulse-glow' : ''}`}>
          <h3 style={{ marginBottom: '12px' }}>
            Jueces ({judges.length})
            {judges.length < 1 && !filtrosDone && (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 400, marginLeft: '8px' }}>← mín. 1</span>
            )}
          </h3>
          <form onSubmit={addJudge} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input placeholder="Nombre del juez" value={newJudge} onChange={e => setNewJudge(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn-primary">+</button>
          </form>
          {judges.map(j => (
            <div key={j.id} className="list-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{j.name}</span>
                <code style={{ color: 'var(--accent)', fontSize: '0.85rem', background: '#1a1a2e', padding: '2px 8px', borderRadius: '4px' }}>{j.access_code}</code>
                <button onClick={() => setQrModal({ url: `${window.location.origin}/judge?code=${j.access_code}`, label: `JURADO · ${j.name}` })}
                  style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--accent)' }}>QR</button>
                <button onClick={() => window.open(`${window.location.origin}/judge?code=${j.access_code}`, '_blank')}
                  style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--accent)' }}>🔗</button>
              </div>
              <button className="btn-danger" onClick={() => removeJudge(j.id, j.name)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>x</button>
            </div>
          ))}
        </div>

        {/* Organizadores */}
        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>Organizadores ({organizers.length})</h3>
          <form onSubmit={addOrganizer} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input placeholder="Nombre del organizador" value={newOrganizer} onChange={e => setNewOrganizer(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn-primary">+</button>
          </form>
          {organizers.map(o => {
            const isSelf = role === 'organizer' && o.access_code === myOrgCode;
            return (
              <div key={o.id} className="list-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span>{o.name}</span>
                  {isSelf && <span style={{ fontSize: '0.7rem', color: '#555' }}>(tú)</span>}
                  <code style={{ color: 'var(--gold)', fontSize: '0.85rem', background: '#1a1a2e', padding: '2px 8px', borderRadius: '4px' }}>{o.access_code}</code>
                  <button onClick={() => setQrModal({ url: `${window.location.origin}/organizer?code=${o.access_code}`, label: `ORGANIZADOR · ${o.name}` })}
                    style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--gold)' }}>QR</button>
                  <button onClick={() => window.open(`${window.location.origin}/organizer?code=${o.access_code}`, '_blank')}
                    style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--gold)' }}>🔗</button>
                </div>
                {!isSelf && (
                  <button className="btn-danger" onClick={() => removeOrganizer(o.id, o.name)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>x</button>
                )}
              </div>
            );
          })}
          {organizers.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '8px' }}>
              Los organizadores acceden con su código al panel de este torneo
            </p>
          )}
          {tournament.speaker_code && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #222' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', letterSpacing: '0.08em', flexShrink: 0 }}>SPEAKER</span>
                <code style={{ color: 'var(--gold)', fontSize: '0.85rem', background: '#1a1a2e', padding: '2px 8px', borderRadius: '4px' }}>
                  {tournament.speaker_code}
                </code>
                <button onClick={() => setQrModal({ url: `${window.location.origin}/speaker?code=${tournament.speaker_code}`, label: 'SPEAKER' })}
                  style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--gold)' }}>QR</button>
                <button onClick={() => window.open(`${window.location.origin}/speaker?code=${tournament.speaker_code}`, '_blank')}
                  style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--gold)' }}>🔗</button>
              </div>
            </div>
          )}
        </div>

      </div>}

      {/* CRONÓMETRO widget — admin / organizer (abajo del todo, poco usado) */}
      {role !== 'speaker' && <div className="card" style={{ marginBottom: '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: timerState.status !== 'idle' ? '12px' : '10px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ marginBottom: 0 }}>CRONÓMETRO</h3>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: '2.8rem', letterSpacing: '4px', lineHeight: 1,
            color: timerFinished ? '#ef5350' : timerState.status === 'paused' ? 'var(--gold)' : '#fff',
          }}>
            {timerDisplay}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {timerState.status === 'idle' && !is7toSmoke && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  min={5}
                  max={3600}
                  value={timerDurationInput}
                  onChange={e => setTimerDurationInput(Number(e.target.value))}
                  style={{ width: '80px', textAlign: 'center' }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>seg</span>
              </div>
              <button className="btn-primary" onClick={timerStart}>▶ TIEMPO</button>
            </>
          )}
          {timerState.status === 'paused' && (
            <button className="btn-primary" onClick={timerStart}>REANUDAR</button>
          )}
          {timerState.status === 'running' && (
            <button className="btn-secondary" onClick={timerPause}>PAUSAR</button>
          )}
          {timerState.status !== 'idle' && (
            <button className="btn-danger" onClick={timerReset}>RESETEAR</button>
          )}
          {timerState.status === 'paused' && (
            <span style={{ color: '#888', fontSize: '0.75rem', letterSpacing: '2px' }}>PAUSADO</span>
          )}
        </div>
      </div>}

      {/* Logo — imagen centrada en pantallas públicas */}
      {role !== 'speaker' && <div className="card" style={{ marginBottom: '12px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', letterSpacing: '0.1em', flexShrink: 0 }}>
            LOGO PANTALLA
          </span>
          {logoPath && (
            <img src={`/uploads/${logoPath}`} alt="logo" style={{ height: '40px', objectFit: 'contain', borderRadius: '4px' }} />
          )}
          <label style={{ cursor: 'pointer' }}>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const formData = new FormData();
                formData.append('logo', file);
                const res = await apiFetch(`${API}/tournaments/${id}/logo`, { method: 'POST', body: formData });
                if (res.ok) { const d = await res.json(); setLogoPath(d.logo_path); showToast('Logo actualizado ✓'); }
                else showToast('Error al subir logo', true);
                e.target.value = '';
              }}
            />
            <span className="btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
              {logoPath ? 'Cambiar' : 'Subir logo'}
            </span>
          </label>
          {logoPath && (
            <button className="btn-danger" style={{ fontSize: '0.82rem', padding: '6px 12px' }} onClick={async () => {
              const res = await apiFetch(`${API}/tournaments/${id}/logo`, { method: 'DELETE' });
              if (res.ok) { setLogoPath(null); showToast('Logo eliminado'); }
            }}>
              Quitar
            </button>
          )}
        </div>
      </div>}

      {/* Ticker — mensaje scrolling en las pantallas públicas */}
      {role !== 'speaker' && <div className="card" style={{ marginBottom: '0', padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', letterSpacing: '0.1em', flexShrink: 0 }}>
            MENSAJE EN PANTALLA
          </span>
          <input
            type="text"
            value={tickerInput}
            onChange={e => setTickerInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendTicker()}
            placeholder="Escribe un aviso o mensaje para el público..."
            style={{ flex: 1, minWidth: '200px', fontSize: '0.9rem', padding: '8px 12px' }}
          />
          <button
            className="btn-primary"
            onClick={() => sendTicker()}
            style={{ fontSize: '0.85rem', padding: '8px 16px', flexShrink: 0 }}
          >
            Enviar
          </button>
          {tickerActive && (
            <button
              className="btn-secondary"
              onClick={() => { setTickerInput(''); sendTicker(''); }}
              style={{ fontSize: '0.85rem', padding: '8px 12px', flexShrink: 0 }}
            >
              Borrar
            </button>
          )}
        </div>
        {tickerActive && (
          <p style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--accent)', marginBottom: 0 }}>
            ▶ Activo: {tickerActive}
          </p>
        )}
        <div style={{ marginTop: '10px', borderTop: '1px solid #2a2a2a', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <button
              className={waitingScreen ? 'btn-secondary' : 'btn-primary'}
              onClick={toggleWaiting}
              style={{ fontSize: '0.82rem' }}
            >
              {waitingScreen ? '⏹ Ocultar Pantalla en Espera' : '⏸ Mostrar Pantalla en Espera'}
            </button>
            {waitingScreen && (
              <span style={{ marginLeft: '10px', fontSize: '0.75rem', color: 'var(--gold)' }}>
                ● Activo — la pantalla pública muestra la imagen de espera
              </span>
            )}
          </div>
          <div>
            <button
              className={bracketScreen ? 'btn-secondary' : 'btn-primary'}
              onClick={toggleBracketScreen}
              style={{ fontSize: '0.82rem' }}
            >
              {bracketScreen ? '⏹ Ocultar Pantalla de Brackets' : '📊 Mostrar Pantalla de Brackets'}
            </button>
            {bracketScreen && (
              <span style={{ marginLeft: '10px', fontSize: '0.75rem', color: 'var(--gold)' }}>
                ● Activo — la pantalla pública muestra el bracket
              </span>
            )}
          </div>
        </div>
      </div>}

      </div>{/* fin layout único */}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          background: toast.isError ? 'rgba(198,40,40,0.95)' : 'rgba(0,180,75,0.95)',
          color: '#fff', padding: '12px 20px', borderRadius: 'var(--radius)',
          fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {toast.isError ? '❌ ' : '✅ '}{toast.msg}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem('adminToken'));

  const handleLogin = () => setAuthed(true);
  const handleUnauth = () => { sessionStorage.removeItem('adminToken'); setAuthed(false); };

  if (!authed) return <AdminLogin onLogin={handleLogin} />;

  return (
    <Routes>
      <Route path="/" element={<TournamentList onLogout={handleUnauth} />} />
      <Route path="/tournament/:id" element={<TournamentManager onLogout={handleUnauth} />} />
    </Routes>
  );
}
