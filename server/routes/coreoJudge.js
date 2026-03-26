const express = require('express');
const router = express.Router();
const db = require('../db');

// In-memory rate limiter: max 30 score submissions per judgeId per minute
const judgeRateMap = new Map();
const JUDGE_RATE_WINDOW_MS = 60 * 1000;
const JUDGE_RATE_MAX = 30;
function checkJudgeRate(judgeId) {
  const now = Date.now();
  const entries = (judgeRateMap.get(judgeId) || []).filter(t => now - t < JUDGE_RATE_WINDOW_MS);
  if (entries.length >= JUDGE_RATE_MAX) return false;
  entries.push(now);
  judgeRateMap.set(judgeId, entries);
  return true;
}

// ── POST /api/coreo-judge/login ─────────────────────────────────────────────
// Reuses the same judges table as battles
router.post('/login', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Código requerido' });
  const judge = db.prepare('SELECT j.id, j.name, j.tournament_id, t.name as tournament_name, t.tournament_type FROM judges j JOIN tournaments t ON t.id = j.tournament_id WHERE j.access_code = ?').get(code.trim());
  if (!judge) return res.status(401).json({ error: 'Código no válido' });
  if (judge.tournament_type !== 'coreografia') return res.status(400).json({ error: 'Este código es para un torneo Battle, no Coreografía' });
  res.json({ judge });
});

// Auth middleware for judge routes below
function requireJudge(req, res, next) {
  const code = req.headers['x-judge-code'];
  if (!code) return res.status(401).json({ error: 'No autorizado' });
  const judge = db.prepare('SELECT id, tournament_id FROM judges WHERE access_code = ?').get(code);
  if (!judge) return res.status(401).json({ error: 'Código no válido' });
  req.judge = judge;
  next();
}

// ── GET /api/coreo-judge/tournament/:id/state ───────────────────────────────
// Full state for the judge: criteria + participants (ordered) + who is on stage
router.get('/tournament/:id/state', requireJudge, (req, res) => {
  const tid = Number(req.params.id);
  if (req.judge.tournament_id !== tid) return res.status(403).json({ error: 'Acceso denegado' });

  const criteria = db.prepare('SELECT * FROM criteria WHERE tournament_id = ? ORDER BY sort_order').all(tid);
  const tournament = db.prepare('SELECT current_round FROM tournaments WHERE id = ?').get(tid);
  const round = tournament?.current_round || 1;

  const participants = db.prepare(`
    SELECT id, name, category, age_group, photo_path, act_order, on_stage, academia, localidad, coreografo, round_number, on_stage_at, on_stage_duration_s
    FROM participants WHERE tournament_id = ? AND COALESCE(round_number, 1) = ? ORDER BY COALESCE(act_order, 9999), id
  `).all(tid, round);

  res.json({ criteria, participants, judgeId: req.judge.id });
});

// ── POST /api/coreo-judge/scores ─────────────────────────────────────────────
// Save (UPSERT) scores for one participant by this judge
// Body: { participantId, scores: [{ criterionId, score }] }
router.post('/scores', requireJudge, (req, res) => {
  const { participantId, scores } = req.body;
  if (!checkJudgeRate(req.judge.id)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento.' });
  }
  if (!participantId || !Array.isArray(scores)) return res.status(400).json({ error: 'Datos inválidos' });

  const participant = db.prepare('SELECT tournament_id FROM participants WHERE id = ?').get(Number(participantId));
  if (!participant || participant.tournament_id !== req.judge.tournament_id) {
    return res.status(403).json({ error: 'Participante no pertenece a tu torneo' });
  }

  const tid = req.judge.tournament_id;

  const txn = db.transaction(() => {
    for (const { criterionId, score } of scores) {
      const criterion = db.prepare('SELECT id, max_score FROM criteria WHERE id = ? AND tournament_id = ?').get(Number(criterionId), tid);
      if (!criterion) continue;
      const clamped = Math.min(Math.max(Number(score) || 0, 0), criterion.max_score);
      db.prepare(`
        INSERT INTO choreography_scores (tournament_id, participant_id, judge_id, criterion_id, score)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(participant_id, judge_id, criterion_id) DO UPDATE SET score = excluded.score
      `).run(tid, Number(participantId), req.judge.id, Number(criterionId), clamped);
    }
  });
  txn();

  req.io.to(`admin:${tid}`).to(`judge:${tid}`).emit('coreo:scores-updated');
  res.json({ success: true });
});

// ── GET /api/coreo-judge/tournament/:id/global-scores ───────────────────────
// Per-participant global avg across all judges + judges voted count (for sidebar colour)
router.get('/tournament/:id/global-scores', requireJudge, (req, res) => {
  const tid = Number(req.params.id);
  if (req.judge.tournament_id !== tid) return res.status(403).json({ error: 'Acceso denegado' });

  const totalJudges = db.prepare('SELECT COUNT(*) as n FROM judges WHERE tournament_id = ?').get(tid).n;
  const rows = db.prepare(`
    SELECT participant_id,
           COUNT(DISTINCT judge_id) as judges_voted,
           AVG(score)               as global_avg
    FROM choreography_scores
    WHERE tournament_id = ?
    GROUP BY participant_id
  `).all(tid);

  const participantScores = {};
  for (const r of rows) {
    participantScores[r.participant_id] = { globalAvg: r.global_avg, judgesVoted: r.judges_voted };
  }
  res.json({ totalJudges, participantScores });
});

// ── GET /api/coreo-judge/scores/:judgeId/:participantId ─────────────────────
// Get previously saved scores for this judge + participant
router.get('/scores/:judgeId/:participantId', requireJudge, (req, res) => {
  const jid = Number(req.params.judgeId);
  const pid = Number(req.params.participantId);

  // Verify the judge can only read their own scores
  if (req.judge.id !== jid) return res.status(403).json({ error: 'Acceso denegado' });

  const scores = db.prepare(`
    SELECT criterion_id, score FROM choreography_scores
    WHERE judge_id = ? AND participant_id = ?
  `).all(jid, pid);

  res.json({ scores });
});

module.exports = router;
