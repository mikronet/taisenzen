import { useState, useEffect } from 'react';

export default function MatchupEditor({ participants, phases, matches, tournamentId, onSave }) {
  const [matchups, setMatchups] = useState([]);
  const [available, setAvailable] = useState([]);

  const firstPhase = phases.find(p => p.phase_order === 1);
  const firstPhaseMatches = firstPhase ? matches.filter(m => m.phase_id === firstPhase.id).sort((a, b) => a.match_order - b.match_order) : [];

  useEffect(() => {
    // Inicializar matchups desde los matches existentes
    const initial = firstPhaseMatches.map(m => ({
      matchId: m.id,
      order: m.match_order,
      p1: m.participant1_id,
      p2: m.participant2_id,
      p1Name: m.participant1_name,
      p2Name: m.participant2_name,
    }));
    setMatchups(initial);

    // Participantes no asignados a ningún match
    const assigned = new Set();
    initial.forEach(m => {
      if (m.p1) assigned.add(m.p1);
      if (m.p2) assigned.add(m.p2);
    });
    setAvailable(participants.filter(p => !assigned.has(p.id)));
  }, [participants, matches, phases]);

  const shuffle = () => {
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const newMatchups = [];
    const matchCount = Math.ceil(shuffled.length / 2);
    for (let i = 0; i < matchCount; i++) {
      const p1 = shuffled[i * 2] || null;
      const p2 = shuffled[i * 2 + 1] || null;
      newMatchups.push({
        matchId: firstPhaseMatches[i]?.id,
        order: i + 1,
        p1: p1?.id || null,
        p2: p2?.id || null,
        p1Name: p1?.name || null,
        p2Name: p2?.name || null,
      });
    }
    setMatchups(newMatchups);
    setAvailable([]);
  };

  const swapParticipant = (matchIdx, slot, participantId) => {
    const newMatchups = [...matchups];
    const participant = participants.find(p => p.id === Number(participantId));

    // Encontrar dónde está actualmente este participante y liberarlo
    let freedParticipant = null;
    for (let i = 0; i < newMatchups.length; i++) {
      if (newMatchups[i].p1 === Number(participantId)) {
        freedParticipant = null; // será reemplazado
        newMatchups[i].p1 = null;
        newMatchups[i].p1Name = null;
      }
      if (newMatchups[i].p2 === Number(participantId)) {
        freedParticipant = null;
        newMatchups[i].p2 = null;
        newMatchups[i].p2Name = null;
      }
    }

    // Si el slot actual tenía a alguien, liberarlo
    const currentInSlot = slot === 'p1' ? newMatchups[matchIdx].p1 : newMatchups[matchIdx].p2;
    if (currentInSlot) {
      const currentParticipant = participants.find(p => p.id === currentInSlot);
      if (currentParticipant) {
        // Mover al sitio donde estaba el nuevo participante (intercambio)
        for (let i = 0; i < newMatchups.length; i++) {
          if (i === matchIdx) continue;
          if (newMatchups[i].p1 === Number(participantId)) {
            newMatchups[i].p1 = currentInSlot;
            newMatchups[i].p1Name = currentParticipant.name;
          }
          if (newMatchups[i].p2 === Number(participantId)) {
            newMatchups[i].p2 = currentInSlot;
            newMatchups[i].p2Name = currentParticipant.name;
          }
        }
      }
    }

    // Asignar el nuevo participante al slot
    if (slot === 'p1') {
      newMatchups[matchIdx].p1 = participant ? participant.id : null;
      newMatchups[matchIdx].p1Name = participant ? participant.name : null;
    } else {
      newMatchups[matchIdx].p2 = participant ? participant.id : null;
      newMatchups[matchIdx].p2Name = participant ? participant.name : null;
    }

    setMatchups(newMatchups);

    // Recalcular disponibles
    const assigned = new Set();
    newMatchups.forEach(m => {
      if (m.p1) assigned.add(m.p1);
      if (m.p2) assigned.add(m.p2);
    });
    setAvailable(participants.filter(p => !assigned.has(p.id)));
  };

  const saveMatchups = async () => {
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/update-matchups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchups: matchups.map(m => ({ matchId: m.matchId, p1: m.p1, p2: m.p2 })) })
    });
    if (res.ok) onSave();
  };

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ color: 'var(--accent)' }}>EMPAREJAMIENTOS — {firstPhase?.name || 'Primera Fase'}</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={shuffle}>Aleatorio</button>
          <button className="btn-gold" onClick={saveMatchups} style={{ fontSize: '0.95rem', padding: '8px 20px' }}>Guardar Emparejamientos</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
        {matchups.map((m, idx) => (
          <div key={idx} style={{
            background: 'var(--bg-card-hover)', borderRadius: 'var(--radius)',
            padding: '14px', border: '1px solid #333'
          }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '8px', textAlign: 'center' }}>
              Match {m.order}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={m.p1 || ''}
                onChange={e => swapParticipant(idx, 'p1', e.target.value)}
                style={{ flex: 1, fontSize: '0.9rem', padding: '8px' }}
              >
                <option value="">— Vacío —</option>
                {participants.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>VS</span>
              <select
                value={m.p2 || ''}
                onChange={e => swapParticipant(idx, 'p2', e.target.value)}
                style={{ flex: 1, fontSize: '0.9rem', padding: '8px' }}
              >
                <option value="">— Vacío —</option>
                {participants.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {available.length > 0 && (
        <div style={{ marginTop: '12px', color: 'var(--warning)', fontSize: '0.9rem' }}>
          Sin asignar: {available.map(p => p.name).join(', ')}
        </div>
      )}
    </div>
  );
}
