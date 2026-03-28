import { useState } from 'react';

export default function Bracket({ phases, matches, currentMatchId, onStartMatch, onRestartMatch, onRenamePhase, isAdmin, onSaveBracket, large, maxHeight }) {
  const getMatchesForPhase = (phaseId) => matches.filter(m => m.phase_id === phaseId);
  const elimPhases = phases.filter(p => p.phase_type !== 'filtros');
  if (elimPhases.length === 0) return null;

  const editablePhase = isAdmin && onSaveBracket
    ? elimPhases.find(phase => {
        const m = getMatchesForPhase(phase.id);
        return m.length > 1
          && m.every(x => x.status === 'pending')
          && m.every(x => x.participant1_id && x.participant2_id);
      })
    : null;

  const finalPhase = elimPhases[elimPhases.length - 1];
  const progressionPhases = elimPhases.slice(0, -1);
  const semiPhaseId = progressionPhases.length > 0 ? progressionPhases[progressionPhases.length - 1].id : null;

  // maxRows = number of match slots in first phase's left half
  const firstPhaseM = progressionPhases.length > 0
    ? getMatchesForPhase(progressionPhases[0].id)
    : getMatchesForPhase(finalPhase.id);
  const maxRows = Math.max(1, Math.ceil(firstPhaseM.length / 2));

  const BASE_SLOT_H = large ? 200 : 185;
  const SLOT_H = maxHeight
    ? Math.min(BASE_SLOT_H, Math.floor(maxHeight / maxRows))
    : BASE_SLOT_H;

  // rank: 'final' | 'semi' | null
  const phaseRank = (phaseId) => {
    if (phaseId === finalPhase.id) return 'final';
    if (phaseId === semiPhaseId) return 'semi';
    return null;
  };

  const RANK_STYLES = {
    final: {
      border: '1px solid #c9a227',
      boxShadow: '0 0 18px rgba(201,162,39,0.45)',
      background: 'rgba(201,162,39,0.08)',
      color: '#ffffff',
    },
    semi: {
      border: '1px solid #9e9e9e',
      boxShadow: '0 0 14px rgba(180,180,180,0.3)',
      background: 'rgba(160,160,160,0.07)',
      color: '#ffffff',
    },
  };

  const renderMatchCard = (match, rank) => {
    const p1c = match.winner_id === match.participant1_id ? 'winner'
      : match.winner_id && match.winner_id !== match.participant1_id ? 'loser' : '';
    const p2c = match.winner_id === match.participant2_id ? 'winner'
      : match.winner_id && match.winner_id !== match.participant2_id ? 'loser' : '';
    const extraStyle = rank ? RANK_STYLES[rank] : {};
    const participantPadding = rank === 'final' ? '30px 20px'
      : rank === 'semi' ? '22px 18px'
      : undefined;
    const participantFontSize = rank === 'final' ? '1.25rem'
      : rank === 'semi' ? '1.1rem'
      : undefined;
    return (
      <div
        className={`match-card ${match.status}`}
        style={{ width: '100%', ...extraStyle }}
      >
        <div className={`match-participant ${p1c}`} style={{ padding: participantPadding, fontSize: participantFontSize }}>
          <span>{match.participant1_name || ''}</span>
        </div>
        <div className={`match-participant ${p2c}`} style={{ padding: participantPadding, fontSize: participantFontSize }}>
          <span>{match.participant2_name || ''}</span>
        </div>
        {(isAdmin || onStartMatch) && match.participant1_id && match.participant2_id && (
          <div style={{ padding: '8px', display: 'flex', gap: '6px', justifyContent: 'center', borderTop: '1px solid #222' }}>
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
            {match.status === 'live' && <span className="badge badge-live">EN CURSO</span>}
            {match.status === 'finished' && <span className="badge badge-finished">Finalizado</span>}
          </div>
        )}
      </div>
    );
  };

  // Render a single bracket column.
  // The phase title is rendered inside the first match cell, just above the card.
  const renderColumn = (colKey, phase, colMatches, span, showTitle) => {
    const rank = phaseRank(phase.id);
    return (
      <div key={colKey} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: '0' }}>
        <div style={{ display: 'grid', gridTemplateRows: `repeat(${maxRows}, ${SLOT_H}px)` }}>
          {colMatches.map((match, i) => (
            <div
              key={match.id}
              style={{
                gridRow: `${i * span + 1} / span ${span}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '0 6px',
              }}
            >
              {i === 0 && showTitle && (
                <PhaseTitle phase={phase} isAdmin={isAdmin} onRename={onRenamePhase} large={large} rank={rank} />
              )}
              <div style={{ width: '100%' }}>{renderMatchCard(match, rank)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Simple centered layout when there are no progression phases (just a final)
  if (progressionPhases.length === 0) {
    return (
      <div>
        {editablePhase && (
          <BracketEditor phase={editablePhase} phaseMatches={getMatchesForPhase(editablePhase.id)} onSave={onSaveBracket} />
        )}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
          {renderColumn('final', finalPhase, getMatchesForPhase(finalPhase.id), 1, true)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {editablePhase && (
        <BracketEditor phase={editablePhase} phaseMatches={getMatchesForPhase(editablePhase.id)} onSave={onSaveBracket} />
      )}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: '4px',
        overflowX: 'visible',
        padding: large ? '0 32px' : '20px 24px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Left side: outermost → innermost (left to right) */}
        {progressionPhases.map((phase, p) => {
          const m = getMatchesForPhase(phase.id);
          const half = Math.ceil(m.length / 2);
          return renderColumn(`${phase.id}_L`, phase, m.slice(0, half), Math.pow(2, p), true);
        })}

        {/* Center: Final */}
        {renderColumn(`${finalPhase.id}_C`, finalPhase, getMatchesForPhase(finalPhase.id), maxRows, true)}

        {/* Right side: innermost → outermost (left to right) — also show titles */}
        {[...progressionPhases].reverse().map((phase, p) => {
          const revIdx = progressionPhases.length - 1 - p;
          const m = getMatchesForPhase(phase.id);
          const half = Math.ceil(m.length / 2);
          return renderColumn(`${phase.id}_R`, phase, m.slice(half), Math.pow(2, revIdx), true);
        })}
      </div>
    </div>
  );
}

// ── Bracket editor ──────────────────────────────────────────────────────────────

function BracketEditor({ phase, phaseMatches, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const pool = [];
  phaseMatches.forEach(m => {
    if (m.participant1_id) pool.push({ id: m.participant1_id, name: m.participant1_name });
    if (m.participant2_id) pool.push({ id: m.participant2_id, name: m.participant2_name });
  });

  const openEditor = () => {
    const initial = {};
    phaseMatches.forEach(m => { initial[m.id] = { p1: m.participant1_id, p2: m.participant2_id }; });
    setDraft(initial);
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const handleChange = (matchId, slot, newId) => {
    newId = Number(newId);
    const oldId = draft[matchId][slot];
    if (oldId === newId) return;
    const next = JSON.parse(JSON.stringify(draft));
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
      matchId: Number(matchId), participant1Id: slots.p1, participant2Id: slots.p2,
    }));
    await onSave(phase.id, payload);
    setSaving(false);
    setEditing(false);
  };

  const getName = (id) => pool.find(p => p.id === id)?.name || '?';

  if (!editing) {
    return (
      <div style={{ marginBottom: '12px', textAlign: 'right' }}>
        <button className="btn-secondary" onClick={openEditor} style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
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
          <button className="btn-secondary" onClick={cancel} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={saving} style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {phaseMatches.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 14px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: '60px' }}>Cruce {i + 1}</span>
            <select value={draft[m.id]?.p1 || ''} onChange={e => handleChange(m.id, 'p1', e.target.value)} style={{ flex: 1, minWidth: '120px', fontSize: '0.9rem', padding: '6px 10px' }}>
              {pool.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.9rem' }}>VS</span>
            <select value={draft[m.id]?.p2 || ''} onChange={e => handleChange(m.id, 'p2', e.target.value)} style={{ flex: 1, minWidth: '120px', fontSize: '0.9rem', padding: '6px 10px' }}>
              {pool.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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

function PhaseTitle({ phase, isAdmin, onRename, large, rank }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(phase.name);

  const save = () => {
    if (name.trim() && name !== phase.name && onRename) onRename(phase.id, name.trim());
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

  const rankColor = rank === 'final' ? '#c9a227' : rank === 'semi' ? '#b0b0b0' : undefined;

  return (
    <div
      className="phase-title"
      onClick={() => isAdmin && setEditing(true)}
      style={{
        cursor: isAdmin ? 'pointer' : 'default',
        fontSize: large ? '1.1rem' : undefined,
        letterSpacing: large ? '0.18em' : undefined,
        textAlign: 'center',
        color: rankColor || undefined,
        textShadow: rank === 'final'
          ? '0 0 12px rgba(201,162,39,0.6)'
          : rank === 'semi'
          ? '0 0 10px rgba(180,180,180,0.4)'
          : undefined,
      }}
    >
      {phase.name}
      {phase.status === 'active' && (
        <span style={{
          display: 'inline-block', marginLeft: '10px',
          width: '10px', height: '10px', borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 6px var(--accent)',
          animation: 'pulse 2s infinite',
          verticalAlign: 'middle',
        }} />
      )}
      {phase.status === 'finished' && <span className="badge badge-finished" style={{ marginLeft: '8px', fontSize: '0.75rem' }}>✓</span>}
    </div>
  );
}
