# TAISEN — Gestión de Batallas

Aplicación web para organizar y gestionar torneos de baile tipo battle, con votación en tiempo real, pantalla pública y roles diferenciados.

---

## Acceso rápido

| Rol | URL | Acceso |
|-----|-----|--------|
| Administrador | `/admin` | Contraseña (ver `.env`) |
| Juez | `/judge` | Código `palabra-palabra` |
| Organizador | `/organizer` | Código `palabra-palabra` |
| Speaker | `/speaker` | Código `palabra-palabra` |
| Pantalla pública | `/screen` | Sin contraseña |
| Landing informativa | `/landing` | Sin contraseña |

---

## Instalación y arranque

### Requisitos

- Node.js 18 o superior
- npm

### Configuración inicial

```bash
# 1. Instalar dependencias (servidor + cliente)
npm run setup

# 2. Crear el archivo de entorno
cp .env.example .env
```

Editar `.env` y cambiar obligatoriamente:

```env
ADMIN_PASSWORD=tu_contraseña_segura
PORT=3000
NODE_ENV=production
```

### Arranque

```bash
# Desarrollo (servidor con hot-reload + cliente Vite)
npm run dev

# Producción
npm run build
npm start
```

La app queda disponible en `http://localhost:3000` (o el puerto configurado).

---

## Docker

```bash
# Arrancar con Docker Compose
docker-compose up -d

# La app queda en http://localhost:3080
```

La base de datos se persiste en el volumen `./data/battle.db`.

---

## Flujo de un torneo completo

### 1. Crear el torneo (Admin)

1. Ir a `/admin` e iniciar sesión con la contraseña.
2. Pulsar **Nuevo Torneo** — introducir nombre y tipo (`1vs1` o `2vs2`).
3. El torneo aparece en la lista con estado **pendiente**.

### 2. Añadir participantes (Admin)

- En la pestaña **Participantes**, añadir los competidores uno a uno.
- En modo `2vs2` se añaden los miembros de cada equipo de forma individual.

### 3. Configurar fases (Admin)

- Ir a **Configurar Fases**.
- Definir cuántas fases habrá: Filtros, Cuartos, Semis, Final, etc.
- Para la fase de Filtros, configurar el tamaño de grupo (cuántos participantes se puntúan a la vez) y cuántos avanzan.
- Pulsar **Generar Fases** para crear el bracket automáticamente.

### 4. Crear jueces y organizadores (Admin)

- En **Jueces**, crear cuentas para cada juez. El sistema genera un código `palabra-palabra`.
- Compartir ese código con cada juez para que accedan desde `/judge`.
- Ídem para organizadores desde `/organizer`.

### 5. Fase de Filtros

**Admin / Organizador:**
1. Iniciar el torneo.
2. Pulsar **Iniciar Ronda** para comenzar un grupo de filtros.
3. Los jueces ven los participantes y puntúan del 0 al 10.
4. Pulsar **Cerrar Ronda** para acumular puntuaciones y pasar al siguiente grupo.
5. Repetir hasta que todos hayan competido.
6. Pulsar **Mostrar Ranking** para visualizar en pantalla.
7. Pulsar **Avanzar a Eliminatoria** — el sistema siembra automáticamente el bracket.

**Pantalla pública (`/screen`):**
- Muestra los participantes del grupo activo.
- Al cerrar ronda muestra el ranking acumulado.

### 6. Fases de eliminación (Cuartos, Semis, Final...)

**Admin / Organizador:**
1. Seleccionar el match a disputar y pulsar **Iniciar Match**.
2. Los jueces ven a los dos competidores y votan por uno.
3. Pulsar **Revelar Resultado** para mostrar el ganador.
4. Si hay empate, el sistema activa automáticamente un **Tiebreaker** — solo pueden votar los jueces que empataron.
5. Pulsar **Cerrar Match** para avanzar al ganador.
6. Repetir hasta terminar la fase y avanzar a la siguiente.

**Pantalla pública:**
- Muestra el enfrentamiento activo con animación.
- Contador de votos en tiempo real (si está activado).
- Animación de ganador al revelar resultado.

---

## Funcionalidades del Admin

| Sección | Qué permite |
|---------|-------------|
| Torneos | Crear, ver y eliminar torneos |
| Participantes | Añadir, eliminar y editar puntuaciones manualmente |
| Fases | Configurar nombres, tamaños de grupo y avances |
| Bracket | Visualizar y reordenar el cuadro de eliminación |
| Jueces | Crear cuentas con códigos de acceso |
| Organizadores | Crear cuentas con códigos de acceso |
| Match control | Iniciar, revelar, reiniciar matches |
| Pantalla | Controlar ticker de texto y modo espera |
| Historial | Ver todos los matches y sus votos |

---

## Pantalla pública (`/screen`)

La pantalla pública no requiere contraseña y se actualiza en tiempo real mediante WebSockets. Modos:

- **Espera** — pantalla de bienvenida / idle configurable desde Admin.
- **Filtros activos** — muestra el grupo en competición.
- **Ranking** — clasificación acumulada de filtros.
- **Match en vivo** — enfrentamiento 1v1 con contador de votos.
- **Ganador** — animación de resultado.

---

## Rol Organizador

El organizador tiene acceso a un torneo específico sin contraseña de admin. Puede:

- Ver el estado actual del torneo y el bracket.
- Controlar el timing de matches (iniciar, cerrar rondas).
- Ver el historial de resultados.

No puede crear torneos, gestionar otros torneos ni borrar participantes.

---

## Persistencia de datos

La base de datos se guarda automáticamente en `data/battle.db` tras cada escritura. En entorno Docker, este fichero se monta como volumen. **Se recomienda hacer copias de seguridad periódicas** de ese archivo antes de cada evento importante.

---

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `3000` |
| `ADMIN_PASSWORD` | Contraseña del panel de administración | — |
| `NODE_ENV` | `development` o `production` | `development` |

---

## Soporte

Para incidencias o sugerencias, contactar con el desarrollador del proyecto.
