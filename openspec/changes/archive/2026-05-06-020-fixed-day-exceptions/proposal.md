# Propuesta: Excepciones por día en puestos fijos

## Motivación

Los puestos fijos representan "este puesto siempre es de Fulano". Pero la realidad es que las personas tienen días libres, vacaciones, viajes, o simplemente teletrabajo. Cuando un usuario con puesto fijo no va un día concreto, hoy mismo:

- El puesto sigue marcado como ocupado por él en la UI.
- Otras personas no pueden ocuparlo aunque esté disponible físicamente.
- El usuario tendría que pedir al admin que le quite el fijo y volver a asignarlo cuando vuelva — fricción innecesaria.

Queremos que el dueño del fijo (o un admin) pueda marcar **"hoy no voy"** para un día concreto, liberando el puesto a otros sin tocar la asignación fija de fondo.

## Alcance

**En scope:**

### A. Tabla `fixed_assignment_exceptions`

Nueva tabla SQL ligada a `fixed_assignments`:

```sql
CREATE TABLE fixed_assignment_exceptions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  fixed_assignment_id   INTEGER NOT NULL REFERENCES fixed_assignments(id) ON DELETE CASCADE,
  date                  TEXT NOT NULL,
  created_by_user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (fixed_assignment_id, date)
);
CREATE INDEX idx_fixed_exceptions_date ON fixed_assignment_exceptions (date);
```

Migración `0010_fixed_assignment_exceptions.sql` idempotente.

### B. Endpoints REST

- **POST `/api/desks/:deskId/fixed/skip`** body `{ date: "YYYY-MM-DD" }`
  - Auth: usuario titular del fijo o admin (global o office-admin de la oficina propietaria)
  - Validación: `date >= todayIso()` y dentro del horizonte de reservas
  - Si no existe fijo en ese desk → 404
  - Si ya hay excepción → 200 idempotente
  - Devuelve `{ exception: { id, fixed_assignment_id, date } }`

- **DELETE `/api/desks/:deskId/fixed/skip`** body `{ date: "YYYY-MM-DD" }`
  - Mismo auth
  - 204 si se borró, 404 si no existía
  - Permite "deshacer" la excepción (decir "sí voy")

### C. Snapshot del backend (`GET /api/offices/:id?date=X`)

Cuando se compone la lista de bookings:
- Para cada `fixed_row` se mira si existe una excepción `(fixed_id, date)`.
- **Si hay excepción**: el fijo se omite del snapshot (igual que hoy ocurre cuando hay daily o el usuario tiene daily en otro puesto).
- **Si no hay excepción**: se incluye como `type: "fixed"` igual que ahora.

Esto significa que en la UI:
- El puesto aparece **libre** ese día (anillo verde de avatar desaparece).
- Otros usuarios pueden reservarlo con una `daily` normal.
- Al día siguiente vuelve a aparecer como fijo (porque la excepción es solo para esa fecha).

### D. WebSocket de tiempo real

Nuevos eventos en el room de oficina:
- `desk.fixed_skipped { deskId, userId, date }` — al crear excepción
- `desk.fixed_unskipped { deskId, userId, date }` — al borrar excepción

Otros clientes conectados refrescan su snapshot.

### E. UI: liberar mi día desde el mapa

Cuando el usuario hace clic en su propio puesto fijo:
- Si **no hay excepción** ese día: confirm "¿Hoy no vienes? El puesto quedará libre para otros." → POST skip.
- Si **hay excepción**: confirm "¿Sí vienes hoy? Se reservará tu puesto fijo de nuevo." → DELETE skip.

Cuando un **admin** hace clic sobre el puesto fijo de otra persona:
- Si no hay excepción: confirm "¿Marcar que [Fulano] hoy no viene?" → POST skip.
- Si hay excepción: confirm "¿Marcar que [Fulano] sí viene hoy?" → DELETE skip.

### F. Permisos

- Solo el `user_id` titular del fijo o un admin (global / office-admin de esa oficina) puede crear/borrar excepciones.
- Member sin permisos → 403.

### G. Logs Winston

- `fixed.day_skipped { deskId, userId, date, byUserId }`
- `fixed.day_unskipped { deskId, userId, date, byUserId }`

**Fuera de scope:**

- Excepciones para rangos de días (vacaciones de una semana). Si el usuario quiere marcar 5 días, hace 5 POSTs. Iteración futura.
- Repetición de excepciones (cada lunes no voy). Iteración futura.
- Notificaciones por email/Slack al liberar.

## Operación

- Migración 0010 idempotente.
- Sin cambio de despliegue (mismo binario, mismo backend).
- Tests integration cubren:
  - dueño puede skip/unskip
  - admin puede skip/unskip
  - member sin permisos → 403
  - skip de fecha pasada → 400
  - snapshot omite el fijo en días con excepción
  - daily de otro usuario sigue ganando frente al fijo
  - reservar daily en un fijo con excepción → 200 (ya posible al ser el desk "libre")
