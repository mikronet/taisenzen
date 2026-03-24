import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { QRCodeSVG } from 'qrcode.react';

const API = '/api/coreo';

function apiFetch(url, options = {}) {
  const token = sessionStorage.getItem('adminToken') || '';
  const orgCode = sessionStorage.getItem('coreoOrgCode') || '';
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
  const orgCode = sessionStorage.getItem('coreoOrgCode') || '';
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
function SetupChecklist({ criteria, categories, participants, judges, onNavigate }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('coreoChecklistCollapsed') === '1');

  const toggle = () => setCollapsed(v => {
    localStorage.setItem('coreoChecklistCollapsed', v ? '0' : '1');
    return !v;
  });

  const steps = [
    {
      label: 'Define los bloques y categorías',
      hint: '¿Cuántas partes tiene el evento y qué estilos van a competir?',
      done: categories.length > 0,
      tab: 'config',
    },
    {
      label: 'Configura los criterios de puntuación',
      hint: '¿Qué van a valorar los jueces? Técnica, Expresión...',
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
      label: 'Añade los participantes',
      hint: 'Grupos, solos o parejas que van a actuar.',
      done: participants.length > 0,
      tab: 'participantes',
    },
    {
      label: 'Define el orden de actuación',
      hint: 'Ajusta el orden en que saldrán al escenario.',
      done: participants.length > 0 && participants.some(p => p.act_order != null),
      tab: 'orden',
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div style={{ marginBottom: '28px', borderRadius: '10px', border: `1px solid ${allDone ? 'rgba(52,211,153,0.25)' : 'rgba(126,207,255,0.15)'}`, overflow: 'hidden' }}>
      {/* Header */}
      <div
        onClick={toggle}
        style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer', background: allDone ? 'rgba(52,211,153,0.06)' : 'rgba(126,207,255,0.04)', userSelect: 'none' }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: collapsed ? 0 : '8px' }}>
            <span style={{ color: allDone ? '#34d399' : '#7ecfff', fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.1em' }}>
              {allDone ? '✓ TODO LISTO PARA EMPEZAR' : `PREPARACIÓN DEL EVENTO — ${doneCount} de ${steps.length} pasos completados`}
            </span>
          </div>
          {!collapsed && (
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: allDone ? '#34d399' : '#7ecfff', borderRadius: '2px', transition: 'width 0.4s ease' }} />
            </div>
          )}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>{collapsed ? 'Ver pasos ↓' : 'Ocultar ↑'}</span>
      </div>

      {/* Steps */}
      {!collapsed && (
        <div style={{ padding: '4px 0 10px' }}>
          {steps.map((s, i) => (
            <div
              key={i}
              onClick={() => !s.done && onNavigate(s.tab)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '14px',
                padding: '10px 18px', cursor: s.done ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!s.done) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: s.done ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${s.done ? '#34d399' : 'rgba(255,255,255,0.15)'}`,
                fontSize: '0.7rem', fontWeight: 700,
                color: s.done ? '#34d399' : 'rgba(255,255,255,0.3)',
              }}>
                {s.done ? '✓' : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: s.done ? 400 : 600, color: s.done ? 'rgba(255,255,255,0.35)' : '#fff', textDecoration: s.done ? 'line-through' : 'none' }}>
                  {s.label}
                </div>
                {!s.done && <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{s.hint}</div>}
              </div>
              {!s.done && <span style={{ color: '#7ecfff', fontSize: '0.72rem', alignSelf: 'center', flexShrink: 0 }}>Ir →</span>}
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
  const selfOrgCode = sessionStorage.getItem('coreoOrgCode');
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

  // ── Config dirty/saved state ──
  const [configDirty, setConfigDirty] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const markConfigDirty = () => { setConfigDirty(true); setConfigSaved(false); };

  // ── Categories ──
  const parsedCats = (() => { try { return JSON.parse(tournament.coreo_categories || '[]'); } catch { return []; } })();
  const [catList, setCatList] = useState(parsedCats);
  const [newCat, setNewCat] = useState('');

  useEffect(() => {
    try { setCatList(JSON.parse(tournament.coreo_categories || '[]')); } catch { setCatList([]); }
  }, [tournament.coreo_categories]);

  const addCategory = (e) => {
    e.preventDefault();
    const v = newCat.trim();
    if (!v || catList.includes(v)) return;
    setCatList(prev => [...prev, v]);
    setNewCat('');
    markConfigDirty();
  };
  const removeCategory = (idx) => { setCatList(prev => prev.filter((_, i) => i !== idx)); markConfigDirty(); };
  const moveCategoryItem = (idx, dir) => {
    const next = [...catList];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setCatList(next);
    markConfigDirty();
  };

  // ── Rounds ──
  const [rounds, setRounds] = useState(tournament.coreo_rounds || 1);
  useEffect(() => { setRounds(tournament.coreo_rounds || 1); }, [tournament.coreo_rounds]);

  // ── Save config ──
  const [savingConfig, setSavingConfig] = useState(false);
  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await apiFetch(`${API}/tournaments/${tournamentId}/config`, {
        method: 'PUT', body: JSON.stringify({ categories: catList, rounds }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onUpdateTournament({ coreo_categories: data.coreo_categories, coreo_rounds: data.coreo_rounds });
      setConfigDirty(false); setConfigSaved(true);
    } finally { setSavingConfig(false); }
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
      <div>
        {/* Rounds */}
        <h3 style={{ color: '#7ecfff', marginBottom: '6px', letterSpacing: '0.1em', fontSize: '0.9rem' }}>NÚMERO DE BLOQUES</h3>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginBottom: '16px' }}>Los participantes se asignan a una bloque. El orden de actuación se agrupa: Bloque → Categoría → Participante.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="number" min={1} max={20}
            value={rounds}
            onChange={e => { setRounds(Math.max(1, Number(e.target.value) || 1)); markConfigDirty(); }}
            style={{ width: '80px' }}
          />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
            {rounds === 1 ? '1 bloque' : `${rounds} bloques`}
          </span>
        </div>

        {SECTION_DIVIDER}

        {/* Categories */}
        <h3 style={{ color: '#7ecfff', marginBottom: '6px', letterSpacing: '0.1em', fontSize: '0.9rem' }}>CATEGORÍAS</h3>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginBottom: '16px' }}>Crea las categorías de este evento. El orden aquí determina el orden en los desplegables.</p>
        <form onSubmit={addCategory} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            placeholder="Nueva categoría (ej: Solo, Parejas, Grupo...)"
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn-secondary">+ Añadir</button>
        </form>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          {catList.length === 0 && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem' }}>Sin categorías definidas.</p>}
          {catList.map((cat, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 12px' }}>
              <span style={{ flex: 1, color: categoryColor(cat), fontWeight: 600 }}>{cat}</span>
              <button onClick={() => moveCategoryItem(i, -1)} disabled={i === 0} style={{ background: 'none', border: '1px solid #333', color: i === 0 ? '#2a2a2a' : '#888', borderRadius: '4px', padding: '2px 7px', cursor: i === 0 ? 'default' : 'pointer', fontSize: '0.8rem' }}>↑</button>
              <button onClick={() => moveCategoryItem(i, 1)} disabled={i === catList.length - 1} style={{ background: 'none', border: '1px solid #333', color: i === catList.length - 1 ? '#2a2a2a' : '#888', borderRadius: '4px', padding: '2px 7px', cursor: i === catList.length - 1 ? 'default' : 'pointer', fontSize: '0.8rem' }}>↓</button>
              <button onClick={() => removeCategory(i)} style={{ background: 'none', border: '1px solid #333', color: '#888', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={saveConfig} className="btn-primary" disabled={savingConfig}>
            {savingConfig ? 'Guardando...' : 'Guardar categorías y bloques'}
          </button>
          <SaveStatus dirty={configDirty} saved={configSaved} savedMsg="Categorías y bloques guardados" />
        </div>

        {SECTION_DIVIDER}

        {/* Criteria */}
        <h3 style={{ color: '#7ecfff', marginBottom: '6px', letterSpacing: '0.1em', fontSize: '0.9rem' }}>CRITERIOS DE PUNTUACIÓN</h3>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginBottom: '16px' }}>Define los criterios con los que los jueces puntuarán cada actuación.</p>
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

        {SECTION_DIVIDER}

        {/* Poster */}
        <h3 style={{ color: '#7ecfff', marginBottom: '6px', letterSpacing: '0.1em', fontSize: '0.9rem' }}>CARTEL DEL TORNEO</h3>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginBottom: '16px' }}>Imagen que aparece de fondo en la pantalla pública.</p>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '8px' }}>
          {tournament.poster_path ? (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={`/uploads/${tournament.poster_path}`}
                alt="Cartel"
                style={{ width: '120px', height: '160px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #2a2a3e', display: 'block' }}
              />
              <button
                onClick={deletePoster}
                style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', border: '1px solid #444', color: '#888', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', fontSize: '0.75rem' }}
              >✕</button>
            </div>
          ) : (
            <div
              onClick={() => posterRef.current.click()}
              style={{ width: '120px', height: '160px', borderRadius: '8px', border: '2px dashed #333', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', flexShrink: 0 }}
            >
              <span style={{ color: '#444', fontSize: '1.5rem' }}>🖼</span>
              <span style={{ color: '#555', fontSize: '0.7rem', textAlign: 'center', lineHeight: 1.4 }}>Sin cartel</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
            <button className="btn-secondary" style={{ fontSize: '0.8rem' }} disabled={posterUploading} onClick={() => posterRef.current.click()}>
              {posterUploading ? 'Subiendo...' : tournament.poster_path ? 'Cambiar cartel' : 'Subir cartel'}
            </button>
            <input type="file" ref={posterRef} accept="image/*" onChange={handlePosterChange} style={{ display: 'none' }} />
          </div>
        </div>
      </div>

      {/* ── Right column: judges + organizers ── */}
      <div>
        {/* Judges */}
        <h3 style={{ color: '#7ecfff', marginBottom: '12px', letterSpacing: '0.1em', fontSize: '0.9rem' }}>JUECES</h3>
        {isAdmin && (
          <form onSubmit={addJudge} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input placeholder="Nombre del juez" value={newJudge} onChange={e => setNewJudge(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn-primary">Crear</button>
          </form>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {judges.map(j => (
            <div key={j.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{j.name}</div>
                <div style={{ color: '#7ecfff', fontSize: '0.78rem', fontFamily: 'monospace', marginTop: '3px' }}>{j.access_code}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button onClick={() => setQrModal({ url: `${window.location.origin}/coreo-judge?code=${j.access_code}`, label: `JURADO · ${j.name}` })} style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.78rem', color: '#7ecfff' }}>QR</button>
                <button onClick={() => window.open(`${window.location.origin}/coreo-judge?code=${j.access_code}`, '_blank')} style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.78rem', color: '#7ecfff' }}>🔗</button>
                {isAdmin && <button className="btn-danger" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => removeJudge(j.id)}>Eliminar</button>}
              </div>
            </div>
          ))}
          {judges.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', padding: '10px 0' }}>Sin jueces.</p>}
        </div>
        <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(126,207,255,0.04)', borderRadius: '8px', border: '1px solid rgba(126,207,255,0.1)' }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', margin: 0 }}>Acceso en <strong style={{ color: '#7ecfff' }}>/coreo-judge</strong></p>
        </div>

        {isAdmin && (<>
          {SECTION_DIVIDER}

          {/* Organizers */}
          <h3 style={{ color: '#7ecfff', marginBottom: '12px', letterSpacing: '0.1em', fontSize: '0.9rem' }}>ORGANIZADORES</h3>
          <form onSubmit={addOrganizer} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input placeholder="Nombre del organizador" value={newOrganizer} onChange={e => setNewOrganizer(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn-primary">Crear</button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {organizers.map(o => (
              <div key={o.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{o.name}</div>
                  <div style={{ color: '#a78bfa', fontSize: '0.78rem', fontFamily: 'monospace', marginTop: '3px' }}>{o.access_code}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button onClick={() => setQrModal({ url: `${window.location.origin}/coreo-organizer?code=${o.access_code}`, label: `ORGANIZADOR · ${o.name}` })} style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.78rem', color: '#a78bfa' }}>QR</button>
                  <button onClick={() => window.open(`${window.location.origin}/coreo-organizer?code=${o.access_code}`, '_blank')} style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.78rem', color: '#a78bfa' }}>🔗</button>
                  {o.access_code !== selfOrgCode && <button className="btn-danger" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => removeOrganizer(o.id)}>Eliminar</button>}
                </div>
              </div>
            ))}
            {organizers.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', padding: '10px 0' }}>Sin organizadores.</p>}
          </div>
          <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(167,139,250,0.04)', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.1)' }}>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', margin: 0 }}>El organizador accede en <strong style={{ color: '#a78bfa' }}>/coreo-organizer</strong> con su código</p>
          </div>

          {SECTION_DIVIDER}

          {/* Staff */}
          <h3 style={{ color: '#fb923c', marginBottom: '12px', letterSpacing: '0.1em', fontSize: '0.9rem' }}>STAFF</h3>
          <form onSubmit={addSpeaker} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input placeholder="Nombre del miembro de staff" value={newSpeaker} onChange={e => setNewSpeaker(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg,#fb923c,#ea580c)', border: 'none' }}>Crear</button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(speakers || []).map(s => (
              <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{s.name}</div>
                  <div style={{ color: '#fb923c', fontSize: '0.78rem', fontFamily: 'monospace', marginTop: '3px' }}>{s.access_code}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button onClick={() => setQrModal({ url: `${window.location.origin}/coreo-speaker?code=${s.access_code}`, label: `STAFF · ${s.name}` })} style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.78rem', color: '#fb923c' }}>QR</button>
                  <button onClick={() => window.open(`${window.location.origin}/coreo-speaker?code=${s.access_code}`, '_blank')} style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.78rem', color: '#fb923c' }}>🔗</button>
                  <button className="btn-danger" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => removeSpeaker(s.id)}>Eliminar</button>
                </div>
              </div>
            ))}
            {!(speakers || []).length && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', padding: '10px 0' }}>Sin staff.</p>}
          </div>
          <div style={{ marginTop: '10px', padding: '10px 14px', background: 'rgba(251,146,60,0.04)', borderRadius: '8px', border: '1px solid rgba(251,146,60,0.1)' }}>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', margin: 0 }}>El staff accede en <strong style={{ color: '#fb923c' }}>/coreo-speaker</strong> con su código</p>
          </div>
        </>)}
      </div>
    </div>
    </>
  );
}

// ── Participant form ───────────────────────────────────────────────────────────
function ParticipantForm({ initial, onSave, onCancel, tournamentId, categories, roundsCount }) {
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [roundNumber, setRoundNumber] = useState(initial?.round_number || 1);
  const [academia, setAcademia] = useState(initial?.academia || '');
  const [localidad, setLocalidad] = useState(initial?.localidad || '');
  const [coreografo, setCoreografo] = useState(initial?.coreografo || '');
  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(initial?.photo_path ? `/uploads/${initial.photo_path}` : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre del grupo es obligatorio'); return; }
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('category', category);
      fd.append('round_number', roundNumber);
      fd.append('academia', academia.trim());
      fd.append('localidad', localidad.trim());
      fd.append('coreografo', coreografo.trim());
      if (photoFile) fd.append('photo', photoFile);

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

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Row 1: photo + name + category + round */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <div
          onClick={() => fileRef.current.click()}
          style={{ width: '90px', height: '90px', borderRadius: '10px', border: '2px dashed #333', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', flexShrink: 0 }}
        >
          {preview
            ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#444', fontSize: '0.68rem', textAlign: 'center', padding: '8px', lineHeight: 1.4 }}>Foto<br/>(jueces)</span>
          }
          <input type="file" ref={fileRef} accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
        </div>
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input placeholder="Nombre del grupo *" value={name} onChange={e => setName(e.target.value)} />
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

// ── PARTICIPANTS tab ──────────────────────────────────────────────────────────
function ParticipantsTab({ tournamentId, participants, onUpdate, categories, roundsCount }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const handleSave = (p) => {
    if (editing) {
      onUpdate(participants.map(x => x.id === p.id ? p : x));
      setEditing(null);
    } else {
      onUpdate([...participants, p]);
      setShowForm(false);
    }
  };

  const remove = async (p) => {
    if (!confirm(`¿Eliminar a "${p.name}"? Se borrará también su foto.`)) return;
    await apiFetch(`${API}/participants/${p.id}`, { method: 'DELETE' });
    onUpdate(participants.filter(x => x.id !== p.id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ color: '#7ecfff', letterSpacing: '0.1em', fontSize: '0.9rem', margin: 0 }}>PARTICIPANTES ({participants.length})</h3>
        {!showForm && !editing && <button className="btn-primary" onClick={() => setShowForm(true)}>+ Añadir</button>}
      </div>

      {showForm && !editing && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <ParticipantForm tournamentId={tournamentId} categories={categories} roundsCount={roundsCount} onSave={handleSave} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {participants.map(p => (
          <div key={p.id}>
            {editing?.id === p.id ? (
              <div className="card">
                <ParticipantForm initial={p} tournamentId={tournamentId} categories={categories} roundsCount={roundsCount} onSave={handleSave} onCancel={() => setEditing(null)} />
              </div>
            ) : (
              <div className="card" style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                {p.photo_path
                  ? <img src={`/uploads/${p.photo_path}`} alt={p.name} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                  : <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '0.65rem', flexShrink: 0 }}>Sin foto</div>
                }
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '3px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ color: '#7ecfff', fontSize: '0.65rem', letterSpacing: '0.08em' }}>Bloque {p.round_number || 1}</span>
                    {p.category && <span style={{ color: categoryColor(p.category), fontSize: '0.7rem', letterSpacing: '0.1em', fontWeight: 700 }}>{p.category}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '3px', flexWrap: 'wrap' }}>
                    {p.academia && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>{p.academia}</span>}
                    {p.localidad && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem' }}>{p.localidad}</span>}
                    {p.coreografo && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem' }}>Cor: {p.coreografo}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => setEditing(p)}>Editar</button>
                  <button className="btn-danger" style={{ fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => remove(p)}>Eliminar</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {participants.length === 0 && !showForm && (
          <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px' }}>No hay participantes. Añade el primero.</p>
        )}
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
function OrderTab({ tournamentId, participants, onUpdate }) {
  const [hierarchy, setHierarchy] = useState(() => buildHierarchy(participants));
  const [saving, setSaving] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [orderSaved, setOrderSaved] = useState(false);

  useEffect(() => {
    setHierarchy(buildHierarchy(participants));
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

  // Running counter across the whole flattened list
  let counter = 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ color: '#7ecfff', letterSpacing: '0.1em', fontSize: '0.9rem', margin: 0 }}>ORDEN DE ACTUACIÓN</h3>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', marginTop: '4px' }}>
            Reordena edades, categorías y participantes con las flechas. Guarda cuando termines.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar orden'}
          </button>
          <SaveStatus dirty={orderDirty} saved={orderSaved} savedMsg="Orden guardado" />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {hierarchy.map((rnd, ri) => (
          <div key={rnd.round_number} style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(126,207,255,0.15)' }}>
            {/* Round header */}
            <div style={{
              background: 'rgba(126,207,255,0.07)',
              padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <MoveButtons
                onUp={() => moveRound(ri, -1)} disableUp={ri === 0}
                onDown={() => moveRound(ri, 1)} disableDown={ri === hierarchy.length - 1}
              />
              <div style={{ flex: 1 }}>
                <span style={{ color: '#7ecfff', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.15em', fontFamily: "'Bebas Neue', sans-serif" }}>
                  BLOQUE {rnd.round_number}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', marginLeft: '10px' }}>
                  {rnd.categories.reduce((n, c) => n + c.participants.length, 0)} participantes
                </span>
              </div>
            </div>

            {/* Categories within this round */}
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rnd.categories.map((cat, ci) => (
                <div key={cat.category} style={{ borderRadius: '8px', border: `1px solid ${categoryColor(cat.category)}30`, overflow: 'hidden' }}>
                  {/* Category header */}
                  <div style={{
                    background: `${categoryColor(cat.category)}12`,
                    padding: '8px 14px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <MoveButtons
                      onUp={() => moveCat(ri, ci, -1)} disableUp={ci === 0}
                      onDown={() => moveCat(ri, ci, 1)} disableDown={ci === rnd.categories.length - 1}
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
                            ? <img src={`/uploads/${p.photo_path}`} alt="" style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '5px', flexShrink: 0 }} />
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
        ))}
      </div>
    </div>
  );
}

// ── Staff chat panel ──────────────────────────────────────────────────────────
function SpeakerMsgPanel({ tournamentId }) {
  const socket = useSocket();
  const [thread, setThread] = useState([]); // { dir: 'out'|'in', from, text, type, ranking, sentAt }
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingRanking, setSendingRanking] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => setThread(prev => [...prev, { dir: 'in', ...msg }]);
    socket.on('coreo:staff-msg', handler);
    return () => socket.off('coreo:staff-msg', handler);
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  const pushOut = (entry) => setThread(prev => [...prev, { dir: 'out', sentAt: Date.now(), ...entry }]);

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

  const handleSendRanking = async () => {
    setSendingRanking(true);
    try {
      const r = await apiFetch(`${API}/tournaments/${tournamentId}/scores/summary`);
      const { criteria, participants } = await r.json();
      const getTotal = (p) => {
        const vals = criteria.map(c => p.criterionScores[c.id]).filter(v => v != null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };
      const roundMap = {}; const roundOrder = [];
      for (const p of participants) {
        const round = p.round_number || 1; const cat = p.category || '—';
        if (!roundMap[round]) { roundMap[round] = {}; roundOrder.push(round); }
        if (!roundMap[round][cat]) roundMap[round][cat] = [];
        roundMap[round][cat].push(p);
      }
      const ranking = roundOrder.map(round => ({
        round,
        categories: Object.keys(roundMap[round]).map(category => ({
          category,
          top3: [...roundMap[round][category]]
            .sort((a, b) => { const ta = getTotal(a); const tb = getTotal(b); if (ta == null) return 1; if (tb == null) return -1; return tb - ta; })
            .slice(0, 3).map(p => ({ name: p.name, total: getTotal(p) })),
        })),
      }));
      await sendToStaff('ranking', { ranking });
    } finally { setSendingRanking(false); }
  };

  return (
    <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #1a1a2e' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ color: '#fb923c', letterSpacing: '0.15em', fontSize: '0.85rem', margin: 0 }}>COMUNICACIÓN CON STAFF</h3>
        <button
          onClick={handleSendRanking} disabled={sendingRanking}
          style={{ background: 'rgba(126,207,255,0.08)', border: '1px solid rgba(126,207,255,0.3)', color: '#7ecfff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
        >
          {sendingRanking ? '...' : '🏆 Enviar ranking Top 3'}
        </button>
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
                <span style={{ color: '#7ecfff', fontSize: '0.8rem', fontWeight: 600 }}>🏆 Ranking Top 3 enviado</span>
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
  if (!startedAt) return '00:00:00';
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
function TimingWidget({ timing, tournamentStatus }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (tournamentStatus !== 'active') return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [tournamentStatus]);

  if (!timing?.started_at) return null;

  const { blocks, blockTotals, globalAvg } = computeTiming(timing.participants, now);
  const roundOrder = Object.keys(blocks).map(Number).sort((a, b) => a - b);

  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
      {/* Cronómetro total */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem', letterSpacing: '0.15em' }}>⏱ TORNEO</span>
          <span style={{ color: '#7ecfff', fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.05em' }}>
            {fmtElapsed(timing.started_at, tournamentStatus === 'active' ? now : timing.started_at + (timing.finished_duration_s ?? 0) * 1000)}
          </span>
        </div>
        {globalAvg != null && (
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem' }}>
            media/actuación: <span style={{ color: 'rgba(255,255,255,0.5)' }}>{fmtDuration(globalAvg)}</span>
          </span>
        )}
      </div>

      {/* Por bloque */}
      {roundOrder.map(round => {
        const bt = blockTotals[round];
        const cats = blocks[round];
        const catEntries = Object.entries(cats);
        return (
          <div key={round} style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span style={{ color: '#7ecfff', fontSize: '0.68rem', letterSpacing: '0.15em', fontWeight: 700 }}>BLOQUE {round}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{bt.done}/{bt.total} actuados</span>
              {bt.remaining != null && bt.remaining > 1 && (
                <span style={{ color: '#fb923c', fontSize: '0.72rem' }}>est. restante: {fmtDuration(bt.remaining)}</span>
              )}
              {bt.remaining != null && bt.remaining <= 1 && bt.total > 0 && (
                <span style={{ color: '#34d399', fontSize: '0.72rem' }}>✓ completado</span>
              )}
            </div>
            {/* Por categoría */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingLeft: '8px' }}>
              {catEntries.map(([cat, s]) => (
                <div key={cat} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '4px 9px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: categoryColor(cat), fontWeight: 700 }}>{cat}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>{s.done}/{s.total}</span>
                  {s.remaining != null && s.remaining > 1 && (
                    <span style={{ color: '#fb923c' }}>~{fmtDuration(s.remaining)}</span>
                  )}
                  {s.remaining != null && s.remaining <= 1 && s.total > 0 && (
                    <span style={{ color: '#34d399' }}>✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LiveTab({ tournamentId, participants, onUpdate, timing, tournamentStatus }) {
  const [onStageId, setOnStageId] = useState(() => participants.find(p => p.on_stage)?.id ?? null);
  const [loading, setLoading] = useState(null);

  const rounds = (() => {
    const sorted = [...participants].sort((a, b) => (a.act_order ?? 9999) - (b.act_order ?? 9999));
    const map = {}; const order = [];
    for (const p of sorted) {
      const r = p.round_number || 1;
      if (!map[r]) { map[r] = []; order.push(r); }
      map[r].push(p);
    }
    return order.map(r => ({ round: r, participants: map[r] }));
  })();

  useEffect(() => {
    setOnStageId(participants.find(p => p.on_stage)?.id ?? null);
  }, [participants]);

  const setOnStage = async (pid) => {
    setLoading(pid);
    try {
      const res = await apiFetch(`${API}/participants/${pid}/on-stage`, { method: 'POST' });
      if (!res.ok) return;
      setOnStageId(pid);
      onUpdate(participants.map(p => ({ ...p, on_stage: p.id === pid ? 1 : 0 })));
    } finally { setLoading(null); }
  };

  const clearStage = async () => {
    await apiFetch(`${API}/tournaments/${tournamentId}/off-stage`, { method: 'POST' });
    setOnStageId(null);
    onUpdate(participants.map(p => ({ ...p, on_stage: 0 })));
  };

  return (
    <div>
        <TimingWidget timing={timing} tournamentStatus={tournamentStatus} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ color: '#7ecfff', letterSpacing: '0.1em', fontSize: '0.9rem', margin: 0 }}>CONTROL DE ESCENA</h3>
          {onStageId && (
            <button onClick={clearStage} style={{ background: 'none', border: '1px solid #555', color: '#888', fontSize: '0.75rem', padding: '5px 12px', borderRadius: '20px', cursor: 'pointer' }}>Limpiar escena</button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {rounds.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', padding: '20px', textAlign: 'center' }}>No hay participantes.</p>}
          {rounds.map(({ round, participants: rps }) => {
            let globalIdx = rounds.slice(0, rounds.indexOf(rounds.find(r => r.round === round))).reduce((n, r) => n + r.participants.length, 0);
            return (
              <div key={round}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ color: '#7ecfff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', letterSpacing: '0.2em' }}>BLOQUE {round}</span>
                  <span style={{ flex: 1, height: '1px', background: 'rgba(126,207,255,0.15)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.72rem' }}>{rps.length} grupos</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rps.map(p => {
                    globalIdx++;
                    const isOnStage = p.id === onStageId;
                    return (
                      <div key={p.id} className="card" style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 16px', border: isOnStage ? '1px solid rgba(126,207,255,0.5)' : '1px solid #1a1a2e', background: isOnStage ? 'rgba(126,207,255,0.06)' : undefined }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: '22px', fontSize: '0.85rem' }}>{globalIdx}</span>
                        {p.photo_path && <img src={`/uploads/${p.photo_path}`} alt="" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.name}</div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                            <span style={{ color: categoryColor(p.category), fontSize: '0.65rem', letterSpacing: '0.1em' }}>{p.category}</span>
                          </div>
                        </div>
                        {isOnStage ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7ecfff', boxShadow: '0 0 8px #7ecfff', display: 'inline-block' }} />
                            <span style={{ color: '#7ecfff', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em' }}>EN ESCENA</span>
                          </div>
                        ) : (
                          <button className="btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                            onClick={() => setOnStage(p.id)} disabled={loading === p.id}>
                            {loading === p.id ? '...' : 'Poner en escena'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      <SpeakerMsgPanel tournamentId={tournamentId} />
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
      sessionStorage.setItem('coreoOrgCode', code.trim());
      onLogin(data.organizer);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: '100%', maxWidth: '380px' }}>
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '0.25em', color: '#7ecfff', marginBottom: '2px' }}>ZEN TAISEN</p>
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
function ScoresTab({ tournamentId }) {
  const socket = useSocket();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`/api/coreo/tournaments/${tournamentId}/scores/summary`);
      const d = await r.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  // Real-time refresh when any judge saves scores
  useEffect(() => {
    if (!socket) return;
    socket.on('coreo:scores-updated', load);
    return () => socket.off('coreo:scores-updated', load);
  }, [socket, load]);

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingTop: '60px' }}>Cargando...</div>;
  if (!data) return null;

  const { criteria, judges = [], participants } = data;

  if (!criteria.length) return <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingTop: '60px' }}>No hay criterios configurados.</div>;
  if (!participants.length) return (
    <div style={{ textAlign: 'center', paddingTop: '60px' }}>
      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '2rem', marginBottom: '12px' }}>—</div>
      <div style={{ color: 'rgba(255,255,255,0.3)' }}>Aún no hay puntuaciones registradas.</div>
      <button onClick={load} style={{ marginTop: '20px', background: 'none', border: '1px solid #333', color: '#888', fontSize: '0.75rem', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer' }}>↻ Actualizar</button>
    </div>
  );

  // Group by round → category, sort within category by globalAvg desc
  const roundMap = {}; const roundOrder = [];
  for (const p of participants) {
    const r = p.round_number || 1;
    const cat = p.category || '—';
    if (!roundMap[r]) { roundMap[r] = {}; roundOrder.push(r); }
    if (!roundMap[r][cat]) roundMap[r][cat] = [];
    roundMap[r][cat].push(p);
  }
  const grouped = roundOrder.map(r => ({
    round: r,
    categories: Object.keys(roundMap[r]).map(cat => ({
      cat,
      participants: [...roundMap[r][cat]].sort((a, b) => {
        if (a.globalAvg == null && b.globalAvg == null) return 0;
        if (a.globalAvg == null) return 1; if (b.globalAvg == null) return -1;
        return b.globalAvg - a.globalAvg;
      }),
    })),
  }));

  const thBase = { padding: '8px 10px', color: 'rgba(255,255,255,0.4)', fontWeight: 400, whiteSpace: 'nowrap', borderBottom: '1px solid #1a1a2e', fontSize: '0.75rem' };
  const thRight = { ...thBase, textAlign: 'right' };
  const JUDGE_COLORS = ['#7ecfff', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <h2 style={{ margin: 0, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.15em', color: '#7ecfff', fontSize: '1.3rem' }}>
          PUNTUACIONES <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', fontFamily: 'inherit' }}>({participants.length} grupos · {judges.length} jueces)</span>
        </h2>
        <button onClick={load} style={{ background: 'none', border: '1px solid #333', color: '#888', fontSize: '0.75rem', padding: '5px 12px', borderRadius: '20px', cursor: 'pointer' }}>↻ Actualizar</button>
      </div>

      {grouped.map(({ round, categories }) => (
        <div key={round} style={{ marginBottom: '36px' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.2em', color: '#7ecfff', fontSize: '1.1rem', marginBottom: '20px', paddingBottom: '8px', borderBottom: '1px solid rgba(126,207,255,0.2)' }}>
            BLOQUE {round}
          </div>

          {categories.map(({ cat, participants: catParts }) => (
            <div key={cat} style={{ marginBottom: '28px' }}>
              <div style={{ color: categoryColor(cat), fontSize: '0.72rem', letterSpacing: '0.18em', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase' }}>
                {cat}
              </div>
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #1a1a2e' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    {/* Row 1: judge name headers */}
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
                    {/* Row 2: criteria per judge */}
                    <tr style={{ background: '#0f0f1a' }}>
                      {judges.map((j, ji) =>
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
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #1a1a2e', background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                          <td style={{ padding: '10px 10px', color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 10px', color: '#fff', fontWeight: 500 }}>{p.name}</td>
                          {judges.map((j, ji) =>
                            criteria.map((c, ci) => {
                              const val = p.judgeScores?.[j.id]?.[c.id];
                              return (
                                <td key={`${j.id}-${c.id}`} style={{ padding: '10px 10px', textAlign: 'right', color: val != null ? '#e2e8f0' : 'rgba(255,255,255,0.15)', borderLeft: ci === 0 ? '1px solid #1a1a2e' : undefined }}>
                                  {val != null ? val.toFixed(1) : '—'}
                                </td>
                              );
                            })
                          )}
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, borderLeft: '2px solid rgba(126,207,255,0.1)', color: total != null ? (p.allVoted ? '#7ecfff' : '#ef4444') : 'rgba(255,255,255,0.15)' }}>
                            {total != null ? total.toFixed(2) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ))}
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
  const [tab, setTab] = useState('config');
  const [toast, setToast] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Auth state: could be admin token or organizer code
  const isAdmin = !!sessionStorage.getItem('adminToken');
  const hasOrgCode = !!sessionStorage.getItem('coreoOrgCode');
  const [needsOrgLogin, setNeedsOrgLogin] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch(`${API}/tournaments/${id}`);
    if (res.status === 401) {
      // No admin token and no org code → show organizer login
      if (!isAdmin && !hasOrgCode) { setNeedsOrgLogin(true); return; }
      navigate('/admin'); return;
    }
    if (res.status === 404) { setNotFound(true); return; }
    const data = await res.json();
    setTournament(data.tournament);
    setCriteria(data.criteria);
    setParticipants(data.participants);
    setJudges(data.judges);
    setOrganizers(data.organizers || []);
    setSpeakers(data.speakers || []);
    setNeedsOrgLogin(false);
  }, [id, navigate, isAdmin, hasOrgCode]);

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
    socket.on('coreo:config-updated', ({ coreo_categories, coreo_rounds }) =>
      setTournament(prev => prev ? { ...prev, coreo_categories, coreo_rounds } : prev)
    );
    socket.on('coreo:participant-added', ({ participant: p }) => setParticipants(prev => [...prev, p]));
    socket.on('coreo:participant-updated', ({ participant: p }) => setParticipants(prev => prev.map(x => x.id === p.id ? p : x)));
    socket.on('coreo:participant-removed', ({ id: pid }) => setParticipants(prev => prev.filter(x => x.id !== pid)));
    socket.on('coreo:order-updated', () => load());
    socket.on('coreo:judge-added', ({ judge }) => setJudges(prev => [...prev, judge]));
    socket.on('coreo:judge-removed', ({ id: jid }) => setJudges(prev => prev.filter(j => j.id !== jid)));
    socket.on('coreo:organizer-added', ({ organizer }) => setOrganizers(prev => [...prev, organizer]));
    socket.on('coreo:organizer-removed', ({ id: oid }) => setOrganizers(prev => prev.filter(o => o.id !== oid)));
    socket.on('coreo:speaker-added', ({ speaker }) => setSpeakers(prev => [...prev, speaker]));
    socket.on('coreo:speaker-removed', ({ id: sid }) => setSpeakers(prev => prev.filter(s => s.id !== sid)));
    socket.on('coreo:on-stage', ({ participant }) => setParticipants(prev => prev.map(p => ({ ...p, on_stage: p.id === participant.id ? 1 : 0 }))));
    socket.on('coreo:off-stage', () => setParticipants(prev => prev.map(p => ({ ...p, on_stage: 0 }))));
    socket.on('coreo:poster-updated', ({ poster_path }) => setTournament(prev => prev ? { ...prev, poster_path } : prev));
    socket.on('coreo:timing-updated', setTiming);
    return () => {
      socket.off('connect', join);
      ['coreo:criteria-updated', 'coreo:config-updated', 'coreo:participant-added',
        'coreo:participant-updated', 'coreo:participant-removed', 'coreo:order-updated',
        'coreo:judge-added', 'coreo:judge-removed', 'coreo:organizer-added',
        'coreo:organizer-removed', 'coreo:speaker-added', 'coreo:speaker-removed',
        'coreo:on-stage', 'coreo:off-stage', 'coreo:poster-updated',
        'coreo:timing-updated'].forEach(e => socket.off(e));
    };
  }, [socket, id, load, loadTiming]);

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
        { key: 'participantes', label: <span>Participantes ({participants.length}){tabDot(participantesOk)}</span> },
        { key: 'orden', label: <span>Orden{tabDot(ordenOk)}</span> },
        { key: 'en-vivo', label: 'En escena' },
        { key: 'puntuaciones', label: 'Puntuaciones' },
      ]
    : [{ key: 'en-vivo', label: 'En escena' }];

  const activeTab = TABS.find(t => t.key === tab) ? tab : TABS[0].key;

  const handleLogout = () => {
    if (isAdmin) {
      sessionStorage.removeItem('adminToken');
      navigate('/admin');
    } else {
      sessionStorage.removeItem('coreoOrgCode');
      setNeedsOrgLogin(true);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a12', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid #1a1a2e', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', letterSpacing: '0.25em', color: '#7ecfff' }}>ZEN TAISEN</span>
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
            <span style={{ color: '#34d399', fontSize: '0.75rem', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '20px', padding: '6px 14px' }}>Torneo finalizado</span>
          )}
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #333', color: '#666', fontSize: '0.78rem', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer' }}>
            {isAdmin ? '← Torneos' : 'Salir'}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: '#0f0f1a', borderBottom: '1px solid #1a1a2e', display: 'flex', gap: '2px', padding: '0 24px' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '14px 18px', fontSize: '0.82rem', letterSpacing: '0.08em',
            display: 'inline-flex', alignItems: 'center',
            color: activeTab === t.key ? '#7ecfff' : 'rgba(255,255,255,0.4)',
            borderBottom: activeTab === t.key ? '2px solid #7ecfff' : '2px solid transparent',
            transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Puntuaciones tab: full-width outside the narrow container */}
      {activeTab === 'puntuaciones' && (
        <div style={{ padding: '28px 32px' }}>
          <ScoresTab tournamentId={Number(id)} />
        </div>
      )}

      {/* Content */}
      <div className="container" style={{ maxWidth: '960px', paddingTop: '28px', display: activeTab === 'puntuaciones' ? 'none' : undefined }}>
        {isAdmin && tournament.status === 'setup' && activeTab !== 'en-vivo' && activeTab !== 'puntuaciones' && (
          <SetupChecklist
            criteria={criteria}
            categories={parsedCategories}
            participants={participants}
            judges={judges}
            onNavigate={setTab}
          />
        )}
        {activeTab === 'config' && (
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
        )}
        {activeTab === 'participantes' && (
          <ParticipantsTab
            tournamentId={Number(id)}
            participants={participants}
            onUpdate={setParticipants}
            categories={parsedCategories}
            roundsCount={roundsCount}
          />
        )}
        {activeTab === 'orden' && <OrderTab tournamentId={Number(id)} participants={participants} onUpdate={setParticipants} />}
        {activeTab === 'en-vivo' && (
          <LiveTab
            tournamentId={Number(id)}
            participants={participants}
            onUpdate={setParticipants}
            timing={timing}
            tournamentStatus={tournament.status}
          />
        )}
      </div>

      <Toast msg={toast?.msg} type={toast?.type} />
    </div>
  );
}
