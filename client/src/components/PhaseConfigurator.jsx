import { useState, useEffect, useRef } from 'react';

// Phase → minimum participants needed to activate
const PHASE_THRESHOLDS = [
  { name: 'Octavos', min: 16 },
  { name: 'Cuartos', min: 8 },
  { name: 'Semifinal', min: 4 },
  { name: 'Final', min: 2 },
];

function computePhases(advanceCount) {
  // Auto-select phases based on how many pass from Filtros
  const phases = ['Filtros'];
  for (const phase of PHASE_THRESHOLDS) {
    if (advanceCount >= phase.min) {
      phases.push(phase.name);
    }
  }
  // Always include Final
  if (!phases.includes('Final')) phases.push('Final');
  return phases;
}

/** Redondea n a la potencia de 2 más cercana (sin exceder maxN, mínimo 2) */
function forcePow2(n, maxN) {
  const clamped = Math.max(2, Math.min(n, maxN));
  const lower = Math.pow(2, Math.floor(Math.log2(clamped)));
  const upper = lower * 2;
  // Si upper excede maxN usamos lower; si no, cogemos el más cercano
  const best = upper > maxN ? lower : (Math.abs(clamped - lower) <= Math.abs(clamped - upper) ? lower : upper);
  return Math.max(2, best);
}

function isPow2(n) { return n >= 2 && (n & (n - 1)) === 0; }

export default function PhaseConfigurator({ tournament, participantCount, judgeCount = 0, onSave, savedOk, onDirty }) {
  const is7toSmoke = tournament.tournament_type === '7tosmoke';

  const [advanceCount, setAdvanceCount] = useState(is7toSmoke ? 7 : 2);
  const [groupSize, setGroupSize] = useState(2);
  const [timerDurationS, setTimerDurationS] = useState(60);
  const [globalTimerDurationS, setGlobalTimerDurationS] = useState(3600);
  const [pointsMode, setPointsMode] = useState('accumulated');
  const [showConfirm, setShowConfirm] = useState(false);

  // Dirty flag: true while user has edited values but save hasn't been confirmed yet.
  const userEdited = useRef(false);

  // Once save is confirmed (savedOk flips to true), allow re-sync from DB next time.
  useEffect(() => {
    if (savedOk) userEdited.current = false;
  }, [savedOk]);

  // Only sync from tournament data when the user hasn't made unsaved edits.
  useEffect(() => {
    if (userEdited.current) return;
    const defaultAdvance = is7toSmoke ? 7 : Math.floor(participantCount / 2) || 2;
    const saved = tournament.filtros_advance_count || defaultAdvance;
    setAdvanceCount(is7toSmoke ? Math.max(2, saved) : forcePow2(saved, participantCount));
    setGroupSize(tournament.group_size || 2);
    setTimerDurationS(tournament.timer_duration_s || 60);
    setGlobalTimerDurationS(tournament.global_timer_duration_s || 3600);
    setPointsMode(tournament.points_mode || 'accumulated');
  }, [tournament.filtros_advance_count, tournament.group_size, tournament.timer_duration_s, tournament.global_timer_duration_s, tournament.points_mode, participantCount, is7toSmoke]);

  const handleAdvanceChange = (val) => {
    userEdited.current = true;
    const n = Math.max(2, Math.min(val, participantCount));
    setAdvanceCount(is7toSmoke ? n : forcePow2(n, participantCount));
    if (onDirty) onDirty();
  };

  const selectedPhases = computePhases(advanceCount);
  const roundCount = groupSize > 0 ? Math.ceil(participantCount / groupSize) : 0;

  const handleSave = () => {
    const validGroupSize = Math.max(1, groupSize || 1);
    const validTimerDuration = Math.max(5, timerDurationS || 60);
    const validGlobalTimer = Math.max(60, globalTimerDurationS || 3600);
    onSave(selectedPhases, advanceCount, validGroupSize, validTimerDuration, validGlobalTimer, pointsMode);
    setShowConfirm(false);
  };

  const roundCount_ = groupSize > 0 ? Math.ceil(participantCount / groupSize) : 0;
  const timerMin = Math.floor(timerDurationS / 60);
  const timerSec = String(timerDurationS % 60).padStart(2, '0');

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      {/* ── Confirm modal ── */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '28px 32px',
            maxWidth: '460px', width: '100%', border: '1px solid #333',
          }}>
            <h3 style={{ marginBottom: '18px', color: 'var(--accent)', letterSpacing: '0.1em' }}>Confirmar configuración</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '20px' }}>
              <tbody>
                {!is7toSmoke && (
                  <tr>
                    <td style={{ color: 'var(--text-muted)', padding: '5px 0', paddingRight: '16px' }}>Recorrido</td>
                    <td style={{ color: 'var(--text)', fontWeight: 600 }}>{selectedPhases.join(' → ')}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ color: 'var(--text-muted)', padding: '5px 0', paddingRight: '16px' }}>Part. por ronda (Filtros)</td>
                  <td style={{ color: 'var(--text)', fontWeight: 600 }}>{groupSize} ({roundCount_} ronda{roundCount_ !== 1 ? 's' : ''})</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', padding: '5px 0', paddingRight: '16px' }}>
                    {is7toSmoke ? 'Pasan a 7toSmoke' : 'Pasan de Filtros'}
                  </td>
                  <td style={{ color: 'var(--gold)', fontWeight: 700 }}>
                    {advanceCount} de {participantCount}
                    {!is7toSmoke && !isPow2(advanceCount) && (
                      <span style={{ color: 'var(--accent)', fontWeight: 400, fontSize: '0.8rem', marginLeft: '8px' }}>
                        ⚠ no es potencia de 2 — el bracket quedará malformado
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', padding: '5px 0', paddingRight: '16px' }}>Cronómetro de ronda</td>
                  <td style={{ color: 'var(--text)', fontWeight: 600 }}>{timerMin}:{timerSec} ({timerDurationS}s)</td>
                </tr>
                {is7toSmoke && (
                  <>
                    <tr>
                      <td style={{ color: 'var(--text-muted)', padding: '5px 0', paddingRight: '16px' }}>Cronómetro global</td>
                      <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{Math.floor(globalTimerDurationS / 60)} min</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-muted)', padding: '5px 0', paddingRight: '16px' }}>Modo de puntos</td>
                      <td style={{ color: 'var(--text)', fontWeight: 600 }}>
                        {pointsMode === 'consecutive' ? 'Consecutivo (racha)' : 'Acumulado (total victorias)'}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowConfirm(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave}>Confirmar y guardar</button>
            </div>
          </div>
        </div>
      )}
      <h3 style={{ color: 'var(--accent)', marginBottom: '16px' }}>CONFIGURAR FASES</h3>

      {/* Phase visualization — for bracket mode only */}
      {!is7toSmoke && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          {['Filtros', 'Octavos', 'Cuartos', 'Semifinal', 'Final'].map(phase => {
            const active = selectedPhases.includes(phase);
            const threshold = PHASE_THRESHOLDS.find(p => p.name === phase);
            return (
              <div key={phase} style={{
                padding: '10px 20px', borderRadius: 'var(--radius)',
                border: active ? '2px solid var(--accent)' : '2px solid #333',
                background: active ? 'rgba(233, 69, 96, 0.15)' : 'var(--bg-card)',
                color: active ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: active ? 700 : 400, fontSize: '0.95rem', opacity: active ? 1 : 0.5, position: 'relative',
              }}>
                {phase}
                {phase === 'Filtros' && (
                  <span style={{ fontSize: '0.7rem', marginLeft: '6px', color: 'var(--text-muted)' }}>(siempre)</span>
                )}
                {threshold && (
                  <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--text-muted)', marginTop: '2px' }}>
                    &ge;{threshold.min} part.
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 7toSmoke phase flow indicator */}
      {is7toSmoke && (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          {['Filtros', '→', '7toSmoke'].map((label, i) => (
            label === '→' ? (
              <span key={i} style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>→</span>
            ) : (
              <div key={label} style={{
                padding: '10px 20px', borderRadius: 'var(--radius)',
                border: '2px solid var(--accent)',
                background: 'rgba(233,69,96,0.15)',
                color: 'var(--text)', fontWeight: 700, fontSize: '0.95rem',
              }}>{label}</div>
            )
          ))}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '4px' }}>
            Cola dinámica · rey de la pista
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Group size for Filtros */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Participantes por ronda (Filtros):
          </label>
          <input
            type="number" min={1} max={participantCount} value={groupSize}
            onChange={e => { userEdited.current = true; setGroupSize(Number(e.target.value)); if (onDirty) onDirty(); }}
            style={{ width: '70px', textAlign: 'center' }}
          />
          {roundCount > 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              ({roundCount} ronda{roundCount !== 1 ? 's' : ''})
            </span>
          )}
        </div>

        {/* Advance count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            {is7toSmoke ? 'Pasan a 7toSmoke:' : 'Pasan de Filtros:'}
          </label>
          <input
            type="number" min={2} max={participantCount}
            step={1}
            value={advanceCount}
            onChange={e => handleAdvanceChange(Number(e.target.value))}
            style={{ width: '70px', textAlign: 'center' }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>de {participantCount}</span>
          {!is7toSmoke && (
            <span style={{ color: isPow2(advanceCount) ? 'var(--text-muted)' : 'var(--accent)', fontSize: '0.8rem' }}>
              {isPow2(advanceCount) ? '(2, 4, 8, 16…)' : `⚠ se ajusta a ${forcePow2(advanceCount, participantCount)}`}
            </span>
          )}
        </div>

        {/* Timer default duration (per round) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Cronómetro de ronda:
          </label>
          <input
            type="number" min={5} max={3600} value={timerDurationS}
            onChange={e => { userEdited.current = true; setTimerDurationS(Number(e.target.value)); if (onDirty) onDirty(); }}
            style={{ width: '70px', textAlign: 'center' }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>seg</span>
        </div>

        {/* 7toSmoke: global timer duration */}
        {is7toSmoke && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ color: 'var(--gold)', fontSize: '0.95rem' }}>
              Cronómetro global (7toSmoke):
            </label>
            <input
              type="number" min={60} max={7200} value={globalTimerDurationS}
              onChange={e => { userEdited.current = true; setGlobalTimerDurationS(Number(e.target.value)); if (onDirty) onDirty(); }}
              style={{ width: '90px', textAlign: 'center' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>seg</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              ({Math.floor(globalTimerDurationS / 60)}:{String(globalTimerDurationS % 60).padStart(2, '0')})
            </span>
          </div>
        )}

        {/* 7toSmoke: points mode */}
        {is7toSmoke && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ color: 'var(--gold)', fontSize: '0.95rem' }}>Modo de puntos:</label>
            <select
              value={pointsMode}
              onChange={e => { userEdited.current = true; setPointsMode(e.target.value); if (onDirty) onDirty(); }}
              style={{ background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid #333', borderRadius: '6px', padding: '6px 10px' }}
            >
              <option value="accumulated">Acumulado (total victorias)</option>
              <option value="consecutive">Consecutivo (racha actual)</option>
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {(() => {
          const canSave = participantCount >= 2 && judgeCount >= 1;
          return (
            <button
              className="btn-primary"
              onClick={() => canSave && setShowConfirm(true)}
              disabled={!canSave}
              style={!canSave ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
              title={!canSave ? `Necesitas al menos 2 participantes y 1 juez (tienes ${participantCount} y ${judgeCount})` : ''}
            >
              Guardar Configuración
            </button>
          );
        })()}
        {participantCount < 2 || judgeCount < 1 ? (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Añade {participantCount < 2 ? `${2 - participantCount} participante${participantCount === 0 ? 's' : ''} más` : ''}{participantCount < 2 && judgeCount < 1 ? ' y ' : ''}{judgeCount < 1 ? '1 juez' : ''} para continuar
          </span>
        ) : savedOk ? (
          <span style={{ color: '#00c853', fontSize: '0.88rem', fontWeight: 600 }}>✓ Configuración guardada</span>
        ) : null}
        {!is7toSmoke && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Recorrido: {selectedPhases.join(' → ')}
          </span>
        )}
        {is7toSmoke && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Objetivo: {advanceCount} victorias ({pointsMode === 'consecutive' ? 'consecutivas' : 'acumuladas'}) · Tiempo límite: {Math.floor(globalTimerDurationS / 60)} min
          </span>
        )}
      </div>
    </div>
  );
}
