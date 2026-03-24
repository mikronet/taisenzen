# PROYECTO.md — Referencia técnica para Claude

Este documento contiene toda la información necesaria para entender el proyecto sin revisar el código en profundidad. Leerlo al inicio de cualquier nueva sesión de trabajo.

---

## Qué es esta aplicación

**TAISEN** es una aplicación web para gestionar torneos de baile tipo battle. Permite:
- Organizar fases de clasificación (Filtros) con puntuación por jueces.
- Gestionar eliminatorias (cuadros tipo bracket) con votación en tiempo real.
- Mostrar una pantalla pública que se actualiza automáticamente.
- Soportar torneos 1vs1 y 2vs2.

Es una aplicación monolítica donde el servidor Express sirve tanto la API REST como el build del cliente React. Se usa en producción en eventos reales de baile.

---

## Stack técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Servidor | Node.js + Express | Express 4.21 |
| Tiempo real | Socket.IO | 4.8 |
| Base de datos | SQL.js (SQLite en memoria + fichero) | 1.14.1 |
| Frontend | React + Vite | React 18.3, Vite 6.0 |
| Routing cliente | react-router-dom | — |
| IDs únicos | nanoid | 3.3.7 |
| Estilos | CSS vanilla (sin framework) | — |
| Deploy | Docker / Node directo | Node 22 alpine |

---

## Estructura de directorios

```
battle-app/
├── server/
│   ├── index.js              # Entry point: Express + Socket.IO + montaje de rutas
│   ├── db.js                 # Wrapper SQL.js: init, migraciones, transacciones, save
│   ├── routes/
│   │   ├── admin.js          # Rutas /api/admin/* (917 líneas, toda la lógica de negocio)
│   │   ├── judge.js          # Rutas /api/judge/* (votos y puntuaciones)
│   │   └── tournament.js     # Rutas /api/tournament/* (datos públicos)
│   └── socket/
│       └── index.js          # Gestión de rooms Socket.IO y restauración de estado
├── client/
│   ├── src/
│   │   ├── App.jsx           # React Router: define las rutas del SPA
│   │   ├── main.jsx          # Entry point React
│   │   ├── pages/
│   │   │   ├── Admin.jsx     # Panel de administración (~1157 líneas)
│   │   │   ├── Judge.jsx     # Interfaz del juez (~400 líneas)
│   │   │   ├── Organizer.jsx # Login organizador (~60 líneas)
│   │   │   ├── Screen.jsx    # Pantalla pública (~400 líneas)
│   │   │   ├── Home.jsx      # Página de inicio (~350 líneas)
│   │   │   └── Landing.jsx   # Landing informativa (~150 líneas)
│   │   ├── components/
│   │   │   ├── Bracket.jsx       # Visualización y edición del cuadro de eliminación
│   │   │   ├── PhaseConfigurator.jsx  # UI para configurar fases
│   │   │   └── MatchupEditor.jsx     # Edición manual de enfrentamientos
│   │   ├── hooks/
│   │   │   └── useSocket.js  # Hook para gestionar conexión Socket.IO (singleton)
│   │   └── styles/
│   │       └── global.css    # Todos los estilos globales (~360 líneas)
│   ├── package.json
│   └── vite.config.js        # Dev proxy → localhost:3000
├── data/
│   └── battle.db             # Fichero SQLite (persistencia, excluir de git)
├── package.json              # Scripts: dev, build, start, setup
├── docker-compose.yml        # Puerto 3080:3000, volumen ./data
├── Dockerfile
├── .env.example
└── .env                      # ADMIN_PASSWORD, PORT, NODE_ENV (no en git)
```

---

## Base de datos (SQL.js)

SQL.js mantiene SQLite **en memoria** y serializa a fichero `data/battle.db` tras cada escritura. Toda la lógica de DB está en `server/db.js`.

### Esquema de tablas

**tournaments**
```sql
id, name, status (pending/active/finished), current_phase_id,
type (1vs1/2vs2), screen_state (JSON), ticker_text, waiting_screen (0/1),
created_at
```

**participants**
```sql
id, tournament_id, name, seed, total_score, eliminated (0/1),
partner_name (para 2vs2), created_at
```

**phases**
```sql
id, tournament_id, name, type (filtros/elimination),
phase_order, status (pending/active/finished),
advance_count, group_size, created_at
```

**matches**
```sql
id, phase_id, tournament_id, round_number,
participant1_id, participant2_id (NULL en filtros),
winner_id, status (pending/live/finished/tie),
allowed_judges (JSON array, para tiebreaker), created_at
```

**match_participants** (solo para filtros, relación N:M)
```sql
id, match_id, participant_id
```

**judges**
```sql
id, tournament_id, name, code (nanoid 8 chars), created_at
```

**votes** (eliminatorias)
```sql
id, match_id, judge_id, voted_for_id, created_at
```

**filtros_scores** (fase filtros)
```sql
id, match_id, judge_id, participant_id, score (0-10), created_at
```

**organizers**
```sql
id, tournament_id, name, code (nanoid 8 chars), created_at
```

**admin_sessions**
```sql
id, token, created_at, expires_at (12h TTL)
```

**contacts**
```sql
id, name (200), email (200), message (2000), created_at
```

### Patrones de DB importantes

- Foreign keys activadas con `PRAGMA foreign_keys = ON`.
- Cascading deletes: borrar torneo elimina todo lo asociado.
- Las migraciones se ejecutan con `IF NOT EXISTS` / `IF NOT EXISTS column` en cada arranque.
- No hay ORM ni herramienta de migraciones — todo SQL crudo con parámetros (`?`).
- Las transacciones se usan en operaciones críticas: generar fases, avanzar filtros, editar bracket.
- `screen_state` es un campo JSON en tournaments que guarda el estado actual de la pantalla pública para restauración en reconexión.

---

## API REST

### Autenticación

- **Admin:** Header `x-admin-token` con el token de sesión. El token se obtiene en `POST /api/admin/login` y se guarda en `sessionStorage` del cliente. TTL 12h.
- **Organizador:** Header `x-organizer-code` con el código de 8 chars.
- **Juez:** Header `x-judge-code` con el código de 8 chars.
- **Público:** Sin autenticación.

### Endpoints principales

#### Admin (`/api/admin`)

| Método | Ruta | Función |
|--------|------|---------|
| POST | `/login` | Autenticación admin |
| POST | `/tournaments` | Crear torneo |
| GET | `/tournaments` | Listar torneos |
| GET | `/tournaments/:id` | Detalle torneo |
| DELETE | `/tournaments/:id` | Eliminar torneo |
| PUT | `/tournaments/:id/phase-config` | Configurar fases |
| POST | `/tournaments/:id/participants` | Añadir participante |
| GET | `/tournaments/:id/participants` | Listar participantes |
| DELETE | `/participants/:id` | Eliminar participante |
| PUT | `/participants/:id/score` | Editar puntuación manualmente |
| POST | `/tournaments/:id/judges` | Crear juez |
| POST | `/tournaments/:id/organizers` | Crear organizador |
| POST | `/tournaments/:id/generate-phases` | Generar bracket |
| POST | `/matches/:id/start` | Iniciar match |
| POST | `/matches/:id/reveal` | Revelar resultado |
| POST | `/matches/:id/close-round` | Cerrar ronda de filtros |
| POST | `/matches/:id/start-tiebreaker` | Activar tiebreaker |
| POST | `/matches/:id/restart` | Reiniciar match |
| POST | `/tournaments/:id/advance-filtros` | Sembrar siguiente fase |
| PUT | `/tournaments/:id/phases/:pid/bracket` | Editar bracket |
| PUT | `/tournaments/:id/ticker` | Actualizar ticker de texto |
| PUT | `/tournaments/:id/waiting` | Mostrar/ocultar pantalla de espera |
| POST | `/tournaments/:id/show-ranking` | Mostrar ranking en pantalla |

#### Judge (`/api/judge`)

| Método | Ruta | Función |
|--------|------|---------|
| POST | `/login` | Login con código |
| POST | `/vote` | Votar en eliminatoria |
| POST | `/score` | Puntuar en filtros |
| GET | `/match/:matchId/status` | Estado del match activo |

#### Tournament (`/api/tournament`)

| Método | Ruta | Función |
|--------|------|---------|
| GET | `/active` | Torneos activos (público) |
| GET | `/:id` | Datos del torneo (público) |
| GET | `/:id/live-match` | Match en vivo (público) |
| GET | `/:id/history` | Historial de matches y votos |

#### Otros

| Método | Ruta | Función |
|--------|------|---------|
| POST | `/api/contact` | Formulario de contacto (público) |

---

## WebSockets (Socket.IO)

El servidor emite eventos a rooms específicas. Los clientes se unen a rooms al conectarse.

### Rooms

- `screen:${tournamentId}` — Pantalla pública del torneo.
- `judge:${tournamentId}` — Jueces de un torneo.
- `admin:${tournamentId}` — Admin gestionando un torneo.

### Eventos servidor → cliente

| Evento | Datos | Cuándo |
|--------|-------|--------|
| `tournament:updated` | tournament data | Cualquier cambio en torneo |
| `match:started` | match data | Admin inicia un match |
| `match:result` | winner, votes | Admin revela resultado |
| `match:restarted` | match data | Admin reinicia match |
| `round:closed` | scores, ranking | Admin cierra ronda filtros |
| `filtros:ranking` | ranking array | Admin muestra ranking |
| `filtros:advance` | next phase data | Participantes avanzan |
| `participant:added` | participant | Nuevo participante |
| `participant:removed` | id | Participante eliminado |
| `phase:renamed` | phase data | Fase renombrada |
| `vote:received` | judge_id, voted_for | Voto registrado (para admin) |
| `vote:count` | counts object | Actualización contador público |
| `ticker:update` | text | Texto del ticker cambiado |
| `screen:waiting` | boolean | Modo espera activado/desactivado |
| `tournament:finished` | tournament | Torneo finalizado |
| `screen:restore` | full state | Reconexión: restaurar estado |

### Restauración de estado

Al emitir `join:screen`, el servidor lee `tournament.screen_state` y emite `screen:restore` con el estado actual, incluyendo votos en vivo si hay match activo. Esto evita pantallas en blanco tras reconexión.

---

## Lógica de negocio clave

### Algoritmo de siembra (seeded bracket)

- Los participantes se ordenan por puntuación total (filtros).
- El bracket se genera enfrentando la mitad superior contra la mitad inferior: seed 1 vs seed N, seed 2 vs seed N-1, etc.
- Esto garantiza que el 1 y el 2 solo se encuentren en la final.
- Función: `seededBracket()` en `server/routes/admin.js`.

### Sistema de tiebreaker

1. Al revelar resultado, si hay empate en votos, el match pasa a estado `tie`.
2. El sistema registra en `matches.allowed_judges` (JSON) qué jueces pueden participar.
3. Solo los jueces que votaron diferente (generando el empate) pueden revotacar.
4. El admin activa el tiebreaker con `POST /matches/:id/start-tiebreaker`.
5. Los jueces reciben el evento y pueden votar de nuevo.

### Filtros — creación de rondas

- Los participantes se distribuyen en grupos del tamaño configurado (`group_size`).
- Se crea un match por grupo con todos los participantes en `match_participants`.
- Los jueces puntúan cada participante del grupo (0-10).
- Al cerrar ronda, la puntuación se acumula en `participants.total_score`.
- Las rondas se crean automáticamente conforme se van cerrando.

### Avance de filtros a eliminatoria

1. Admin pulsa avanzar.
2. El sistema toma los `advance_count` primeros por puntuación.
3. Actualiza `participants.eliminated = 0` para los que pasan.
4. Genera el bracket de la siguiente fase con el algoritmo de siembra.
5. Emite `filtros:advance` a todos los clientes.

---

## Frontend — páginas y responsabilidades

| Página | Ruta | Función |
|--------|------|---------|
| Home.jsx | `/` | Lista torneos activos, accesos rápidos, animación partículas |
| Admin.jsx | `/admin` | Panel completo (1157 líneas — candidato a refactor) |
| Judge.jsx | `/judge` | Login y votación en tiempo real |
| Organizer.jsx | `/organizer` | Login, delega en TournamentManager |
| Screen.jsx | `/screen/:id` | Pantalla pública con todos los modos de display |
| Landing.jsx | `/landing` | Página informativa / marketing |

**Nota:** Admin.jsx mezcla: lista de torneos, gestión de participantes, bracket, configuración de fases, gestión de jueces y control de matches. Es el mayor candidato a dividirse.

### useSocket.js

Hook singleton. Se conecta al montar el componente y se desconecta al desmontar. Usa `useRef` para mantener una única instancia. Los componentes llaman `socket.on(event, handler)` y deben limpiarlos en el `return` del `useEffect` para evitar memory leaks (esto no siempre se hace correctamente en el código actual).

---

## Autenticación y sesiones

- **Admin:** Token en `sessionStorage` (`adminToken`). Se valida contra `admin_sessions` en cada petición. Las sesiones se limpian en el login (se eliminan las expiradas).
- **Juez/Organizador:** Código guardado en `sessionStorage` (`judgeCode` / `organizerCode` + `organizerTournamentId`). Se valida en cada petición contra la tabla correspondiente.
- No hay JWT real aunque `JWT_SECRET` esté en `.env` — el token de admin es un nanoid.

---

## Configuración y entorno

```env
PORT=3000
ADMIN_PASSWORD=...          # Contraseña del panel admin (texto plano)
JWT_SECRET=...              # Definido pero NO USADO en el código actual
NODE_ENV=development|production
```

En producción con `NODE_ENV=production`, Express sirve el build de Vite desde `client/dist/`.
En desarrollo, Vite corre en puerto 5173 y hace proxy de `/api` y `/socket.io` al servidor en 3000 (configurado en `client/vite.config.js`).

---

## Docker

- **Imagen base:** node:22-alpine
- **Build:** El Dockerfile ejecuta `npm run build` para compilar el cliente.
- **Puerto expuesto:** 3000 (mapeado a 3080 en docker-compose).
- **Volumen:** `./data:/app/data` — persiste la base de datos.
- **Arranque:** `npm start` → `NODE_ENV=production node server/index.js`.

---

## Deuda técnica conocida

### Seguridad (alta prioridad)
- Sin rate limiting en endpoints de login.
- `sessionStorage` para tokens (vulnerable a XSS).
- Sin sanitización de inputs contra XSS.
- Admin password en texto plano en `.env`.
- `JWT_SECRET` definido pero no usado.

### Calidad de código
- `Admin.jsx` tiene 1157 líneas — demasiado grande.
- Magic strings dispersos: `"filtros"`, `"pending"`, `"live"`, `"finished"`, `"tie"`, `"1vs1"`, `"2vs2"`.
- Estilos inline masivos en JSX en lugar de clases CSS.
- Sin archivo de constantes.
- Listeners Socket.IO no siempre se limpian (posibles memory leaks).

### Infraestructura
- Sin tests (ni unitarios, ni integración, ni E2E).
- Sin logging estructurado.
- Sin health check endpoint.
- Sin estrategia de backup para `battle.db`.
- Sin paginación en listas de participantes/jueces.
- Sin índices definidos en la DB.

### Documentación
- Sin documentación de API (OpenAPI/Swagger).
- Sin diagrama de la DB.

---

## Comandos útiles

```bash
# Desarrollo
npm run setup          # Instala dependencias servidor + cliente
npm run dev            # Arranca servidor (watch) + cliente (Vite) en paralelo
npm run dev:server     # Solo servidor
npm run dev:client     # Solo cliente

# Producción
npm run build          # Compila cliente a client/dist/
npm start              # Arranca servidor en modo producción

# Docker
docker-compose up -d   # Arranca en background, acceso en :3080
docker-compose down    # Para y elimina contenedores
docker-compose logs -f # Ver logs en tiempo real
```

---

## Historial de cambios relevantes

*(Actualizar esta sección conforme se hagan cambios importantes)*

| Fecha | Cambio |
|-------|--------|
| 2026-03-14 | Creación de README.md y PROYECTO.md |
