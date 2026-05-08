# Tasks

> NOTA: este change está en propuesta. Las tareas concretas se cerrarán al
> redactar `design.md`. Esta lista es un esqueleto para mostrar el alcance
> general y permitir que `openspec validate` pase.

## 1. Modelo de datos

- [ ] 1.1 Migración SQL `0NNN_weekly_assignments.sql`: tabla `weekly_assignments(id, desk_id, user_id, dow, created_at, created_by)`, UNIQUE `(desk_id, dow)`, FKs.
- [ ] 1.2 Migración SQL `0NNN_weekly_exceptions.sql` (o decidir reutilizar `fixed_exceptions` generalizado).
- [ ] 1.3 Repos `weekly-assignments.ts` y `weekly-exceptions.ts` con tests unit.

## 2. Endpoints CRUD weekly

- [ ] 2.1 `POST /api/desks/:id/weekly` con guarda admin, validación `dow ∈ [0..6]`, conflictos. Tests integración.
- [ ] 2.2 `DELETE /api/desks/:id/weekly/:weeklyId`. Tests integración.
- [ ] 2.3 `GET /api/offices/:id/weekly` (listado por oficina). Tests integración.

## 3. Cómputo de bookings de un día

- [ ] 3.1 Adaptar el servicio que arma `bookings[]` para una fecha: añadir weeklies proyectadas según `dow` con `type: "weekly"`.
- [ ] 3.2 Reglas de precedencia: fixed > weekly > daily, exceptions invalidan el slot.
- [ ] 3.3 Tests integración cubriendo los casos de overlap y precedencia.

## 4. UI usuario (excepción weekly)

- [ ] 4.1 Botón en HUD para "saltarse este día" cuando el booking visible es de tipo weekly.
- [ ] 4.2 Endpoint `POST /api/desks/:id/weekly/:weeklyId/exceptions { date }`.

## 5. UI admin (en modal del change 026)

- [ ] 5.1 Checkbox "todos los <día>" al lado del nombre de cada usuario en el modal admin.
- [ ] 5.2 Si el usuario ya tiene weekly para ese (desk, dow), el checkbox aparece marcado; desmarcarlo borra.
- [ ] 5.3 Listado weekly en admin panel con borrar inline.

## 6. Validación final

- [ ] 6.1 `openspec validate --all --strict` en verde.
- [ ] 6.2 Typecheck + lint + format.
- [ ] 6.3 Tests unit + integración.
