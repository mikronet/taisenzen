const express = require('express');
const router = express.Router();
const db = require('../db');

// Public: list active tournaments (no auth required)
router.get('/active', (req, res) => {
  const tournaments = db.prepare(`
    SELECT t.id, t.name, t.type, t.tournament_type, t.status, p.name as current_phase
    FROM tournaments t
    LEFT JOIN phases p ON p.tournament_id = t.id AND p.status = 'active'
    WHERE t.status = 'active'
    ORDER BY t.created_at DESC
  `).all();
  res.json(tournaments);
});

router.get('/:id', (req, res) => {
  const tid = Number(req.params.id);
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tid);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  const phases = db.prepare('SELECT * FROM phases WHERE tournament_id = ? ORDER BY phase_order').all(tid);
  const matches = db.prepare(`
    SELECT m.*, p1.name as participant1_name, p2.name as participant2_name, w.name as winner_name,
           ph.phase_type, ph.name as phase_name
    FROM matches m LEFT JOIN participants p1 ON m.participant1_id = p1.id
    LEFT JOIN participants p2 ON m.participant2_id = p2.id LEFT JOIN participants w ON m.winner_id = w.id
    LEFT JOIN phases ph ON m.phase_id = ph.id
    WHERE m.tournament_id = ? ORDER BY m.phase_id, m.match_order
  `).all(tid);

  // Bulk-load filtros participants in one query (avoids N+1)
  const filtrosMatchIds = matches.filter(m => m.phase_type === 'filtros').map(m => m.id);
  const filtrosParticipantsByMatch = {};
  if (filtrosMatchIds.length > 0) {
    const placeholders = filtrosMatchIds.map(() => '?').join(',');
    const allFp = db.prepare(`
      SELECT mp.match_id, mp.position, p.id, p.name, p.member1_name, p.member2_name
      FROM match_participants mp JOIN participants p ON mp.participant_id = p.id
      WHERE mp.match_id IN (${placeholders}) ORDER BY mp.match_id, mp.position
    `).all(...filtrosMatchIds);
    for (const fp of allFp) {
      if (!filtrosParticipantsByMatch[fp.match_id]) filtrosParticipantsByMatch[fp.match_id] = [];
      filtrosParticipantsByMatch[fp.match_id].push(fp);
    }
  }
  matches.forEach(m => {
    if (m.phase_type === 'filtros') m.participants = filtrosParticipantsByMatch[m.id] || [];
  });

  // For 7toSmoke phases, attach smoke_points
  phases.forEach(ph => {
    if (ph.phase_type === '7tosmoke') {
      ph.smoke_points = db.prepare(`
        SELECT sp.participant_id, sp.points, sp.consecutive_points, p.name
        FROM smoke_points sp JOIN participants p ON sp.participant_id = p.id
        WHERE sp.phase_id = ?
        ORDER BY sp.points DESC, sp.consecutive_points DESC
      `).all(ph.id);
    }
  });

  const participants = db.prepare('SELECT * FROM participants WHERE tournament_id = ? ORDER BY seed').all(tid);

  res.json({ tournament, phases, matches, participants });
});

router.get('/:id/live-match', (req, res) => {
  const tid = Number(req.params.id);
  const judgeId = req.query.judgeId ? Number(req.query.judgeId) : null;

  const match = db.prepare(`
    SELECT m.*, p1.name as participant1_name, p1.member1_name as participant1_member1, p1.member2_name as participant1_member2,
           p2.name as participant2_name, p2.member1_name as participant2_member1, p2.member2_name as participant2_member2,
           ph.name as phase_name, ph.phase_type
    FROM matches m LEFT JOIN participants p1 ON m.participant1_id = p1.id
    LEFT JOIN participants p2 ON m.participant2_id = p2.id
    LEFT JOIN phases ph ON m.phase_id = ph.id
    WHERE m.tournament_id = ? AND m.status = 'live' LIMIT 1
  `).get(tid);

  let totalJudges = db.prepare('SELECT COUNT(*) as c FROM judges WHERE tournament_id = ?').get(tid).c;
  let votesCount = 0;
  let hasVoted = false;
  let myVote = null;
  let allVoted = false;

  if (match) {
    if (match.phase_type === 'filtros') {
      match.participants = db.prepare(`
        SELECT mp.position, p.id, p.name, p.member1_name, p.member2_name
        FROM match_participants mp JOIN participants p ON mp.participant_id = p.id
        WHERE mp.match_id = ? ORDER BY mp.position
      `).all(match.id);
      votesCount = db.prepare('SELECT COUNT(DISTINCT judge_id) as c FROM filtros_scores WHERE match_id = ?').get(match.id).c;
      allVoted = totalJudges > 0 && votesCount >= totalJudges;
      if (judgeId) {
        const judgeScoreCount = db.prepare('SELECT COUNT(*) as c FROM filtros_scores WHERE match_id = ? AND judge_id = ?').get(match.id, judgeId).c;
        hasVoted = judgeScoreCount > 0;
      }
    } else {
      votesCount = db.prepare('SELECT COUNT(*) as c FROM votes WHERE match_id = ?').get(match.id).c;
      if (match.is_tiebreaker && match.allowed_judges) {
        const allowedIds = JSON.parse(match.allowed_judges);
        match.allowed_judge_ids = allowedIds;
        totalJudges = allowedIds.length;
      }
      allVoted = totalJudges > 0 && votesCount >= totalJudges;
      if (judgeId) {
        const vote = db.prepare('SELECT choice FROM votes WHERE match_id = ? AND judge_id = ?').get(match.id, judgeId);
        if (vote) { hasVoted = true; myVote = vote.choice; }
      }
    }
  }

  const tournament = db.prepare('SELECT status FROM tournaments WHERE id = ?').get(tid);
  const tournamentFinished = tournament?.status === 'finished';
  res.json({ match: match || null, totalJudges, totalVotes: votesCount, hasVoted, myVote, allVoted, tournamentFinished });
});

module.exports = router;
