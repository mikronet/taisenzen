const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'battle.db');

let db;

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT '1vs1',
      status TEXT NOT NULL DEFAULT 'setup',
      current_phase_id INTEGER,
      phase_config TEXT DEFAULT '[]',
      filtros_advance_count INTEGER DEFAULT 0,
      group_size INTEGER DEFAULT 2,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      seed INTEGER,
      eliminated INTEGER DEFAULT 0,
      total_score REAL DEFAULT 0,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS phases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phase_order INTEGER NOT NULL,
      size INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      phase_type TEXT NOT NULL DEFAULT 'elimination',
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      phase_id INTEGER NOT NULL,
      participant1_id INTEGER,
      participant2_id INTEGER,
      winner_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      match_order INTEGER NOT NULL,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE CASCADE
    )
  `);
  // For Filtros rounds: links N participants to a single match
  db.run(`
    CREATE TABLE IF NOT EXISTS match_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS judges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      access_code TEXT NOT NULL UNIQUE,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    )
  `);
  // For elimination phase: pick winner
  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      judge_id INTEGER NOT NULL,
      choice TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
      FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE,
      UNIQUE(match_id, judge_id)
    )
  `);
  // For Filtros phase: individual scores per participant
  db.run(`
    CREATE TABLE IF NOT EXISTS filtros_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      judge_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
      FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
      UNIQUE(match_id, judge_id, participant_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS organizers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      access_code TEXT NOT NULL UNIQUE,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    )
  `);

  // 7toSmoke: points table (one row per participant in the smoke phase)
  db.run(`
    CREATE TABLE IF NOT EXISTS smoke_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      phase_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      points INTEGER DEFAULT 0,
      consecutive_points INTEGER DEFAULT 0,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
      UNIQUE(phase_id, participant_id)
    )
  `);

  // Coreography: configurable criteria per tournament
  db.run(`
    CREATE TABLE IF NOT EXISTS criteria (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      name          TEXT NOT NULL,
      max_score     REAL NOT NULL DEFAULT 10,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    )
  `);

  // Coreography: scores per judge / participant / criterion (UPSERT-safe)
  db.run(`
    CREATE TABLE IF NOT EXISTS choreography_scores (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id  INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      judge_id       INTEGER NOT NULL,
      criterion_id   INTEGER NOT NULL,
      score          REAL NOT NULL DEFAULT 0,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id)  REFERENCES tournaments(id)   ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id)  ON DELETE CASCADE,
      FOREIGN KEY (judge_id)       REFERENCES judges(id)        ON DELETE CASCADE,
      FOREIGN KEY (criterion_id)   REFERENCES criteria(id)      ON DELETE CASCADE,
      UNIQUE(participant_id, judge_id, criterion_id)
    )
  `);

  // Coreography: group / duo members list
  db.run(`
    CREATE TABLE IF NOT EXISTS participant_members (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id INTEGER NOT NULL,
      member_name    TEXT NOT NULL,
      sort_order     INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
    )
  `);

  // Coreography: named speakers per tournament
  db.run(`
    CREATE TABLE IF NOT EXISTS coreo_speakers (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      name          TEXT NOT NULL,
      access_code   TEXT NOT NULL UNIQUE,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    )
  `);

  // Migrations for existing databases
  const migrations = [
    "ALTER TABLE tournaments ADD COLUMN phase_config TEXT DEFAULT '[]'",
    "ALTER TABLE tournaments ADD COLUMN filtros_advance_count INTEGER DEFAULT 0",
    "ALTER TABLE tournaments ADD COLUMN group_size INTEGER DEFAULT 2",
    "ALTER TABLE participants ADD COLUMN total_score REAL DEFAULT 0",
    "ALTER TABLE phases ADD COLUMN phase_type TEXT NOT NULL DEFAULT 'elimination'",
    "ALTER TABLE tournaments ADD COLUMN ticker_message TEXT DEFAULT ''",
    "ALTER TABLE tournaments ADD COLUMN waiting_screen INTEGER DEFAULT 0",
    "ALTER TABLE matches ADD COLUMN is_tiebreaker INTEGER DEFAULT 0",
    "ALTER TABLE matches ADD COLUMN allowed_judges TEXT DEFAULT NULL",
    "ALTER TABLE participants ADD COLUMN member1_name TEXT DEFAULT ''",
    "ALTER TABLE participants ADD COLUMN member2_name TEXT DEFAULT ''",
    "ALTER TABLE tournaments ADD COLUMN screen_state TEXT DEFAULT NULL",
    "ALTER TABLE tournaments ADD COLUMN speaker_code TEXT DEFAULT NULL",
    "ALTER TABLE tournaments ADD COLUMN timer_duration_s INTEGER DEFAULT 60",
    "ALTER TABLE tournaments ADD COLUMN timer_status TEXT DEFAULT 'idle'",
    "ALTER TABLE tournaments ADD COLUMN timer_start_at INTEGER DEFAULT NULL",
    "ALTER TABLE tournaments ADD COLUMN timer_remaining_s REAL DEFAULT NULL",
    // 7toSmoke columns
    "ALTER TABLE tournaments ADD COLUMN tournament_type TEXT DEFAULT 'bracket'",
    "ALTER TABLE tournaments ADD COLUMN points_mode TEXT DEFAULT 'accumulated'",
    "ALTER TABLE tournaments ADD COLUMN global_timer_status TEXT DEFAULT 'idle'",
    "ALTER TABLE tournaments ADD COLUMN global_timer_start_at INTEGER DEFAULT NULL",
    "ALTER TABLE tournaments ADD COLUMN global_timer_remaining_s REAL DEFAULT NULL",
    "ALTER TABLE tournaments ADD COLUMN global_timer_duration_s INTEGER DEFAULT 3600",
    "ALTER TABLE phases ADD COLUMN queue_state TEXT DEFAULT NULL",
    // Coreography columns on participants
    "ALTER TABLE participants ADD COLUMN category TEXT DEFAULT 'solo'",
    "ALTER TABLE participants ADD COLUMN age_group TEXT DEFAULT 'absoluta'",
    "ALTER TABLE participants ADD COLUMN photo_path TEXT DEFAULT NULL",
    "ALTER TABLE participants ADD COLUMN act_order INTEGER DEFAULT NULL",
    "ALTER TABLE participants ADD COLUMN on_stage INTEGER DEFAULT 0",
    "ALTER TABLE participants ADD COLUMN academia TEXT DEFAULT NULL",
    "ALTER TABLE participants ADD COLUMN localidad TEXT DEFAULT NULL",
    "ALTER TABLE participants ADD COLUMN coreografo TEXT DEFAULT NULL",
    // Coreo config: dynamic categories list + number of rounds
    "ALTER TABLE tournaments ADD COLUMN coreo_categories TEXT DEFAULT '[]'",
    "ALTER TABLE tournaments ADD COLUMN coreo_rounds INTEGER DEFAULT 1",
    // Per-participant round assignment
    "ALTER TABLE participants ADD COLUMN round_number INTEGER DEFAULT 1",
    "ALTER TABLE tournaments ADD COLUMN poster_path TEXT DEFAULT NULL",
    // Timing: track how long each participant spends on stage
    "ALTER TABLE participants ADD COLUMN on_stage_at INTEGER DEFAULT NULL",
    "ALTER TABLE participants ADD COLUMN on_stage_duration_s REAL DEFAULT 0",
    // Timing: when the tournament actually started (first on-stage)
    "ALTER TABLE tournaments ADD COLUMN started_at INTEGER DEFAULT NULL",
    // Coreo: which block is currently active (source of truth for all clients)
    "ALTER TABLE tournaments ADD COLUMN current_round INTEGER DEFAULT 1",
    // Coreo: block structure — which categories go in each block and in what order
    "ALTER TABLE tournaments ADD COLUMN block_structure TEXT DEFAULT NULL",
    // Coreo: music file per participant
    "ALTER TABLE participants ADD COLUMN audio_path TEXT DEFAULT NULL",
    // Battles: logo image for public screens
    "ALTER TABLE tournaments ADD COLUMN logo_path TEXT DEFAULT NULL",
    // Battles: show bracket overlay on public screen
    "ALTER TABLE tournaments ADD COLUMN bracket_screen INTEGER DEFAULT 0",
  ];
  for (const sql of migrations) {
    try { db.run(sql); } catch (e) { /* column already exists */ }
  }

  // Performance indexes — safe to run on existing DBs (IF NOT EXISTS)
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_participants_tournament ON participants(tournament_id)',
    'CREATE INDEX IF NOT EXISTS idx_participants_tournament_round ON participants(tournament_id, round_number)',
    'CREATE INDEX IF NOT EXISTS idx_phases_tournament ON phases(tournament_id)',
    'CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id)',
    'CREATE INDEX IF NOT EXISTS idx_matches_phase ON matches(phase_id)',
    'CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)',
    'CREATE INDEX IF NOT EXISTS idx_match_participants_match ON match_participants(match_id)',
    'CREATE INDEX IF NOT EXISTS idx_match_participants_participant ON match_participants(participant_id)',
    'CREATE INDEX IF NOT EXISTS idx_votes_match ON votes(match_id)',
    'CREATE INDEX IF NOT EXISTS idx_filtros_scores_match ON filtros_scores(match_id)',
    'CREATE INDEX IF NOT EXISTS idx_judges_tournament ON judges(tournament_id)',
    'CREATE INDEX IF NOT EXISTS idx_organizers_tournament ON organizers(tournament_id)',
    'CREATE INDEX IF NOT EXISTS idx_criteria_tournament ON criteria(tournament_id)',
    'CREATE INDEX IF NOT EXISTS idx_choreography_scores_tournament ON choreography_scores(tournament_id)',
    'CREATE INDEX IF NOT EXISTS idx_choreography_scores_participant ON choreography_scores(participant_id)',
    'CREATE INDEX IF NOT EXISTS idx_smoke_points_phase ON smoke_points(phase_id)',
    'CREATE INDEX IF NOT EXISTS idx_participant_members_participant ON participant_members(participant_id)',
    'CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_matches_phase_status ON matches(phase_id, status)',
  ];
  for (const sql of indexes) {
    db.run(sql);
  }

  save();
  return db;
}

let _saveTimer = null;

function save() {
  if (_saveTimer) return; // ya hay un save pendiente
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    if (db) {
      try {
        fs.writeFileSync(dbPath, Buffer.from(db.export()));
      } catch (e) {
        console.error('[DB] Error al guardar en disco:', e.message);
      }
    }
  }, 300);
}

function saveSync() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  if (db) {
    try { fs.writeFileSync(dbPath, Buffer.from(db.export())); } catch (e) {
      console.error('[DB] Error en saveSync:', e.message);
    }
  }
}

process.on('exit', saveSync);
process.on('SIGINT',  () => { saveSync(); process.exit(0); });
process.on('SIGTERM', () => { saveSync(); process.exit(0); });

let inTransaction = false;

function getDb() { return db; }

function prepare(sql) {
  return {
    run(...params) {
      db.run(sql, params);
      const changes = db.getRowsModified();
      const result = db.exec('SELECT last_insert_rowid() as id');
      const lastId = result.length > 0 ? result[0].values[0][0] : 0;
      if (!inTransaction) save();
      return { lastInsertRowid: lastId, changes };
    },
    get(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        stmt.free();
        const row = {};
        cols.forEach((c, i) => row[c] = vals[i]);
        return row;
      }
      stmt.free();
      return undefined;
    },
    all(...params) {
      const results = [];
      const stmt = db.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        const row = {};
        cols.forEach((c, i) => row[c] = vals[i]);
        results.push(row);
      }
      stmt.free();
      return results;
    }
  };
}

function runSql(sql, params = []) {
  db.run(sql, params);
  if (!inTransaction) save();
}

function transaction(fn) {
  return () => {
    inTransaction = true;
    db.run('BEGIN TRANSACTION');
    try {
      fn();
      db.run('COMMIT');
      inTransaction = false;
      save();
    } catch (e) {
      db.run('ROLLBACK');
      inTransaction = false;
      throw e;
    }
  };
}

module.exports = {
  initDb,
  getDb,
  prepare,
  run: runSql,
  transaction,
  save
};
