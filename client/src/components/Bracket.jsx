import { useState, useEffect } from 'react';

export default function Bracket({ phases, matches, currentMatchId, onPrepareMatch, onStartMatch, onRestartMatch, onRenamePhase, isAdmin, onSaveBracket }) {
  const getMatchesForPhase = (phaseId) => matches.filter(m => m.phase_id === phaseId);

  // Filter out Filtros phases — they're managed separately
  const elimPhases = phases.filter(p => p.phase_type !== 'filtros');

  if (elimPhases.length === 0) return null;

  // Find the next editable phase: the first phase where ALL matches are still
  // pending (none started) AND all have both participants assigned.
  // This works for the initial bracket AND for each subsequent round once the
  // previous one is done and winners have been seeded into the next phase.
  const editablePhase = isAdmin && onSaveBracket
    ? elimPhases.find(phase => {
        const phaseMatches = getMatchesForPhase(phase.id);
        return phaseMatches.length > 1          // Final (1 match) needs no editor
          && phaseMatches.every(m => m.status === 'pending')
          && phaseMatches.every(m => m.participant1_id && m.participant2_id);
      })
    : null;
  const editablePhaseMatches = editablePhase ? getMatchesForPhase(editablePhase.id) : [];

  return (
    <div>
      {/* Edit bracket button — shown for the next fully-pending phase with assigned participants */}
      {editablePhase && (
        <BracketEditor
          phase={editablePhase}
          phaseMatches={editablePhaseMatches}
          onSave={onSaveBracket}
        />
      )}
      <div className="bracket">
        {elimPhases.map(phase => (
          <div key={phase.id} className="phase-column">
            <PhaseTitle phase={phase} isAdmin={isAdmin} onRename={onRenamePhase} />
            {getMatchesForPhase(phase.id).map(match => (
              <div key={match.id} className={`match-card ${match.status}`}>
                <div className={`match-participant ${match.winner_id === match.participant1_id ? 'winner' : match.winner_id && match.winner_id !== match.participant1_id ? 'loser' : ''}`}>
                  <span>{match.participant1_name || <span style={{ color: '#444' }}>Por determinar</span>}</span>
                </div>
                <div className={`match-participant ${match.winner_id === match.participant2_id ? 'winner' : match.winner_id && match.winner_id !== match.participant2_id ? 'loser' : ''}`}>
                  <span>{match.participant2_name || <span style={{ color: '#444' }}>Por determinar</span>}</span>
                </div>

                {(isAdmin || onStartMatch) && match.participant1_id && match.participant2_id && (
                  <div style={{ padding: '8px', display: 'flex', gap: '6px', justifyContent: 'center', borderTop: '1px solid #222' }}>
                    {match.status === 'pending' && onPrepareMatch && match.id === currentMatchId && (
                      <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 12px' }} onClick={() => onPrepareMatch(match.id)}>
                        Preparar
                      </button>
                    )}
                    {match.status === 'pending' && onStartMatch && match.id === currentMatchId && (
                      <button className="btn-primary" style={{ fontSize: '0.75rem', padding: '5px 12px' }} onClick={() => onStartMatch(match.id)}>
                        Iniciar
                      </button>
                    )}
                    {match.status === 'tie' && onRestartMatch && (
                      <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '5px 12px' }} onClick={() => onRestartMatch(match.id)}>
                        Repetir
                      </button>
                    )}
                    {match.status === 'live' && (
                      <span className="badge badge-live">EN CURSO</span>
                    )}
                    {match.status === 'finished' && (
                      <span className="badge badge-finished">Finalizado</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bracket editor ─────────────────────────────────────────────────────────────
// Shows all first-phase matches as pairs of dropdowns.
// Changing a slot auto-swaps the displaced participant to keep the pool intact.

function BracketEditor({ phase, phaseMatches, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  // Build participant pool from current matches
  const pool = [];
  phaseMatches.forEach(m => {
    if (m.participant1_id) pool.push({ id: m.participant1_id, name: m.participant1_name });
    if (m.participant2_id) pool.push({ id: m.participant2_id, name: m.participant2_name });
  });

  const openEditor = () => {
    const initial = {};
    phaseMatches.forEach(m => {
      initial[m.id] = { p1: m.participant1_id, p2: m.participant2_id };
    });
    setDraft(initial);
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  // Change a slot and auto-swap the displaced participant
  const handleChange = (matchId, slot, newId) => {
    newId = Number(newId);
    const oldId = draft[matchId][slot];
    if (oldId === newId) return;

    const next = JSON.parse(JSON.stringify(draft));

    // Find where newId currently lives and put oldId there
    for (const mid of Object.keys(next)) {
      if (next[mid].p1 === newId) { next[mid].p1 = oldId; break; }
      if (next[mid].p2 === newId) { next[mid].p2 = oldId; break; }
    }
    next[matchId][slot] = newId;
    setDraft(next);
  };

  const save = async () => {
    setSaving(true);
    const payload = Object.entries(draft).map(([matchId, slots]) => ({
      matchId: Number(matchId),
      participant1Id: slots.p1,
      participant2Id: slots.p2,
    }));
    await onSave(phase.id, payload);
    setSaving(false);
    setEditing(false);
  };

  // Name lookup helper
  const getName = (id) => pool.find(p => p.id === id)?.name || '?';

  if (!editing) {
    return (
      <div style={{ marginBottom: '12px', textAlign: 'right' }}>
        <button
          className="btn-secondary"
          onClick={openEditor}
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
        >
          ✏️ Editar cruces
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ color: 'var(--gold)', fontSize: '0.9rem', letterSpacing: '0.15em' }}>
          EDITAR CRUCES — {phase.name.toUpperCase()}
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={cancel} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={save} disabled={saving} style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {phaseMatches.map((m, i) => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
            padding: '10px 14px', flexWrap: 'wrap',
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '60px' }}>
              Cruce {i + 1}
            </span>
            <select
              value={draft[m.id]?.p1 || ''}
              onChange={e => handleChange(m.id, 'p1', e.target.value)}
              style={{ flex: 1, minWidth: '120px', fontSize: '0.9rem', padding: '6px 10px' }}
            >
              {pool.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.9rem' }}>VS</span>
            <select
              value={draft[m.id]?.p2 || ''}
              onChange={e => handleChange(m.id, 'p2', e.target.value)}
              style={{ flex: 1, minWidth: '120px', fontSize: '0.9rem', padding: '6px 10px' }}
            >
              {pool.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <span style={{ color: '#444', fontSize: '0.75rem', minWidth: '160px' }}>
              Actualmente: {getName(draft[m.id]?.p1)} vs {getName(draft[m.id]?.p2)}
            </span>
          </div>
        ))}
      </div>
      <p style={{ marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Al cambiar un participante de cruce, el desplazado ocupa su lugar automáticamente.
      </p>
    </div>
  );
}

function PhaseTitle({ phase, isAdmin, onRename }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(phase.name);

  const save = () => {
    if (name.trim() && name !== phase.name && onRename) {
      onRename(phase.id, name.trim());
    }
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') { setName(phase.name); setEditing(false); }
  };

  if (isAdmin && editing) {
    return (
      <div className="phase-title" style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: '1.1rem', padding: '4px 8px', width: '140px' }}
        />
      </div>
    );
  }

  return (
    <div className="phase-title" onClick={() => isAdmin && setEditing(true)} style={{ cursor: isAdmin ? 'pointer' : 'default' }}>
      {phase.name}
      {phase.status === 'active' && <span className="badge badge-live" style={{ marginLeft: '8px', fontSize: '0.65rem' }}>ACTIVA</span>}
      {phase.status === 'finished' && <span className="badge badge-finished" style={{ marginLeft: '8px', fontSize: '0.6rem' }}>HECHO</span>}
    </div>
  );
}
