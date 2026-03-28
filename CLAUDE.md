# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> For deep technical detail (DB schema, full API reference, Socket.IO events, business logic), read **PROYECTO.md** at the root.

---

## Commands

```bash
# First-time setup (installs both server and client dependencies)
npm run setup

# Development — runs server with --watch and Vite client concurrently
npm run dev

# Individual processes
npm run dev:server    # Node with --watch on port 3000
npm run dev:client    # Vite on port 5173 (proxies /api and /socket.io to :3000)

# Production
npm run build         # Compiles client to client/dist/
npm start             # NODE_ENV=production, serves API + static from :3000

# Docker (maps :3000 → :3080, persists DB in ./data)
docker-compose up -d
docker-compose logs -f
```

No linter, no test runner, no type-checking is configured. There are no pre-commit hooks.

---

## Architecture

The app is a **monolith**: one Express+Socket.IO server (`server/`) serves both the REST API and (in production) the Vite-compiled React SPA (`client/`).

```
browser clients
  ├── /admin, /organizer  →  Admin.jsx / Organizer.jsx  (TournamentManager)
  ├── /speaker            →  Speaker.jsx  (TournamentManager role="speaker")
  ├── /judge              →  Judge.jsx
  ├── /screen/:id         →  Screen.jsx
  └── /                   →  Home.jsx + Landing.jsx

     ↕ REST /api/*   ↕ Socket.IO

Express server
  ├── routes/admin.js       (~1000 lines, all tournament business logic)
  ├── routes/judge.js       (vote + score endpoints, emits vote:received)
  ├── routes/tournament.js  (public read-only endpoints + live-match)
  └── socket/index.js       (room join handlers + screen state restore on reconnect)

DB: SQL.js (SQLite in-memory, serialised to data/battle.db after every write)
```

### Key architectural decisions to know

**SQL.js is synchronous and in-memory.** All DB reads/writes use `db.prepare(...).get/all/run()`. The DB is saved to disk after every mutating operation. There is no async DB layer.

**`req.io` is injected by middleware** (in `server/index.js`) so every route handler can emit Socket.IO events directly via `req.io.to(room).emit(event, data)`.

**Three Socket.IO rooms per tournament:**
- `screen:${tournamentId}` — public display
- `judge:${tournamentId}` — judge devices
- `admin:${tournamentId}` — admin/organizer/speaker browser tabs

**Four roles share two React components:**
- `Admin.jsx` renders `<TournamentManager role="admin" />`
- `Organizer.jsx` renders `<TournamentManager role="organizer" />`
- `Speaker.jsx` renders `<TournamentManager role="speaker" />`
- Authentication is distinguished by headers: `x-admin-token` vs `x-organizer-code` vs `x-speaker-code`
- The `requireAdmin` middleware in admin routes accepts all three.

**`apiFetch()` in `Admin.jsx`** automatically attaches whichever credential is in `sessionStorage` (`adminToken`, `organizerCode`, or `speakerCode`). Plain `fetch()` is used for public endpoints (`/api/tournament/*`).

**Speaker role** has a stripped-down UI: no participant/judge management, no bracket editor, no history. Key speaker-specific behaviours:
- In Filtros: sees a minimal card with round info + participant names, then **▶ CONVOCAR A PISTA** (btn-success, calls `startMatch`). When live: EN CURSO badge + vote dots + integrated timer (compact seconds input + ¡INICIAR TIEMPO! btn-blue) + CERRAR RONDA (btn-gold, shown when `allVoted`).
- After Filtros: sees AVANZAR button. The ELIMINATORIAS card only appears **after** AVANZAR is pressed (`filtrosDone && !nextPhaseReady`).
- In Elimination (bracket): sees a minimal card with phase name, cruce X/Y, participant names VS layout, **▶ CONVOCAR A PISTA** (pending), EN CURSO badge + vote dots + winner name preview (gold, shown when `allVoted`) + integrated timer + REVELAR RESULTADO (btn-gold, shown when `allVoted`). Full bracket is hidden.
- In 7toSmoke phase: sees a minimal card with battle number, VS display, and INICIAR BATALLA / REVELAR RESULTADO buttons. No PREPARAR (queue already set). Global timer controls (PAUSAR/REANUDAR/RESET) plus per-battle timer controls (PAUSAR/REANUDAR/RESET — timer auto-starts, no manual start needed).
- PUNTUACIONES FILTROS widget is hidden after AVANZAR is pressed (`filtrosDone`).
- The general "MATCH EN CURSO" widget is hidden for the speaker in 7toSmoke (their card replaces it).
- CRONÓMETRO standalone card is only shown for 7toSmoke (`is7toSmoke`); bracket tournaments use the integrated timer inside each card.

**Screen state persistence:** `tournaments.screen_state` (JSON column) is updated on every admin action so that `Screen.jsx` can fully restore its display on reconnect via `socket.on('join:screen')` → server emits `screen:restore`.

**`useSocket.js` is a singleton hook** (via `useRef`). It creates the socket with `autoConnect: false` and connects in a `useEffect`. Components must clean up their `socket.on` listeners in the `useEffect` return to avoid memory leaks.

**Admin.jsx reconnect handling:** `socket.on('connect', rejoin)` re-joins the `admin:${id}` room and calls `loadAll()` on every reconnect. This mirrors the pattern in `Judge.jsx` and prevents stale state after network drops.

### Tournament types

`tournaments.tournament_type` distinguishes two types:
- `'bracket'` (default) — classic Filtros + Elimination bracket
- `'7tosmoke'` — Filtros + 7toSmoke dynamic queue phase

`tournaments.type` (separate field) is still `'1vs1'` or `'2vs2'` — the battle format.

### Tournament lifecycle

**Bracket** (`tournament_type = 'bracket'`):
```
setup → (generate phases) → active
  Phase 1: Filtros
    rounds: pending → live → finished  (judge scores 0-10, admin/speaker closes)
    → speaker/admin clicks "Avanzar a Eliminatoria" → seeds bracket
  Phases 2+: Elimination
    matches run in strict sequential order (currentElimMatch = first non-finished)
    matches: pending → live → finished | tie
    tie → (start-tiebreaker) → live again → finished
    tiebreaker auto-resets and starts the timer
  → admin marks tournament finished
```

**7toSmoke** (`tournament_type = '7tosmoke'`):
```
setup → (generate phases) → active
  Phase 1: Filtros  (same as bracket)
    → speaker/admin clicks "Avanzar a 7toSmoke" → POST advance-7tosmoke
      initialises smoke_points, sets queue_state in phases, creates first match
  Phase 2: 7toSmoke (phase_type = '7tosmoke')
    Global countdown timer (global_timer_*) controlled by speaker
    Timer auto-starts on first INICIAR BATALLA
    Matches: pending → live → finished
      on reveal: points updated, queue rotated (winner stays, loser → end), next match created
      win condition: first to reach (participants count) points → tournament winner
      timer reaches 0 → most points wins; tie → extra 1v1 round
  → admin marks tournament finished
```

**Points modes** (`tournaments.points_mode`):
- `'accumulated'` — total wins across the phase
- `'consecutive'` — current winning streak (resets on loss)

### `voteStatus` state in Admin.jsx

The `voteStatus` map (`{ [matchId]: { totalVotes, totalJudges, allVoted, votesP1, votesP2 } }`) controls when the "CERRAR RONDA" / "REVELAR RESULTADO" buttons appear, and provides vote breakdown for the speaker's winner preview. It is populated two ways:
1. On page load via `loadAll()` → `GET /api/tournament/:id/live-match` (returns `match.votesP1`/`match.votesP2` for elimination matches)
2. In real-time via the `vote:received` socket event (includes `votesP1`/`votesP2`)

`votesP1`/`votesP2` are only meaningful for elimination matches (choice = `'participant1'`/`'participant2'`). For filtros (score-based) they are 0.

### Sequential match gating

**Filtros rounds** go in strict order. `firstPendingIdx = filtrosMatches.findIndex(m => m.status !== 'finished')` — only that round shows PREPARAR/INICIAR. Earlier rounds show their status badge; later rounds show nothing.

**Elimination matches** also go in strict global order across all phases. `currentElimMatch = eliminationMatches.find(m => m.status !== 'finished')` (array is ordered by `phase_order, match_order`). The `Bracket` component gates PREPARAR/INICIAR via `match.id === currentMatchId` prop. The speaker's minimal elimination view uses the same `currentElimMatch`.

### Spatial layout (judge vs public screen)

Judges and audience face each other across the dance floor. Positions are mirrored horizontally between the two views.

**Judge's screen (CCW from judge's perspective):**
- N=2: P2=left, P1=right (horizontal)
- N=4: P1=top-left, P2=bottom-left, P3=bottom-right, P4=top-right

**Public screen (horizontal mirror of judge's view):**
- N=2: P1=left, P2=right
- N=4: P4=top-left, P3=bottom-left, P2=bottom-right, P1=top-right

Implemented as CSS grid with explicit `gridRow`/`gridColumn` per participant index. Constants `JUDGE_CCW` (in `Judge.jsx`) and `PUBLIC_CCW` (in `Screen.jsx`) define the mappings. N=2 is a special case within both arrays.

For elimination vote on judge screen: P2 button LEFT | EMPATE button center (64px) | P1 button RIGHT. Member names (for 2vs2) are shown stacked under the team name; they come from `participant1_member1/2` / `participant2_member1/2` fields added to the match query in both `tournament.js` and `buildTournamentData` in `admin.js`.

### PREPARAR feature

`POST /api/admin/matches/:id/prepare` emits `match:prepare` to `screen:${tid}` with full participant data. `screen_state` is updated to `{ mode: 'prepare', match }` for reconnect restore. Screen.jsx shows a "¡PREPARARSE!" overlay with participants in their `PUBLIC_CCW` grid positions. Timer auto-starts on `startMatch` and `startTiebreaker`.

### Bracket seeding

`seededBracket(rankedPlayers)` pairs top vs middle seed. `arrangePairsForBracket` is only called when `isPow2(pairs.length)` — non-power-of-2 counts return pairs directly to avoid the recursive function dropping pairs.

---

## Important patterns

**DB writes always go through `db.prepare(...).run()`** — never raw string concatenation. Use `?` placeholders.

**Transactions** are used for multi-step operations (generate phases, advance filtros, bracket edits). Pattern: `const txn = db.transaction(() => { ... }); txn();`

**Filtros vs Elimination** is distinguished throughout by `phase.phase_type`: `'filtros'` or `'elimination'`. Matches in filtros use the `match_participants` join table (N participants); elimination matches use `participant1_id` / `participant2_id` directly on the match row.

**Tiebreaker** reuses the same match row (same `id`), sets `is_tiebreaker = 1` and `allowed_judges` (JSON array of judge IDs), and resets `status` back to `'live'`. Previous votes are deleted before starting. The timer is automatically reset and started when a tiebreaker begins.

**`advance-filtros`** checks for score ties at the cutoff boundary before seeding the bracket, returning a 400 error if found. This same check does **not** exist in `show-ranking`.

**The `scores` endpoint** (`GET /api/admin/tournaments/:id/scores`) returns participants with their accumulated `total_score` used in the Filtros ranking table in Admin.jsx.

**7toSmoke DB schema additions:**
- `tournaments.tournament_type TEXT DEFAULT 'bracket'`
- `tournaments.points_mode TEXT DEFAULT 'accumulated'`
- `tournaments.global_timer_status TEXT` / `global_timer_start_at INTEGER` / `global_timer_remaining_s REAL` / `global_timer_duration_s INTEGER`
- `phases.queue_state TEXT` — JSON array of participant IDs in current queue order
- `smoke_points` table: `(tournament_id, phase_id, participant_id, points, consecutive_points)` — UNIQUE on `(phase_id, participant_id)`

**7toSmoke server endpoints** (all under `/api/admin`):
- `POST /tournaments/:id/advance-7tosmoke` — init smoke_points, set queue, create first match
- `POST /tournaments/:id/global-timer/start|pause|reset` — global countdown control, emits `global-timer:update`
- `POST /matches/:id/reveal` — branches on `phase_type === '7tosmoke'` to update points, rotate queue, create next match, check win condition

**`buildTournamentData`** attaches `smoke_points` array to 7toSmoke phases. `screen:restore` includes `globalTimer` state and `bracketScreen` boolean.

**`bracket_screen` feature:** `PUT /api/admin/tournaments/:id/bracket-screen` toggles `tournaments.bracket_screen` (0/1) and emits `screen:bracket` to `screen:${tid}`. Screen.jsx listens and shows/hides a full-screen bracket overlay (`position: fixed, zIndex: 200`). State restored on reconnect via `screen:restore`.

**Cross-role sync on match start/restart:** after emitting `match:started` or `match:restarted`, the server also emits `tournament:updated` to `admin:${tid}`. This ensures the speaker panel updates immediately when admin starts a match and vice versa.

**Judge `?code=` URL priority:** if `?code=` is present in the URL, Judge.jsx uses it immediately (skipping any saved `localStorage` session). This prevents stale finished-tournament sessions from blocking a new judge login via URL.

**Member names in elimination matches** (`participant1_member1`, `participant1_member2`, `participant2_member1`, `participant2_member2`) are included in both the `live-match` endpoint (tournament.js) and `buildTournamentData` (admin.js) via LEFT JOIN on the participants table. These are null for 1vs1 tournaments and used by Judge.jsx to show team members in the vote layout.
