/**
 * Seed script: crea un torneo de coreografía de prueba con
 * 2 bloques, 3 categorías, 30 participantes, criterios y orden asignado.
 * Uso: node scripts/seed-test-coreo.js
 */

const BASE = 'http://localhost:3000';
const PASS = 'admin123';

const CATEGORIES = ['Infantil', 'Junior', 'Senior'];
const ACADEMIAS   = ['Academia Norte', 'Studio Sur', 'Danza Central', 'Movimiento Libre'];
const COREOGRAFOS = ['Ana García', 'Luis Martín', 'Sara López', 'Pedro Ruiz'];
const FIRSTNAMES  = ['Sofía','Lucía','Martina','Valentina','Camila','Isabella','Emma',
                     'Daniela','Paula','Andrea','Alejandro','Mateo','Santiago','Nicolás',
                     'Diego','Sebastián'];
const SURNAMES    = ['Ruiz','García','López','Martín','Sánchez','Pérez'];

let _seed = 1;
function seededRnd(arr) { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return arr[_seed % arr.length]; }
function rndName() { return `${seededRnd(FIRSTNAMES)} ${seededRnd(SURNAMES)}`; }

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-admin-token': token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

function assert(cond, msg) {
  if (!cond) { console.error(`  ❌ FALLO: ${msg}`); process.exitCode = 1; }
  else console.log(`  ✅ ${msg}`);
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  SEED TEST — Torneo Coreografía');
  console.log('═══════════════════════════════════════\n');

  // ── 1. Login ────────────────────────────────────────
  const { token } = await api('POST', '/api/admin/login', { password: PASS });
  assert(!!token, 'Login OK');

  // ── 2. Crear torneo ─────────────────────────────────
  const t = await api('POST', '/api/admin/tournaments', {
    name: '[TEST] Campeonato Coreo ' + new Date().toISOString().slice(0,10),
    tournament_type: 'coreografia',
  }, token);
  assert(!!t.id && t.tournament_type === 'coreografia', `Torneo creado ID=${t.id}`);
  const TID = t.id;

  // ── 3. Configurar bloques ───────────────────────────
  const cfgR = await api('PUT', `/api/coreo/tournaments/${TID}/config`, { rounds: 2 }, token);
  assert(cfgR.coreo_rounds === 2, `coreo_rounds=2`);

  // ── 4. Criterios ────────────────────────────────────
  const critR = await api('PUT', `/api/coreo/tournaments/${TID}/criteria`, {
    criteria: [
      { name: 'Técnica',     max_score: 10 },
      { name: 'Creatividad', max_score: 10 },
      { name: 'Expresión',   max_score: 10 },
    ],
  }, token);
  assert(critR.criteria?.length === 3, `3 criterios guardados`);

  // ── 5. Jueces ───────────────────────────────────────
  const judgeNames = ['Juez A', 'Juez B', 'Juez C'];
  const judges = [];
  for (const name of judgeNames) {
    const r = await api('POST', `/api/coreo/tournaments/${TID}/judges`, { name }, token);
    if (r.judge?.id) judges.push(r.judge);
  }
  assert(judges.length === 3, `3 jueces creados`);

  // ── 6. Participantes: 2 bloques × 3 cats × 5 = 30 ──
  console.log('\nCreando participantes...');
  const created = [];
  for (let block = 1; block <= 2; block++) {
    for (const cat of CATEGORIES) {
      for (let i = 0; i < 5; i++) {
        const r = await api('POST', `/api/coreo/tournaments/${TID}/participants`, {
          name:         rndName(),
          category:     cat,
          round_number: block,
          academia:     seededRnd(ACADEMIAS),
          coreografo:   seededRnd(COREOGRAFOS),
          age_group:    cat === 'Infantil' ? '8-12' : cat === 'Junior' ? '13-17' : '18+',
        }, token);
        if (r.participant?.id) { created.push({ ...r.participant, _block: block }); process.stdout.write('.'); }
        else { process.stdout.write('✗'); }
      }
    }
  }
  console.log('');
  assert(created.length === 30, `30 participantes creados`);

  // ── 7. Asignar orden de actuación por bloque ────────
  for (let block = 1; block <= 2; block++) {
    const blockParts = created.filter(p => (p.round_number || p._block) === block);
    // Shuffle within block for realism
    blockParts.sort(() => Math.random() - 0.5);
    const orderPayload = blockParts.map((p, i) => ({ id: p.id, act_order: i + 1 }));
    const orderR = await api('PUT', `/api/coreo/tournaments/${TID}/act-order`, { order: orderPayload }, token);
    assert(orderR.success, `Orden asignado bloque ${block}`);
  }

  // ── 8. Verificaciones de consistencia ────────────────
  console.log('\n── Verificando consistencia ──');

  // 8a. GET participants por bloque
  const d1 = await api('GET', `/api/coreo/tournaments/${TID}?round=1`, null, token);
  const d2 = await api('GET', `/api/coreo/tournaments/${TID}?round=2`, null, token);
  assert(d1.participants?.length === 15, `Bloque 1: 15 participantes`);
  assert(d2.participants?.length === 15, `Bloque 2: 15 participantes`);

  // 8b. act_order asignado y sin duplicados
  for (const [blk, d] of [[1, d1], [2, d2]]) {
    const orders = d.participants.map(p => p.act_order).filter(v => v != null);
    const hasDupes = orders.length !== new Set(orders).size;
    assert(orders.length === 15, `Bloque ${blk}: todos tienen act_order`);
    assert(!hasDupes, `Bloque ${blk}: act_orders únicos`);
  }

  // 8c. Categorías correctas
  for (const [blk, d] of [[1, d1], [2, d2]]) {
    const cats = [...new Set(d.participants.map(p => p.category))].sort();
    assert(JSON.stringify(cats) === JSON.stringify([...CATEGORIES].sort()),
      `Bloque ${blk}: categorías correctas (${cats.join(', ')})`);
  }

  // 8d. Scores summary vacío (nadie ha actuado aún)
  for (let b = 1; b <= 2; b++) {
    const sc = await api('GET', `/api/coreo/tournaments/${TID}/scores/summary?round=${b}`, null, token);
    assert(sc.participants?.length === 0, `Scores bloque ${b}: 0 puntuaciones (correcto)`);
    assert(sc.criteria?.length === 3, `Scores bloque ${b}: 3 criterios presentes`);
    assert(sc.judges?.length === 3, `Scores bloque ${b}: 3 jueces presentes`);
  }

  // 8e. Timing
  const timing = await api('GET', `/api/coreo/tournaments/${TID}/timing`, null, token);
  assert(timing.participants?.length === 15, `Timing: 15 participantes (bloque actual)`);
  assert(timing.started_at == null, `Timing: started_at null (torneo no iniciado)`);

  // ── 9. Resumen ───────────────────────────────────────
  console.log('\n── Distribución final ──');
  for (const [blk, d] of [[1, d1], [2, d2]]) {
    console.log(`  Bloque ${blk}:`);
    const catCount = {};
    for (const p of d.participants) catCount[p.category] = (catCount[p.category] || 0) + 1;
    for (const [c, n] of Object.entries(catCount)) console.log(`    ${c}: ${n}`);
  }

  const failed = process.exitCode === 1;
  console.log(`\n${failed ? '❌ ALGUNOS TESTS FALLARON' : '✅ TODOS LOS TESTS PASARON'}`);
  console.log(`\nAbre: http://localhost:5173/coreo-admin/${TID}`);
}

main().catch(err => { console.error('❌ Error fatal:', err.message); process.exit(1); });
