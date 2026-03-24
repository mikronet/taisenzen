const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { upload, uploadsDir } = require('../upload');
const { generateWordCode } = require('../wordCode');

// ── Auth middleware ───────────────────────────────────────────────────────────
// Accepts admin token OR organizer code scoped to the tournament
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token) {
    const session = db.prepare('SELECT token FROM admin_sessions WHERE token = ? AND expires_at > ?').get(token, Date.now());
    if (session) return next();
  }

  const orgCode = req.headers['x-organizer-code'];
  if (orgCode) {
    // Resolve tournament id from the URL
    const m = req.path.match(/\/tournaments\/(\d+)/) || req.path.match(/\/participants\/(\d+)/) || req.path.match(/\/judges\/(\d+)/);
    let tid = null;
    if (req.path.match(/\/tournaments\/(\d+)/)) {
      tid = Number(req.path.match(/\/tournaments\/(\d+)/)[1]);
    } else if (req.path.match(/\/participants\/(\d+)/)) {
      const p = db.prepare('SELECT tournament_id FROM participants WHERE id = ?').get(Number(req.path.match(/\/participants\/(\d+)/)[1]));
      tid = p?.tournament_id;
    }
    const organizer = tid
      ? db.prepare('SELECT id FROM organizers WHERE access_code = ? AND tournament_id = ?').get(orgCode, tid)
      : db.prepare('SELECT id FROM organizers WHERE access_code = ?').get(orgCode);
    if (organizer) return next();
  }

  return res.status(401).json({ error: 'No autorizado' });
}

// Public endpoints (no auth)
router.post('/organizer-login', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Código requerido' });
  const org = db.prepare(`
    SELECT o.id, o.name, o.tournament_id, o.access_code, t.name as tournament_name
    FROM organizers o JOIN tournaments t ON t.id = o.tournament_id
    WHERE o.access_code = ? AND t.tournament_type = 'coreografia'
  `).get(code.trim());
  if (!org) return res.status(401).json({ error: 'Código no válido' });
  res.json({ organizer: org });
});

router.use(requireAdmin);

// ── GET /api/coreo/tournaments/:id ──────────────────────────────────────────
router.get('/tournaments/:id', (req, res) => {
  const tid = Number(req.params.id);
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ? AND tournament_type = ?').get(tid, 'coreografia');
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  const criteria = db.prepare('SELECT * FROM criteria WHERE tournament_id = ? ORDER BY sort_order').all(tid);

  const participants = db.prepare(`
    SELECT id, name, category, age_group, photo_path, act_order, on_stage, academia, localidad, coreografo, round_number
    FROM participants WHERE tournament_id = ? ORDER BY COALESCE(act_order, 9999), id
  `).all(tid);

  for (const p of participants) {
    p.members = db.prepare('SELECT member_name FROM participant_members WHERE participant_id = ? ORDER BY sort_order').all(p.id).map(r => r.member_name);
  }

  const judges = db.prepare('SELECT id, name, access_code FROM judges WHERE tournament_id = ? ORDER BY id').all(tid);
  const organizers = db.prepare('SELECT id, name, access_code FROM organizers WHERE tournament_id = ? ORDER BY id').all(tid);

  res.json({ tournament, criteria, participants, judges, organizers });
});

// ── POST /api/coreo/tournaments/:id/poster ───────────────────────────────────
router.post('/tournaments/:id/poster', upload.single('poster'), (req, res) => {
  const tid = Number(req.params.id);
  const tournament = db.prepare('SELECT poster_path FROM tournaments WHERE id = ?').get(tid);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  // Delete old poster if exists
  if (tournament.poster_path) {
    const old = path.join(uploadsDir, tournament.poster_path);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }

  const poster_path = req.file ? req.file.filename : null;
  db.prepare('UPDATE tournaments SET poster_path = ? WHERE id = ?').run(poster_path, tid);
  req.io.to(`screen:${tid}`).emit('coreo:poster-updated', { poster_path });
  req.io.to(`admin:${tid}`).emit('coreo:poster-updated', { poster_path });
  res.json({ success: true, poster_path });
});

// ── DELETE /api/coreo/tournaments/:id/poster ─────────────────────────────────
router.delete('/tournaments/:id/poster', (req, res) => {
  const tid = Number(req.params.id);
  const tournament = db.prepare('SELECT poster_path FROM tournaments WHERE id = ?').get(tid);
  if (!tournament) return res.status(404).json({ error: 'Torneo no encontrado' });

  if (tournament.poster_path) {
    const old = path.join(uploadsDir, tournament.poster_path);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }
  db.prepare('UPDATE tournaments SET poster_path = NULL WHERE id = ?').run(tid);
  req.io.to(`screen:${tid}`).emit('coreo:poster-updated', { poster_path: null });
  req.io.to(`admin:${tid}`).emit('coreo:poster-updated', { poster_path: null });
  res.json({ success: true });
});

// ── PUT /api/coreo/tournaments/:id/config ────────────────────────────────────
router.put('/tournaments/:id/config', (req, res) => {
  const tid = Number(req.params.id);
  const { categories, rounds } = req.body;
  const cats = Array.isArray(categories) ? JSON.stringify(categories.map(String)) : '[]';
  const rds = Math.max(1, Number(rounds) || 1);
  db.prepare('UPDATE tournaments SET coreo_categories = ?, coreo_rounds = ? WHERE id = ?').run(cats, rds, tid);
  const updated = db.prepare('SELECT coreo_categories, coreo_rounds FROM tournaments WHERE id = ?').get(tid);
  req.io.to(`admin:${tid}`).emit('coreo:config-updated', { coreo_categories: updated.coreo_categories, coreo_rounds: updated.coreo_rounds });
  res.json({ success: true, coreo_categories: updated.coreo_categories, coreo_rounds: updated.coreo_rounds });
});

// ── PUT /api/coreo/tournaments/:id/criteria ─────────────────────────────────
router.put('/tournaments/:id/criteria', (req, res) => {
  const tid = Number(req.params.id);
  const { criteria } = req.body;
  if (!Array.isArray(criteria)) return res.status(400).json({ error: 'criteria debe ser un array' });

  const txn = db.transaction(() => {
    db.prepare('DELETE FROM criteria WHERE tournament_id = ?').run(tid);
    criteria.forEach((c, i) => {
      db.prepare('INSERT INTO criteria (tournament_id, name, max_score, sort_order) VALUES (?, ?, ?, ?)').run(tid, String(c.name).trim(), Number(c.max_score) || 10, i);
    });
  });
  txn();

  const saved = db.prepare('SELECT * FROM criteria WHERE tournament_id = ? ORDER BY sort_order').all(tid);
  req.io.to(`admin:${tid}`).emit('coreo:criteria-updated', { criteria: saved });
  res.json({ criteria: saved });
});

// ── POST /api/coreo/tournaments/:id/participants ─────────────────────────────
router.post('/tournaments/:id/participants', (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const tid = Number(req.params.id);
      const { name, category, age_group, academia, localidad, coreografo, round_number } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

      const photoPath = req.file ? req.file.filename : null;
      const cat = category?.trim() || '';
      const ageGrp = age_group?.trim() || '';
      const rnd = Math.max(1, Number(round_number) || 1);

      let pid;
      const txn = db.transaction(() => {
        const result = db.prepare(
          'INSERT INTO participants (tournament_id, name, category, age_group, photo_path, academia, localidad, coreografo, round_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(tid, name.trim(), cat, ageGrp, photoPath, academia?.trim() || null, localidad?.trim() || null, coreografo?.trim() || null, rnd);
        pid = result.lastInsertRowid;
      });
      txn();

      const participant = db.prepare('SELECT id, name, category, age_group, photo_path, act_order, on_stage, academia, localidad, coreografo, round_number FROM participants WHERE id = ?').get(pid);
      participant.members = [];

      req.io.to(`admin:${tid}`).emit('coreo:participant-added', { participant });
      res.json({ participant });
    } catch (e) {
      console.error('Error creating participant:', e.message);
      res.status(500).json({ error: 'Error interno al crear el participante' });
    }
  });
});

// ── PUT /api/coreo/participants/:id ──────────────────────────────────────────
router.put('/participants/:id', (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const pid = Number(req.params.id);
      const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(pid);
      if (!participant) return res.status(404).json({ error: 'Participante no encontrado' });

      const { name, category, age_group, academia, localidad, coreografo, round_number } = req.body;
      const cat = category?.trim() ?? participant.category;
      const ageGrp = age_group?.trim() ?? participant.age_group ?? '';
      const newName = name?.trim() || participant.name;
      const rnd = round_number !== undefined ? Math.max(1, Number(round_number) || 1) : (participant.round_number || 1);

      let photoPath = participant.photo_path;
      if (req.file) {
        if (photoPath) {
          const oldFile = path.join(uploadsDir, photoPath);
          if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        }
        photoPath = req.file.filename;
      }

      db.prepare(
        'UPDATE participants SET name = ?, category = ?, age_group = ?, photo_path = ?, academia = ?, localidad = ?, coreografo = ?, round_number = ? WHERE id = ?'
      ).run(newName, cat, ageGrp, photoPath, academia?.trim() || null, localidad?.trim() || null, coreografo?.trim() || null, rnd, pid);

      const updated = db.prepare('SELECT id, name, category, age_group, photo_path, act_order, on_stage, academia, localidad, coreografo, round_number FROM participants WHERE id = ?').get(pid);
      updated.members = [];

      req.io.to(`admin:${participant.tournament_id}`).emit('coreo:participant-updated', { participant: updated });
      res.json({ participant: updated });
    } catch (e) {
      console.error('Error updating participant:', e.message);
      res.status(500).json({ error: 'Error interno al actualizar' });
    }
  });
});

// ── DELETE /api/coreo/participants/:id ───────────────────────────────────────
router.delete('/participants/:id', (req, res) => {
  const pid = Number(req.params.id);
  const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(pid);
  if (!participant) return res.status(404).json({ error: 'Participante no encontrado' });

  if (participant.photo_path) {
    const filePath = path.join(uploadsDir, participant.photo_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM participants WHERE id = ?').run(pid);
  req.io.to(`admin:${participant.tournament_id}`).emit('coreo:participant-removed', { id: pid });
  res.json({ success: true });
});

// ── PUT /api/coreo/tournaments/:id/act-order ─────────────────────────────────
router.put('/tournaments/:id/act-order', (req, res) => {
  const tid = Number(req.params.id);
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order debe ser un array' });

  const txn = db.transaction(() => {
    order.forEach(({ id, act_order }) => {
      db.prepare('UPDATE participants SET act_order = ? WHERE id = ? AND tournament_id = ?').run(Number(act_order), Number(id), tid);
    });
  });
  txn();

  req.io.to(`admin:${tid}`).emit('coreo:order-updated', { order });
  res.json({ success: true });
});

// ── POST /api/coreo/participants/:id/on-stage ────────────────────────────────
router.post('/participants/:id/on-stage', (req, res) => {
  const pid = Number(req.params.id);
  const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(pid);
  if (!participant) return res.status(404).json({ error: 'Participante no encontrado' });

  const tid = participant.tournament_id;

  const txn = db.transaction(() => {
    db.prepare('UPDATE participants SET on_stage = 0 WHERE tournament_id = ?').run(tid);
    db.prepare('UPDATE participants SET on_stage = 1 WHERE id = ?').run(pid);
  });
  txn();

  const full = db.prepare('SELECT id, name, category, age_group, photo_path, act_order, on_stage, academia, localidad, coreografo, round_number FROM participants WHERE id = ?').get(pid);
  const onStageData = { ...full, members: [] };

  db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?').run(
    JSON.stringify({ mode: 'on-stage', participant: onStageData }), tid
  );

  const payload = { participant: onStageData };
  req.io.to(`screen:${tid}`).emit('coreo:on-stage', payload);
  req.io.to(`admin:${tid}`).emit('coreo:on-stage', payload);
  req.io.to(`judge:${tid}`).emit('coreo:on-stage', payload);
  res.json({ success: true, participant: onStageData });
});

// ── POST /api/coreo/tournaments/:id/off-stage ────────────────────────────────
router.post('/tournaments/:id/off-stage', (req, res) => {
  const tid = Number(req.params.id);
  db.prepare('UPDATE participants SET on_stage = 0 WHERE tournament_id = ?').run(tid);
  db.prepare('UPDATE tournaments SET screen_state = ? WHERE id = ?').run(JSON.stringify({ mode: 'idle' }), tid);
  req.io.to(`screen:${tid}`).emit('coreo:off-stage');
  req.io.to(`admin:${tid}`).emit('coreo:off-stage');
  req.io.to(`judge:${tid}`).emit('coreo:off-stage');
  res.json({ success: true });
});

// ── POST /api/coreo/tournaments/:id/judges ───────────────────────────────────
router.post('/tournaments/:id/judges', (req, res) => {
  const tid = Number(req.params.id);
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const code = generateWordCode();
  const result = db.prepare('INSERT INTO judges (tournament_id, name, access_code) VALUES (?, ?, ?)').run(tid, name.trim(), code);
  const judge = { id: result.lastInsertRowid, tournament_id: tid, name: name.trim(), access_code: code };
  req.io.to(`admin:${tid}`).emit('coreo:judge-added', { judge });
  res.json({ judge });
});

// ── DELETE /api/coreo/judges/:id ─────────────────────────────────────────────
router.delete('/judges/:id', (req, res) => {
  const jid = Number(req.params.id);
  const judge = db.prepare('SELECT * FROM judges WHERE id = ?').get(jid);
  if (!judge) return res.status(404).json({ error: 'Juez no encontrado' });
  db.prepare('DELETE FROM judges WHERE id = ?').run(jid);
  req.io.to(`admin:${judge.tournament_id}`).emit('coreo:judge-removed', { id: jid });
  res.json({ success: true });
});

// ── POST /api/coreo/tournaments/:id/organizers ───────────────────────────────
router.post('/tournaments/:id/organizers', (req, res) => {
  const tid = Number(req.params.id);
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const code = generateWordCode();
  const result = db.prepare('INSERT INTO organizers (tournament_id, name, access_code) VALUES (?, ?, ?)').run(tid, name.trim(), code);
  const organizer = { id: result.lastInsertRowid, tournament_id: tid, name: name.trim(), access_code: code };
  req.io.to(`admin:${tid}`).emit('coreo:organizer-added', { organizer });
  res.json({ organizer });
});

// ── DELETE /api/coreo/organizers/:id ─────────────────────────────────────────
router.delete('/organizers/:id', (req, res) => {
  const oid = Number(req.params.id);
  const org = db.prepare('SELECT * FROM organizers WHERE id = ?').get(oid);
  if (!org) return res.status(404).json({ error: 'Organizador no encontrado' });
  db.prepare('DELETE FROM organizers WHERE id = ?').run(oid);
  req.io.to(`admin:${org.tournament_id}`).emit('coreo:organizer-removed', { id: oid });
  res.json({ success: true });
});

// ── GET /api/coreo/tournaments/:id/scores ────────────────────────────────────
router.get('/tournaments/:id/scores', (req, res) => {
  const tid = Number(req.params.id);
  const rows = db.prepare(`
    SELECT p.id, p.name, p.category, p.age_group, p.act_order,
      COUNT(DISTINCT cs.judge_id) as judges_scored,
      SUM(cs.score) as total_raw, AVG(cs.score) as avg_score
    FROM participants p
    LEFT JOIN choreography_scores cs ON cs.participant_id = p.id
    WHERE p.tournament_id = ?
    GROUP BY p.id ORDER BY avg_score DESC
  `).all(tid);
  res.json({ scores: rows });
});

// ── GET /api/coreo/tournaments/:id/scores/detail ─────────────────────────────
router.get('/tournaments/:id/scores/detail', (req, res) => {
  const tid = Number(req.params.id);
  const rows = db.prepare(`
    SELECT cs.participant_id, cs.judge_id, cs.criterion_id, cs.score,
      j.name as judge_name, c.name as criterion_name, c.max_score,
      p.name as participant_name
    FROM choreography_scores cs
    JOIN judges j ON j.id = cs.judge_id
    JOIN criteria c ON c.id = cs.criterion_id
    JOIN participants p ON p.id = cs.participant_id
    WHERE cs.tournament_id = ?
    ORDER BY cs.participant_id, cs.judge_id, c.sort_order
  `).all(tid);
  res.json({ detail: rows });
});

// ── GET /api/coreo/tournaments/:id/scores/summary ────────────────────────────
// Per-participant per-criterion average scores (across all judges)
router.get('/tournaments/:id/scores/summary', (req, res) => {
  const tid = Number(req.params.id);

  const criteria = db.prepare('SELECT * FROM criteria WHERE tournament_id = ? ORDER BY sort_order').all(tid);

  const scores = db.prepare(`
    SELECT cs.participant_id, cs.criterion_id, AVG(cs.score) as avg_score
    FROM choreography_scores cs
    WHERE cs.tournament_id = ?
    GROUP BY cs.participant_id, cs.criterion_id
  `).all(tid);

  if (!scores.length) return res.json({ criteria, participants: [] });

  const participantIds = [...new Set(scores.map(s => s.participant_id))];
  const placeholders = participantIds.map(() => '?').join(',');
  const participants = db.prepare(`
    SELECT id, name, category, act_order, round_number
    FROM participants WHERE id IN (${placeholders})
    ORDER BY COALESCE(act_order, 9999), id
  `).all(...participantIds);

  const scoreMap = {};
  for (const s of scores) {
    if (!scoreMap[s.participant_id]) scoreMap[s.participant_id] = {};
    scoreMap[s.participant_id][s.criterion_id] = s.avg_score;
  }

  const result = participants.map(p => ({ ...p, criterionScores: scoreMap[p.id] || {} }));
  res.json({ criteria, participants: result });
});

module.exports = router;
