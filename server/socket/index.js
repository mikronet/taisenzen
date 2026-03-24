const db = require('../db');

function setupSocket(io) {
  io.on('connection', (socket) => {

    socket.on('join:screen', (tournamentId) => {
      try {
        const tid = Number(tournamentId);
        if (!tid || isNaN(tid)) return;
        socket.join(`screen:${tid}`);

        // Restore current screen state for this client (handles reconnects)
        const tournament = db.prepare('SELECT tournament_type, screen_state, waiting_screen, timer_status, timer_start_at, timer_remaining_s, timer_duration_s, global_timer_status, global_timer_start_at, global_timer_remaining_s, global_timer_duration_s FROM tournaments WHERE id = ?').get(tid);

        // Coreo: send tournament info + restore on-stage participant for reconnection
        if (tournament?.tournament_type === 'coreografia') {
          const t = db.prepare('SELECT name, poster_path FROM tournaments WHERE id = ?').get(tid);
          socket.emit('coreo:tournament-info', { name: t?.name || '', poster_path: t?.poster_path || null });
          const onStage = db.prepare(`
            SELECT p.id, p.name, p.category, p.photo_path, p.act_order
            FROM participants p
            WHERE p.tournament_id = ? AND p.on_stage = 1
            LIMIT 1
          `).get(tid);
          if (onStage) {
            const members = db.prepare('SELECT member_name FROM participant_members WHERE participant_id = ? ORDER BY sort_order').all(onStage.id);
            onStage.members = members.map(m => m.member_name);
            socket.emit('coreo:on-stage', { participant: onStage });
          }
          return;
        }

        if (!tournament?.screen_state) return;

        let state;
        try { state = JSON.parse(tournament.screen_state); } catch { return; }

        // For live mode, enrich with current vote counts from DB
        if (state.mode === 'live' && state.match) {
          const mid = state.match.id;
          const liveMatch = db.prepare('SELECT status FROM matches WHERE id = ?').get(mid);
          if (liveMatch?.status === 'live') {
            if (state.match.phase_type === 'filtros') {
              state.totalVotes = db.prepare('SELECT COUNT(DISTINCT judge_id) as c FROM filtros_scores WHERE match_id = ?').get(mid).c;
            } else {
              state.totalVotes = db.prepare('SELECT COUNT(*) as c FROM votes WHERE match_id = ?').get(mid).c;
            }
            state.totalJudges = db.prepare('SELECT COUNT(*) as c FROM judges WHERE tournament_id = ?').get(tid).c;
            if (state.match.is_tiebreaker && state.match.allowed_judge_ids) {
              state.totalJudges = state.match.allowed_judge_ids.length;
            }
          } else {
            // Match is no longer live — show idle so screen recovers gracefully
            state = { mode: 'idle' };
          }
        }

        socket.emit('screen:restore', {
          ...state,
          isWaiting: tournament.waiting_screen === 1,
          timer: {
            status: tournament.timer_status || 'idle',
            startAt: tournament.timer_start_at,
            remainingS: tournament.timer_remaining_s,
            durationS: tournament.timer_duration_s || 60,
          },
          globalTimer: {
            status: tournament.global_timer_status || 'idle',
            startAt: tournament.global_timer_start_at,
            remainingS: tournament.global_timer_remaining_s,
            durationS: tournament.global_timer_duration_s || 3600,
          },
        });
      } catch (err) {
        console.error('Socket join:screen error:', err.message);
      }
    });

    socket.on('join:judge', ({ tournamentId, judgeId }) => {
      try {
        const tid = Number(tournamentId);
        if (!tid || isNaN(tid)) return;
        socket.join(`judge:${tid}`);
        socket.judgeId = judgeId;
      } catch (err) {
        console.error('Socket join:judge error:', err.message);
      }
    });

    socket.on('join:coreo-speaker', (tournamentId) => {
      try {
        const tid = Number(tournamentId);
        if (!tid || isNaN(tid)) return;
        socket.join(`coreo-speaker:${tid}`);
        socket.join(`screen:${tid}`); // receive coreo:on-stage / coreo:off-stage

        const t = db.prepare('SELECT name FROM tournaments WHERE id = ?').get(tid);
        socket.emit('coreo:tournament-info', { name: t?.name || '', poster_path: null });

        const onStage = db.prepare(`
          SELECT p.id, p.name, p.category, p.photo_path, p.act_order
          FROM participants p
          WHERE p.tournament_id = ? AND p.on_stage = 1 LIMIT 1
        `).get(tid);
        if (onStage) {
          const members = db.prepare('SELECT member_name FROM participant_members WHERE participant_id = ? ORDER BY sort_order').all(onStage.id);
          onStage.members = members.map(m => m.member_name);
          socket.emit('coreo:on-stage', { participant: onStage });
        }
      } catch (err) {
        console.error('Socket join:coreo-speaker error:', err.message);
      }
    });

    socket.on('join:admin', (tournamentId) => {
      try {
        const tid = Number(tournamentId);
        if (!tid || isNaN(tid)) return;
        socket.join(`admin:${tid}`);
      } catch (err) {
        console.error('Socket join:admin error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      socket.rooms.forEach(room => socket.leave(room));
    });
  });
}

module.exports = setupSocket;
