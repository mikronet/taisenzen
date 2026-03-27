import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { QRCodeSVG } from 'qrcode.react';

const API = '/api/coreo';

function apiFetch(url, options = {}) {
  const token = sessionStorage.getItem('adminToken') || '';
  const orgCode = localStorage.getItem('coreoOrgCode') || '';
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
      'x-organizer-code': orgCode,
      ...(options.headers || {}),
    },
  });
}

function apiUpload(url, formData, method = 'POST') {
  const token = sessionStorage.getItem('adminToken') || '';
  const orgCode = localStorage.getItem('coreoOrgCode') || '';
  return fetch(url, {
    method,
    headers: { 'x-admin-token': token, 'x-organizer-code': orgCode },
    body: formData,
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

// ── Combo: predefined list + free text for "Otro" ────────────────────────────
function ComboSelect({ options, value, onChange, placeholder }) {
  const isOtro = value && !options.map(o => o.toLowerCase()).includes(value.toLowerCase());
  const [custom, setCustom] = useState(isOtro ? value : '');
  const [showOtro, setShowOtro] = useState(isOtro);

  const handleSelect = (e) => {
    const v = e.target.value;
    if (v === 'Otro') {
      setShowOtro(true);
      onChange(custom || '');
    } else {
      setShowOtro(false);
      onChange(v);
    }
  };

  const selectValue = showOtro ? 'Otro' : (options.find(o => o.toLowerCase() === value?.toLowerCase()) || '');

  return (
    <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
      <select value={selectValue} onChange={handleSelect} style={{ flex: 1 }}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {showOtro && (
        <input
          placeholder="Especifica..."
          value={custom}
          onChange={e => { setCustom(e.target.value); onChange(e.target.value); }}
          style={{ flex: 1 }}
        />
      )}
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: type === 'error' ? '#7f1d1d' : '#14532d', border: `1px solid ${type === 'error' ? '#dc2626' : '#16a34a'}`, color: '#fff', padding: '10px 24px', borderRadius: '8px', zIndex: 9999, fontSize: '0.9rem' }}>
      {msg}
    </div>
  );
}

const SECTION_DIVIDER = <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '32px 0' }} />;

// ── Save status indicator ─────────────────────────────────────────────────────
function SaveStatus({ dirty, saved, savedMsg }) {
  if (dirty) return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#fb923c', fontSize: '0.78rem' }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fb923c', flexShrink: 0 }} />
      Tienes cambios sin guardar
    </span>
  );
  if (saved) return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#34d399', fontSize: '0.78rem' }}>
      <span style={{ fontSize: '1rem', lineHeight: 1 }}>✓</span>
      {savedMsg || 'Guardado'}
    </span>
  );
  return null;
}

// ── Setup checklist ───────────────────────────────────────────────────────────
function SetupChecklist({ criteria, participants, judges, blockStructure, onNavigate }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('coreoChecklistCollapsed') === '1');

  const toggle = () => setCollapsed(v => {
    localStorage.setItem('coreoChecklistCollapsed', v ? '0' : '1');
    return !v;
  });

  let parsedBlock = null;
  try { parsedBlock = blockStructure ? JSON.parse(blockStructure) : null; } catch {}
  const blockConfigured = Array.isArray(parsedBlock) && parsedBlock.length > 0 && parsedBlock.some(b => b.categories?.length > 0);

  const steps = [
    {
      label: 'Configura los criterios de puntuación',
      hint: '¿Qué van a valorar los jueces? Técnica, Expresión, Musicalidad...',
      done: criteria.length > 0,
      tab: 'config',
    },
    {
      label: 'Añade los jueces',
      hint: 'Crea sus accesos para que puedan puntuar desde su móvil.',
      done: judges.length > 0,
      tab: 'config',
    },
    {
      label: 'Define la estructura de bloques y categorías',
      hint: 'En la pestaña Participantes, crea los bloques del evento y asigna categorías a cada uno.',
      done: blockConfigured,
      tab: 'participantes',
    },
    {
      label: 'Añade los participantes',
      hint: 'Grupos, solos o parejas — inscríbelos en su categoría y bloque correspondiente.',
      done: participants.length > 0,
      tab: 'participantes',
    },
    {
      label: 'Define el orden de actuación',
      hint: 'En la pestaña Orden, arrastra para ajustar quién sale primero.',
      done: participants.length > 0 && participants.some(p => p.act_order != null),
      tab: 'orden',
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;
  const pct = Math.round((doneCount / steps.length) * 100);

  const accent = allDone ? '#34d399' : '#fb923c';
  const accentAlpha = (a) => allDone ? `rgba(52,211,153,${a})` : `rgba(251,146,60,${a})`;

  return (
    <div style={{ marginBottom: '28px', borderRadius: '10px', border: `1px solid ${accentAlpha(0.35)}`, overflow: 'hidden', boxShadow: allDone ? 'none' : `0 0 18px rgba(251,146,60,0.1)` }}>
      {/* Header */}
      <div
        onClick={toggle}
        style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer', background: accentAlpha(0.07), userSelect: 'none' }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: collapsed ? 0 : '8px' }}>
            <span style={{ color: accent, fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em' }}>
              {allDone ? '✓ TODO LISTO PARA EMPEZAR' : `PREPARACIÓN DEL EVENTO — ${doneCount} de ${steps.length} pasos completados`}
            </span>
          </div>
          {!collapsed && (
            <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: accent, borderRadius: '3px', transition: 'width 0.4s ease' }} />
            </div>
          )}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{collapsed ? 'Ver pasos ↓' : 'Ocultar ↑'}</span>
      </div>

      {/* Steps */}
      {!collapsed && (
        <div style={{ padding: '4px 0 10px', background: accentAlpha(0.02) }}>
          {steps.map((s, i) => (
            <div
              key={i}
              onClick={() => !s.done && onNavigate(s.tab)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '14px',
                padding: '10px 18px', cursor: s.done ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!s.done) e.currentTarget.style.background = accentAlpha(0.05); }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: s.done ? 'rgba(52,211,153,0.15)' : accentAlpha(0.12),
                border: `1px solid ${s.done ? '#34d399' : accentAlpha(0.5)}`,
                fontSize: '0.7rem', fontWeight: 700,
                color: s.done ? '#34d399' : accent,
              }}>
                {s.done ? '✓' : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: s.done ? 400 : 600, color: s.done ? 'rgba(255,255,255,0.35)' : '#fff', textDecoration: s.done ? 'line-through' : 'none' }}>
                  {s.label}
                </div>
                {!s.done && <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{s.hint}</div>}
              </div>
              {!s.done && <span style={{ color: accent, fontSize: '0.72rem', alignSelf: 'center', flexShrink: 0, fontWeight: 700 }}>Ir →</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CONFIG tab (criteria + categories + rounds) ───────────────────────────────
function ConfigTab({ tournamentId, criteria, onUpdateCriteria, tournament, onUpdateTournament, judges, organizers, speakers, onUpdateJudges, onUpdateOrganizers, onUpdateSpeakers, isAdmin }) {
  // ── QR modal ──
  const [qrModal, setQrModal] = useState(null);

  // ── Judges ──
  const [newJudge, setNewJudge] = useState('');
  const addJudge = async (e) => {
    e.preventDefault();
    if (!newJudge.trim()) return;
    const res = await apiFetch(`${API}/tournaments/${tournamentId}/judges`, {
      method: 'POST', body: JSON.stringify({ name: newJudge.trim() }),
    });
    const data = await res.json();
    setNewJudge('');
    onUpdateJudges([...judges, data.judge]);
  };
  const removeJudge = async (jid) => {
    if (!confirm('¿Eliminar este juez?')) return;
    await apiFetch(`${API}/judges/${jid}`, { method: 'DELETE' });
    onUpdateJudges(judges.filter(j => j.id !== jid));
  };

  // ── Organizers ──
  const [newOrganizer, setNewOrganizer] = useState('');
  const selfOrgCode = localStorage.getItem('coreoOrgCode');
  const addOrganizer = async (e) => {
    e.preventDefault();
    if (!newOrganizer.trim()) return;
    const res = await apiFetch(`${API}/tournaments/${tournamentId}/organizers`, {
      method: 'POST', body: JSON.stringify({ name: newOrganizer.trim() }),
    });
    const data = await res.json();
    setNewOrganizer('');
    onUpdateOrganizers([...organizers, data.organizer]);
  };
  const removeOrganizer = async (oid) => {
    if (!confirm('¿Eliminar este organizador?')) return;
    await apiFetch(`${API}/organizers/${oid}`, { method: 'DELETE' });
    onUpdateOrganizers(organizers.filter(o => o.id !== oid));
  };

  // ── Speakers ──
  const [newSpeaker, setNewSpeaker] = useState('');
  const addSpeaker = async (e) => {
    e.preventDefault();
    if (!newSpeaker.trim()) return;
    const res = await apiFetch(`${API}/tournaments/${tournamentId}/speakers`, {
      method: 'POST', body: JSON.stringify({ name: newSpeaker.trim() }),
    });
    const data = await res.json();
    setNewSpeaker('');
    onUpdateSpeakers([...(speakers || []), data.speaker]);
  };
  const removeSpeaker = async (sid) => {
    if (!confirm('¿Eliminar este speaker?')) return;
    await apiFetch(`${API}/speakers/${sid}`, { method: 'DELETE' });
    onUpdateSpeakers((speakers || []).filter(s => s.id !== sid));
  };

  // ── Poster ──
  const [posterUploading, setPosterUploading] = useState(false);
  const posterRef = useRef();

  const handlePosterChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPosterUploading(true);
    try {
      const fd = new FormData();
      fd.append('poster', file);
      const res = await apiUpload(`${API}/tournaments/${tournamentId}/poster`, fd);
      const data = await res.json();
      if (res.ok) onUpdateTournament({ poster_path: data.poster_path });
    } finally { setPosterUploading(false); e.target.value = ''; }
  };

  const deletePoster = async () => {
    if (!confirm('¿Eliminar el cartel?')) return;
    const res = await apiFetch(`${API}/tournaments/${tournamentId}/poster`, { method: 'DELETE' });
    if (res.ok) onUpdateTournament({ poster_path: null });
  };

  // ── Criteria dirty/saved state ──
  const [criteriaDirty, setCriteriaDirty] = useState(false);
  const [criteriaSaved, setCriteriaSaved] = useState(false);

  const markCriteriaDirty = () => { setCriteriaDirty(true); setCriteriaSaved(false); };

  // ── Criteria list ──
  const [criteriaList, setCriteriaList] = useState(criteria.map(c => ({ ...c })));
  const [savingCriteria, setSavingCriteria] = useState(false);
  // External update (from socket/reload) resets dirty without marking saved
  useEffect(() => { setCriteriaList(criteria.map(c => ({ ...c }))); }, [criteria]);

  const addCriterion = () => { setCriteriaList(prev => [...prev, { id: `new-${Date.now()}`, name: '', max_score: 10 }]); markCriteriaDirty(); };
  const removeCriterion = (idx) => { setCriteriaList(prev => prev.filter((_, i) => i !== idx)); markCriteriaDirty(); };
  const updateCriterion = (idx, field, val) => { setCriteriaList(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r)); markCriteriaDirty(); };

  const saveCriteria = async () => {
    setSavingCriteria(true);
    try {
      const payload = criteriaList.filter(c => c.name.trim()).map(c => ({ name: c.name.trim(), max_score: Number(c.max_score) || 10 }));
      const res = await apiFetch(`${API}/tournaments/${tournamentId}/criteria`, {
        method: 'PUT', body: JSON.stringify({ criteria: payload }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onUpdateCriteria(data.criteria);
      setCriteriaDirty(false); setCriteriaSaved(true);
    } finally { setSavingCriteria(false); }
  };


  return (
    <>
    {/* QR modal */}
    {qrModal && (
      <div onClick={() => setQrModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#111827', borderRadius: '12px', padding: '32px', textAlign: 'center', border: '1px solid #333', maxWidth: '340px', width: '100%' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', letterSpacing: '0.12em', marginBottom: '16px' }}>{qrModal.label}</p>
          <div style={{ background: '#fff', display: 'inline-block', padding: '12px', borderRadius: '8px' }}>
            <QRCodeSVG value={qrModal.url} size={220} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', marginTop: '14px', wordBreak: 'break-all' }}>{qrModal.url}</p>
          <button onClick={() => setQrModal(null)} className="btn-danger" style={{ marginTop: '18px', padding: '8px 24px' }}>Cerrar</button>
        </div>
      </div>
    )}

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
      {/* ── Left column: event config ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Frame 1: Criterios */}
        <div style={{ border: '1px solid rgba(126,207,255,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', background: 'rgba(126,207,255,0.04)', borderBottom: '1px solid rgba(126,207,255,0.1)' }}>
            <span style={{ color: '#7ecfff', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.15em' }}>CRITERIOS DE PUNTUACIÓN</span>
          </div>
          <div style={{ padding: '20px' }}>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', marginBottom: '16px' }}>Define los criterios con los que los jueces puntuarán cada actuación.</p>
            {criteriaList.map((c, i) => (
              <div key={c.id ?? i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                <input
                  placeholder={`Criterio ${i + 1} (ej: Técnica, Expresión...)`}
                  value={c.name}
                  onChange={e => updateCriterion(i, 'name', e.target.value)}
                  style={{ flex: 1 }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>0 –</span>
                  <input
                    type="number" min={1} max={100} step={0.5}
                    value={c.max_score}
                    onChange={e => updateCriterion(i, 'max_score', e.target.value)}
                    style={{ width: '70px' }}
                  />
                </div>
                <button onClick={() => removeCriterion(i)} style={{ background: 'none', border: '1px solid #333', color: '#888', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'center' }}>
              <button onClick={addCriterion} className="btn-secondary">+ Añadir criterio</button>
              <button onClick={saveCriteria} className="btn-primary" disabled={savingCriteria}>{savingCriteria ? 'Guardando...' : 'Guardar criterios'}</button>
              <SaveStatus dirty={criteriaDirty} saved={criteriaSaved} savedMsg="Criterios guardados" />
            </div>
          </div>
        </div>

        {/* Poster (no frame, secondary) */}
        <div>
        <h3 style={{ color: '#7ecfff', marginBottom: '8px', letterSpacing: '0.1em', fontSize: '1rem' }}>CARTEL DEL TORNEO</h3>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', marginBottom: '16px' }}>Imagen que aparece de fondo en la pantalla pública.</p>
        {tournament.poster_path ? (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
              <img
                src={`/uploads/${tournament.poster_path}`}
                alt="Cartel"
                style={{ display: 'block', maxWidth: '100%', maxHeight: '220px', width: 'auto', height: 'auto', objectFit: 'contain', borderRadius: '8px', border: '1px solid #2a2a3e', background: '#0a0a14' }}
              />
              <button
                onClick={deletePoster}
                style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.75)', border: '1px solid #444', color: '#aaa', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1.4 }}
              >✕</button>
            </div>
            <div style={{ marginTop: '10px' }}>
              <button className="btn-secondary" style={{ fontSize: '0.8rem' }} disabled={posterUploading} onClick={() => posterRef.current.click()}>
                {posterUploading ? 'Subiendo...' : 'Cambiar cartel'}
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => posterRef.current.click()}
            style={{ width: '100%', height: '110px', borderRadius: '8px', border: '2px dashed #333', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}
          >
            <span style={{ color: '#444', fontSize: '1.5rem' }}>🖼</span>
            <span style={{ color: '#555', fontSize: '0.7rem' }}>Subir cartel</span>
          </div>
        )}
        <input type="file" ref={posterRef} accept="image/*" onChange={handlePosterChange} style={{ display: 'none' }} />
        {!tournament.poster_path && (
          <button className="btn-secondary" style={{ fontSize: '0.8rem' }} disabled={posterUploading} onClick={() => posterRef.current.click()}>
            {posterUploading ? 'Subiendo...' : 'Subir cartel'}
          </button>
        )}
        </div>{/* end poster div */}
      </div>{/* end left column */}

      {/* ── Right column: judges + organizers + staff ── */}
      <div style={{ border: '1px solid rgba(126,207,255,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', background: 'rgba(126,207,255,0.04)', borderBottom: '1px solid rgba(126,207,255,0.1)' }}>
          <span style={{ color: '#7ecfff', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.15em' }}>ACCESOS</span>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '0' }}>

        {/* Judges */}
        <h3 style={{ color: '#7ecfff', marginBottom: '12px', letterSpacing: '0.1em', fontSize: '1rem' }}>JUECES</h3>
        {isAdmin && (
          <form onSubmit={addJudge} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input placeholder="Nombre del juez" value={newJudge} onChange={e => setNewJudge(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn-primary">Crear</button>
          </form>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {judges.map(j => (
            <div key={j.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{j.name}</div>
                <div style={{ color: '#7ecfff', fontSize: '0.85rem', fontFamily: 'monospace', marginTop: '4px' }}>{j.access_code}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button onClick={() => setQrModal({ url: `${window.location.origin}/coreo-judge?code=${j.access_code}`, label: `JURADO · ${j.name}` })} style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.82rem', color: '#7ecfff' }}>QR</button>
                <button onClick={() => window.open(`${window.location.origin}/coreo-judge?code=${j.access_code}`, '_blank')} style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.82rem', color: '#7ecfff' }}>🔗</button>
                {isAdmin && <button onClick={() => removeJudge(j.id)} style={{ background: 'none', border: '1px solid rgba(233,69,96,0.4)', color: '#e94560', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>}
              </div>
            </div>
          ))}
          {judges.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.88rem', padding: '10px 0' }}>Sin jueces.</p>}
        </div>
        <div style={{ marginTop: '10px', padding: '12px 16px', background: 'rgba(126,207,255,0.04)', borderRadius: '8px', border: '1px solid rgba(126,207,255,0.1)' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', margin: 0 }}>Acceso en <strong style={{ color: '#7ecfff' }}>/coreo-judge</strong></p>
        </div>

        {isAdmin && (<>
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '24px 0' }} />

          {/* Organizers */}
          <h3 style={{ color: '#7ecfff', marginBottom: '12px', letterSpacing: '0.1em', fontSize: '1rem' }}>ORGANIZADORES</h3>
          <form onSubmit={addOrganizer} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input placeholder="Nombre del organizador" value={newOrganizer} onChange={e => setNewOrganizer(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn-primary">Crear</button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {organizers.map(o => (
              <div key={o.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{o.name}</div>
                  <div style={{ color: '#a78bfa', fontSize: '0.85rem', fontFamily: 'monospace', marginTop: '4px' }}>{o.access_code}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button onClick={() => setQrModal({ url: `${window.location.origin}/coreo-organizer?code=${o.access_code}`, label: `ORGANIZADOR · ${o.name}` })} style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.82rem', color: '#a78bfa' }}>QR</button>
                  <button onClick={() => window.open(`${window.location.origin}/coreo-organizer?code=${o.access_code}`, '_blank')} style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.82rem', color: '#a78bfa' }}>🔗</button>
                  {o.access_code !== selfOrgCode && <button onClick={() => removeOrganizer(o.id)} style={{ background: 'none', border: '1px solid rgba(233,69,96,0.4)', color: '#e94560', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>}
                </div>
              </div>
            ))}
            {organizers.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.88rem', padding: '10px 0' }}>Sin organizadores.</p>}
          </div>
          <div style={{ marginTop: '10px', padding: '12px 16px', background: 'rgba(167,139,250,0.04)', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.1)' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', margin: 0 }}>El organizador accede en <strong style={{ color: '#a78bfa' }}>/coreo-organizer</strong> con su código</p>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)', margin: '24px 0' }} />

          {/* Staff */}
          <h3 style={{ color: '#7ecfff', marginBottom: '12px', letterSpacing: '0.1em', fontSize: '1rem' }}>STAFF</h3>
          <form onSubmit={addSpeaker} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input placeholder="Nombre del miembro de staff" value={newSpeaker} onChange={e => setNewSpeaker(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn-primary">Crear</button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(speakers || []).map(s => (
              <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{s.name}</div>
                  <div style={{ color: '#7ecfff', fontSize: '0.85rem', fontFamily: 'monospace', marginTop: '4px' }}>{s.access_code}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button onClick={() => setQrModal({ url: `${window.location.origin}/coreo-speaker?code=${s.access_code}`, label: `STAFF · ${s.name}` })} style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.82rem', color: '#7ecfff' }}>QR</button>
                  <button onClick={() => window.open(`${window.location.origin}/coreo-speaker?code=${s.access_code}`, '_blank')} style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.82rem', color: '#7ecfff' }}>🔗</button>
                  <button onClick={() => removeSpeaker(s.id)} style={{ background: 'none', border: '1px solid rgba(233,69,96,0.4)', color: '#e94560', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>
                </div>
              </div>
            ))}
            {!(speakers || []).length && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.88rem', padding: '10px 0' }}>Sin staff.</p>}
          </div>
          <div style={{ marginTop: '10px', padding: '12px 16px', background: 'rgba(126,207,255,0.04)', borderRadius: '8px', border: '1px solid rgba(126,207,255,0.1)' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', margin: 0 }}>El staff accede en <strong style={{ color: '#7ecfff' }}>/coreo-speaker</strong> con su código</p>
          </div>
        </>)}

        </div>{/* end padding div */}
      </div>{/* end right frame */}
    </div>
    </>
  );
}

// ── Participant form ───────────────────────────────────────────────────────────
function ParticipantForm({ initial, onSave, onCancel, tournamentId, categories, roundsCount, context }) {
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [roundNumber, setRoundNumber] = useState(initial?.round_number || 1);
  const [academia, setAcademia] = useState(initial?.academia || '');
  const [localidad, setLocalidad] = useState(initial?.localidad || '');
  const [coreografo, setCoreografo] = useState(initial?.coreografo || '');
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(initial?.photo_path ? `/uploads/${initial.photo_path}` : null);
  const [audioFile, setAudioFile] = useState(null);
  const [audioName, setAudioName] = useState(initial?.audio_path || null);
  const [removeAudio, setRemoveAudio] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const audioRef = useRef();

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleAudio = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAudioFile(file);
    setAudioName(file.name);
    setRemoveAudio(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre del grupo es obligatorio'); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('category', context ? context.category : category);
      fd.append('round_number', context ? context.round_number : roundNumber);
      fd.append('academia', academia.trim());
      fd.append('localidad', localidad.trim());
      fd.append('coreografo', coreografo.trim());
      if (photoFile) fd.append('photo', photoFile);
      if (audioFile) fd.append('audio', audioFile);
      if (removeAudio) fd.append('remove_audio', '1');

      const url = initial
        ? `${API}/participants/${initial.id}`
        : `${API}/tournaments/${tournamentId}/participants`;
      const method = initial ? 'PUT' : 'POST';
      const res = await apiUpload(url, fd, method);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar'); return; }
      onSave(data.participant);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const rounds = Math.max(1, Number(roundsCount) || 1);
  const hasAudio = !removeAudio && (audioFile || audioName);

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {context && (
        <div style={{ padding: '8px 12px', background: 'rgba(126,207,255,0.07)', borderRadius: '6px', marginBottom: '2px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
          <span style={{ color: '#7ecfff', fontWeight: 600 }}>Bloque {context.round_number}</span>
          <span style={{ margin: '0 6px', opacity: 0.3 }}>›</span>
          <span style={{ color: '#fff' }}>{context.category}</span>
        </div>
      )}

      {/* Row 1: photo + name + (category + round only if no context) */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <div
          onClick={() => fileRef.current.click()}
          style={{ width: '90px', height: '90px', borderRadius: '10px', border: '2px dashed #333', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', flexShrink: 0 }}
        >
          {preview
            ? <img src={preview} alt="Vista previa de foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#444', fontSize: '0.68rem', textAlign: 'center', padding: '8px', lineHeight: 1.4 }}>Foto<br/>(jueces)</span>
          }
          <input type="file" ref={fileRef} accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
        </div>
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input placeholder="Nombre del grupo *" value={name} onChange={e => setName(e.target.value)} />
          {!context && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ flex: 1 }}>
                <option value="">Categoría</option>
                {(categories || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={roundNumber} onChange={e => setRoundNumber(Number(e.target.value))} style={{ flex: 1 }}>
                {Array.from({ length: rounds }, (_, i) => i + 1).map(r => (
                  <option key={r} value={r}>Bloque {r}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Academia + Localidad + Coreógrafo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <div>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', letterSpacing: '0.1em', display: 'block', marginBottom: '5px' }}>ACADEMIA</label>
          <input placeholder="Nombre de la academia" value={academia} onChange={e => setAcademia(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', letterSpacing: '0.1em', display: 'block', marginBottom: '5px' }}>LOCALIDAD</label>
          <input placeholder="Ciudad / pueblo" value={localidad} onChange={e => setLocalidad(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', letterSpacing: '0.1em', display: 'block', marginBottom: '5px' }}>COREÓGRAFO</label>
          <input placeholder="Nombre del coreógrafo" value={coreografo} onChange={e => setCoreografo(e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>

      {/* Row 3: Music */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: '8px' }}>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', letterSpacing: '0.1em', flexShrink: 0 }}>MÚSICA</span>
        {hasAudio ? (
          <>
            <span style={{ flex: 1, fontSize: '0.8rem', color: '#34d399', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🎵 {audioFile ? audioFile.name : audioName}
            </span>
            <button type="button" onClick={() => { audioRef.current.value = ''; setAudioFile(null); setAudioName(null); setRemoveAudio(true); }}
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.85rem', padding: '2px 6px', flexShrink: 0 }}>✕</button>
            <button type="button" onClick={() => audioRef.current.click()}
              style={{ background: 'none', border: '1px solid #333', color: '#888', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}>
              Cambiar
            </button>
          </>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: '0.8rem', color: 'rgba(255,255,255,0.2)' }}>Sin archivo de música</span>
            <button type="button" onClick={() => audioRef.current.click()}
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.78rem', flexShrink: 0 }}>
              + Subir MP3
            </button>
          </>
        )}
        <input type="file" ref={audioRef} accept="audio/mpeg,audio/mp3,audio/aac,audio/wav,audio/ogg,.mp3,.aac,.wav,.ogg,.m4a" onChange={handleAudio} style={{ display: 'none' }} />
      </div>

      {error && <p style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Guardando...' : initial ? 'Guardar cambios' : 'Añadir participante'}
        </button>
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>}
      </div>
    </form>
  );
}

// ── Block Structure Editor ─────────────────────────────────────────────────────
function BlockStructureEditor({ tournamentId, initialRoundsCount, initialStructure, onSaved }) {
  const makeEmpty = (count) => Array.from({ length: count }, (_, i) => ({ round: i + 1, categories: [] }));

  const [roundsCount, setRoundsCount] = useState(initialRoundsCount || 1);
  const [blocks, setBlocks] = useState(() =>
    initialStructure && initialStructure.length > 0 ? initialStructure : makeEmpty(initialRoundsCount || 1)
  );
  const [newCatInputs, setNewCatInputs] = useState(() => Array.from({ length: initialRoundsCount || 1 }, () => ''));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleRoundsChange = (newCount) => {
    newCount = Math.max(1, Math.min(20, newCount));
    setRoundsCount(newCount);
    setBlocks(prev => {
      if (newCount > prev.length) {
        return [...prev, ...Array.from({ length: newCount - prev.length }, (_, i) => ({ round: prev.length + i + 1, categories: [] }))];
      }
      return prev.slice(0, newCount);
    });
    setNewCatInputs(prev => {
      if (newCount > prev.length) return [...prev, ...Array.from({ length: newCount - prev.length }, () => '')];
      return prev.slice(0, newCount);
    });
    setSaved(false);
  };

  // All category names across all blocks (for duplicate detection)
  const allCatNames = blocks.flatMap(b => b.categories);

  const moveCatUp = (bi, ci) => {
    if (ci === 0) return;
    setBlocks(prev => prev.map((b, i) => i !== bi ? b : {
      ...b, categories: [...b.categories.slice(0, ci-1), b.categories[ci], b.categories[ci-1], ...b.categories.slice(ci+1)]
    }));
    setSaved(false);
  };
  const moveCatDown = (bi, ci) => {
    setBlocks(prev => prev.map((b, i) => {
      if (i !== bi) return b;
      const cats = [...b.categories];
      if (ci >= cats.length - 1) return b;
      [cats[ci], cats[ci+1]] = [cats[ci+1], cats[ci]];
      return { ...b, categories: cats };
    }));
    setSaved(false);
  };
  const removeCat = (bi, ci) => {
    setBlocks(prev => prev.map((b, i) => i !== bi ? b : {
      ...b, categories: b.categories.filter((_, j) => j !== ci)
    }));
    setSaved(false);
  };
  const addCatToBlock = (bi, e) => {
    e.preventDefault();
    const val = newCatInputs[bi].trim();
    if (!val || allCatNames.includes(val)) return;
    setBlocks(prev => prev.map((b, i) => i !== bi ? b : { ...b, categories: [...b.categories, val] }));
    setNewCatInputs(prev => prev.map((v, i) => i !== bi ? v : ''));
    setSaved(false);
  };

  const handleSave = async () => {
    const allCats = [...new Set(blocks.flatMap(b => b.categories))];
    setSaving(true);
    try {
      await apiFetch(`/api/coreo/tournaments/${tournamentId}/config`, {
        method: 'PUT', body: JSON.stringify({ rounds: roundsCount }),
      });
      const res = await apiFetch(`/api/coreo/tournaments/${tournamentId}/block-structure`, {
        method: 'PUT',
        body: JSON.stringify({ block_structure: blocks, categories: allCats }),
      });
      if (res.ok) { setSaved(true); onSaved(blocks, allCats, roundsCount); }
    } finally { setSaving(false); }
  };

  const hasCategories = blocks.some(b => b.categories.length > 0);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#7ecfff', letterSpacing: '0.1em', fontSize: '0.9rem', margin: '0 0 6px' }}>ESTRUCTURA DE BLOQUES</h3>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', margin: 0 }}>
          Define cuántos bloques tiene el evento y las categorías de cada uno. Una vez guardado podrás introducir participantes categoría por categoría.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '12px 16px', background: 'rgba(126,207,255,0.04)', border: '1px solid rgba(126,207,255,0.15)', borderRadius: '8px' }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', letterSpacing: '0.1em', flexShrink: 0 }}>NÚMERO DE BLOQUES</span>
        <input
          type="number" min={1} max={20}
          value={roundsCount}
          onChange={e => handleRoundsChange(Number(e.target.value) || 1)}
          style={{ width: '64px', textAlign: 'center' }}
        />
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
          {roundsCount === 1 ? '1 bloque' : `${roundsCount} bloques`}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        {blocks.map((block, bi) => (
          <div key={block.round} style={{ border: '1px solid rgba(126,207,255,0.15)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: 'rgba(126,207,255,0.07)' }}>
              <span style={{ color: '#7ecfff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', letterSpacing: '0.2em' }}>
                BLOQUE {block.round}
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem', fontFamily: 'inherit', marginLeft: '8px' }}>
                  {block.categories.length} {block.categories.length === 1 ? 'categoría' : 'categorías'}
                </span>
              </span>
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {block.categories.length === 0 && (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.78rem', margin: '4px 0', fontStyle: 'italic' }}>Sin categorías — añade la primera abajo</p>
              )}
              {block.categories.map((cat, ci) => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0f0f1a', borderRadius: '6px', padding: '7px 12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                    <button onClick={() => moveCatUp(bi, ci)} disabled={ci === 0} style={{ background: 'none', border: '1px solid #333', color: ci === 0 ? '#1a1a2e' : '#aaa', borderRadius: '3px', padding: '1px 6px', cursor: ci === 0 ? 'default' : 'pointer', fontSize: '0.75rem', lineHeight: 1 }}>↑</button>
                    <button onClick={() => moveCatDown(bi, ci)} disabled={ci === block.categories.length - 1} style={{ background: 'none', border: '1px solid #333', color: ci === block.categories.length - 1 ? '#1a1a2e' : '#aaa', borderRadius: '3px', padding: '1px 6px', cursor: ci === block.categories.length - 1 ? 'default' : 'pointer', fontSize: '0.75rem', lineHeight: 1 }}>↓</button>
                  </div>
                  <span style={{ flex: 1, fontSize: '0.88rem', color: '#fff' }}>{cat}</span>
                  <button onClick={() => removeCat(bi, ci)} style={{ background: 'none', border: '1px solid #333', color: '#666', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                </div>
              ))}
              <form onSubmit={(e) => addCatToBlock(bi, e)} style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <input
                  placeholder="Nueva categoría (ej: Solo, Parejas, Grupo...)"
                  value={newCatInputs[bi]}
                  onChange={e => setNewCatInputs(prev => prev.map((v, i) => i !== bi ? v : e.target.value))}
                  style={{ flex: 1, fontSize: '0.82rem', padding: '6px 10px' }}
                />
                <button type="submit" className="btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>+ Añadir</button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={saving || !hasCategories}
          title={!hasCategories ? 'Añade al menos una categoría' : ''}
        >
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar estructura'}
        </button>
        {saved && (
          <span style={{ color: '#34d399', fontSize: '0.78rem' }}>Estructura guardada — puedes comenzar a introducir participantes</span>
        )}
      </div>
    </div>
  );
}

// ── PARTICIPANTS tab ──────────────────────────────────────────────────────────
function ParticipantsTab({ tournamentId, participants, onUpdate, categories, roundsCount, activeBlock, onBlockChange, totalBlocks, blockStructure, onBlockStructureSave }) {
  // Parsed block structure
  const parsedStructure = (() => {
    try { return blockStructure ? JSON.parse(blockStructure) : null; } catch { return null; }
  })();

  const [editingStructure, setEditingStructure] = useState(!parsedStructure || parsedStructure.length === 0 || parsedStructure.every(b => b.categories.length === 0));
  const [activeCategory, setActiveCategory] = useState(() => {
    if (!parsedStructure) return null;
    const block = parsedStructure.find(b => b.round === activeBlock);
    return block?.categories[0] ?? null;
  });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  // When block changes, reset active category to first of new block
  useEffect(() => {
    if (!parsedStructure) return;
    const block = parsedStructure.find(b => b.round === activeBlock);
    setActiveCategory(block?.categories[0] ?? null);
    setShowForm(false);
    setEditing(null);
  }, [activeBlock, blockStructure]); // eslint-disable-line react-hooks/exhaustive-deps

  // ENTER key opens add-participant form
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && !showForm && !editing && activeCategory) {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && tag !== 'BUTTON') {
          setShowForm(true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm, editing, activeCategory]);

  const handleSave = (p) => {
    if (p.id && participants.find(x => x.id === p.id)) {
      onUpdate(participants.map(x => x.id === p.id ? p : x));
    } else {
      onUpdate([...participants, p]);
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`¿Eliminar "${p.name}"?`)) return;
    await apiFetch(`${API}/participants/${p.id}`, { method: 'DELETE' });
    onUpdate(participants.filter(x => x.id !== p.id));
  };

  // If no structure defined, show the editor
  if (editingStructure || !parsedStructure) {
    return (
      <div>
        <BlockStructureEditor
          tournamentId={tournamentId}
          initialRoundsCount={roundsCount}
          initialStructure={parsedStructure}
          onSaved={(structure, cats, newRoundsCount) => {
            onBlockStructureSave(structure, cats, newRoundsCount);
            setEditingStructure(false);
            const firstBlock = structure.find(b => b.round === activeBlock) || structure[0];
            setActiveCategory(firstBlock?.categories[0] ?? null);
          }}
        />
      </div>
    );
  }

  const currentBlockDef = parsedStructure.find(b => b.round === activeBlock) || { round: activeBlock, categories: [] };
  const blockCategories = currentBlockDef.categories;
  const catIndex = blockCategories.indexOf(activeCategory);

  // Flat navigation: all (block, cat) pairs in order
  const allPairs = parsedStructure.flatMap(b => b.categories.map(c => ({ round: b.round, category: c })));
  const currentPairIdx = allPairs.findIndex(p => p.round === activeBlock && p.category === activeCategory);
  const prevPair = currentPairIdx > 0 ? allPairs[currentPairIdx - 1] : null;
  const nextPair = currentPairIdx < allPairs.length - 1 ? allPairs[currentPairIdx + 1] : null;

  const goToPrev = async () => {
    if (!prevPair) return;
    if (prevPair.round !== activeBlock) await onBlockChange(prevPair.round);
    setActiveCategory(prevPair.category);
    setShowForm(false); setEditing(null);
  };
  const goToNext = async () => {
    if (!nextPair) return;
    if (nextPair.round !== activeBlock) await onBlockChange(nextPair.round);
    setActiveCategory(nextPair.category);
    setShowForm(false); setEditing(null);
  };

  // Participants for current context
  const catParticipants = participants.filter(p => p.category === activeCategory);
  const context = activeCategory ? { round_number: activeBlock, category: activeCategory } : null;

  return (
    <div>
      {/* Block + category nav bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {/* Block nav */}
        {totalBlocks > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', background: 'rgba(126,207,255,0.04)', border: '1px solid rgba(126,207,255,0.1)', borderRadius: '8px' }}>
            <button onClick={() => onBlockChange(activeBlock - 1)} disabled={activeBlock <= 1} style={{ background: 'none', border: '1px solid #333', color: activeBlock <= 1 ? '#1a1a2e' : '#666', borderRadius: '5px', padding: '4px 10px', cursor: activeBlock <= 1 ? 'default' : 'pointer', fontSize: '0.78rem' }}>←</button>
            <span style={{ flex: 1, textAlign: 'center', color: '#7ecfff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.95rem', letterSpacing: '0.2em' }}>
              BLOQUE {activeBlock} <span style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'inherit', fontSize: '0.7rem' }}>de {totalBlocks}</span>
            </span>
            <button onClick={() => onBlockChange(activeBlock + 1)} disabled={activeBlock >= totalBlocks} style={{ background: 'none', border: '1px solid #333', color: activeBlock >= totalBlocks ? '#1a1a2e' : '#666', borderRadius: '5px', padding: '4px 10px', cursor: activeBlock >= totalBlocks ? 'default' : 'pointer', fontSize: '0.78rem' }}>→</button>
          </div>
        )}

        {/* Category nav */}
        {blockCategories.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#0f0f1a', border: '1px solid #1a1a2e', borderRadius: '8px' }}>
            <button onClick={goToPrev} disabled={!prevPair} style={{ background: 'none', border: '1px solid #333', color: !prevPair ? '#1a1a2e' : '#888', borderRadius: '5px', padding: '4px 10px', cursor: !prevPair ? 'default' : 'pointer', fontSize: '0.78rem', flexShrink: 0 }}>←</button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.05em' }}>
                {activeCategory}
                {catParticipants.length > 0 && (
                  <span style={{ marginLeft: '8px', color: '#7ecfff', fontWeight: 400, fontSize: '0.78rem' }}>
                    {catParticipants.length}
                  </span>
                )}
              </div>
              {blockCategories.length > 1 && (
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem', marginTop: '2px' }}>
                  {catIndex + 1} de {blockCategories.length} en este bloque
                </div>
              )}
            </div>
            <button onClick={goToNext} disabled={!nextPair} style={{ background: 'none', border: '1px solid #333', color: !nextPair ? '#1a1a2e' : '#888', borderRadius: '5px', padding: '4px 10px', cursor: !nextPair ? 'default' : 'pointer', fontSize: '0.78rem', flexShrink: 0 }}>→</button>
          </div>
        ) : (
          <div style={{ padding: '10px 14px', background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.15)', borderRadius: '8px', color: '#fb923c', fontSize: '0.8rem' }}>
            Este bloque no tiene categorías asignadas.{' '}
            <button onClick={() => setEditingStructure(true)} style={{ background: 'none', border: 'none', color: '#7ecfff', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 'inherit' }}>Editar estructura</button>
          </div>
        )}
      </div>

      {/* Participant list for current category */}
      {activeCategory && (
        <>
          {catParticipants.length === 0 && !showForm && (
            <p style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '30px 0', fontSize: '0.85rem' }}>
              Sin participantes en {activeCategory} — Bloque {activeBlock}
            </p>
          )}

          {catParticipants.map(p => (
            editing?.id === p.id ? (
              <ParticipantForm
                key={p.id}
                initial={p}
                tournamentId={tournamentId}
                categories={categories}
                roundsCount={roundsCount}
                context={context}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div key={p.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#0f0f1a', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
                {p.photo_path
                  ? <img src={`/uploads/${p.photo_path}`} alt={p.name} style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                  : <div style={{ width: '44px', height: '44px', borderRadius: '6px', background: '#1a1a2e', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '0.6rem' }}>Sin foto</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  {p.academia && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', marginTop: '2px' }}>{p.academia}</div>}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button onClick={() => setEditing(p)} style={{ background: 'none', border: '1px solid #333', color: '#888', borderRadius: '5px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.78rem' }}>Editar</button>
                  <button onClick={() => handleDelete(p)} style={{ background: 'none', border: '1px solid #333', color: '#666', borderRadius: '5px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.78rem' }}>✕</button>
                </div>
              </div>
            )
          ))}

          {showForm ? (
            <ParticipantForm
              tournamentId={tournamentId}
              categories={categories}
              roundsCount={roundsCount}
              context={context}
              onSave={handleSave}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <button className="btn-secondary" style={{ marginTop: '8px', width: '100%' }} onClick={() => setShowForm(true)}>
              + Añadir participante en {activeCategory}
            </button>
          )}
        </>
      )}

      {/* Footer: edit structure link */}
      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #1a1a2e', textAlign: 'right' }}>
        <button onClick={() => setEditingStructure(true)} style={{ background: 'none', border: 'none', color: 'rgba(126,207,255,0.4)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}>
          Editar estructura de bloques
        </button>
      </div>
    </div>
  );
}

// ── ORDER tab ─────────────────────────────────────────────────────────────────
// ── Helpers for OrderTab hierarchy ───────────────────────────────────────────

function buildHierarchy(participants) {
  // Sort participants by existing act_order first so initial grouping preserves it
  const sorted = [...participants].sort((a, b) => (a.act_order ?? 9999) - (b.act_order ?? 9999));

  // Collect rounds and categories in the order they first appear
  const roundOrder = [];
  const catOrderByRound = {}; // round_number → [category, ...]

  for (const p of sorted) {
    const rnd = p.round_number || 1;
    const cat = p.category || '—';
    if (!roundOrder.includes(rnd)) { roundOrder.push(rnd); catOrderByRound[rnd] = []; }
    if (!catOrderByRound[rnd].includes(cat)) catOrderByRound[rnd].push(cat);
  }

  // Sort rounds numerically
  roundOrder.sort((a, b) => a - b);

  return roundOrder.map(rnd => ({
    round_number: rnd,
    categories: catOrderByRound[rnd].map(cat => ({
      category: cat,
      participants: sorted.filter(p => (p.round_number || 1) === rnd && (p.category || '—') === cat),
    })),
  }));
}

function flattenHierarchy(hierarchy) {
  return hierarchy.flatMap(ag => ag.categories.flatMap(c => c.participants));
}

function moveItem(arr, idx, dir) {
  const next = [...arr];
  const swap = idx + dir;
  if (swap < 0 || swap >= next.length) return arr;
  [next[idx], next[swap]] = [next[swap], next[idx]];
  return next;
}

// ── Reorder buttons ───────────────────────────────────────────────────────────
function MoveButtons({ onUp, onDown, disableUp, disableDown }) {
  const btn = (label, onClick, disabled) => (
    <button onClick={onClick} disabled={disabled} style={{
      background: 'none', border: '1px solid #333', color: disabled ? '#2a2a2a' : '#aaa',
      borderRadius: '4px', padding: '2px 7px', cursor: disabled ? 'default' : 'pointer',
      fontSize: '0.85rem', lineHeight: 1,
    }}>{label}</button>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
      {btn('↑', onUp, disableUp)}
      {btn('↓', onDown, disableDown)}
    </div>
  );
}

// ── ORDER tab ─────────────────────────────────────────────────────────────────
function OrderTab({ tournamentId, participants, onUpdate, activeBlock }) {
  const [hierarchy, setHierarchy] = useState(() => buildHierarchy(participants));
  const [saving, setSaving] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [orderSaved, setOrderSaved] = useState(false);
  const [viewBlock, setViewBlock] = useState(() => activeBlock || 1);

  // Sync viewBlock when activeBlock prop changes (e.g. changed from PARTICIPANTES)
  useEffect(() => { if (activeBlock) setViewBlock(activeBlock); }, [activeBlock]);

  // Only rebuild hierarchy when the SET of participants changes (added/removed).
  // Attribute changes (act_order, on_stage, etc.) must NOT reset the user's manual ordering.
  const lastIdsRef = useRef(participants.map(p => p.id).join(','));
  useEffect(() => {
    const ids = participants.map(p => p.id).join(',');
    if (ids !== lastIdsRef.current) {
      lastIdsRef.current = ids;
      setHierarchy(buildHierarchy(participants));
    }
  }, [participants]);

  const markOrderDirty = () => { setOrderDirty(true); setOrderSaved(false); };

  // Round level
  const moveRound = (ri, dir) => { setHierarchy(prev => moveItem(prev, ri, dir)); markOrderDirty(); };

  // Category level within a round
  const moveCat = (ri, ci, dir) => {
    setHierarchy(prev => prev.map((rnd, i) =>
      i !== ri ? rnd : { ...rnd, categories: moveItem(rnd.categories, ci, dir) }
    ));
    markOrderDirty();
  };

  // Participant level within a category
  const movePart = (ri, ci, pi, dir) => {
    setHierarchy(prev => prev.map((rnd, i) =>
      i !== ri ? rnd : {
        ...rnd,
        categories: rnd.categories.map((c, j) =>
          j !== ci ? c : { ...c, participants: moveItem(c.participants, pi, dir) }
        ),
      }
    ));
    markOrderDirty();
  };

  const save = async () => {
    setSaving(true);
    try {
      const flat = flattenHierarchy(hierarchy);
      const order = flat.map((p, i) => ({ id: p.id, act_order: i + 1 }));
      await apiFetch(`${API}/tournaments/${tournamentId}/act-order`, {
        method: 'PUT', body: JSON.stringify({ order }),
      });
      onUpdate(participants.map(p => {
        const entry = order.find(o => o.id === p.id);
        return entry ? { ...p, act_order: entry.act_order } : p;
      }));
      setOrderDirty(false); setOrderSaved(true);
    } finally { setSaving(false); }
  };

  if (participants.length === 0) {
    return <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '60px' }}>Añade participantes primero.</p>;
  }

  // Resolve which block to show (clamp to valid range)
  const ri = Math.max(0, Math.min(hierarchy.findIndex(r => r.round_number === viewBlock), hierarchy.length - 1));
  const visibleRound = hierarchy[ri] ?? hierarchy[0];
  const totalBlocks = hierarchy.length;

  // Global act_order counter offset: participants in blocks before the visible one
  const counterOffset = hierarchy.slice(0, ri).reduce(
    (sum, rnd) => sum + rnd.categories.reduce((s, c) => s + c.participants.length, 0), 0
  );
  let counter = counterOffset;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ color: '#7ecfff', letterSpacing: '0.1em', fontSize: '0.9rem', margin: 0 }}>
            ORDEN DE ACTUACIÓN
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', marginTop: '4px' }}>
            Reordena categorías y participantes con las flechas. Guarda cuando termines.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar orden'}
          </button>
          <SaveStatus dirty={orderDirty} saved={orderSaved} savedMsg="Orden guardado" />
        </div>
      </div>

      {/* Block navigator */}
      {totalBlocks > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', background: 'rgba(126,207,255,0.04)', border: '1px solid rgba(126,207,255,0.1)', borderRadius: '8px', marginBottom: '16px' }}>
          <button
            onClick={() => setViewBlock(hierarchy[ri - 1].round_number)}
            disabled={ri === 0}
            style={{ background: 'none', border: '1px solid #333', color: ri === 0 ? '#1a1a2e' : '#888', borderRadius: '5px', padding: '4px 10px', cursor: ri === 0 ? 'default' : 'pointer', fontSize: '0.78rem' }}
          >←</button>
          <span style={{ flex: 1, textAlign: 'center', color: '#7ecfff', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.12em', fontFamily: "'Bebas Neue', sans-serif" }}>
            BLOQUE {visibleRound.round_number}
            <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400, fontSize: '0.72rem', marginLeft: '8px', fontFamily: 'inherit' }}>
              de {totalBlocks}
            </span>
          </span>
          <button
            onClick={() => setViewBlock(hierarchy[ri + 1].round_number)}
            disabled={ri === totalBlocks - 1}
            style={{ background: 'none', border: '1px solid #333', color: ri === totalBlocks - 1 ? '#1a1a2e' : '#888', borderRadius: '5px', padding: '4px 10px', cursor: ri === totalBlocks - 1 ? 'default' : 'pointer', fontSize: '0.78rem' }}
          >→</button>
        </div>
      )}

      {/* Only render the visible block */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(126,207,255,0.15)' }}>
          {/* Round header */}
          <div style={{
            background: 'rgba(126,207,255,0.07)',
            padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <MoveButtons
              onUp={() => { moveRound(ri, -1); setViewBlock(hierarchy[ri - 1].round_number); }}
              disableUp={ri === 0}
              onDown={() => { moveRound(ri, 1); setViewBlock(hierarchy[ri + 1].round_number); }}
              disableDown={ri === hierarchy.length - 1}
            />
            <div style={{ flex: 1 }}>
              <span style={{ color: '#7ecfff', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.15em', fontFamily: "'Bebas Neue', sans-serif" }}>
                BLOQUE {visibleRound.round_number}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', marginLeft: '10px' }}>
                {visibleRound.categories.reduce((n, c) => n + c.participants.length, 0)} participantes
              </span>
            </div>
          </div>

          {/* Categories within this round */}
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {visibleRound.categories.map((cat, ci) => (
              <div key={cat.category} style={{ borderRadius: '8px', border: `1px solid ${categoryColor(cat.category)}30`, overflow: 'hidden' }}>
                {/* Category header */}
                <div style={{
                  background: `${categoryColor(cat.category)}12`,
                  padding: '8px 14px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <MoveButtons
                    onUp={() => moveCat(ri, ci, -1)} disableUp={ci === 0}
                    onDown={() => moveCat(ri, ci, 1)} disableDown={ci === visibleRound.categories.length - 1}
                  />
                  <span style={{ color: categoryColor(cat.category), fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.12em', flex: 1 }}>
                    {cat.category === '—' ? 'Sin categoría' : cat.category.toUpperCase()}
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, marginLeft: '8px', fontSize: '0.72rem' }}>
                      {cat.participants.length} {cat.participants.length === 1 ? 'grupo' : 'grupos'}
                    </span>
                  </span>
                </div>

                {/* Participants within this category */}
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {cat.participants.map((p, pi) => {
                    counter++;
                    const pos = counter;
                    return (
                      <div key={p.id} style={{
                        display: 'flex', gap: '10px', alignItems: 'center',
                        background: '#0f0f1a', borderRadius: '6px', padding: '8px 12px',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '28px', gap: '2px' }}>
                          <span style={{
                            color: '#7ecfff', fontFamily: "'Bebas Neue', sans-serif",
                            fontSize: '1.2rem', textAlign: 'center', lineHeight: 1,
                          }}>{pos}</span>
                          <span style={{
                            color: categoryColor(cat.category), fontSize: '0.62rem',
                            fontWeight: 700, letterSpacing: '0.05em', lineHeight: 1,
                          }}>{pi + 1}</span>
                        </div>
                        {p.photo_path
                          ? <img src={`/uploads/${p.photo_path}`} alt={p.name} style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '5px', flexShrink: 0 }} />
                          : <div style={{ width: '38px', height: '38px', borderRadius: '5px', background: '#1a1a2e', flexShrink: 0 }} />
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          {p.academia && (
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.academia}
                            </div>
                          )}
                        </div>
                        <MoveButtons
                          onUp={() => movePart(ri, ci, pi, -1)} disableUp={pi === 0}
                          onDown={() => movePart(ri, ci, pi, 1)} disableDown={pi === cat.participants.length - 1}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Staff chat panel ──────────────────────────────────────────────────────────
// SpeakerMsgPanel is a controlled component: thread state lives in the root component
// so messages aren't lost when the admin switches away from the en-vivo tab.
function SpeakerMsgPanel({ tournamentId, thread, onAdd }) {
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  const pushOut = (entry) => onAdd({ dir: 'out', sentAt: Date.now(), ...entry });

  const sendToStaff = async (type, payload) => {
    const res = await apiFetch(`${API}/tournaments/${tournamentId}/speaker/send`, {
      method: 'POST', body: JSON.stringify({ type, ...payload }),
    });
    if (res.ok) pushOut({ type, ...payload });
  };

  const handleSendText = async () => {
    const text = msgText.trim();
    if (!text) return;
    setSending(true);
    try { await sendToStaff('message', { text }); setMsgText(''); }
    finally { setSending(false); }
  };

  return (
    <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #1a1a2e' }}>
      <div style={{ marginBottom: '12px' }}>
        <h3 style={{ color: '#fb923c', letterSpacing: '0.15em', fontSize: '0.85rem', margin: 0 }}>COMUNICACIÓN CON STAFF</h3>
      </div>

      {/* Thread */}
      <div style={{ background: '#080810', borderRadius: '10px', border: '1px solid #1a1a2e', padding: '12px', minHeight: '120px', maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
        {thread.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.8rem', margin: 'auto', textAlign: 'center' }}>Sin mensajes aún</p>
        )}
        {thread.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.dir === 'out' ? 'flex-end' : 'flex-start' }}>
            {m.dir === 'in' && (
              <span style={{ color: '#fb923c', fontSize: '0.65rem', fontWeight: 700, marginBottom: '3px', letterSpacing: '0.08em' }}>{m.from}</span>
            )}
            <div style={{
              maxWidth: '85%',
              background: m.dir === 'out' ? 'rgba(126,207,255,0.12)' : 'rgba(251,146,60,0.1)',
              border: `1px solid ${m.dir === 'out' ? 'rgba(126,207,255,0.25)' : 'rgba(251,146,60,0.25)'}`,
              borderRadius: m.dir === 'out' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
              padding: '8px 12px',
            }}>
              {m.type === 'ranking' ? (
                <span style={{ color: '#7ecfff', fontSize: '0.8rem', fontWeight: 600 }}>🏆 Ranking enviado</span>
              ) : (
                <span style={{ color: '#f0f0f0', fontSize: '0.88rem', lineHeight: 1.4 }}>{m.text}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={msgText} onChange={e => setMsgText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
          placeholder="Mensaje al staff…"
          style={{ flex: 1, background: '#0f0f1a', border: '1px solid #2a2a3e', borderRadius: '8px', color: '#fff', padding: '10px 14px', fontSize: '0.9rem' }}
        />
        <button
          onClick={handleSendText} disabled={sending || !msgText.trim()}
          style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
        >
          {sending ? '...' : '→'}
        </button>
      </div>
    </div>
  );
}

// ── LIVE tab ──────────────────────────────────────────────────────────────────
// ── Timing helpers ────────────────────────────────────────────────────────────
function fmtElapsed(startedAt, now = Date.now()) {
  if (startedAt == null) return '00:00:00';
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function fmtDuration(seconds) {
  if (seconds == null || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`;
  if (m === 0) return `${s}s`;
  return `${m}min ${s > 0 ? s + 's' : ''}`.trim();
}

function computeTiming(participants, now = Date.now()) {
  const allPerformed = participants.filter(p => p.on_stage_duration_s > 0);
  const globalAvg = allPerformed.length
    ? allPerformed.reduce((s, p) => s + p.on_stage_duration_s, 0) / allPerformed.length
    : null;

  // Group by round → category
  const groups = {}; // { round: { cat: { performed[], inProgress, pending[] } } }
  for (const p of participants) {
    const r = p.round_number || 1;
    const cat = p.category || '—';
    if (!groups[r]) groups[r] = {};
    if (!groups[r][cat]) groups[r][cat] = { performed: [], inProgress: null, pending: [] };
    if (p.on_stage) groups[r][cat].inProgress = p;
    else if (p.on_stage_duration_s > 0) groups[r][cat].performed.push(p);
    else groups[r][cat].pending.push(p);
  }

  const calcGroup = (g) => {
    const catDurations = g.performed.map(p => p.on_stage_duration_s);
    const avg = catDurations.length
      ? catDurations.reduce((a, b) => a + b, 0) / catDurations.length
      : globalAvg;
    let remaining = null;
    if (avg != null) {
      let inProg = 0;
      if (g.inProgress?.on_stage_at) inProg = Math.max(0, avg - (now - g.inProgress.on_stage_at) / 1000);
      else if (g.inProgress) inProg = avg;
      remaining = inProg + g.pending.length * avg;
    }
    const done = g.performed.length;
    const total = done + (g.inProgress ? 1 : 0) + g.pending.length;
    return { done, total, avg, remaining };
  };

  const blocks = {};
  const blockTotals = {};
  for (const [round, cats] of Object.entries(groups)) {
    blocks[round] = {};
    let bDone = 0, bTotal = 0, bRemaining = 0, bHasEst = false;
    for (const [cat, g] of Object.entries(cats)) {
      const s = calcGroup(g);
      blocks[round][cat] = s;
      bDone += s.done; bTotal += s.total;
      if (s.remaining != null) { bRemaining += s.remaining; bHasEst = true; }
    }
    blockTotals[round] = { done: bDone, total: bTotal, remaining: bHasEst ? bRemaining : null };
  }
  return { blocks, blockTotals, globalAvg };
}

// ── TimingWidget ──────────────────────────────────────────────────────────────
// Stopwatch helpers: { running: bool, startMs: number|null, pausedMs: number }
const _twStart = (t, now) => ({ running: true, startMs: now - (t?.pausedMs ?? 0), pausedMs: 0 });
const _twPause = (t, now) => ({ running: false, startMs: null, pausedMs: t?.running ? now - t.startMs : (t?.pausedMs ?? 0) });
const _twReset = () => ({ running: false, startMs: null, pausedMs: 0 });
const _twElapsed = (t, now) => !t ? 0 : t.running ? now - t.startMs : (t.pausedMs ?? 0);

function TimingWidget({ timing, tourTimer, setTourTimer, blockTimers, setBlockTimers, activeBlock }) {
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  if (!timing?.started_at) return null;

  const visibleParticipants = activeBlock != null
    ? (timing.participants || []).filter(p => (p.round_number || 1) === activeBlock)
    : (timing.participants || []);

  const { blocks, blockTotals, globalAvg } = computeTiming(visibleParticipants, now);
  const roundOrder = Object.keys(blocks).map(Number).sort((a, b) => a - b);

  const btnSt = {
    background: 'rgba(126,207,255,0.1)', border: '1px solid rgba(126,207,255,0.2)',
    borderRadius: '4px', color: '#7ecfff', fontSize: '0.72rem',
    padding: '1px 7px', cursor: 'pointer', lineHeight: '1.5',
  };

  const TimerRow = ({ ms, label, timer, onSet }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem', letterSpacing: '0.15em' }}>{label}</span>
      <span style={{ color: '#7ecfff', fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.05em' }}>
        {fmtElapsed(0, ms)}
      </span>
      {timer?.running
        ? <button style={btnSt} onClick={() => onSet(_twPause(timer, now))}>⏸</button>
        : <button style={btnSt} onClick={() => onSet(_twStart(timer, now))}>▶</button>}
      <button style={btnSt} onClick={() => onSet(_twReset())}>↺</button>
    </div>
  );

  const tourMs = _twElapsed(tourTimer, now);

  return (
    <div style={{ border: '1px solid rgba(126,207,255,0.15)', borderRadius: '12px' }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ padding: '10px 16px', background: 'rgba(126,207,255,0.04)', borderBottom: collapsed ? 'none' : '1px solid rgba(126,207,255,0.1)', borderRadius: collapsed ? '12px' : '12px 12px 0 0', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span style={{ color: '#7ecfff', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.15em' }}>CRONÓMETROS</span>
        <span style={{ color: 'rgba(126,207,255,0.4)', fontSize: '0.65rem' }}>{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && <div style={{ padding: '12px 16px' }}>
      {/* Cronómetro total */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <TimerRow
          ms={tourMs}
          label="⏱ TORNEO"
          timer={tourTimer ?? _twReset()}
          onSet={setTourTimer}
        />
        {globalAvg != null && (
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem' }}>
            media/actuación: <span style={{ color: 'rgba(255,255,255,0.5)' }}>{fmtDuration(globalAvg)}</span>
          </span>
        )}
      </div>

      {/* Por bloque */}
      {roundOrder.map(round => {
        const bt = blockTotals[round];
        const bKey = String(round);
        const bTimer = blockTimers[bKey];
        const bMs = _twElapsed(bTimer, now);
        return (
          <div key={round} style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <TimerRow
                ms={bMs}
                label={`BLOQUE ${round}`}
                timer={bTimer ?? _twReset()}
                onSet={t => setBlockTimers(prev => ({ ...prev, [bKey]: t }))}
              />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{bt.done}/{bt.total} actuados</span>
              {bt.remaining != null && bt.remaining > 1 && (
                <span style={{ color: '#fb923c', fontSize: '0.72rem' }}>est. restante: {fmtDuration(bt.remaining)}</span>
              )}
              {bt.remaining != null && bt.remaining <= 1 && bt.total > 0 && (
                <span style={{ color: '#34d399', fontSize: '0.72rem' }}>✓ completado</span>
              )}
            </div>
          </div>
        );
      })}
      </div>}{/* end padding div */}
    </div>
  );
}

function LiveTab({ tournamentId, participants, onUpdate, timing, tournamentStatus, staffThread, onStaffAdd, scoresRefreshTick, activeBlock, loadBlock, totalBlocks, tourTimer, setTourTimer, blockTimers, setBlockTimers, iframeCollapsed, setIframeCollapsed }) {
  const [loading, setLoading] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  // Local participant state (augments parent state with real-time timer fields)
  const [localParts, setLocalParts] = useState(participants);
  useEffect(() => { setLocalParts(participants); }, [participants]);

  // Music control state
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicActive, setMusicActive] = useState(false); // true once play has been pressed at least once

  // Collapse state for blocks and categories
  const [collapsedBlocks, setCollapsedBlocks] = useState({});
  const [collapsedCats, setCollapsedCats] = useState({});
  const toggleBlock = (r) => setCollapsedBlocks(prev => ({ ...prev, [r]: !prev[r] }));
  const toggleCat = (key) => setCollapsedCats(prev => ({ ...prev, [key]: !prev[key] }));

  // allVotedMap: { [participantId]: true } — set when all judges have voted
  const [allVotedMap, setAllVotedMap] = useState({});
  const [judgesList, setJudgesList] = useState([]);
  // judgesVotedMap: { [participantId]: Set<judgeId> }
  const [judgesVotedMap, setJudgesVotedMap] = useState({});
  // globalAvgMap: { [participantId]: number } — for computing top 3
  const [globalAvgMap, setGlobalAvgMap] = useState({});

  const loadVotes = useCallback(async () => {
    const r = await apiFetch(`/api/coreo/tournaments/${tournamentId}/scores/summary`);
    if (!r.ok) return;
    const d = await r.json();
    const map = {};
    const votedMap = {};
    const avgMap = {};
    for (const p of (d.participants || [])) {
      if (p.allVoted) map[p.id] = true;
      votedMap[p.id] = new Set(Object.keys(p.judgeScores || {}).map(Number));
      if (p.globalAvg != null) avgMap[p.id] = p.globalAvg;
    }
    setAllVotedMap(map);
    setJudgesList(d.judges || []);
    setJudgesVotedMap(votedMap);
    setGlobalAvgMap(avgMap);
  }, [tournamentId]);

  const [sendingRanking, setSendingRanking] = useState({});
  const sendCategoryRanking = async (round, cat, cps) => {
    const key = `${round}:${cat}`;
    setSendingRanking(prev => ({ ...prev, [key]: true }));
    try {
      const top3 = [...cps]
        .filter(p => globalAvgMap[p.id] != null)
        .sort((a, b) => (globalAvgMap[b.id] ?? 0) - (globalAvgMap[a.id] ?? 0))
        .slice(0, 3)
        .map(p => ({ name: p.name, total: globalAvgMap[p.id] }));
      await apiFetch(`/api/coreo/tournaments/${tournamentId}/speaker/send`, {
        method: 'POST',
        body: JSON.stringify({ type: 'ranking', ranking: [{ round, categories: [{ category: cat, top3 }] }] }),
      });
    } finally {
      setSendingRanking(prev => ({ ...prev, [key]: false }));
    }
  };

  useEffect(() => { loadVotes(); }, [loadVotes, scoresRefreshTick]);

  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const fmtTimer = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Participant stage state: idle | shown | timing | finalized | done | pending_votes
  // done          = performed + all judges voted
  // pending_votes = performed + waiting for remaining judge votes
  const stageState = (p) => {
    if (!p.on_stage) {
      if (p.on_stage_duration_s > 0) return allVotedMap[p.id] ? 'done' : 'pending_votes';
      return 'idle';
    }
    if (p.on_stage_at) return 'timing';
    if (p.on_stage_duration_s > 0) return 'finalized';
    return 'shown';
  };

  const rounds = (() => {
    const sorted = [...localParts].sort((a, b) => (a.act_order ?? 9999) - (b.act_order ?? 9999));
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
      categories: roundMap[r].catOrder.map(cat => ({ cat, participants: roundMap[r].catMap[cat] })),
    }));
  })();

  const allSorted = rounds.flatMap(r => r.categories.flatMap(c => c.participants));
  const partIdxMap = Object.fromEntries(allSorted.map((p, i) => [p.id, i + 1]));
  const onStageP = localParts.find(p => p.on_stage);

  // Reset music state when participant changes
  useEffect(() => { setMusicPlaying(false); setMusicActive(false); }, [onStageP?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const musicPlay = async () => {
    await apiFetch(`${API}/tournaments/${tournamentId}/music/play`, { method: 'POST', body: JSON.stringify({ position: musicActive ? undefined : 0 }) });
    setMusicPlaying(true); setMusicActive(true);
  };
  const musicPause = async () => {
    await apiFetch(`${API}/tournaments/${tournamentId}/music/pause`, { method: 'POST' });
    setMusicPlaying(false);
  };
  const musicStop = async () => {
    await apiFetch(`${API}/tournaments/${tournamentId}/music/stop`, { method: 'POST' });
    setMusicPlaying(false); setMusicActive(false);
  };

  // Auto-collapse: expand block+category of active participant (or next-in-line), collapse the rest
  useEffect(() => {
    // Determine the focal participant: on-stage first, else first idle (SIGUIENTE target)
    const focal = onStageP ?? (
      [...localParts]
        .sort((a, b) => (a.act_order ?? 9999) - (b.act_order ?? 9999))
        .find(p => !p.on_stage && p.on_stage_duration_s === 0)
    );
    if (!focal) return;
    const focalRound = String(focal.round_number || 1);
    const focalKey = `${focalRound}:${focal.category || '—'}`;

    const newBlocks = {};
    for (const { round } of rounds) {
      newBlocks[String(round)] = String(round) !== focalRound;
    }
    setCollapsedBlocks(newBlocks);

    const newCats = {};
    for (const p of localParts) {
      const key = `${p.round_number || 1}:${p.category || '—'}`;
      if (!(key in newCats)) newCats[key] = key !== focalKey;
    }
    setCollapsedCats(newCats);
  }, [onStageP?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const onStageIdx = onStageP ? allSorted.findIndex(p => p.id === onStageP?.id) : -1;
  const nextIdleId = allSorted.slice(onStageIdx + 1).find(p => stageState(p) === 'idle')?.id ?? null;

  const doOnStage = async (pid) => {
    setLoading(pid + ':stage');
    try {
      const res = await apiFetch(`${API}/participants/${pid}/on-stage`, { method: 'POST' });
      if (!res.ok) return;
      setLocalParts(prev => prev.map(p => p.id === pid
        ? { ...p, on_stage: 1, on_stage_at: null, on_stage_duration_s: 0 }
        : { ...p, on_stage: 0 }
      ));
      onUpdate(participants.map(p => p.id === pid
        ? { ...p, on_stage: 1, on_stage_at: null, on_stage_duration_s: 0 }
        : { ...p, on_stage: 0 }
      ));
    } finally { setLoading(null); }
  };

  const doTimerStart = async (pid) => {
    setLoading(pid + ':start');
    try {
      const res = await apiFetch(`${API}/participants/${pid}/timer/start`, { method: 'POST' });
      if (!res.ok) return;
      const d = await res.json();
      setLocalParts(prev => prev.map(p => p.id === pid ? { ...p, on_stage_at: d.on_stage_at } : p));
    } finally { setLoading(null); }
  };

  const doTimerStop = async (pid) => {
    setLoading(pid + ':stop');
    try {
      const res = await apiFetch(`${API}/participants/${pid}/timer/stop`, { method: 'POST' });
      if (!res.ok) return;
      const d = await res.json();
      setLocalParts(prev => prev.map(p => p.id === pid ? { ...p, on_stage_at: null, on_stage_duration_s: d.on_stage_duration_s } : p));
    } finally { setLoading(null); }
  };

  const doClearStage = async () => {
    setLoading('clear');
    try {
      await apiFetch(`${API}/tournaments/${tournamentId}/off-stage`, { method: 'POST' });
      setLocalParts(prev => prev.map(p => ({ ...p, on_stage: 0, on_stage_at: null })));
      onUpdate(prev => prev.map(p => ({ ...p, on_stage: 0, on_stage_at: null })));
    } finally { setLoading(null); }
  };

  const elapsedS = onStageP?.on_stage_at
    ? Math.max(0, Math.floor((nowMs - onStageP.on_stage_at) / 1000))
    : onStageP?.on_stage_duration_s > 0 ? Math.round(onStageP.on_stage_duration_s) : null;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 109px)', overflow: 'hidden' }}>

      {/* ── Left: control panel ── */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', borderRight: iframeCollapsed ? 'none' : '1px solid #1a1a2e', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>

        <TimingWidget timing={timing} tourTimer={tourTimer} setTourTimer={setTourTimer} blockTimers={blockTimers} setBlockTimers={setBlockTimers} activeBlock={activeBlock} />

        {/* ── Music control ── */}
        {onStageP?.audio_path && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(52,211,153,0.05)', border: `1px solid ${musicPlaying ? 'rgba(52,211,153,0.45)' : 'rgba(52,211,153,0.18)'}`, borderRadius: '10px', transition: 'border-color 0.3s' }}>
            <span style={{ fontSize: '0.88rem', lineHeight: 1 }}>🎵</span>
            <span style={{ flex: 1, fontSize: '0.78rem', color: musicPlaying ? '#34d399' : 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color 0.3s' }}>
              {musicPlaying ? 'Reproduciendo...' : musicActive ? 'Pausado' : onStageP.name}
            </span>
            <button onClick={musicPlaying ? musicPause : musicPlay}
              style={{ background: musicPlaying ? 'rgba(52,211,153,0.15)' : 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399', borderRadius: '6px', padding: '5px 14px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
              {musicPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={musicStop} disabled={!musicActive}
              style={{ background: 'none', border: '1px solid #333', color: musicActive ? '#888' : '#2a2a3e', borderRadius: '6px', padding: '5px 10px', cursor: musicActive ? 'pointer' : 'default', fontSize: '0.85rem' }}>
              ⏹
            </button>
          </div>
        )}

        {/* ── Block switcher ── */}
        {activeBlock !== null && totalBlocks > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(126,207,255,0.05)', border: '1px solid rgba(126,207,255,0.18)', borderRadius: '10px' }}>
            <span style={{ color: '#7ecfff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', letterSpacing: '0.2em', flex: 1 }}>
              BLOQUE {activeBlock} <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', fontFamily: 'inherit' }}>de {totalBlocks}</span>
            </span>
            {Array.from({ length: totalBlocks }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => loadBlock(n)} style={{
                background: n === activeBlock ? 'rgba(126,207,255,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${n === activeBlock ? 'rgba(126,207,255,0.5)' : '#2a2a3e'}`,
                color: n === activeBlock ? '#7ecfff' : 'rgba(255,255,255,0.4)',
                borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: n === activeBlock ? 700 : 400,
              }}>
                {n === activeBlock ? `▶ ${n}` : n}
              </button>
            ))}
          </div>
        )}

        {/* Participant list */}
        <div style={{ border: '1px solid rgba(251,146,60,0.2)', borderRadius: '12px' }}>
          <div style={{ padding: '10px 16px', background: 'rgba(251,146,60,0.05)', borderBottom: '1px solid rgba(251,146,60,0.12)', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#fb923c', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.15em', flex: 1 }}>CONTROL DE ESCENA</span>
            {activeBlock !== null && totalBlocks > 1 && activeBlock < totalBlocks && (() => {
              const allDone = localParts.length > 0 && localParts.every(p => p.on_stage_duration_s > 0 || p.on_stage);
              return allDone ? (
                <button onClick={() => loadBlock(activeBlock + 1)} style={{
                  background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.4)',
                  color: '#34d399', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer',
                  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em',
                }}>
                  Comenzar Bloque {activeBlock + 1} →
                </button>
              ) : null;
            })()}
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rounds.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.3)', padding: '20px', textAlign: 'center', fontSize: '0.85rem' }}>No hay participantes.</p>
            )}
            {(() => {
              return rounds.map(({ round, categories }) => {
                const bCollapsed = !!collapsedBlocks[round];
                return (
                <div key={round}>
                  <div onClick={() => toggleBlock(round)} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: bCollapsed ? 0 : '8px', cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ color: '#7ecfff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.85rem', letterSpacing: '0.2em' }}>BLOQUE {round}</span>
                    <span style={{ flex: 1, height: '1px', background: 'rgba(126,207,255,0.12)' }} />
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem' }}>{categories.reduce((n, c) => n + c.participants.length, 0)}</span>
                    <span style={{ color: 'rgba(126,207,255,0.4)', fontSize: '0.65rem', marginLeft: '2px' }}>{bCollapsed ? '▶' : '▼'}</span>
                  </div>
                  {!bCollapsed && <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {categories.map(({ cat, participants: cps }) => {
                    const cKey = `${round}:${cat}`;
                    const cCollapsed = !!collapsedCats[cKey];
                    return (
                    <div key={cat}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: cCollapsed ? 0 : '4px', paddingLeft: '4px' }}>
                        <div onClick={() => toggleCat(cKey)} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, cursor: 'pointer', userSelect: 'none' }}>
                          <span style={{ color: categoryColor(cat), fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{cat === '—' ? 'Sin categoría' : cat}</span>
                          <span style={{ flex: 1, height: '1px', background: `${categoryColor(cat)}22` }} />
                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem' }}>{cps.length}</span>
                          <span style={{ color: `${categoryColor(cat)}88`, fontSize: '0.6rem', marginLeft: '2px' }}>{cCollapsed ? '▶' : '▼'}</span>
                        </div>
                      </div>
                      {!cCollapsed && <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {cps.map(p => {
                        const idx = partIdxMap[p.id];
                      const ss = stageState(p);
                      const isNext = ss === 'idle' && p.id === nextIdleId && !onStageP;
                      const rowBorder = ss === 'shown' || ss === 'timing'
                        ? '1px solid rgba(126,207,255,0.5)'
                        : isNext ? '1px solid rgba(251,146,60,0.4)'
                        : '1px solid #1a1a2e';
                      const rowBg = ss === 'shown' || ss === 'timing'
                        ? 'rgba(126,207,255,0.07)'
                        : isNext ? 'rgba(251,146,60,0.06)'
                        : 'transparent';
                      const isDimmed = ss === 'done' || ss === 'pending_votes';
                      const pElapsed = ss === 'timing' && p.on_stage_at
                        ? Math.max(0, Math.floor((nowMs - p.on_stage_at) / 1000))
                        : null;
                      return (
                        <div key={p.id} style={{
                          display: 'flex', gap: '10px', alignItems: 'center', padding: '9px 12px',
                          borderRadius: '8px', border: rowBorder, background: rowBg,
                          opacity: isDimmed ? 0.45 : 1,
                        }}>
                          <span style={{ color: 'rgba(255,255,255,0.2)', minWidth: '18px', fontSize: '0.75rem' }}>{idx}</span>
                          {p.photo_path && <img src={`/uploads/${p.photo_path}`} alt={p.name} style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: ss !== 'idle' || isNext ? 700 : 400, fontSize: '0.88rem', color: isDimmed ? 'rgba(255,255,255,0.4)' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                            {p.academia && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.62rem', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.academia}</div>}
                          </div>
                          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {ss === 'idle' && (
                              <button
                                onClick={() => doOnStage(p.id)} disabled={!!loading}
                                style={{ background: isNext ? 'linear-gradient(135deg,#fb923c,#ea580c)' : 'none', border: isNext ? 'none' : '1px solid #2a2a3e', color: isNext ? '#fff' : '#888', fontWeight: isNext ? 700 : 400, fontSize: '0.7rem', padding: isNext ? '5px 11px' : '4px 9px', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}>
                                {loading === p.id + ':stage' ? '...' : isNext ? 'SIGUIENTE →' : 'EN ESCENA'}
                              </button>
                            )}
                            {ss === 'shown' && (
                              <>
                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#7ecfff', boxShadow: '0 0 8px #7ecfff', display: 'inline-block', animation: 'liveTabPulse 1.5s ease-in-out infinite' }} />
                                <button
                                  onClick={() => doTimerStart(p.id)} disabled={!!loading}
                                  style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.7rem', padding: '5px 11px', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}>
                                  {loading === p.id + ':start' ? '...' : 'INICIAR'}
                                </button>
                              </>
                            )}
                            {ss === 'timing' && (
                              <>
                                <span style={{ color: '#7ecfff', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700, minWidth: '48px', textAlign: 'right' }}>{fmtTimer(pElapsed ?? 0)}</span>
                                <button
                                  onClick={() => doTimerStop(p.id)} disabled={!!loading}
                                  style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.7rem', padding: '5px 11px', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}>
                                  {loading === p.id + ':stop' ? '...' : 'FINALIZAR'}
                                </button>
                              </>
                            )}
                            {ss === 'finalized' && (
                              <>
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontFamily: 'monospace' }}>✓ {fmtTimer(Math.round(p.on_stage_duration_s))}</span>
                                <button
                                  onClick={() => doClearStage()} disabled={!!loading}
                                  style={{ background: 'none', border: '1px solid #3a3a4e', color: '#666', fontSize: '0.7rem', padding: '4px 9px', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer' }}>
                                  {loading === 'clear' ? '...' : 'LIMPIAR'}
                                </button>
                              </>
                            )}
                            {ss === 'done' && (
                              <span style={{ color: '#34d399', fontSize: '0.75rem', fontFamily: 'monospace' }}>✓ {fmtTimer(Math.round(p.on_stage_duration_s))}</span>
                            )}
                            {ss === 'pending_votes' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontFamily: 'monospace' }}>{fmtTimer(Math.round(p.on_stage_duration_s))}</span>
                                <span style={{ color: '#fb923c', fontSize: '0.65rem', letterSpacing: '0.06em' }}>⏳ votos</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                      })}
                      </div>}
                    </div>
                  );
                  })}
                  </div>}
                </div>
              );
              });
            })()}
          </div>
        </div>{/* end frame */}

        {/* Messaging to staff */}
        <div style={{ border: '1px solid rgba(126,207,255,0.15)', borderRadius: '12px' }}>
          <div style={{ padding: '10px 16px', background: 'rgba(126,207,255,0.04)', borderBottom: '1px solid rgba(126,207,255,0.1)', borderRadius: '12px 12px 0 0' }}>
            <span style={{ color: '#7ecfff', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.15em' }}>COMUNICACIÓN</span>
          </div>
          <div style={{ padding: '16px' }}>
            <SpeakerMsgPanel tournamentId={tournamentId} thread={staffThread} onAdd={onStaffAdd} />
          </div>
        </div>

      </div>

      {/* ── Right: public screen preview ── */}
      <div style={{ flex: iframeCollapsed ? 0 : 1, minWidth: 0, width: iframeCollapsed ? 0 : undefined, background: '#000', position: 'relative', overflow: 'hidden', transition: 'flex 0.25s ease' }}>
        <div style={{ position: 'absolute', top: '10px', right: '12px', zIndex: 10, display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '0.62rem', letterSpacing: '0.14em', padding: '3px 8px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px' }}>PANTALLA PÚBLICA</span>
          <button onClick={() => window.open(`/coreo-screen/${tournamentId}`, '_blank')} style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid #2a2a3e', color: '#666', fontSize: '0.62rem', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}>⤢ Abrir</button>
        </div>
        <iframe
          src={`/coreo-screen/${tournamentId}`}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title="Pantalla pública"
        />
        {/* EN ESCENA AHORA overlay — visible while any participant is on stage, disappears only on LIMPIAR */}
        {onStageP && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)', padding: '18px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.58rem', letterSpacing: '0.2em', marginBottom: '3px' }}>EN ESCENA AHORA</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>{onStageP.name}</div>
              <div style={{ color: categoryColor(onStageP.category), fontSize: '0.65rem', letterSpacing: '0.1em', marginTop: '3px' }}>{onStageP.category}</div>
              {judgesList.length > 0 && (
                <div style={{ display: 'flex', gap: '5px', marginTop: '8px' }}>
                  {judgesList.map(j => {
                    const voted = judgesVotedMap[onStageP.id]?.has(j.id);
                    return (
                      <div key={j.id} title={j.name} style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: voted ? '#34d399' : 'rgba(255,255,255,0.2)',
                        border: voted ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.3)',
                        transition: 'background 0.3s',
                      }} />
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ color: elapsedS !== null ? '#7ecfff' : 'rgba(255,255,255,0.25)', fontFamily: 'monospace', fontSize: '2.2rem', fontWeight: 700, lineHeight: 1 }}>
              {elapsedS !== null ? fmtTimer(elapsedS) : '––:––'}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes liveTabPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #7ecfff, 0 0 12px #7ecfff; }
          50%       { opacity: 0.5; box-shadow: 0 0 3px #7ecfff; }
        }
      `}</style>
    </div>
  );
}


// ── Organizer login ───────────────────────────────────────────────────────────
function OrganizerLogin({ onLogin }) {
  const [code, setCode] = useState('');
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
      localStorage.setItem('coreoOrgCode', code.trim());
      localStorage.setItem('coreoOrgName', data.organizer.name);
      onLogin(data.organizer);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '380px' }}>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.25em', color: '#7ecfff', marginBottom: '2px' }}>ZEN.TAISEN</p>
        <h2 style={{ marginBottom: '8px', color: '#a78bfa', fontSize: '0.85rem', letterSpacing: '0.2em' }}>ORGANIZADOR</h2>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginBottom: '16px' }}>Introduce tu código de acceso</p>
        <input
          placeholder="Código de organizador"
          value={code} onChange={e => setCode(e.target.value)}
          style={{ width: '100%', marginBottom: '12px' }}
          autoCapitalize="none" autoComplete="off"
        />
        {error && <p style={{ color: 'var(--accent)', marginBottom: '12px', fontSize: '0.9rem' }}>{error}</p>}
        <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <button type="button" onClick={() => navigate('/admin')} style={{ width: '100%', marginTop: '10px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '0.8rem' }}>
          Soy administrador →
        </button>
      </form>
    </div>
  );
}

// ── ScoresTab ─────────────────────────────────────────────────────────────────
function ScoresTab({ tournamentId, scoresRefreshTick, activeBlock, totalBlocks }) {
  const [viewBlock, setViewBlock] = useState(() => activeBlock || 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingRanking, setSendingRanking] = useState({}); // { 'round:cat': true }
  const [collapsedCats, setCollapsedCats] = useState({}); // { 'cat': true }

  const sendCategoryRanking = async (round, cat, catParts) => {
    const key = `${round}:${cat}`;
    setSendingRanking(prev => ({ ...prev, [key]: true }));
    try {
      const top3 = [...catParts]
        .filter(p => p.globalAvg != null)
        .sort((a, b) => b.globalAvg - a.globalAvg)
        .slice(0, 3)
        .map(p => ({ name: p.name, total: p.globalAvg }));
      await apiFetch(`/api/coreo/tournaments/${tournamentId}/speaker/send`, {
        method: 'POST',
        body: JSON.stringify({ type: 'ranking', ranking: [{ round, categories: [{ category: cat, top3 }] }] }),
      });
    } finally {
      setSendingRanking(prev => ({ ...prev, [key]: false }));
    }
  };

  const load = useCallback(async (block) => {
    setLoading(true);
    try {
      const roundParam = (totalBlocks > 1 && block) ? `?round=${block}` : '';
      const r = await apiFetch(`/api/coreo/tournaments/${tournamentId}/scores/summary${roundParam}`);
      const d = await r.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [tournamentId, totalBlocks]);

  useEffect(() => { load(viewBlock); }, [load, scoresRefreshTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBlockChange = (n) => {
    setViewBlock(n);
    setCollapsedCats({});
    load(n);
  };

  const thBase = { padding: '8px 10px', color: 'rgba(255,255,255,0.4)', fontWeight: 400, whiteSpace: 'nowrap', borderBottom: '1px solid #1a1a2e', fontSize: '0.75rem' };
  const thRight = { ...thBase, textAlign: 'right' };
  const JUDGE_COLORS = ['#7ecfff', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15'];
  const PODIUM = ['#fbbf24', '#94a3b8', '#cd7f32']; // gold, silver, bronze

  const { criteria = [], judges = [], participants = [] } = data || {};

  // Group by category, sort within category by globalAvg desc
  const categories = [];
  const catMap = {};
  for (const p of participants) {
    const cat = p.category || '—';
    if (!catMap[cat]) { catMap[cat] = []; categories.push(cat); }
    catMap[cat].push(p);
  }
  const grouped = categories.map(cat => ({
    cat,
    participants: [...catMap[cat]].sort((a, b) => {
      if (a.globalAvg == null && b.globalAvg == null) return 0;
      if (a.globalAvg == null) return 1; if (b.globalAvg == null) return -1;
      return b.globalAvg - a.globalAvg;
    }),
  }));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.15em', color: '#7ecfff', fontSize: '1.3rem' }}>
          PUNTUACIONES
          {!loading && data && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', fontFamily: 'inherit' }}> ({participants.length} grupos · {judges.length} jueces)</span>}
        </h2>
        <button onClick={() => load(viewBlock)} style={{ background: 'none', border: '1px solid #333', color: '#888', fontSize: '0.75rem', padding: '5px 12px', borderRadius: '20px', cursor: 'pointer' }}>↻ Actualizar</button>
      </div>

      {/* Block navigator */}
      {totalBlocks > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: '10px 14px', background: 'rgba(126,207,255,0.05)', border: '1px solid rgba(126,207,255,0.18)', borderRadius: '10px' }}>
          <span style={{ color: '#7ecfff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', letterSpacing: '0.2em', flex: 1 }}>
            BLOQUE {viewBlock} <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', fontFamily: 'inherit' }}>de {totalBlocks}</span>
          </span>
          {Array.from({ length: totalBlocks }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => handleBlockChange(n)} style={{
              background: n === viewBlock ? 'rgba(126,207,255,0.18)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${n === viewBlock ? 'rgba(126,207,255,0.5)' : '#2a2a3e'}`,
              color: n === viewBlock ? '#7ecfff' : 'rgba(255,255,255,0.4)',
              borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: n === viewBlock ? 700 : 400,
            }}>
              {n === viewBlock ? `▶ ${n}` : n}
            </button>
          ))}
        </div>
      )}

      {loading && <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingTop: '40px' }}>Cargando...</div>}

      {!loading && !data && null}

      {!loading && data && !criteria.length && (
        <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingTop: '60px' }}>No hay criterios configurados.</div>
      )}

      {!loading && data && criteria.length > 0 && !participants.length && (
        <div style={{ textAlign: 'center', paddingTop: '60px' }}>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '2rem', marginBottom: '12px' }}>—</div>
          <div style={{ color: 'rgba(255,255,255,0.3)' }}>Aún no hay puntuaciones para este bloque.</div>
        </div>
      )}

      {!loading && data && criteria.length > 0 && participants.length > 0 && grouped.map(({ cat, participants: catParts }) => {
        const catComplete = catParts.length > 0 && catParts.every(p => p.allVoted);
        const rankKey = `${viewBlock}:${cat}`;
        const isCollapsed = !!collapsedCats[cat];
        return (
          <div key={cat} style={{ marginBottom: '20px', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Category header — clickable to collapse */}
            <div
              onClick={() => setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{ color: categoryColor(cat), fontSize: '0.72rem', letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase', flex: 1 }}>
                {cat}
                <span style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'inherit', letterSpacing: '0.05em', marginLeft: '8px', fontSize: '0.85em' }}>
                  {catParts.length} participantes
                </span>
              </div>
              {catComplete && !isCollapsed && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (!window.confirm(`¿Enviar el ranking de "${cat}" al staff? Esto mostrará el Top 3 en su panel.`)) return;
                    sendCategoryRanking(viewBlock, cat, catParts);
                  }}
                  disabled={sendingRanking[rankKey]}
                  style={{ background: 'rgba(126,207,255,0.08)', border: '1px solid rgba(126,207,255,0.3)', color: '#7ecfff', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                  {sendingRanking[rankKey] ? '...' : '🏆 Enviar ranking'}
                </button>
              )}
              <span style={{ color: 'rgba(126,207,255,0.4)', fontSize: '0.65rem' }}>{isCollapsed ? '▶' : '▼'}</span>
            </div>

            {!isCollapsed && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#0d0d1a' }}>
                      <th rowSpan={2} style={{ ...thBase, textAlign: 'left', color: 'rgba(255,255,255,0.25)', minWidth: '28px' }}>#</th>
                      <th rowSpan={2} style={{ ...thBase, textAlign: 'left', color: 'rgba(255,255,255,0.4)', minWidth: '120px' }}>Participante</th>
                      {judges.map((j, ji) => (
                        <th key={j.id} colSpan={criteria.length}
                          style={{ ...thBase, textAlign: 'center', color: JUDGE_COLORS[ji % JUDGE_COLORS.length], fontWeight: 600, borderLeft: '1px solid #1a1a2e', fontSize: '0.72rem', letterSpacing: '0.1em' }}>
                          {j.name}
                        </th>
                      ))}
                      <th rowSpan={2} style={{ ...thRight, color: '#7ecfff', fontWeight: 700, borderLeft: '2px solid rgba(126,207,255,0.2)', minWidth: '60px' }}>TOTAL</th>
                    </tr>
                    <tr style={{ background: '#0f0f1a' }}>
                      {judges.map((j) =>
                        criteria.map((c, ci) => (
                          <th key={`${j.id}-${c.id}`} style={{ ...thRight, borderLeft: ci === 0 ? '1px solid #1a1a2e' : undefined, fontSize: '0.7rem' }}>
                            {c.name}
                            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7em', marginLeft: '2px' }}>/{c.max_score}</span>
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {catParts.map((p, idx) => {
                      const total = p.globalAvg;
                      const podiumColor = idx < 3 && total != null ? PODIUM[idx] : null;
                      const rowBg = podiumColor ? `${podiumColor}0d` : idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent';
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #1a1a2e', background: rowBg }}>
                          <td style={{ padding: '10px 10px', color: podiumColor ?? 'rgba(255,255,255,0.25)', fontSize: '0.75rem', fontWeight: podiumColor ? 700 : 400 }}>
                            {podiumColor ? ['🥇','🥈','🥉'][idx] : idx + 1}
                          </td>
                          <td style={{ padding: '10px 10px', color: podiumColor ?? '#fff', fontWeight: podiumColor ? 700 : 500 }}>{p.name}</td>
                          {judges.map((j) =>
                            criteria.map((c, ci) => {
                              const val = p.judgeScores?.[j.id]?.[c.id];
                              return (
                                <td key={`${j.id}-${c.id}`} style={{ padding: '10px 10px', textAlign: 'right', color: val != null ? '#e2e8f0' : 'rgba(255,255,255,0.15)', borderLeft: ci === 0 ? '1px solid #1a1a2e' : undefined }}>
                                  {val != null ? val.toFixed(1) : '—'}
                                </td>
                              );
                            })
                          )}
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, borderLeft: '2px solid rgba(126,207,255,0.1)', color: total != null ? (podiumColor ?? (p.allVoted ? '#7ecfff' : '#ef4444')) : 'rgba(255,255,255,0.15)' }}>
                            {total != null ? total.toFixed(2) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
export default function CoreoAdmin() {
  const { id } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();

  const [tournament, setTournament] = useState(null);
  const [criteria, setCriteria] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [judges, setJudges] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [timing, setTiming] = useState(null);
  const [scoresRefreshTick, setScoresRefreshTick] = useState(0);
  const [tab, setTab] = useState('config');
  const [iframeCollapsed, setIframeCollapsed] = useState(false);
  // Active block — server's current_round is the source of truth; starts at 1 and load() corrects it
  const [activeBlock, setActiveBlock] = useState(1);
  // Ref so load() and socket handlers can always read the latest activeBlock without stale closure
  const activeBlockRef = useRef(1);
  useEffect(() => { activeBlockRef.current = activeBlock; }, [activeBlock]);
  const [toast, setToast] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Staff communication thread — lives here so messages survive tab switches
  const [staffThread, setStaffThread] = useState([]);
  const addToStaffThread = useCallback((entry) => setStaffThread(prev => [...prev, entry]), []);

  // ── Timer state (lives here to survive EN VIVO tab switches) ──
  const [tourTimer, setTourTimer] = useState(null);
  const [blockTimers, setBlockTimers] = useState({});
  const [catTimers, setCatTimers] = useState({});
  const didInitTour = useRef(false);

  // Auto-init tour timer from started_at (once only — survives tab switches via parent state)
  useEffect(() => {
    if (timing?.started_at && !didInitTour.current) {
      didInitTour.current = true;
      const isActive = tournament?.status === 'active' || timing?.status === 'active';
      setTourTimer({ running: isActive, startMs: timing.started_at, pausedMs: 0 });
    }
  }, [timing?.started_at, tournament?.status, timing?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start all timers when a participant begins performing
  useEffect(() => {
    const active = timing?.participants?.find(p => p.on_stage_at);
    if (!active) return;
    const ref = active.on_stage_at;
    const bKey = String(active.round_number || 1);
    const cKey = `${active.round_number || 1}:${active.category || '—'}`;
    setTourTimer(prev => prev?.running ? prev : { running: true, startMs: ref - (prev?.pausedMs ?? 0), pausedMs: 0 });
    setBlockTimers(prev => prev[bKey]?.running ? prev : { ...prev, [bKey]: { running: true, startMs: ref - (prev[bKey]?.pausedMs ?? 0), pausedMs: 0 } });
    setCatTimers(prev => prev[cKey]?.running ? prev : { ...prev, [cKey]: { running: true, startMs: ref - (prev[cKey]?.pausedMs ?? 0), pausedMs: 0 } });
  }, [timing?.participants]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-stop category / block timers when all participants in them have finished
  useEffect(() => {
    if (!timing?.participants?.length) return;
    const snap = Date.now();
    const groups = {};
    for (const p of timing.participants) {
      const r = String(p.round_number || 1);
      const cat = p.category || '—';
      if (!groups[r]) groups[r] = {};
      if (!groups[r][cat]) groups[r][cat] = { done: 0, total: 0, inProgress: false };
      groups[r][cat].total++;
      if (p.on_stage) groups[r][cat].inProgress = true;
      else if (p.on_stage_duration_s > 0) groups[r][cat].done++;
    }
    setCatTimers(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [r, cats] of Object.entries(groups)) {
        for (const [cat, s] of Object.entries(cats)) {
          const cKey = `${r}:${cat}`;
          if (s.total > 0 && s.done === s.total && !s.inProgress && prev[cKey]?.running) {
            next[cKey] = _twPause(prev[cKey], snap);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
    setBlockTimers(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [r, cats] of Object.entries(groups)) {
        const allDone = Object.values(cats).every(s => s.total > 0 && s.done === s.total && !s.inProgress);
        if (allDone && prev[r]?.running) {
          next[r] = _twPause(prev[r], snap);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [timing?.participants]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auth state: could be admin token or organizer code
  const isAdmin = !!sessionStorage.getItem('adminToken');
  const hasOrgCode = !!localStorage.getItem('coreoOrgCode');
  const [needsOrgLogin, setNeedsOrgLogin] = useState(false);

  const load = useCallback(async () => {
    // Server always returns participants for current_round — no client-side filtering needed.
    const res = await apiFetch(`${API}/tournaments/${id}`);
    if (res.status === 401) {
      if (!isAdmin && !hasOrgCode) { setNeedsOrgLogin(true); return; }
      navigate('/admin'); return;
    }
    if (res.status === 404) { setNotFound(true); return; }
    const data = await res.json();
    setTournament(data.tournament);
    setCriteria(data.criteria);
    setJudges(data.judges);
    setOrganizers(data.organizers || []);
    setSpeakers(data.speakers || []);
    setNeedsOrgLogin(false);

    // Sync activeBlock from server's current_round
    const serverRound = data.tournament.current_round || 1;
    if (serverRound !== activeBlockRef.current) {
      activeBlockRef.current = serverRound;
      setActiveBlock(serverRound);
    }
    setParticipants(data.participants);
  }, [id, navigate, isAdmin, hasOrgCode]);

  // loadBlock: called explicitly when switching blocks — updates current_round on server and notifies all clients
  const loadBlock = useCallback(async (n) => {
    const res = await apiFetch(`${API}/tournaments/${id}/advance-round`, {
      method: 'POST',
      body: JSON.stringify({ round: n }),
    });
    if (!res.ok) return;
    const data = await res.json();
    activeBlockRef.current = n;
    setActiveBlock(n);
    setParticipants(data.participants);
  }, [id]);

  const loadTiming = useCallback(async () => {
    const r = await apiFetch(`${API}/tournaments/${id}/timing`);
    if (r.ok) setTiming(await r.json());
  }, [id]);

  useEffect(() => {
    if (!isAdmin && !hasOrgCode) { setNeedsOrgLogin(true); return; }
    load();
    loadTiming();
  }, [load, loadTiming, isAdmin, hasOrgCode]);

  useEffect(() => {
    if (!socket || !id) return;
    let initialConnect = true;
    const join = () => {
      socket.emit('join:admin', Number(id));
      // On reconnection (not the first connect) reload all data to catch missed events
      if (!initialConnect) { load(); loadTiming(); }
      initialConnect = false;
    };
    join();
    socket.on('connect', join);
    socket.on('coreo:criteria-updated', ({ criteria: c }) => setCriteria(c));
    socket.on('coreo:config-updated', ({ coreo_categories, coreo_rounds, block_structure }) =>
      setTournament(prev => prev ? {
        ...prev,
        ...(coreo_categories !== undefined && { coreo_categories }),
        ...(coreo_rounds !== undefined && { coreo_rounds }),
        ...(block_structure !== undefined && { block_structure: JSON.stringify(block_structure) }),
      } : prev)
    );
    socket.on('coreo:participant-added', ({ participant: p }) => setParticipants(prev => [...prev, p]));
    socket.on('coreo:participant-updated', ({ participant: p }) => setParticipants(prev => prev.map(x => x.id === p.id ? p : x)));
    socket.on('coreo:participant-removed', ({ id: pid }) => setParticipants(prev => prev.filter(x => x.id !== pid)));
    socket.on('coreo:order-updated', ({ order }) => {
      // Update act_order in-place — do NOT call load() to avoid full reload/filtering side-effects.
      if (Array.isArray(order)) {
        setParticipants(prev => prev.map(p => {
          const entry = order.find(o => o.id === p.id);
          return entry ? { ...p, act_order: entry.act_order } : p;
        }));
      }
    });
    socket.on('coreo:judge-added', ({ judge }) => setJudges(prev => [...prev, judge]));
    socket.on('coreo:judge-removed', ({ id: jid }) => setJudges(prev => prev.filter(j => j.id !== jid)));
    socket.on('coreo:organizer-added', ({ organizer }) => setOrganizers(prev => [...prev, organizer]));
    socket.on('coreo:organizer-removed', ({ id: oid }) => setOrganizers(prev => prev.filter(o => o.id !== oid)));
    socket.on('coreo:speaker-added', ({ speaker }) => setSpeakers(prev => [...prev, speaker]));
    socket.on('coreo:speaker-removed', ({ id: sid }) => setSpeakers(prev => prev.filter(s => s.id !== sid)));
    socket.on('coreo:on-stage', ({ participant }) => setParticipants(prev => prev.map(p =>
      p.id === participant.id
        ? { ...p, on_stage: 1, on_stage_at: null, on_stage_duration_s: 0 }
        : { ...p, on_stage: 0 }
    )));
    socket.on('coreo:off-stage', () => setParticipants(prev => prev.map(p => ({ ...p, on_stage: 0, on_stage_at: null }))));
    socket.on('coreo:timer-started', ({ participantId, on_stage_at }) => setParticipants(prev => prev.map(p =>
      p.id === participantId ? { ...p, on_stage_at } : p
    )));
    socket.on('coreo:timer-stopped', ({ participantId, on_stage_duration_s }) => setParticipants(prev => prev.map(p =>
      p.id === participantId ? { ...p, on_stage_at: null, on_stage_duration_s } : p
    )));
    socket.on('coreo:poster-updated', ({ poster_path }) => setTournament(prev => prev ? { ...prev, poster_path } : prev));
    socket.on('coreo:timing-updated', setTiming);
    socket.on('coreo:scores-updated', () => setScoresRefreshTick(t => t + 1));
    socket.on('coreo:staff-msg', (msg) => addToStaffThread({ dir: 'in', ...msg }));
    socket.on('coreo:restarted', () => { load(); loadTiming(); });
    socket.on('coreo:round-changed', ({ round, participants: newParts }) => {
      // Only update if this round-change came from another session (not ourselves — we already updated in loadBlock)
      if (round !== activeBlockRef.current) {
        activeBlockRef.current = round;
        setActiveBlock(round);
        setParticipants(newParts);
      }
    });
    return () => {
      socket.off('connect', join);
      ['coreo:criteria-updated', 'coreo:config-updated', 'coreo:participant-added',
        'coreo:participant-updated', 'coreo:participant-removed', 'coreo:order-updated',
        'coreo:judge-added', 'coreo:judge-removed', 'coreo:organizer-added',
        'coreo:organizer-removed', 'coreo:speaker-added', 'coreo:speaker-removed',
        'coreo:on-stage', 'coreo:off-stage', 'coreo:timer-started', 'coreo:timer-stopped',
        'coreo:poster-updated', 'coreo:timing-updated', 'coreo:scores-updated', 'coreo:staff-msg',
        'coreo:restarted', 'coreo:round-changed'].forEach(e => socket.off(e));
    };
  }, [socket, id, load, loadTiming, addToStaffThread]);

  if (needsOrgLogin) {
    return <OrganizerLogin onLogin={(org) => {
      // After organizer login, reload the panel for their tournament
      if (String(org.tournament_id) !== String(id)) {
        navigate(`/coreo-admin/${org.tournament_id}`);
      } else {
        load();
      }
    }} />;
  }

  if (notFound) return <div style={{ minHeight: '100vh', background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Torneo no encontrado</div>;
  if (!tournament) return <div style={{ minHeight: '100vh', background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Cargando...</div>;

  // Organizers only see Live tab (they manage the event, not setup)
  const parsedCategories = (() => { try { return JSON.parse(tournament.coreo_categories || '[]'); } catch { return []; } })();
  const roundsCount = tournament.coreo_rounds || 1;

  const configOk = criteria.length > 0 && parsedCategories.length > 0 && judges.length > 0;
  const participantesOk = participants.length > 0;
  const ordenOk = participantesOk && participants.some(p => p.act_order != null);

  const tabDot = (ok) => (
    <span style={{
      display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
      background: ok ? '#34d399' : '#fb923c', marginLeft: '7px', verticalAlign: 'middle', flexShrink: 0,
    }} />
  );

  const TABS = isAdmin
    ? [
        { key: 'config', label: <span>Configuración{tabDot(configOk)}</span> },
        { key: 'participantes', label: <span>Participantes{tabDot(participantesOk)}</span> },
        ...(tournament.status === 'setup' ? [{ key: 'orden', label: <span>Orden{tabDot(ordenOk)}</span> }] : []),
        { key: 'puntuaciones', label: 'Puntuaciones' },
        { key: 'en-vivo', label: '▶ En escena', accent: true },
      ]
    : [{ key: 'en-vivo', label: '▶ En escena', accent: true }];

  const activeTab = TABS.find(t => t.key === tab) ? tab : TABS[0].key;

  const handleLogout = () => {
    if (isAdmin) {
      sessionStorage.removeItem('adminToken');
      navigate('/admin');
    } else {
      localStorage.removeItem('coreoOrgCode');
      setNeedsOrgLogin(true);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a12', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid #1a1a2e', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.25em', color: '#7ecfff' }}>ZEN.TAISEN</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '12px', fontSize: '0.85rem' }}>{tournament.name}</span>
          <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#7ecfff', border: '1px solid rgba(126,207,255,0.3)', borderRadius: '4px', padding: '2px 8px', letterSpacing: '0.1em' }}>COREO</span>
          {tournament.status === 'setup' && (
            <span style={{ marginLeft: '4px', fontSize: '0.65rem', color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)', borderRadius: '4px', padding: '2px 8px', letterSpacing: '0.1em' }}>PREPARACIÓN</span>
          )}
          {tournament.status === 'active' && (
            <span style={{ marginLeft: '4px', fontSize: '0.65rem', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '4px', padding: '2px 8px', letterSpacing: '0.1em' }}>ACTIVO</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {!isAdmin && localStorage.getItem('coreoOrgName') && (
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', marginRight: '4px' }}>{localStorage.getItem('coreoOrgName')}</span>
          )}
          <button onClick={() => window.open(`/coreo-screen/${id}`, '_blank')} className="btn-secondary" style={{ fontSize: '0.8rem' }}>Ver pantalla</button>
          {isAdmin && tournament.status === 'active' && (
            <button
              onClick={async () => {
                if (!window.confirm('¿Finalizar el torneo? Esta acción no se puede deshacer.')) return;
                const res = await apiFetch(`${API}/tournaments/${id}/finish`, { method: 'POST' });
                if (res.ok) {
                  setTournament(prev => ({ ...prev, status: 'finished' }));
                }
              }}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontSize: '0.78rem', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer' }}
            >
              Finalizar torneo
            </button>
          )}
          {isAdmin && tournament.status === 'finished' && (
            <button
              onClick={async () => {
                if (!window.confirm('¿Reiniciar el torneo? Se borrarán todas las puntuaciones y datos de escena.')) return;
                const r = await apiFetch(`${API}/tournaments/${id}/restart`, { method: 'POST' });
                if (r.ok) { await load(); await loadTiming(); }
              }}
              style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.4)', color: '#fb923c', fontSize: '0.78rem', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer' }}
            >
              ↺ Reiniciar torneo
            </button>
          )}
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #333', color: '#666', fontSize: '0.78rem', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer' }}>
            {isAdmin ? '← Torneos' : 'Salir'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: '#0f0f1a', borderBottom: '1px solid #1a1a2e', display: 'flex', gap: '2px', padding: '0 24px', alignItems: 'center' }}>
        {TABS.map(t => {
          const isActive = activeTab === t.key;
          const color = t.accent ? '#fb923c' : '#7ecfff';
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              background: isActive && t.accent ? 'rgba(251,146,60,0.08)' : 'none',
              border: 'none', cursor: 'pointer',
              padding: '14px 18px', fontSize: '0.82rem', letterSpacing: '0.08em',
              display: 'inline-flex', alignItems: 'center',
              color: isActive ? color : t.accent ? 'rgba(251,146,60,0.5)' : 'rgba(255,255,255,0.4)',
              borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
              transition: 'all 0.15s',
            }}>
              {t.label}
            </button>
          );
        })}
        {activeTab === 'en-vivo' && (
          <button
            onClick={() => setIframeCollapsed(c => !c)}
            title={iframeCollapsed ? 'Mostrar pantalla pública' : 'Ocultar pantalla pública'}
            style={{
              marginLeft: 'auto', background: 'none',
              border: '1px solid rgba(126,207,255,0.2)', color: 'rgba(126,207,255,0.5)',
              borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
              fontSize: '0.72rem', letterSpacing: '0.08em',
            }}
          >
            {iframeCollapsed ? '◀ Pantalla' : 'Pantalla ▶'}
          </button>
        )}
      </div>

      {/* Puntuaciones tab: full-width outside the narrow container */}
      {activeTab === 'puntuaciones' && (
        <div style={{ padding: '28px 32px' }}>
          <ScoresTab tournamentId={Number(id)} scoresRefreshTick={scoresRefreshTick} activeBlock={activeBlock} totalBlocks={roundsCount} />
        </div>
      )}

      {/* Config tab: also full-width outside the narrow container */}
      {activeTab === 'config' && (
        <div style={{ padding: '28px 48px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          {isAdmin && tournament.status === 'setup' && (
            <SetupChecklist
              criteria={criteria}
              blockStructure={tournament?.block_structure}
              participants={participants}
              judges={judges}
              onNavigate={setTab}
            />
          )}
          <ConfigTab
            tournamentId={Number(id)}
            criteria={criteria}
            onUpdateCriteria={setCriteria}
            tournament={tournament}
            onUpdateTournament={updates => setTournament(prev => ({ ...prev, ...updates }))}
            judges={judges}
            organizers={organizers}
            speakers={speakers}
            onUpdateJudges={setJudges}
            onUpdateOrganizers={setOrganizers}
            onUpdateSpeakers={setSpeakers}
            isAdmin={isAdmin}
          />
        </div>
      )}

      {/* En-vivo tab: full-height two-column layout, outside the narrow container */}
      {activeTab === 'en-vivo' && (
        <LiveTab
          tournamentId={Number(id)}
          participants={participants}
          onUpdate={setParticipants}
          timing={timing}
          tournamentStatus={tournament.status}
          staffThread={staffThread}
          onStaffAdd={addToStaffThread}
          scoresRefreshTick={scoresRefreshTick}
          activeBlock={activeBlock}
          loadBlock={loadBlock}
          totalBlocks={roundsCount}
          tourTimer={tourTimer}
          setTourTimer={setTourTimer}
          blockTimers={blockTimers}
          setBlockTimers={setBlockTimers}
          iframeCollapsed={iframeCollapsed}
          setIframeCollapsed={setIframeCollapsed}
        />
      )}

      {/* Content */}
      <div className="container" style={{ maxWidth: '960px', paddingTop: '28px', display: (activeTab === 'puntuaciones' || activeTab === 'config' || activeTab === 'en-vivo') ? 'none' : undefined }}>
        {isAdmin && tournament.status === 'setup' && activeTab !== 'en-vivo' && activeTab !== 'puntuaciones' && (
          <SetupChecklist
            criteria={criteria}
            blockStructure={tournament?.block_structure}
            participants={participants}
            judges={judges}
            onNavigate={setTab}
          />
        )}
        {activeTab === 'participantes' && (
          <ParticipantsTab
            tournamentId={Number(id)}
            participants={participants}
            onUpdate={setParticipants}
            categories={parsedCategories}
            roundsCount={roundsCount}
            activeBlock={activeBlock}
            onBlockChange={loadBlock}
            totalBlocks={roundsCount}
            blockStructure={tournament?.block_structure}
            onBlockStructureSave={(structure, cats, newRoundsCount) => {
              setTournament(prev => prev ? {
                ...prev,
                block_structure: JSON.stringify(structure),
                ...(cats !== undefined && { coreo_categories: JSON.stringify(cats) }),
                ...(newRoundsCount !== undefined && { coreo_rounds: newRoundsCount }),
              } : prev);
            }}
          />
        )}
        {activeTab === 'orden' && <OrderTab tournamentId={Number(id)} participants={participants} onUpdate={setParticipants} activeBlock={activeBlock} />}
      </div>

      <Toast msg={toast?.msg} type={toast?.type} />
    </div>
  );
}
