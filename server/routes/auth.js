const express = require('express');
const router = express.Router();
const db = require('../db');

// Resolve a staff code → returns role + data needed to redirect
router.post('/resolve-code', (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'Código requerido' });
  }
  const c = code.trim();

  // Judge
  const judge = db.prepare(
    'SELECT j.*, t.name as tournament_name FROM judges j JOIN tournaments t ON j.tournament_id = t.id WHERE j.access_code = ?'
  ).get(c);
  if (judge) return res.json({ type: 'judge', data: judge });

  // Organizer
  const organizer = db.prepare(
    'SELECT o.tournament_id FROM organizers o WHERE o.access_code = ?'
  ).get(c);
  if (organizer) return res.json({ type: 'organizer', tournament_id: organizer.tournament_id });

  // Speaker
  const speaker = db.prepare('SELECT id FROM tournaments WHERE speaker_code = ?').get(c);
  if (speaker) return res.json({ type: 'speaker', tournament_id: speaker.id });

  return res.status(404).json({ error: 'Código no reconocido' });
});

module.exports = router;
