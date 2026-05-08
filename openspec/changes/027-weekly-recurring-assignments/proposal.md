## Why

Hoy hay dos modelos de reserva:

- **Daily booking**: un día concreto, un usuario, un desk.
- **Fixed assignment**: todos los días, un usuario, un desk.

El gap intermedio: **"todos los lunes Ana está en el desk 5"**. Esto es muy común en oficinas con teletrabajo parcial:

- Ana viene los lunes y miércoles.
- Bob viene los martes y jueves.
- Ambos pueden compartir el mismo desk los días alternos sin pisarse.

Hoy no se puede modelar. Las opciones son:
1. Asignación fija al usuario más frecuente y reservas diarias para los demás → desplaza el problema y pelea con la fija los días "no suyos".
2. Reservas diarias semanales una a una → cada admin las recrea cada semana. Inviable.

Adicionalmente, el usuario debe poder **liberarse** de su recurrencia un día concreto (igual que ya puede saltarse un fijo con el change 020), y el admin debe poder gestionar (crear, borrar, ver) las recurrencias semanales.

## What Changes

- **Modelo de datos nuevo** — tabla `weekly_assignments(id, desk_id, user_id, dow, created_at, created_by)` donde `dow` es 0–6 (0 = lunes según convención ISO 8601). Constraint UNIQUE `(desk_id, dow)` impide dos personas el mismo lunes en el mismo desk.
- **Endpoints CRUD** — `POST /api/desks/:id/weekly`, `DELETE /api/desks/:id/weekly/:weeklyId`, `GET /api/offices/:id/weekly` (listado para admin panel).
- **Cómputo de bookings de un día** — al pedir el detalle de la oficina para una fecha, el servidor proyecta las recurrencias semanales activas a ese día (calculando `dow` de la fecha) y las añade como bookings "tipo weekly". Igual que ya hace con `fixed`. Las daily reales y las exceptions ganan precedencia sobre weekly.
- **UI modal admin (extiende 026)** — al lado del nombre de cada usuario en la lista del modal, un checkbox "todos los <día>". Marcado al confirmar crea el `weekly_assignment`. Si el usuario ya tiene weekly para ese (desk, dow), aparece marcado y desmarcarlo lo borra.
- **UI usuario** — el usuario puede liberarse un día concreto de su weekly creando una "weekly_exception" (mismo modelo conceptual que fixed_exception del change 020, tabla nueva o extensión).
- **UI admin panel** — listado de weeklies por oficina con (desk, user, dow), borrar inline.

## Impact

- **Specs afectadas**: `reservas` (modelo nuevo + interacción con daily/fixed), `ui-game` (modal extendido + admin panel).
- **DB migration nueva** — `0NNN_weekly_assignments.sql` + posible `weekly_exceptions.sql`.
- **Cómputo de la oficina** — el servicio que arma `bookings[]` para una fecha tiene que considerar también weeklies. Pequeño refactor en `offices.ts` route.
- **Interacción con fijos** — un desk con `fixed_assignment` no puede tener weekly (fijo gana). Validación al crear weekly: 409 si hay fijo conflictivo.
- **Dependencia con 026**: si 026 ya añadió el modal admin, 027 lo extiende con el checkbox. Si 026 no está, 027 se hace sobre el flujo actual. Mejor orden: **026 primero, 027 después**.
- **Sin nuevas dependencias**.

## Open questions (a resolver en design)

- ¿`dow` es 0–6 (lun-dom ISO) o 0–6 (dom-sáb US)? El proyecto usa locale es-ES; ISO es el natural.
- ¿Las weekly_exceptions se reusan del modelo de fixed_exceptions (change 020) o tabla aparte? Reusar es atractivo pero hoy fixed_exception apunta a `fixed_assignment_id`; tendríamos que generalizar a "exception over assignment X" donde X es fixed o weekly.
- ¿Una weekly tiene "fecha de fin" o es indefinida? Empezar indefinida y añadir fecha fin si surge la necesidad.
- ¿Mostrar weeklies en el HUD del usuario igual que fijas (badge "fijo")? Probablemente sí con badge distinto ("L" para "lunes recurrente").
