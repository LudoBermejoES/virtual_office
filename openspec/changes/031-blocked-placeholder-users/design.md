# Design — 031 Usuarios placeholder "Bloqueado"

## Contexto

Tres capas del sistema asumen hoy **un puesto por persona y día**:

| Capa | Restricción | Fichero |
|------|-------------|---------|
| Daily | `idx_bookings_user_date_daily` = `UNIQUE(user_id, date) WHERE type='daily'` | `0002_bookings_indexes.sql` |
| Weekly | `UNIQUE(user_id, dow)` | `0008_weekly_assignments.sql:15` |
| Fijo | `UNIQUE(user_id)` | `0003_fixed_assignments.sql` |
| Proyección | de-duplicación por usuario (`dailyByUserId`, `userIdsTaken`) | `backend/src/http/routes/offices.ts:389-447` |

Esa asunción es **correcta y deseable** para personas reales: evita que alguien ocupe dos sitios. La decisión central de este change es no romperla.

## Decisión 1 — Tres filas normales, no un placeholder exento

**Elegido**: tres usuarios `Bloqueado #1..#3` sembrados por migración, cada uno una fila de `users` ordinaria.

**Descartado**: un único usuario `Bloqueado` con `is_placeholder = 1` exento de las reglas de unicidad.

Razón: el placeholder único obliga a tocar los cuatro puntos de la tabla anterior. Los índices parciales de SQLite no admiten subconsultas (`WHERE user_id NOT IN (SELECT ...)` no es indexable), así que la exención tendría que moverse de la DB al código de aplicación, perdiendo la garantía a nivel de esquema para **todos** los usuarios, reales incluidos. A cambio de un límite de tres bloqueos simultáneos por día, este change no modifica ni un índice.

**Consecuencia asumida**: bloquear un cuarto puesto el mismo día devuelve `409 user_already_booked_today` sobre el placeholder que ya esté en uso. Es un error legible y el admin ve en el modal qué placeholders están libres.

## Decisión 2 — Identidad sintética que no puede loguearse

```
google_sub = 'placeholder:1' | 'placeholder:2' | 'placeholder:3'
email      = 'bloqueado1@teimas.space' | ... (dominio NO en TEIMAS_DOMAINS)
domain     = 'teimas.space'
name       = 'Bloqueado #1' | 'Bloqueado #2' | 'Bloqueado #3'
role       = 'member'
is_placeholder = 1
```

Tres salvaguardas independientes contra el login:

1. `upsertUser` hace `ON CONFLICT(google_sub)`. Un `sub` de Google es una cadena numérica; `placeholder:N` nunca colisiona, así que ningún login puede aterrizar en estas filas.
2. `teimas.space` no está en `TEIMAS_DOMAINS`, luego `checkDomain` devolvería `domain_not_allowed` incluso si se llegase ahí.
3. Rechazo explícito: si el usuario resuelto tiene `is_placeholder = 1`, el login responde `403 placeholder_cannot_login`. Es la que protege contra un futuro cambio de dominios permitidos.

## Decisión 3 — Visibilidad selectiva en `GET /api/users`

`GET /api/users` alimenta tres consumidores:

- Pestaña USUARIOS del admin panel → **no** debe mezclar placeholders con personas.
- Pestaña FIJOS (`admin-panel.ts:870`) → **sí** los necesita, para poder dejar un puesto bloqueado indefinidamente.
- Modal de reserva al clicar un puesto (`OfficeScene.ts:592`) → **sí** los necesita, es el flujo principal.

Solución: `listUsers` excluye placeholders por defecto y `GET /api/users?includePlaceholders=1` los incluye, ordenados al final. Así el comportamiento por defecto del endpoint no cambia para nada de lo ya existente, y cada consumidor opta explícitamente.

## Migraciones SQL

`backend/src/infra/db/migrations/0010_placeholder_users.sql`:

```sql
-- Usuarios placeholder "Bloqueado #N" (change 031).
-- Permiten a un admin bloquear un puesto sin ponerle encima a una persona
-- real, para gente que aún no ha entrado en la empresa.
-- Son tres filas de users normales: así respetan las reglas de unicidad
-- existentes (daily, weekly, fixed) sin modificar ningún índice. El precio
-- es un máximo de tres puestos bloqueados simultáneamente el mismo día.
ALTER TABLE users ADD COLUMN is_placeholder INTEGER NOT NULL DEFAULT 0;

-- Seed idempotente: google_sub es UNIQUE, así que INSERT OR IGNORE no
-- duplica si la migración se re-aplica sobre una DB que ya los tiene.
INSERT OR IGNORE INTO users
  (google_sub, email, domain, name, role, is_invited_external, is_placeholder)
VALUES
  ('placeholder:1', 'bloqueado1@teimas.space', 'teimas.space', 'Bloqueado #1', 'member', 0, 1),
  ('placeholder:2', 'bloqueado2@teimas.space', 'teimas.space', 'Bloqueado #2', 'member', 0, 1),
  ('placeholder:3', 'bloqueado3@teimas.space', 'teimas.space', 'Bloqueado #3', 'member', 0, 1);

CREATE INDEX IF NOT EXISTS idx_users_is_placeholder
  ON users (is_placeholder) WHERE is_placeholder = 1;
```

Nota sobre idempotencia: el runner (`migrations.ts`) lleva registro en `_migrations`, pero la convención del proyecto exige SQL idempotente de todas formas. `ALTER TABLE ADD COLUMN` no es idempotente por sí solo en SQLite; el registro de versión lo cubre, igual que ya ocurre con `0006` y `0009`.

## Endpoints HTTP

**Ninguno nuevo.** Bloquear un puesto usa los que ya existen, pasando un `userId` de placeholder:

| Mecanismo | Endpoint existente | Change origen |
|-----------|--------------------|---------------|
| Bloqueo de un día | `POST /api/desks/:id/bookings { date, userId }` | 026 |
| Desbloqueo de un día | `DELETE /api/desks/:id/bookings { date, userId }` | 026 |
| Bloqueo indefinido | `POST /api/desks/:id/fixed { userId }` | 008 |
| Bloqueo semanal | `POST /api/desks/:id/weekly { userId, dow }` | 027 |
| Excepción de un día | `POST /api/desks/:id/weekly/:weeklyId/exceptions { date }` | 028 |

Modificados:

- `GET /api/users` — acepta `?includePlaceholders=1`.
- `PATCH /api/users/:id` — `409 cannot_modify_placeholder` si el destino es placeholder.
- `POST /api/auth/google` — `403 placeholder_cannot_login` si el usuario resuelto es placeholder.
- `POST /api/invitations` — `422 cannot_invite_placeholder` si el email es de un placeholder.

## Mensajes WebSocket

Sin mensajes nuevos. `desk.booked` y `desk.released` ya viajan con el `user` de destino (change 026), así que los demás clientes ven el bloqueo en tiempo real con el nombre `Bloqueado #N` sin tocar el protocolo.

## Frontend

**Escenas Phaser tocadas**: `OfficeScene`, y solo en un punto — la petición de `api/users` que puebla el modal de reserva pasa a `?includePlaceholders=1` (`OfficeScene.ts:592`). El renderizado de puestos no cambia: `deskState` devuelve `occupied` para un placeholder igual que para cualquier otra persona, porque el `userId` no coincide con `meId`.

**Assets nuevos**: ninguno. Si se quiere un icono de candado para los `Bloqueado #N`, se sube como avatar custom con el mecanismo del change 030, sin código nuevo.

**Overlay HTML tocado**: `admin-panel.ts`, pestaña USUARIOS. Los placeholders se listan en una sección propia "PUESTOS BLOQUEADOS" debajo de USUARIOS, con el botón "Avatar" y **sin** los botones "Promover"/"Degradar".

## Riesgos

- **Confusión del admin al agotar los tres placeholders.** Mitigación: el modal de reserva marca cuáles están ya en uso ese día y el `409` es explícito. Si resulta insuficiente en uso real, un change posterior sube el número o pasa al modelo exento.
- **Placeholders contando como personas en métricas de ocupación.** Este change no toca métricas; queda anotado porque cualquier futuro informe de ocupación tendrá que filtrar `is_placeholder = 1`.
