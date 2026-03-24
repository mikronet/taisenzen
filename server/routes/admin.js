const express = require('express');
const router = express.Router();
const db = require('../db');
const { nanoid } = require('nanoid');
const { generateWordCode } = require('../wordCode');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Auth middleware — applied to all routes except login endpoints.
// Accepts admin session token, organizer access_code, or speaker_code.
function requireAdmin(req, res, next) {
  // Public login endpoints
  if (req.path === '/organizer-login' || req.path === '/speaker-login') return next();

  // Check admin token first (DB-backed, survives server restarts) — full access, no tournament scope needed
  const token = req.headers['x-admin-token'];
  if (token) {
    const session = db.prepare('SELECT token FROM admin_sessions WHERE token = ? AND expires_at > ?').get(token, Date.now());
    if (session) return next();
  }

  // Resolve which tournament this request targets so organizer/speaker codes can be scoped
  function resolveTournamentId() {
    const t = req.path.match(/^\/tournaments\/(\d+)/);
    if (t) return Number(t[1]);
    const m = req.path.match(/^\/matches\/(\d+)/);
    if (m) {
      const row = db.prepare('SELECT tournament_id FROM matches WHERE id = ?').get(Number(m[1]));
      return row ? row.tournament_id : null;
    }
    const p = req.path.match(/^\/phases\/(\d+)/);
    if (p) {
      const row = db.prepare('SELECT tournament_id FROM phases WHERE id = ?').get(Number(p[1]));
      return row ? row.tournament_id : null;
    }
    return null;
  }

  const tid = resolveTournamentId();

  // Organizer code — scoped to the organizer's own tournament
  const organizerCode = req.headers['x-organizer-code'];
  if (organizerCode) {
    const organizer = tid
      ? db.prepare('SELECT id FROM organizers WHERE access_code = ? AND tournament_id = ?').get(organizerCode, tid)
      : db.prepare('SELECT id FROM organizers WHERE access_code = ?').get(organizerCode);
    if (organizer) return next();
  }

  // Speaker code — scoped to the speaker's own tournament
  const speakerCode = req.headers['x-speaker-code'];
  if (speakerCode) {
    const tournament = tid
      ? db.prepare('SELECT id FROM tournaments WHERE id = ? AND speaker_code = ?').get(tid, speakerCode)
      : db.prepare('SELECT id FROM tournaments WHERE speaker_code = ?').get(speakerCode);
    if (tournament) return next();
  }

  return res.status(401).json({ error: 'No autorizado' });
}

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    const token = nanoid(32);
    const expiresAt = Date.now() + SESSION_TTL_MS;
    db.prepare('INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)').run(token, expiresAt);
    // Clean up expired sessions on each login
    db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(Date.now());
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
});

// Organizer login is also public (no admin token needed)
// Apply auth to all routes from here onwards
router.use(requireAdmin);

// --- Speaker login (public, no auth required) ---

router.post('/speaker-login', (req, res) => {
  const { code } = req.body;
  const tournament = db.prepare('SELECT id, name FROM tournaments WHERE speaker_code = ?').get(code);
  if (!tournament) return res.status(401).json({ error: 'Código de speaker inválido' });
  res.json({ tournament_id: tournament.id, tournament_name: tournament.name });
});

// --- Tournaments ---

router.post('/tournaments', (req, res) => {
  const { name, type = '1vs1', tournament_type = 'bracket', points_mode = 'accumulated' } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'El nombre del torneo es obligatorio' });
  }
  if (name.length > 200) {
    return res.status(400).json({ error: 'El nombre del torneo es demasiado largo (máx. 200 caracteres)' });
  }
  const speakerCode = generateWordCode();
  const defaultConfig = JSON.stringify(['Filtros', 'Cuartos', 'Semifinal', 'Final']);
  const result = db.prepare(
    'INSERT INTO tournaments (name, type, phase_config, speaker_code, tournament_type, points_mode) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, type, defaultConfig, speakerCode, tournament_type, points_mode);
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(result.lastInsertRowid);
  res.json(tournament);
});

router.get('/tournaments', (req, res) => {
  res.json(db.prepare('SELECT * FROM tournaments ORDER BY created_at DESC').all());
});

router.get('/tournaments/:id', (req, res) => {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(Number(req.params.id));
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });
  res.json(tournament);
});

router.delete('/tournaments/:id', (req, res) => {
  db.prepare('DELETE FROM tournaments WHERE id = ?').run(Number(req.params.id));
  res.json({ success: true });
});

// --- Phase Configuration ---

router.put('/tournaments/:id/phase-config', (req, res) => {
  const tid = Number(req.params.id);
  const { phaseConfig, filtrosAdvanceCount, groupSize, timerDurationS, globalTimerDurationS, pointsMode } = req.body;
  db.prepare(
    'UPDATE tournaments SET phase_config = ?, filtros_advance_count = ?, group_size = ?, timer_duration_s = ?, global_timer_duration_s = ?, points_mode = ? WHERE id = ?'
  ).run(JSON.stringify(phaseConfig), filtrosAdvanceCount || 0, groupSize || 2, timerDurationS || 60, globalTimerDurationS || 3600, pointsMode || 'accumulated', tid);
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tid);
  // Notify all connected clients (including Speaker) that config changed
  req.io.to(`admin:${tid}`).emit('tournament:updated', { id: tid });
  res.json(tournament);
});

// --- Participants ---

router.post('/tournaments/:id/participants', (req, res) => {
  const { name, member1_name = '', member2_name = '' } = req.body;
  const tid = Number(req.params.id);
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
  const duplicate = db.prepare('SELECT id FROM participants WHERE tournament_id = ? AND LOWER(name) = LOWER(?)').get(tid, name.trim());
  if (duplicate) return res.status(400).json({ error: `Ya existe un participante llamado "${name.trim()}"` });
  const count = db.prepare('SELECT COUNT(*) as c FROM participants WHERE tournament_id = ?').get(tid).c;
  const result = db.prepare(
    'INSERT INTO participants (tournament_id, name, seed, member1_name, member2_name) VALUES (?, ?, ?, ?, ?)'
  ).run(tid, name, count + 1, member1_name, member2_name);
  const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(result.lastInsertRowid);

  // Auto-assign to a filtros round if phases have already been generated
  const filtrosPhase = db.prepare("SELECT * FROM phases WHERE tournament_id = ? AND phase_type = 'filtros'").get(tid);
  if (filtrosPhase) {
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tid);
    const groupSize = tournament.group_size || 2;

    // Find the last pending round that still has room
    const lastPendingRound = db.prepare(`
      SELECT m.id, m.match_order, COUNT(mp.participant_id) as participant_count
      FROM matches m
      LEFT JOIN match_participants mp ON m.id = mp.match_id
      WHERE m.phase_id = ? AND m.status = 'pending'
      GROUP BY m.id
      ORDER BY m.match_order DESC
      LIMIT 1
    `).get(filtrosPhase.id);

    let targetMatchId;
    let nextPosition;

    if (lastPendingRound && lastPendingRound.participant_count < groupSize) {
      // There's room in the last pending round — add there
      targetMatchId = lastPendingRound.id;
      nextPosition = lastPendingRound.participant_count + 1;
    } else {
      // Last round is full (or no pending rounds exist) — create a new round
      const maxOrderRow = db.prepare('SELECT MAX(match_order) as maxOrder FROM matches WHERE phase_id = ?').get(filtrosPhase.id);
      const newOrder = (maxOrderRow.maxOrder || 0) + 1;
      const newMatchResult = db.prepare(
        'INSERT INTO matches (tournament_id, phase_id, participant1_id, participant2_id, status, match_order) VALUES (?, ?, NULL, NULL, ?, ?)'
      ).run(tid, filtrosPhase.id, 'pending', newOrder);
      targetMatchId = newMatchResult.lastInsertRowid;
      nextPosition = 1;

      // Keep phases.size in sync (used for round count display)
      db.prepare('UPDATE phases SET size = size + 1 WHERE id = ?').run(filtrosPhase.id);
    }

    db.prepare('INSERT INTO match_participants (match_id, participant_id, position) VALUES (?, ?, ?)').run(targetMatchId, participant.id, nextPosition);

    // Notify admin so the bracket/round list refreshes automatically
    req.io.to(`admin:${tid}`).emit('tournament:updated', { id: tid });
  }

  req.io.to(`screen:${tid}`).emit('participant:added', participant);
  res.json(participant);
});

router.get('/tournaments/:id/participants', (req, res) => {
  res.json(db.prepare('SELECT * FROM participants WHERE tournament_id = ? ORDER BY seed').all(Number(req.params.id)));
});

router.delete('/participants/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM participants WHERE id = ?').get(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'No encontrado' });
  db.prepare('DELETE FROM participants WHERE id = ?').run(Number(req.params.id));
  req.io.to(`screen:${p.tournament_id}`).emit('participant:removed', p);
  res.json({ success: true });
});

// --- Update participant score (admin manual edit) ---

router.put('/participants/:id/score', (req, res) => {
  const pid = Number(req.params.id);
  const { score } = req.body;
  if (typeof score !== 'number' || isNaN(score)) {
    return res.status(400).json({ error: 'Puntuación inválida' });
  }
  const p = db.prepare('SELECT * FROM participants WHERE id = ?').get(pid);
  if (!p) return res.status(404).json({ error: 'Participante no encontrado' });
  db.prepare('UPDATE participants SET total_score = ? WHERE id = ?').run(score, pid);
  res.json({ success: true, id: pid, total_score: score });
});

// --- Judges ---

router.post('/tournaments/:id/judges', (req, res) => {
  const tid = Number(req.params.id);
  const { name } = req.body;
  // Block if any match is currently live — changing judge count mid-match breaks vote tracking
  const hasLiveMatch = db.prepare("SELECT id FROM matches WHERE tournament_id = ? AND status = 'live'").get(tid);
  if (hasLiveMatch) return res.status(400).json({ error: 'No se puede añadir un juez mientras hay un match en curso' });
  const code = generateWordCode();
  const result = db.prepare('INSERT INTO judges (tournament_id, name, access_code) VALUES (?, ?, ?)').run(tid, name, code);
  const judge = db.prepare('SELECT * FROM judges WHERE id = ?').get(result.lastInsertRowid);
  res.json(judge);
});

router.get('/tournaments/:id/judges', (req, res) => {
  res.json(db.prepare('SELECT * FROM judges WHERE tournament_id = ?').all(Number(req.params.id)));
});

router.delete('/judges/:id', (req, res) => {
  const jid = Number(req.params.id);
  const judge = db.prepare('SELECT * FROM judges WHERE id = ?').get(jid);
  if (!judge) return res.status(404).json({ error: 'Juez no encontrado' });
  // Block if any match is currently live — changing judge count mid-match breaks vote tracking
  const hasLiveMatch = db.prepare("SELECT id FROM matches WHERE tournament_id = ? AND status = 'live'").get(judge.tournament_id);
  if (hasLiveMatch) return res.status(400).json({ error: 'No se puede eliminar un juez mientras hay un match en curso' });
  db.prepare('DELETE FROM judges WHERE id = ?').run(jid);
  res.json({ success: true });
});

// --- Organizers ---

router.post('/tournaments/:id/organizers', (req, res) => {
  const { name } = req.body;
  const code = generateWordCode();
  const result = db.prepare('INSERT INTO organizers (tournament_id, name, access_code) VALUES (?, ?, ?)').run(Number(req.params.id), name, code);
  const organizer = db.prepare('SELECT * FROM organizers WHERE id = ?').get(result.lastInsertRowid);
  res.json(organizer);
});

router.get('/tournaments/:id/organizers', (req, res) => {
  res.json(db.prepare('SELECT * FROM organizers WHERE tournament_id = ?').all(Number(req.params.id)));
});

router.delete('/organizers/:id', (req, res) => {
  db.prepare('DELETE FROM organizers WHERE id = ?').run(Number(req.params.id));
  res.json({ success: true });
});

// --- Organizer login (by code → gets tournament access) ---

router.post('/organizer-login', (req, res) => {
  const { code } = req.body;
  const organizer = db.prepare(
    'SELECT o.*, t.name as tournament_name FROM organizers o JOIN tournaments t ON o.tournament_id = t.id WHERE o.access_code = ?'
  ).get(code);
  if (!organizer) return res.status(401).json({ error: 'Código de organizador inválido' });
  res.json(organizer);
});

// --- Phase name editing ---

router.put('/phases/:id/name', (req, res) => {
  const { name } = req.body;
  db.prepare('UPDATE phases SET name = ? WHERE id = ?').run(name, Number(req.params.id));
  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(Number(req.params.id));
  if (phase) {
    req.io.to(`screen:${phase.tournament_id}`).emit('phase:renamed', phase);
  }
  res.json(phase);
});

// --- Generate Phases ---

router.post('/tournaments/:id/generate-phases', (req, res) => {
  const tid = Number(req.params.id);
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tid);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  // Clean existing data
  db.run('DELETE FROM filtros_scores WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = ?)', [tid]);
  db.run('DELETE FROM match_participants WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = ?)', [tid]);
  db.run('DELETE FROM votes WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = ?)', [tid]);
  db.run('DELETE FROM matches WHERE tournament_id = ?', [tid]);
  db.run('DELETE FROM phases WHERE tournament_id = ?', [tid]);
  db.run('UPDATE participants SET eliminated = 0, total_score = 0 WHERE tournament_id = ?', [tid]);

  const participants = db.prepare('SELECT * FROM participants WHERE tournament_id = ? ORDER BY seed').all(tid);
  let phaseConfig;
  try {
    phaseConfig = JSON.parse(tournament.phase_config || '[]');
  } catch {
    phaseConfig = ['Filtros', 'Cuartos', 'Semifinal', 'Final'];
  }

  if (phaseConfig.length === 0) {
    phaseConfig = ['Filtros', 'Cuartos', 'Semifinal', 'Final'];
  }

  // Ensure Filtros is first
  if (phaseConfig[0] !== 'Filtros') {
    phaseConfig.unshift('Filtros');
  }

  const advanceCount = tournament.filtros_advance_count || participants.length;
  const groupSize = tournament.group_size || 2;

  // --- 7toSmoke: only Filtros + one 7toSmoke phase ---
  if (tournament.tournament_type === '7tosmoke') {
    const txn = db.transaction(() => {
      const roundCount = Math.ceil(participants.length / groupSize);
      const filtrosResult = db.prepare(
        'INSERT INTO phases (tournament_id, name, phase_order, size, status, phase_type) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(tid, 'Filtros', 1, roundCount, 'active', 'filtros');
      const filtrosPhaseId = filtrosResult.lastInsertRowid;
      db.prepare('UPDATE tournaments SET current_phase_id = ? WHERE id = ?').run(filtrosPhaseId, tid);

      for (let r = 0; r < roundCount; r++) {
        const matchResult = db.prepare(
          'INSERT INTO matches (tournament_id, phase_id, participant1_id, participant2_id, status, match_order) VALUES (?, ?, NULL, NULL, ?, ?)'
        ).run(tid, filtrosPhaseId, 'pending', r + 1);
        const matchId = matchResult.lastInsertRowid;
        const startIdx = r * groupSize;
        participants.slice(startIdx, startIdx + groupSize).forEach((p, pos) => {
          db.prepare('INSERT INTO match_participants (match_id, participant_id, position) VALUES (?, ?, ?)').run(matchId, p.id, pos + 1);
        });
      }

      // 7toSmoke phase (pending until advance-7tosmoke is called)
      db.prepare(
        'INSERT INTO phases (tournament_id, name, phase_order, size, status, phase_type) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(tid, '7toSmoke', 2, advanceCount, 'pending', '7tosmoke');
    });
    txn();

    db.prepare('UPDATE tournaments SET status = ?, screen_state = NULL WHERE id = ?').run('active', tid);
    const timerDuration = tournament.timer_duration_s || 60;
    db.prepare('UPDATE tournaments SET timer_status = ?, timer_start_at = NULL, timer_remaining_s = NULL, global_timer_status = ?, global_timer_start_at = NULL, global_timer_remaining_s = NULL WHERE id = ?')
      .run('idle', 'idle', tid);
    req.io.to(`admin:${tid}`).emit('timer:update', { status: 'idle', startAt: null, remainingS: null, durationS: timerDuration });
    req.io.to(`screen:${tid}`).emit('timer:update', { status: 'idle', startAt: null, remainingS: null, durationS: timerDuration });
    const globalDuration = tournament.global_timer_duration_s || 3600;
    req.io.to(`admin:${tid}`).emit('global-timer:update', { status: 'idle', startAt: null, remainingS: null, durationS: globalDuration });
    req.io.to(`screen:${tid}`).emit('global-timer:update', { status: 'idle', startAt: null, remainingS: null, durationS: globalDuration });

    const responseData = buildTournamentData(tid);
    req.io.to(`screen:${tid}`).emit('tournament:updated', responseData);
    return res.json(responseData);
  }

  // Minimum players required per named elimination phase
  const PHASE_MIN_PLAYERS = {
    'Dieciseisavos': 32,
    'Octavos': 16,
    'Cuartos': 8,
    'Semifinal': 4,
    'Final': 2
  };

  // Filter elimination phases: skip any that need more players than will advance
  const elimPhaseNames = phaseConfig.slice(1).filter(name => {
    const minNeeded = PHASE_MIN_PLAYERS[name] || 2;
    return advanceCount >= minNeeded;
  });
  // Always keep at least Final (2 players) as last phase
  if (elimPhaseNames.length === 0) elimPhaseNames.push('Final');

  const txn = db.transaction(() => {
    // Phase 1: Filtros — rounds with N participants each
    const roundCount = Math.ceil(participants.length / groupSize);
    const filtrosResult = db.prepare(
      'INSERT INTO phases (tournament_id, name, phase_order, size, status, phase_type) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(tid, phaseConfig[0], 1, roundCount, 'active', 'filtros');
    const filtrosPhaseId = filtrosResult.lastInsertRowid;

    db.prepare('UPDATE tournaments SET current_phase_id = ? WHERE id = ?').run(filtrosPhaseId, tid);

    // Create rounds and populate match_participants
    for (let r = 0; r < roundCount; r++) {
      const matchResult = db.prepare(
        'INSERT INTO matches (tournament_id, phase_id, participant1_id, participant2_id, status, match_order) VALUES (?, ?, NULL, NULL, ?, ?)'
      ).run(tid, filtrosPhaseId, 'pending', r + 1);
      const matchId = matchResult.lastInsertRowid;

      // Add participants for this round
      const startIdx = r * groupSize;
      const roundParticipants = participants.slice(startIdx, startIdx + groupSize);
      roundParticipants.forEach((p, pos) => {
        db.prepare('INSERT INTO match_participants (match_id, participant_id, position) VALUES (?, ?, ?)').run(matchId, p.id, pos + 1);
      });
    }

    // Subsequent elimination phases (only those with enough capacity)
    let remainingCount = advanceCount;
    for (let i = 0; i < elimPhaseNames.length; i++) {
      const matchCount = Math.ceil(remainingCount / 2);
      if (matchCount < 1) break;

      const phaseResult = db.prepare(
        'INSERT INTO phases (tournament_id, name, phase_order, size, status, phase_type) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(tid, elimPhaseNames[i], i + 2, matchCount, 'pending', 'elimination');
      const phaseId = phaseResult.lastInsertRowid;

      for (let m = 0; m < matchCount; m++) {
        db.prepare(
          'INSERT INTO matches (tournament_id, phase_id, participant1_id, participant2_id, status, match_order) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(tid, phaseId, null, null, 'pending', m + 1);
      }

      remainingCount = matchCount;
    }
  });
  txn();

  db.prepare('UPDATE tournaments SET status = ?, screen_state = NULL WHERE id = ?').run('active', tid);

  // Reset timer so it doesn't carry stale state into the restarted tournament
  const timerDuration = tournament.timer_duration_s || 60;
  db.prepare('UPDATE tournaments SET timer_status = ?, timer_start_at = NULL, timer_remaining_s = NULL WHERE id = ?')
    .run('idle', tid);
  req.io.to(`admin:${tid}`).emit('timer:update', { status: 'idle', startAt: null, remainingS: null, durationS: timerDuration });
  req.io.to(`screen:${tid}`).emit('timer:update', { status: 'idle', startAt: null, remainingS: null, durationS: timerDuration });

  const responseData = buildTournamentData(tid);
  req.io.to(`screen:${tid}`).emit('tournament:updated', responseData);
  res.json(responseData);
});

// --- Update matchups (elimination phases) ---

router.post('/tournaments/:id/update-matchups', (req, res) => {
  const tid = Number(req.params.id);
  const { matchups } = req.body;

  matchups.forEach(m => {
    if (m.matchId) {
      db.run('UPDATE matches SET participant1_id = ?, participant2_id = ? WHERE id = ? AND tournament_id = ?',
        [m.p1, m.p2, m.matchId, tid]);
    }
  });

  const responseData = buildTournamentData(tid);
  req.io.to(`screen:${tid}`).emit('tournament:updated', responseData);
  res.json(responseData);
});

// --- Match lifecycle ---

router.post('/matches/:id/prepare', (req, res) => {
  const mid = Number(req.params.id);
  const match = db.prepare(`
    SELECT m.*, ph.name as phase_name, ph.phase_type
    FROM matches m LEFT JOIN phases ph ON m.phase_id = ph.id WHERE m.id = ?
  `).get(mid);
  if (!match) return res.status(404).json({ error: 'Match no encontrado' });

  if (match.phase_type === 'filtros') {
    const roundParticipants = db.prepare(`
      SELECT mp.position, p.id, p.name, p.member1_name, p.member2_name
      FROM match_participants mp JOIN participants p ON mp.participant_id = p.id
      WHERE mp.match_id = ? ORDER BY mp.position
    `).all(mid);
    match.participants = roundParticipants;
  } else {
    const p1 = match.participant1_id ? db.prepare('SELECT name FROM participants WHERE id = ?').get(match.participant1_id) : null;
    const p2 = match.participant2_id ? db.prepare('SELECT name FROM participants WHERE id = ?').get(match.participant2_id) : null;
    match.participant1_name = p1 ? p1.name : null;
    match.participant2_name = p2 ? p2.name : null;
  }

  db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?')
    .run(JSON.stringify({ mode: 'prepare', match }), match.tournament_id);

  req.io.to(`screen:${match.tournament_id}`).emit('match:prepare', match);
  res.json(match);
});

router.post('/matches/:id/start', (req, res) => {
  const mid = Number(req.params.id);
  const match = db.prepare(`
    SELECT m.*, ph.name as phase_name, ph.phase_type
    FROM matches m LEFT JOIN phases ph ON m.phase_id = ph.id WHERE m.id = ?
  `).get(mid);
  if (!match) return res.status(404).json({ error: 'Match no encontrado' });
  if (match.status === 'live') return res.status(400).json({ error: 'El match ya está en curso' });
  if (match.status === 'finished') return res.status(400).json({ error: 'El match ya ha terminado' });

  // Clean previous scores/votes for this match
  db.run('DELETE FROM filtros_scores WHERE match_id = ?', [mid]);
  db.run('DELETE FROM votes WHERE match_id = ?', [mid]);
  db.prepare('UPDATE matches SET status = ? WHERE id = ?').run('live', mid);
  match.status = 'live';

  if (match.phase_type === 'filtros') {
    // Get all participants for this round (include member names for 2vs2)
    const roundParticipants = db.prepare(`
      SELECT mp.position, p.id, p.name, p.member1_name, p.member2_name
      FROM match_participants mp JOIN participants p ON mp.participant_id = p.id
      WHERE mp.match_id = ? ORDER BY mp.position
    `).all(mid);
    match.participants = roundParticipants;
  } else {
    // Get participant names for elimination match
    const p1 = match.participant1_id ? db.prepare('SELECT name FROM participants WHERE id = ?').get(match.participant1_id) : null;
    const p2 = match.participant2_id ? db.prepare('SELECT name FROM participants WHERE id = ?').get(match.participant2_id) : null;
    match.participant1_name = p1 ? p1.name : null;
    match.participant2_name = p2 ? p2.name : null;
  }

  db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?')
    .run(JSON.stringify({ mode: 'live', match }), match.tournament_id);

  // 7toSmoke: auto-start global timer on the very first smoke battle (when idle)
  if (match.phase_type === '7tosmoke') {
    const tData = db.prepare('SELECT global_timer_status, global_timer_remaining_s, global_timer_duration_s FROM tournaments WHERE id = ?').get(match.tournament_id);
    if (tData && tData.global_timer_status === 'idle') {
      const durationS = tData.global_timer_duration_s || 3600;
      db.prepare('UPDATE tournaments SET global_timer_status = ?, global_timer_start_at = ?, global_timer_remaining_s = ? WHERE id = ?')
        .run('running', Date.now(), durationS, match.tournament_id);
      const gState = getGlobalTimerState(match.tournament_id);
      req.io.to(`screen:${match.tournament_id}`).emit('global-timer:update', gState);
      req.io.to(`admin:${match.tournament_id}`).emit('global-timer:update', gState);
    }
  }

  req.io.to(`screen:${match.tournament_id}`).emit('match:started', match);
  req.io.to(`judge:${match.tournament_id}`).emit('match:started', match);
  res.json(match);
});

// --- Close Filtros round (accumulate scores, no visible result) ---

router.post('/matches/:id/close-round', (req, res) => {
  const mid = Number(req.params.id);
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(mid);
  if (!match) return res.status(404).json({ error: 'Match no encontrado' });

  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(match.phase_id);
  if (phase.phase_type !== 'filtros') return res.status(400).json({ error: 'Solo para rondas de Filtros' });

  // Check all judges scored all participants
  const judgeCount = db.prepare('SELECT COUNT(*) as c FROM judges WHERE tournament_id = ?').get(match.tournament_id).c;
  const roundParticipants = db.prepare('SELECT * FROM match_participants WHERE match_id = ?').all(mid);
  const expectedScores = judgeCount * roundParticipants.length;
  const actualScores = db.prepare('SELECT COUNT(*) as c FROM filtros_scores WHERE match_id = ?').get(mid).c;

  if (actualScores < expectedScores) {
    return res.status(400).json({ error: `Faltan puntuaciones: ${actualScores}/${expectedScores}` });
  }

  // Accumulate scores on participants
  roundParticipants.forEach(mp => {
    const totalForParticipant = db.prepare(
      'SELECT COALESCE(SUM(score), 0) as total FROM filtros_scores WHERE match_id = ? AND participant_id = ?'
    ).get(mid, mp.participant_id);
    db.run('UPDATE participants SET total_score = total_score + ? WHERE id = ?',
      [totalForParticipant.total, mp.participant_id]);
  });

  // Mark round as finished
  db.prepare('UPDATE matches SET status = ? WHERE id = ?').run('finished', mid);

  // Check if all Filtros rounds are done
  const pendingInPhase = db.prepare("SELECT COUNT(*) as c FROM matches WHERE phase_id = ? AND status NOT IN ('finished')").get(match.phase_id).c;
  if (pendingInPhase === 0) {
    db.prepare('UPDATE phases SET status = ? WHERE id = ?').run('finished', match.phase_id);
    // Ranking is NOT emitted automatically — admin/organizer triggers it manually via show-ranking
  }

  db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?')
    .run(JSON.stringify({ mode: 'idle' }), match.tournament_id);

  // Notify judge/screen that round is closed (no result shown)
  req.io.to(`screen:${match.tournament_id}`).emit('round:closed', { matchId: mid });
  req.io.to(`judge:${match.tournament_id}`).emit('round:closed', { matchId: mid });
  req.io.to(`admin:${match.tournament_id}`).emit('round:closed', { matchId: mid });

  // Emit updated tournament data
  const responseData = buildTournamentData(match.tournament_id);
  req.io.to(`screen:${match.tournament_id}`).emit('tournament:updated', responseData);

  res.json({ success: true });
});

// --- Reveal result (elimination phases only) ---

router.post('/matches/:id/reveal', (req, res) => {
  const mid = Number(req.params.id);
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(mid);
  if (!match) return res.status(404).json({ error: 'Match no encontrado' });
  if (match.status === 'finished') return res.status(400).json({ error: 'El match ya ha terminado' });
  if (match.status === 'pending') return res.status(400).json({ error: 'El match no ha comenzado' });

  const phase = db.prepare('SELECT * FROM phases WHERE id = ?').get(match.phase_id);
  if (phase.phase_type === 'filtros') {
    return res.status(400).json({ error: 'Usa close-round para Filtros' });
  }

  const votes = db.prepare('SELECT * FROM votes WHERE match_id = ?').all(mid);
  // For tiebreakers, only the allowed judges need to have voted (not all judges)
  let allowedJudgesParsed = [];
  try { allowedJudgesParsed = JSON.parse(match.allowed_judges || '[]'); } catch { allowedJudgesParsed = []; }
  const judgeCount = match.is_tiebreaker
    ? allowedJudgesParsed.length
    : db.prepare('SELECT COUNT(*) as c FROM judges WHERE tournament_id = ?').get(match.tournament_id).c;
  if (votes.length < judgeCount) return res.status(400).json({ error: 'No todos los jueces han votado' });

  // Elimination: count winner votes
  let p1Votes = 0, p2Votes = 0, ties = 0;
  votes.forEach(v => {
    if (v.choice === 'participant1') p1Votes++;
    else if (v.choice === 'participant2') p2Votes++;
    else ties++;
  });

  let winnerId = null;
  if (p1Votes > p2Votes) winnerId = match.participant1_id;
  else if (p2Votes > p1Votes) winnerId = match.participant2_id;

  // --- 7toSmoke win resolution ---
  if (winnerId && phase.phase_type === '7tosmoke') {
    const loserId = winnerId === match.participant1_id ? match.participant2_id : match.participant1_id;
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(match.tournament_id);
    const pointsMode = tournament.points_mode || 'accumulated';

    if (pointsMode === 'consecutive') {
      const sp = db.prepare('SELECT consecutive_points FROM smoke_points WHERE phase_id = ? AND participant_id = ?').get(phase.id, winnerId);
      const newStreak = (sp?.consecutive_points || 0) + 1;
      db.prepare('UPDATE smoke_points SET consecutive_points = ?, points = ? WHERE phase_id = ? AND participant_id = ?')
        .run(newStreak, newStreak, phase.id, winnerId);
      db.prepare('UPDATE smoke_points SET consecutive_points = 0, points = 0 WHERE phase_id = ? AND participant_id = ?')
        .run(phase.id, loserId);
    } else {
      // accumulated (default)
      db.prepare('UPDATE smoke_points SET points = points + 1, consecutive_points = consecutive_points + 1 WHERE phase_id = ? AND participant_id = ?')
        .run(phase.id, winnerId);
      db.prepare('UPDATE smoke_points SET consecutive_points = 0 WHERE phase_id = ? AND participant_id = ?')
        .run(phase.id, loserId);
    }

    const targetPoints = db.prepare('SELECT COUNT(*) as c FROM smoke_points WHERE phase_id = ?').get(phase.id).c;
    const winnerPoints = db.prepare('SELECT points FROM smoke_points WHERE phase_id = ? AND participant_id = ?').get(phase.id, winnerId);

    db.prepare('UPDATE matches SET winner_id = ?, status = ? WHERE id = ?').run(winnerId, 'finished', mid);

    if (targetPoints > 0 && winnerPoints && winnerPoints.points >= targetPoints) {
      // Tournament winner!
      db.prepare('UPDATE participants SET eliminated = 1 WHERE id = ?').run(loserId);
      db.prepare('UPDATE phases SET status = ? WHERE id = ?').run('finished', phase.id);
      db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('finished', match.tournament_id);
      const winnerName = db.prepare('SELECT name FROM participants WHERE id = ?').get(winnerId)?.name;
      db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?')
        .run(JSON.stringify({ mode: 'finished', winnerName }), match.tournament_id);
      req.io.to(`screen:${match.tournament_id}`).emit('tournament:finished', { tournamentId: match.tournament_id });
    } else {
      // Update queue: winner stays at front, loser goes to end
      let currentQueue;
      try { currentQueue = JSON.parse(phase.queue_state || '[]'); } catch { currentQueue = []; }
      const newQueue = [winnerId, ...currentQueue.slice(2), loserId];
      db.prepare('UPDATE phases SET queue_state = ? WHERE id = ?').run(JSON.stringify(newQueue), phase.id);

      // Create next match
      const matchCount = db.prepare('SELECT COUNT(*) as c FROM matches WHERE phase_id = ?').get(phase.id).c;
      db.prepare('INSERT INTO matches (tournament_id, phase_id, participant1_id, participant2_id, status, match_order) VALUES (?, ?, ?, ?, ?, ?)')
        .run(match.tournament_id, phase.id, newQueue[0], newQueue[1], 'pending', matchCount + 1);

      db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?')
        .run(JSON.stringify({ mode: 'idle' }), match.tournament_id);
    }

    const updatedMatch = db.prepare(`
      SELECT m.*, p1.name as participant1_name, p2.name as participant2_name, w.name as winner_name
      FROM matches m LEFT JOIN participants p1 ON m.participant1_id = p1.id
      LEFT JOIN participants p2 ON m.participant2_id = p2.id LEFT JOIN participants w ON m.winner_id = w.id WHERE m.id = ?
    `).get(mid);
    const voteDetails = db.prepare('SELECT v.*, j.name as judge_name FROM votes v JOIN judges j ON v.judge_id = j.id WHERE v.match_id = ?').all(mid);
    const smokeResultData = {
      match: updatedMatch, votes: voteDetails, phaseType: '7tosmoke',
      summary: { participant1: p1Votes, participant2: p2Votes, ties }
    };

    req.io.to(`screen:${match.tournament_id}`).emit('match:result', smokeResultData);
    req.io.to(`judge:${match.tournament_id}`).emit('match:result', smokeResultData);
    req.io.to(`admin:${match.tournament_id}`).emit('match:result', smokeResultData);

    const responseData = buildTournamentData(match.tournament_id);
    req.io.to(`screen:${match.tournament_id}`).emit('tournament:updated', responseData);
    req.io.to(`admin:${match.tournament_id}`).emit('tournament:updated', responseData);

    return res.json(smokeResultData);
  }

  if (winnerId) {
    db.prepare('UPDATE matches SET winner_id = ?, status = ? WHERE id = ?').run(winnerId, 'finished', mid);
    const loserId = winnerId === match.participant1_id ? match.participant2_id : match.participant1_id;
    db.prepare('UPDATE participants SET eliminated = 1 WHERE id = ?').run(loserId);

    // Advance winner to next phase
    const nextPhase = db.prepare('SELECT * FROM phases WHERE tournament_id = ? AND phase_order = ?').get(match.tournament_id, phase.phase_order + 1);
    if (nextPhase) {
      const nextMatchOrder = Math.ceil(match.match_order / 2);
      const nextMatch = db.prepare('SELECT * FROM matches WHERE phase_id = ? AND match_order = ?').get(nextPhase.id, nextMatchOrder);
      if (nextMatch) {
        const slot = match.match_order % 2 !== 0 ? 'participant1_id' : 'participant2_id';
        db.run(`UPDATE matches SET ${slot} = ? WHERE id = ?`, [winnerId, nextMatch.id]);
      }
    }

    // Check if phase is complete
    const pendingInPhase = db.prepare("SELECT COUNT(*) as c FROM matches WHERE phase_id = ? AND status != 'finished'").get(match.phase_id).c;
    if (pendingInPhase === 0) {
      db.prepare('UPDATE phases SET status = ? WHERE id = ?').run('finished', match.phase_id);
      if (nextPhase) {
        db.prepare('UPDATE phases SET status = ? WHERE id = ?').run('active', nextPhase.id);
        db.prepare('UPDATE tournaments SET current_phase_id = ? WHERE id = ?').run(nextPhase.id, match.tournament_id);
      } else {
        db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run('finished', match.tournament_id);
      }
    }
  } else {
    // Store which judges voted EMPATE — only they can vote in the tiebreaker round
    const tieJudgeIds = votes.filter(v => v.choice === 'tie').map(v => v.judge_id);
    db.prepare('UPDATE matches SET status = ?, allowed_judges = ? WHERE id = ?')
      .run('tie', JSON.stringify(tieJudgeIds), mid);

    // Persist tie state for screen reconnect
    db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?')
      .run(JSON.stringify({ mode: 'result', resultData: { match: { ...match, status: 'tie' }, phaseType: 'elimination', summary: { participant1: p1Votes, participant2: p2Votes, ties } } }), match.tournament_id);
  }

  const updatedMatch = db.prepare(`
    SELECT m.*, p1.name as participant1_name, p2.name as participant2_name, w.name as winner_name
    FROM matches m LEFT JOIN participants p1 ON m.participant1_id = p1.id
    LEFT JOIN participants p2 ON m.participant2_id = p2.id LEFT JOIN participants w ON m.winner_id = w.id WHERE m.id = ?
  `).get(mid);

  const voteDetails = db.prepare('SELECT v.*, j.name as judge_name FROM votes v JOIN judges j ON v.judge_id = j.id WHERE v.match_id = ?').all(mid);
  const resultData = {
    match: updatedMatch,
    votes: voteDetails,
    phaseType: 'elimination',
    summary: { participant1: p1Votes, participant2: p2Votes, ties }
  };

  // Determine screen state: result if winner, result (tie) if empate, finished if tournament over
  const updatedTournament = db.prepare('SELECT status FROM tournaments WHERE id = ?').get(match.tournament_id);
  if (updatedTournament?.status === 'finished') {
    db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?')
      .run(JSON.stringify({ mode: 'finished', winnerName: updatedMatch.winner_name || null }), match.tournament_id);
  } else {
    db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?')
      .run(JSON.stringify({ mode: 'result', resultData }), match.tournament_id);
  }

  req.io.to(`screen:${match.tournament_id}`).emit('match:result', resultData);
  req.io.to(`judge:${match.tournament_id}`).emit('match:result', resultData);
  req.io.to(`admin:${match.tournament_id}`).emit('match:result', resultData);

  // Emit updated tournament data
  const responseData = buildTournamentData(match.tournament_id);
  req.io.to(`screen:${match.tournament_id}`).emit('tournament:updated', responseData);

  res.json(resultData);
});

// --- Advance from Filtros to 7toSmoke phase ---

router.post('/tournaments/:id/advance-7tosmoke', (req, res) => {
  const tid = Number(req.params.id);
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tid);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });
  if (tournament.tournament_type !== '7tosmoke') return res.status(400).json({ error: 'Este torneo no es de tipo 7toSmoke' });

  const filtrosPhase = db.prepare("SELECT * FROM phases WHERE tournament_id = ? AND phase_type = 'filtros'").get(tid);
  if (!filtrosPhase) return res.status(400).json({ error: 'No hay fase de Filtros' });

  const pendingFiltros = db.prepare("SELECT COUNT(*) as c FROM matches WHERE phase_id = ? AND status NOT IN ('finished')").get(filtrosPhase.id).c;
  if (pendingFiltros > 0) return res.status(400).json({ error: 'Aún hay rondas pendientes en Filtros' });

  const advanceCount = tournament.filtros_advance_count || 0;
  if (advanceCount < 2) return res.status(400).json({ error: 'Configura cuántos participantes avanzan (mínimo 2)' });

  const smokePhase = db.prepare("SELECT * FROM phases WHERE tournament_id = ? AND phase_type = '7tosmoke'").get(tid);
  if (!smokePhase) return res.status(400).json({ error: 'No hay fase 7toSmoke configurada' });

  const allParticipants = db.prepare('SELECT * FROM participants WHERE tournament_id = ? ORDER BY total_score DESC, id ASC').all(tid);
  const cutoffScore = allParticipants[advanceCount - 1]?.total_score;
  const nextScore = allParticipants[advanceCount]?.total_score;
  if (cutoffScore !== undefined && nextScore !== undefined && cutoffScore === nextScore) {
    return res.status(400).json({
      error: `Hay empate de puntuación (${cutoffScore.toFixed(1)}) en la zona de corte. Edita las puntuaciones para desempatar.`
    });
  }

  const advancing = allParticipants.slice(0, advanceCount);
  const eliminated = allParticipants.slice(advanceCount);
  const queue = advancing.map(p => p.id);

  const txn = db.transaction(() => {
    eliminated.forEach(p => db.prepare('UPDATE participants SET eliminated = 1 WHERE id = ?').run(p.id));
    advancing.forEach((p, idx) => db.prepare('UPDATE participants SET seed = ?, eliminated = 0 WHERE id = ?').run(idx + 1, p.id));

    // Initialize smoke_points for each advancing participant
    advancing.forEach(p => {
      db.prepare('INSERT OR IGNORE INTO smoke_points (tournament_id, phase_id, participant_id, points, consecutive_points) VALUES (?, ?, ?, 0, 0)')
        .run(tid, smokePhase.id, p.id);
    });

    // Activate 7toSmoke phase with initial queue
    db.prepare('UPDATE phases SET status = ?, queue_state = ? WHERE id = ?')
      .run('active', JSON.stringify(queue), smokePhase.id);
    db.prepare('UPDATE tournaments SET current_phase_id = ? WHERE id = ?').run(smokePhase.id, tid);

    // Create first match
    db.prepare('INSERT INTO matches (tournament_id, phase_id, participant1_id, participant2_id, status, match_order) VALUES (?, ?, ?, ?, ?, ?)')
      .run(tid, smokePhase.id, queue[0], queue[1], 'pending', 1);
  });
  txn();

  db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?').run(JSON.stringify({ mode: 'idle' }), tid);

  req.io.to(`screen:${tid}`).emit('filtros:advance', {
    advancing: advancing.map(p => p.name),
    eliminated: eliminated.map(p => p.name)
  });

  const responseData = buildTournamentData(tid);
  req.io.to(`screen:${tid}`).emit('tournament:updated', responseData);
  req.io.to(`admin:${tid}`).emit('tournament:updated', responseData);

  res.json({ ...responseData, advancing: advancing.map(p => p.name) });
});

// --- Advance from Filtros (seeding) ---

router.post('/tournaments/:id/advance-filtros', (req, res) => {
  const tid = Number(req.params.id);
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tid);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  const filtrosPhase = db.prepare("SELECT * FROM phases WHERE tournament_id = ? AND phase_type = 'filtros'").get(tid);
  if (!filtrosPhase) return res.status(400).json({ error: 'No hay fase de Filtros' });

  const pendingFiltros = db.prepare("SELECT COUNT(*) as c FROM matches WHERE phase_id = ? AND status NOT IN ('finished')").get(filtrosPhase.id).c;
  if (pendingFiltros > 0) return res.status(400).json({ error: 'Aún hay rondas pendientes en Filtros' });

  const advanceCount = tournament.filtros_advance_count || 0;
  if (advanceCount === 0) return res.status(400).json({ error: 'Configura cuántos participantes avanzan' });
  if (advanceCount % 2 !== 0) return res.status(400).json({ error: 'El número de participantes que pasan debe ser par' });

  // Rank participants by total_score descending (admin should have resolved ties by editing scores)
  const allParticipants = db.prepare('SELECT * FROM participants WHERE tournament_id = ? ORDER BY total_score DESC, id ASC').all(tid);

  // Warn if there are ties at the cutoff boundary
  const cutoffScore = allParticipants[advanceCount - 1]?.total_score;
  const nextScore = allParticipants[advanceCount]?.total_score;
  if (cutoffScore !== undefined && nextScore !== undefined && cutoffScore === nextScore) {
    return res.status(400).json({
      error: `Hay empate de puntuación (${cutoffScore.toFixed(1)}) en la zona de corte. Edita las puntuaciones en el ranking para desempatar antes de avanzar.`
    });
  }

  const advancing = allParticipants.slice(0, advanceCount);
  const eliminated = allParticipants.slice(advanceCount);

  const txn = db.transaction(() => {
    eliminated.forEach(p => {
      db.prepare('UPDATE participants SET eliminated = 1 WHERE id = ?').run(p.id);
    });

    advancing.forEach((p, idx) => {
      db.prepare('UPDATE participants SET seed = ?, eliminated = 0 WHERE id = ?').run(idx + 1, p.id);
    });

    // Seed into next phase using standard tournament seeding
    const nextPhase = db.prepare('SELECT * FROM phases WHERE tournament_id = ? AND phase_order = ?').get(tid, 2);
    if (nextPhase) {
      const nextMatches = db.prepare('SELECT * FROM matches WHERE phase_id = ? ORDER BY match_order').all(nextPhase.id);
      const seeded = seededBracket(advancing);

      for (let i = 0; i < nextMatches.length && i < seeded.length; i++) {
        const pair = seeded[i];
        db.run('UPDATE matches SET participant1_id = ?, participant2_id = ? WHERE id = ?',
          [pair[0] ? pair[0].id : null, pair[1] ? pair[1].id : null, nextMatches[i].id]);
      }

      db.prepare('UPDATE phases SET status = ? WHERE id = ?').run('active', nextPhase.id);
      db.prepare('UPDATE tournaments SET current_phase_id = ? WHERE id = ?').run(nextPhase.id, tid);
    }
  });
  txn();

  const responseData = buildTournamentData(tid);
  const updatedParticipants = db.prepare('SELECT * FROM participants WHERE tournament_id = ? ORDER BY seed').all(tid);

  db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?')
    .run(JSON.stringify({ mode: 'idle' }), tid);
  req.io.to(`screen:${tid}`).emit('filtros:advance', {
    advancing: advancing.map(p => p.name),
    eliminated: eliminated.map(p => p.name)
  });
  req.io.to(`screen:${tid}`).emit('tournament:updated', responseData);

  res.json({ ...responseData, participants: updatedParticipants, advancing: advancing.map(p => p.name) });
});

// Seeded bracket: top-half vs bottom-half pairing, arranged so top seeds are
// in opposite halves (1 and 2 can only meet in the Final).
// For N players: pair i vs (N/2 + i), then interleave recursively.
function seededBracket(rankedPlayers) {
  const n = rankedPlayers.length;
  if (n === 0) return [];
  const numMatches = Math.floor(n / 2);
  const pairs = [];
  for (let i = 0; i < numMatches; i++) {
    pairs.push([
      rankedPlayers[i] || null,
      rankedPlayers[numMatches + i] || null,
    ]);
  }
  // arrangePairsForBracket only works correctly for power-of-2 counts;
  // for other counts (e.g. 3 pairs from 6 players) it silently drops pairs.
  const isPow2 = (x) => x > 0 && (x & (x - 1)) === 0;
  return isPow2(pairs.length) ? arrangePairsForBracket(pairs) : pairs;
}

// Recursively interleaves pairs so that seeds are maximally separated:
// e.g. 4 pairs [(1v5),(2v6),(3v7),(4v8)] → [(1v5),(4v8),(2v6),(3v7)]
// Left side: seeds 1,4 · Right side: seeds 2,3 · Only meet in Final.
function arrangePairsForBracket(pairs) {
  const n = pairs.length;
  if (n <= 2) return pairs;
  const topArranged = arrangePairsForBracket(pairs.slice(0, n / 2));
  const bottomArranged = arrangePairsForBracket(pairs.slice(n / 2));
  const result = [];
  for (let i = 0; i < topArranged.length; i++) {
    result.push(topArranged[i]);
    result.push(bottomArranged[bottomArranged.length - 1 - i]);
  }
  return result;
}

// --- Edit bracket: manual reassignment of participants in a pending phase ---
// Body: { matches: [{ matchId, participant1Id, participant2Id }, ...] }
// Validates: each participant appears exactly once, all matches still pending.

router.put('/tournaments/:id/phases/:pid/bracket', requireAdmin, (req, res) => {
  const tid = Number(req.params.id);
  const pid = Number(req.params.pid);
  const { matches } = req.body;

  if (!Array.isArray(matches) || matches.length === 0)
    return res.status(400).json({ error: 'Datos de cruces inválidos' });

  // All matches must be pending (no battle started yet)
  const dbMatches = db.prepare('SELECT * FROM matches WHERE phase_id = ?').all(pid);
  const anyStarted = dbMatches.some(m => m.status !== 'pending');
  if (anyStarted)
    return res.status(400).json({ error: 'Ya han comenzado batallas en esta fase, no se pueden editar los cruces' });

  // Collect all participant IDs assigned (must be unique, no duplicates or nulls)
  const allIds = [];
  for (const m of matches) {
    if (!m.participant1Id || !m.participant2Id)
      return res.status(400).json({ error: 'Todos los cruces deben tener dos participantes' });
    allIds.push(Number(m.participant1Id), Number(m.participant2Id));
  }
  const uniqueIds = new Set(allIds);
  if (uniqueIds.size !== allIds.length)
    return res.status(400).json({ error: 'Un participante no puede aparecer en más de un cruce' });

  // Apply changes in a transaction
  const txn = db.transaction(() => {
    for (const m of matches) {
      db.prepare('UPDATE matches SET participant1_id = ?, participant2_id = ? WHERE id = ? AND phase_id = ?')
        .run(Number(m.participant1Id), Number(m.participant2Id), Number(m.matchId), pid);
    }
  });
  txn();

  // Return updated bracket data
  const phases = db.prepare('SELECT * FROM phases WHERE tournament_id = ? ORDER BY phase_order').all(tid);
  const updatedMatches = db.prepare(`
    SELECT m.*, p1.name as participant1_name, p2.name as participant2_name,
           ph.name as phase_name, ph.phase_type
    FROM matches m
    LEFT JOIN participants p1 ON m.participant1_id = p1.id
    LEFT JOIN participants p2 ON m.participant2_id = p2.id
    LEFT JOIN phases ph ON m.phase_id = ph.id
    WHERE m.tournament_id = ?
    ORDER BY ph.phase_order, m.match_order
  `).all(tid);

  req.io.to(`admin:${tid}`).emit('tournament:updated', { phases, matches: updatedMatches });
  res.json({ phases, matches: updatedMatches });
});

// --- Start tiebreaker round (only judges who voted EMPATE can vote) ---

router.post('/matches/:id/start-tiebreaker', (req, res) => {
  const mid = Number(req.params.id);
  const match = db.prepare(`
    SELECT m.*, ph.name as phase_name, ph.phase_type
    FROM matches m LEFT JOIN phases ph ON m.phase_id = ph.id WHERE m.id = ?
  `).get(mid);

  if (!match || match.status !== 'tie')
    return res.status(400).json({ error: 'El match no está en estado de empate' });

  let allowedJudgeIds;
  try { allowedJudgeIds = JSON.parse(match.allowed_judges || '[]'); } catch { allowedJudgeIds = []; }
  if (allowedJudgeIds.length === 0)
    return res.status(400).json({ error: 'No hay jueces de desempate registrados' });

  // Delete previous votes, mark as live tiebreaker
  db.run('DELETE FROM votes WHERE match_id = ?', [mid]);
  db.prepare('UPDATE matches SET status = ?, is_tiebreaker = 1 WHERE id = ?').run('live', mid);

  const p1 = match.participant1_id ? db.prepare('SELECT name FROM participants WHERE id = ?').get(match.participant1_id) : null;
  const p2 = match.participant2_id ? db.prepare('SELECT name FROM participants WHERE id = ?').get(match.participant2_id) : null;

  // Resolve judge names for display
  const allowedJudgesInfo = allowedJudgeIds.map(jid => {
    const j = db.prepare('SELECT id, name FROM judges WHERE id = ?').get(jid);
    return j || { id: jid, name: '?' };
  });

  const matchData = {
    id: match.id,
    tournament_id: match.tournament_id,
    phase_id: match.phase_id,
    phase_name: match.phase_name,
    phase_type: match.phase_type,
    participant1_id: match.participant1_id,
    participant2_id: match.participant2_id,
    participant1_name: p1?.name,
    participant2_name: p2?.name,
    match_order: match.match_order,
    status: 'live',
    is_tiebreaker: true,
    allowed_judge_ids: allowedJudgeIds,
    allowed_judges_info: allowedJudgesInfo,
  };

  // Persist screen state for reconnect restore
  db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?')
    .run(JSON.stringify({ mode: 'live', match: matchData }), match.tournament_id);

  // Auto-reset and start per-match timer for tiebreaker
  const tData = db.prepare('SELECT timer_duration_s FROM tournaments WHERE id = ?').get(match.tournament_id);
  const durationS = tData?.timer_duration_s || 60;
  db.prepare('UPDATE tournaments SET timer_status = ?, timer_start_at = ?, timer_remaining_s = ? WHERE id = ?')
    .run('running', Date.now(), durationS, match.tournament_id);
  const timerState = { status: 'running', startAt: Date.now(), remainingS: durationS, durationS };
  req.io.to(`screen:${match.tournament_id}`).emit('timer:update', timerState);
  req.io.to(`admin:${match.tournament_id}`).emit('timer:update', timerState);

  req.io.to(`screen:${match.tournament_id}`).emit('match:started', matchData);
  req.io.to(`judge:${match.tournament_id}`).emit('match:started', matchData);
  res.json(matchData);
});

// --- Restart match ---

router.post('/matches/:id/restart', (req, res) => {
  const mid = Number(req.params.id);
  db.run('DELETE FROM filtros_scores WHERE match_id = ?', [mid]);
  db.run('DELETE FROM votes WHERE match_id = ?', [mid]);
  db.prepare('UPDATE matches SET status = ?, winner_id = NULL, is_tiebreaker = 0, allowed_judges = NULL WHERE id = ?').run('pending', mid);
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(mid);
  db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?')
    .run(JSON.stringify({ mode: 'idle' }), match.tournament_id);
  req.io.to(`screen:${match.tournament_id}`).emit('match:restarted', match);
  req.io.to(`judge:${match.tournament_id}`).emit('match:restarted', match);
  res.json({ success: true });
});

// --- Get participant scores for a tournament ---

router.get('/tournaments/:id/scores', (req, res) => {
  const tid = Number(req.params.id);
  const participants = db.prepare('SELECT * FROM participants WHERE tournament_id = ? ORDER BY total_score DESC').all(tid);
  res.json(participants);
});

// --- Manually trigger ranking display on screen ---

router.post('/tournaments/:id/show-ranking', (req, res) => {
  const tid = Number(req.params.id);
  const participants = db.prepare('SELECT * FROM participants WHERE tournament_id = ? ORDER BY total_score DESC').all(tid);
  const advanceCount = db.prepare('SELECT filtros_advance_count FROM tournaments WHERE id = ?').get(tid)?.filtros_advance_count || 0;
  const ranking = participants.map((p, idx) => ({
    rank: idx + 1,
    id: p.id,
    name: p.name,
    total_score: p.total_score,
    advancing: advanceCount > 0 ? idx < advanceCount : false,
  }));
  db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?')
    .run(JSON.stringify({ mode: 'ranking', ranking }), tid);
  req.io.to(`screen:${tid}`).emit('filtros:ranking', { ranking });
  res.json({ success: true });
});

// --- Timer control ---

function getTimerState(tid) {
  const t = db.prepare('SELECT timer_status, timer_start_at, timer_remaining_s, timer_duration_s FROM tournaments WHERE id = ?').get(tid);
  return {
    status: t.timer_status || 'idle',
    startAt: t.timer_start_at,
    remainingS: t.timer_remaining_s,
    durationS: t.timer_duration_s || 60,
  };
}

router.post('/tournaments/:id/timer/start', (req, res) => {
  const tid = Number(req.params.id);
  const tournament = db.prepare('SELECT timer_status, timer_remaining_s, timer_duration_s FROM tournaments WHERE id = ?').get(tid);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  let durationS;
  if (tournament.timer_status === 'paused' && tournament.timer_remaining_s != null) {
    // Resume from where it was paused
    durationS = tournament.timer_remaining_s;
  } else {
    // Fresh start: use body param or saved default
    durationS = req.body.duration_s || tournament.timer_duration_s || 60;
  }

  const now = Date.now();
  db.prepare('UPDATE tournaments SET timer_status = ?, timer_start_at = ?, timer_remaining_s = ? WHERE id = ?')
    .run('running', now, durationS, tid);
  const state = getTimerState(tid);
  req.io.to(`screen:${tid}`).emit('timer:update', state);
  req.io.to(`admin:${tid}`).emit('timer:update', state);
  res.json(state);
});

router.post('/tournaments/:id/timer/pause', (req, res) => {
  const tid = Number(req.params.id);
  const tournament = db.prepare('SELECT timer_status, timer_start_at, timer_remaining_s FROM tournaments WHERE id = ?').get(tid);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });
  if (tournament.timer_status !== 'running') return res.status(400).json({ error: 'El temporizador no está en marcha' });

  const elapsed = (Date.now() - tournament.timer_start_at) / 1000;
  const remaining = Math.max(0, (tournament.timer_remaining_s || 0) - elapsed);
  db.prepare('UPDATE tournaments SET timer_status = ?, timer_remaining_s = ?, timer_start_at = NULL WHERE id = ?')
    .run('paused', remaining, tid);
  const state = getTimerState(tid);
  req.io.to(`screen:${tid}`).emit('timer:update', state);
  req.io.to(`admin:${tid}`).emit('timer:update', state);
  res.json(state);
});

router.post('/tournaments/:id/timer/reset', (req, res) => {
  const tid = Number(req.params.id);
  if (!db.prepare('SELECT id FROM tournaments WHERE id = ?').get(tid)) return res.status(404).json({ error: 'Torneo no encontrado' });
  db.prepare('UPDATE tournaments SET timer_status = ?, timer_start_at = NULL, timer_remaining_s = NULL WHERE id = ?')
    .run('idle', tid);
  const state = getTimerState(tid);
  req.io.to(`screen:${tid}`).emit('timer:update', state);
  req.io.to(`admin:${tid}`).emit('timer:update', state);
  res.json(state);
});

// --- Global timer control (for 7toSmoke phase) ---

function getGlobalTimerState(tid) {
  const t = db.prepare('SELECT global_timer_status, global_timer_start_at, global_timer_remaining_s, global_timer_duration_s FROM tournaments WHERE id = ?').get(tid);
  return {
    status: t.global_timer_status || 'idle',
    startAt: t.global_timer_start_at,
    remainingS: t.global_timer_remaining_s,
    durationS: t.global_timer_duration_s || 3600,
  };
}

router.post('/tournaments/:id/global-timer/start', (req, res) => {
  const tid = Number(req.params.id);
  const tournament = db.prepare('SELECT global_timer_status, global_timer_remaining_s, global_timer_duration_s FROM tournaments WHERE id = ?').get(tid);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  let durationS;
  if (tournament.global_timer_status === 'paused' && tournament.global_timer_remaining_s != null) {
    durationS = tournament.global_timer_remaining_s;
  } else {
    durationS = req.body.duration_s || tournament.global_timer_duration_s || 3600;
  }

  const now = Date.now();
  db.prepare('UPDATE tournaments SET global_timer_status = ?, global_timer_start_at = ?, global_timer_remaining_s = ? WHERE id = ?')
    .run('running', now, durationS, tid);
  const state = getGlobalTimerState(tid);
  req.io.to(`screen:${tid}`).emit('global-timer:update', state);
  req.io.to(`admin:${tid}`).emit('global-timer:update', state);
  res.json(state);
});

router.post('/tournaments/:id/global-timer/pause', (req, res) => {
  const tid = Number(req.params.id);
  const tournament = db.prepare('SELECT global_timer_status, global_timer_start_at, global_timer_remaining_s FROM tournaments WHERE id = ?').get(tid);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });
  if (tournament.global_timer_status !== 'running') return res.status(400).json({ error: 'El temporizador global no está en marcha' });

  const elapsed = (Date.now() - tournament.global_timer_start_at) / 1000;
  const remaining = Math.max(0, (tournament.global_timer_remaining_s || 0) - elapsed);
  db.prepare('UPDATE tournaments SET global_timer_status = ?, global_timer_remaining_s = ?, global_timer_start_at = NULL WHERE id = ?')
    .run('paused', remaining, tid);
  const state = getGlobalTimerState(tid);
  req.io.to(`screen:${tid}`).emit('global-timer:update', state);
  req.io.to(`admin:${tid}`).emit('global-timer:update', state);
  res.json(state);
});

router.post('/tournaments/:id/global-timer/reset', (req, res) => {
  const tid = Number(req.params.id);
  if (!db.prepare('SELECT id FROM tournaments WHERE id = ?').get(tid)) return res.status(404).json({ error: 'Torneo no encontrado' });
  db.prepare('UPDATE tournaments SET global_timer_status = ?, global_timer_start_at = NULL, global_timer_remaining_s = NULL WHERE id = ?')
    .run('idle', tid);
  const state = getGlobalTimerState(tid);
  req.io.to(`screen:${tid}`).emit('global-timer:update', state);
  req.io.to(`admin:${tid}`).emit('global-timer:update', state);
  res.json(state);
});

// --- Get match participants (for Filtros rounds) ---

router.get('/matches/:id/participants', (req, res) => {
  const mid = Number(req.params.id);
  const participants = db.prepare(`
    SELECT mp.position, p.id, p.name, p.member1_name, p.member2_name
    FROM match_participants mp JOIN participants p ON mp.participant_id = p.id
    WHERE mp.match_id = ? ORDER BY mp.position
  `).all(mid);
  res.json(participants);
});

// --- Manually finish a tournament ---

router.put('/tournaments/:id/finish', (req, res) => {
  const tid = Number(req.params.id);
  db.prepare("UPDATE tournaments SET status = 'finished' WHERE id = ?").run(tid);
  const lastMatch = db.prepare(`
    SELECT w.name as winner_name FROM matches m
    LEFT JOIN participants w ON m.winner_id = w.id
    JOIN phases ph ON m.phase_id = ph.id
    WHERE m.tournament_id = ? AND m.status = 'finished'
    ORDER BY ph.phase_order DESC LIMIT 1
  `).get(tid);
  db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?')
    .run(JSON.stringify({ mode: 'finished', winnerName: lastMatch?.winner_name || null }), tid);
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tid);
  req.io.to(`screen:${tid}`).emit('tournament:finished', { tournamentId: tid });
  res.json(tournament);
});

// --- Ticker message (scrolling text on the screen) ---

router.put('/tournaments/:id/ticker', requireAdmin, (req, res) => {
  const tid = Number(req.params.id);
  const message = (req.body.message || '').trim();
  db.prepare('UPDATE tournaments SET ticker_message = ? WHERE id = ?').run(message, tid);
  req.io.to(`screen:${tid}`).emit('ticker:update', { message });
  res.json({ ok: true });
});

// --- Waiting screen toggle ---

router.put('/tournaments/:id/waiting', (req, res) => {
  const tid = Number(req.params.id);
  const tournament = db.prepare('SELECT waiting_screen FROM tournaments WHERE id = ?').get(tid);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });
  const newState = tournament.waiting_screen ? 0 : 1;
  db.prepare('UPDATE tournaments SET waiting_screen = ? WHERE id = ?').run(newState, tid);
  req.io.to(`screen:${tid}`).emit('screen:waiting', { active: newState === 1 });
  res.json({ active: newState === 1 });
});

// --- Match history for a tournament (elimination battles with per-judge votes) ---

router.get('/tournaments/:id/history', (req, res) => {
  const tid = Number(req.params.id);
  const matches = db.prepare(`
    SELECT m.id as match_id, m.participant1_id, m.participant2_id,
           p1.name as p1_name, p2.name as p2_name, w.name as winner_name,
           ph.name as phase_name, ph.phase_order
    FROM matches m
    LEFT JOIN participants p1 ON m.participant1_id = p1.id
    LEFT JOIN participants p2 ON m.participant2_id = p2.id
    LEFT JOIN participants w  ON m.winner_id = w.id
    LEFT JOIN phases ph ON m.phase_id = ph.id
    WHERE m.tournament_id = ? AND m.status = 'finished' AND ph.phase_type = 'elimination'
    ORDER BY ph.phase_order, m.match_order
  `).all(tid);

  const result = matches.map(m => {
    const votes = db.prepare(`
      SELECT v.choice, j.name as judge_name
      FROM votes v JOIN judges j ON v.judge_id = j.id
      WHERE v.match_id = ?
      ORDER BY j.name
    `).all(m.match_id);
    return { ...m, votes };
  });

  res.json(result);
});

// --- Helper: build full tournament data ---

function buildTournamentData(tid) {
  const phases = db.prepare('SELECT * FROM phases WHERE tournament_id = ? ORDER BY phase_order').all(tid);
  const matches = db.prepare(`
    SELECT m.*, p1.name as participant1_name, p1.member1_name as participant1_member1, p1.member2_name as participant1_member2,
           p2.name as participant2_name, p2.member1_name as participant2_member1, p2.member2_name as participant2_member2,
           w.name as winner_name, ph.phase_type, ph.name as phase_name
    FROM matches m LEFT JOIN participants p1 ON m.participant1_id = p1.id
    LEFT JOIN participants p2 ON m.participant2_id = p2.id LEFT JOIN participants w ON m.winner_id = w.id
    LEFT JOIN phases ph ON m.phase_id = ph.id
    WHERE m.tournament_id = ? ORDER BY m.phase_id, m.match_order
  `).all(tid);

  // For Filtros matches, attach participant list (include member names for 2vs2)
  matches.forEach(m => {
    if (m.phase_type === 'filtros') {
      m.participants = db.prepare(`
        SELECT mp.position, p.id, p.name, p.member1_name, p.member2_name
        FROM match_participants mp JOIN participants p ON mp.participant_id = p.id
        WHERE mp.match_id = ? ORDER BY mp.position
      `).all(m.id);
    }
  });

  // For 7toSmoke phases, attach smoke_points and queue
  phases.forEach(ph => {
    if (ph.phase_type === '7tosmoke') {
      ph.smoke_points = db.prepare(`
        SELECT sp.participant_id, sp.points, sp.consecutive_points, p.name
        FROM smoke_points sp JOIN participants p ON sp.participant_id = p.id
        WHERE sp.phase_id = ?
        ORDER BY sp.points DESC, sp.consecutive_points DESC
      `).all(ph.id);
      try { ph.queue = JSON.parse(ph.queue_state || '[]'); } catch { ph.queue = []; }
    }
  });

  return { phases, matches };
}

module.exports = router;
