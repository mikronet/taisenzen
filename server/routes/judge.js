const express = require('express');
const router = express.Router();
const db = require('../db');

// In-memory rate limiter: max 20 score/vote requests per judgeId per minute
const judgeRateMap = new Map();
const JUDGE_RATE_WINDOW_MS = 60 * 1000;
const JUDGE_RATE_MAX = 20;
function checkJudgeRate(judgeId) {
  const now = Date.now();
  const entries = (judgeRateMap.get(judgeId) || []).filter(t => now - t < JUDGE_RATE_WINDOW_MS);
  if (entries.length >= JUDGE_RATE_MAX) return false;
  entries.push(now);
  judgeRateMap.set(judgeId, entries);
  return true;
}

router.post('/login', (req, res) => {
  const { code } = req.body;
  const judge = db.prepare('SELECT j.*, t.name as tournament_name FROM judges j JOIN tournaments t ON j.tournament_id = t.id WHERE j.access_code = ?').get(code);
  if (!judge) return res.status(401).json({ error: 'Código inválido' });
  res.json(judge);
});

// Vote for elimination phase (pick winner or tie)
router.post('/vote', (req, res) => {
  const { matchId, judgeId, choice } = req.body;
  if (!checkJudgeRate(Number(judgeId))) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento.' });
  }
  if (!['participant1', 'participant2', 'tie'].includes(choice)) {
    return res.status(400).json({ error: 'Opción inválida' });
  }

  const match = db.prepare('SELECT * FROM matches WHERE id = ? AND status = ?').get(Number(matchId), 'live');
  if (!match) return res.status(400).json({ error: 'El match no está activo' });

  // Validate judge belongs to this tournament
  const judgeRow = db.prepare('SELECT id FROM judges WHERE id = ? AND tournament_id = ?').get(Number(judgeId), match.tournament_id);
  if (!judgeRow) return res.status(403).json({ error: 'No estás autorizado para votar en este torneo' });

  // Tiebreaker: only judges who voted EMPATE in the previous round can vote
  if (match.is_tiebreaker) {
    let allowedIds;
    try { allowedIds = JSON.parse(match.allowed_judges || '[]'); } catch { allowedIds = []; }
    if (!allowedIds.includes(Number(judgeId))) {
      return res.status(403).json({ error: 'No estás autorizado para votar en este desempate' });
    }
  }

  const existing = db.prepare('SELECT * FROM votes WHERE match_id = ? AND judge_id = ?').get(Number(matchId), Number(judgeId));
  if (existing) {
    db.prepare('UPDATE votes SET choice = ? WHERE id = ?').run(choice, existing.id);
  } else {
    db.prepare('INSERT INTO votes (match_id, judge_id, choice) VALUES (?, ?, ?)').run(Number(matchId), Number(judgeId), choice);
  }

  const totalVotes = db.prepare('SELECT COUNT(*) as c FROM votes WHERE match_id = ?').get(Number(matchId)).c;
  // For tiebreakers, totalJudges is the number of allowed judges, not all judges
  let allowedJudgesLen = 0;
  try { allowedJudgesLen = JSON.parse(match.allowed_judges || '[]').length; } catch { allowedJudgesLen = 0; }
  const totalJudges = match.is_tiebreaker
    ? allowedJudgesLen
    : db.prepare('SELECT COUNT(*) as c FROM judges WHERE tournament_id = ?').get(match.tournament_id).c;

  const votesP1 = db.prepare("SELECT COUNT(*) as c FROM votes WHERE match_id = ? AND choice = 'participant1'").get(Number(matchId)).c;
  const votesP2 = db.prepare("SELECT COUNT(*) as c FROM votes WHERE match_id = ? AND choice = 'participant2'").get(Number(matchId)).c;

  req.io.to(`admin:${match.tournament_id}`).emit('vote:received', {
    matchId, judgeId, totalVotes, totalJudges, allVoted: totalVotes >= totalJudges, votesP1, votesP2
  });

  req.io.to(`screen:${match.tournament_id}`).emit('vote:count', {
    matchId, totalVotes, totalJudges
  });

  res.json({ success: true, totalVotes, totalJudges, allVoted: totalVotes >= totalJudges });
});

// Score for Filtros phase (N participants, each scored 0-10)
router.post('/score', (req, res) => {
  const { matchId, judgeId, scores } = req.body;
  // scores is an array: [{participantId, score}, ...]
  if (!checkJudgeRate(Number(judgeId))) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento.' });
  }
  if (!Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de puntuaciones' });
  }

  // Validate all scores
  for (const s of scores) {
    const val = parseFloat(s.score);
    if (isNaN(val) || val < 0 || val > 10) {
      return res.status(400).json({ error: `Puntuación inválida para participante ${s.participantId}: ${s.score} (0-10)` });
    }
  }

  const match = db.prepare('SELECT * FROM matches WHERE id = ? AND status = ?').get(Number(matchId), 'live');
  if (!match) return res.status(400).json({ error: 'La ronda no está activa' });

  // Validate judge belongs to this tournament
  const judgeRow = db.prepare('SELECT id FROM judges WHERE id = ? AND tournament_id = ?').get(Number(judgeId), match.tournament_id);
  if (!judgeRow) return res.status(403).json({ error: 'No estás autorizado para puntuar en este torneo' });

  // Validate participantIds belong to this match and count matches
  const matchParticipantIds = db.prepare('SELECT participant_id FROM match_participants WHERE match_id = ?')
    .all(Number(matchId)).map(r => r.participant_id);
  if (scores.length !== matchParticipantIds.length) {
    return res.status(400).json({ error: `Se esperaban ${matchParticipantIds.length} puntuaciones, se recibieron ${scores.length}` });
  }
  const validIds = new Set(matchParticipantIds);
  for (const s of scores) {
    if (!validIds.has(Number(s.participantId))) {
      return res.status(400).json({ error: `Participante ${s.participantId} no pertenece a esta ronda` });
    }
  }

  // Insert/update each score
  for (const s of scores) {
    const val = Math.round(parseFloat(s.score) * 10) / 10; // round to 1 decimal
    const existing = db.prepare('SELECT * FROM filtros_scores WHERE match_id = ? AND judge_id = ? AND participant_id = ?')
      .get(Number(matchId), Number(judgeId), Number(s.participantId));
    if (existing) {
      db.prepare('UPDATE filtros_scores SET score = ? WHERE id = ?').run(val, existing.id);
    } else {
      db.prepare('INSERT INTO filtros_scores (match_id, judge_id, participant_id, score) VALUES (?, ?, ?, ?)')
        .run(Number(matchId), Number(judgeId), Number(s.participantId), val);
    }
  }

  // Count how many judges have submitted (distinct judge_ids — each submission covers all participants atomically)
  const judgeCount = db.prepare('SELECT COUNT(*) as c FROM judges WHERE tournament_id = ?').get(match.tournament_id).c;
  const judgesCompleted = db.prepare('SELECT COUNT(DISTINCT judge_id) as c FROM filtros_scores WHERE match_id = ?').get(Number(matchId)).c;

  // allVoted: every judge has submitted their scores (guard against 0-judge tournaments)
  const allVoted = judgeCount > 0 && judgesCompleted >= judgeCount;

  req.io.to(`admin:${match.tournament_id}`).emit('vote:received', {
    matchId, judgeId, totalVotes: judgesCompleted, totalJudges: judgeCount, allVoted
  });

  req.io.to(`screen:${match.tournament_id}`).emit('vote:count', {
    matchId, totalVotes: judgesCompleted, totalJudges: judgeCount
  });

  res.json({ success: true, totalVotes: judgesCompleted, totalJudges: judgeCount, allVoted });
});

// Get match status with participants
router.get('/match/:matchId/status', (req, res) => {
  const mid = Number(req.params.matchId);
  const match = db.prepare(`
    SELECT m.*, p1.name as participant1_name, p2.name as participant2_name, ph.phase_type, ph.name as phase_name
    FROM matches m LEFT JOIN participants p1 ON m.participant1_id = p1.id
    LEFT JOIN participants p2 ON m.participant2_id = p2.id
    LEFT JOIN phases ph ON m.phase_id = ph.id WHERE m.id = ?
  `).get(mid);
  if (!match) return res.status(404).json({ error: 'Match no encontrado' });

  // For Filtros, include all participants
  if (match.phase_type === 'filtros') {
    match.participants = db.prepare(`
      SELECT mp.position, p.id, p.name
      FROM match_participants mp JOIN participants p ON mp.participant_id = p.id
      WHERE mp.match_id = ? ORDER BY mp.position
    `).all(mid);
  }

  res.json(match);
});

module.exports = router;
