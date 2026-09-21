## Why

Hoy un admin solo puede bloquear un puesto poniéndole encima a **una persona real con cuenta**: reserva diaria a nombre de otro (change 026), fijo (change 008) o recurrencia semanal (change 027). Todo pasa por una fila de `users` con `google_sub` y `email` reales.

El caso que no se cubre: **gente que todavía no ha entrado en la empresa**. Sabemos que el 1 de octubre entran dos personas, queremos reservarles ya su sitio para que nadie lo coja, pero esas personas aún no tienen cuenta de Google en el dominio y no pueden loguearse. Crear su usuario "de verdad" antes de que existan en la empresa es peor: aparecerían en la lista de usuarios como miembros, podrían ser promovidos a admin y contaminarían invitaciones y avatares.

Hoy el workaround es que un admin reserve el puesto a su propio nombre o al de un compañero, lo cual miente sobre quién ocupa el sitio y rompe la regla de "un puesto por persona y día" para quien presta su nombre.

Lo que falta es un ocupante ficticio: un "Bloqueado" que se pueda poner en un puesto igual que se pone a cualquier usuario, y que pueda estar en **varios puestos distintos el mismo día** (porque no es una persona, es una etiqueta de "reservado, no toques").

## What Changes

- **Tres usuarios placeholder sembrados por migración** — `Bloqueado #1`, `Bloqueado #2` y `Bloqueado #3`, con `is_placeholder = 1`. Al ser tres filas de `users` distintas, **cada una respeta las reglas de unicidad existentes sin tocarlas**: tres puestos bloqueables simultáneamente el mismo día, cada uno a nombre de un placeholder diferente.
- **Mismo flujo que un usuario real** — el admin selecciona un puesto en el mapa, abre el modal de reserva (change 026) y elige `Bloqueado #1` en la lista igual que elegiría a Ana. Sirven **todos** los mecanismos actuales sin cambios en su lógica: daily, fijo, recurrencia semanal y sus excepciones.
- **Los placeholders no pueden loguearse jamás** — `google_sub` sintético (`placeholder:N`, nunca un `sub` de Google) y email en un dominio que no está en `TEIMAS_DOMAINS`. Dos salvaguardas independientes. Además el login rechaza explícitamente cualquier usuario con `is_placeholder = 1`.
- **Los placeholders no son gestionables como personas** — no se les puede cambiar el rol, ni invitar, ni promover a admin. Sí se les puede poner avatar custom (change 030), que es justo lo que da el icono de "bloqueado" en el mapa.
- **Render sin cambios** — un puesto bloqueado se ve como cualquier puesto ocupado por otra persona, con el nombre `Bloqueado #N`. No se añade `DeskState` nuevo ni color nuevo.
- **No incluye**: bloqueo por rango de fechas en una sola llamada, número dinámico de placeholders, motivo/nota del bloqueo, estado visual propio en el mapa. Si hacen falta más de tres bloqueos simultáneos en un día, se resuelve en un change posterior.

## Impact

- **Specs afectadas**:
  - `autenticacion` — flag `is_placeholder`, rechazo de login, exclusión de gestión de rol.
  - `reservas` — los placeholders son destino válido de daily / fixed / weekly a través de los endpoints existentes; el límite de tres bloqueos simultáneos por día es una consecuencia observable.
  - `ui-game` — los placeholders aparecen en el modal de reserva del admin y se listan aparte en la pestaña USUARIOS.
- **Código nuevo / modificado**:
  - Migración `0010_placeholder_users.sql`: columna `is_placeholder` + seed idempotente de las tres filas.
  - `backend/src/infra/repos/users.ts`: `listPlaceholders`, y `listUsers` deja de devolver placeholders por defecto.
  - `backend/src/http/routes/users.ts`: query `?includePlaceholders=1` en `GET /api/users`; `PATCH /api/users/:id` rechaza placeholders.
  - `backend/src/http/routes/auth.ts`: rechazo de login de placeholder.
  - `frontend/src/ui/admin-panel.ts`: sección propia para los placeholders en USUARIOS (sin botones de rol).
  - `frontend/src/scenes/OfficeScene.ts`: pide `?includePlaceholders=1` al poblar el modal de reserva.
- **Sin cambios de índices**: `idx_bookings_user_date_daily`, `weekly_assignments UNIQUE(user_id, dow)` y `fixed_assignments UNIQUE(user_id)` se quedan como están.
- **Sin cambios en la precedencia** `daily > fixed > weekly` ni en la de-duplicación por usuario de `GET /api/offices/:id`.
- **Sin breaking changes** y **sin nuevas dependencias**.

## Dependencias

- Requiere **change 026** (reserva a nombre de otro usuario) archivado: es el flujo que el admin reutiliza para bloquear.
- Requiere **change 030** (avatares custom) archivado si se quiere un icono propio para `Bloqueado #N`; es opcional, no bloquea el change.
- Los changes 008 (fijos) y 027/028 (weeklies + excepciones) ya archivados aportan los otros dos mecanismos de bloqueo, sin modificación.

## Notas

El coste real de este change es bajo precisamente por la decisión de usar **tres filas normales** en vez de un único "Bloqueado" multi-puesto. Un único placeholder exento de unicidad habría obligado a reescribir el índice parcial de daily, a quitar `UNIQUE(user_id, dow)` de `weekly_assignments` y a meter una excepción en la de-duplicación por usuario de `GET /api/offices/:id` — tres puntos delicados que ahora quedan intactos. El precio aceptado es el límite de tres bloqueos simultáneos por día.
