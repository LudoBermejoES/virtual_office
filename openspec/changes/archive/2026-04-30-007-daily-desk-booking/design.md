# Diseño técnico: Daily Desk Booking

## Modelo

```ts
type Booking = {
  id: number;
  desk_id: number;
  user_id: number;
  date: string;             // YYYY-MM-DD literal
  type: "daily" | "fixed";
  created_at: string;
};
```

`UNIQUE(desk_id, date)` garantiza que solo un user reserva un desk por día.

`UNIQUE(user_id, date) WHERE type='daily'` (índice parcial) garantiza que un user solo tiene un daily booking por día.

```sql
CREATE UNIQUE INDEX idx_bookings_user_date_daily
  ON bookings(user_id, date) WHERE type='daily';
```

(Migración nueva en este change.)

## Endpoints

```
POST   /api/desks/:id/bookings   auth   { date }            → 201 { booking }
DELETE /api/desks/:id/bookings   auth   { date }            → 204
GET    /api/offices/:id?date=YYYY-MM-DD   auth              → 200 { office, desks, bookings }
```

`bookings` en `GET /api/offices/:id?date=…` incluye solo las del día consultado:

```json
"bookings": [
  { "id": 1, "deskId": 10, "userId": 7, "type": "daily",
    "user": { "id": 7, "name": "Ludo", "avatar_url": "https://..." } }
]
```

(Nota: el avatar viene de Google directamente, almacenado en `users.avatar_url` desde el flujo de auth.)

## Reglas

### Crear booking

```
1. requireAuth
2. validar:
   - date es YYYY-MM-DD parseable
   - date >= hoy_user (cliente envía su "hoy" en TZ; server valida date >= hoy_server - 1 día por seguridad de TZ)
   - date <= hoy + BOOKING_HORIZON_DAYS (default 60)
3. cargar desk, validar que existe y pertenece a una office accesible al user
4. (en este change todos los users de la app pueden reservar; futuras restricciones por oficina pueden venir)
5. INSERT bookings(desk_id, user_id, date, type='daily')
   - si UNIQUE viola por (desk_id, date) → 409 desk_already_booked
   - si UNIQUE viola por (user_id, date) → 409 user_already_booked_today
6. responder 201
```

### Liberar booking

```
1. requireAuth
2. validar date
3. SELECT booking WHERE desk_id=? AND date=?
4. si no existe → 404
5. si booking.user_id !== req.user.id AND req.user.role !== 'admin' → 403
6. si booking.type === 'fixed' → 409 (los fixed se liberan por endpoint específico, change 008)
7. DELETE
8. responder 204
```

### "Mover" reserva

No hay endpoint dedicado: el cliente hace `DELETE` del actual seguido de `POST` del nuevo. Si el `POST` falla, mostrar error y dejar al user sin reserva (decisión deliberada: simplicidad sobre transaccionalidad).

Alternativa futura: endpoint `POST /api/bookings/move { fromDeskId, toDeskId, date }` con transacción.

## Validación de fecha

Backend usa solo cadena YYYY-MM-DD. La regla "no pasado" comparada como strings es válida (ISO orden lexicográfico):

```ts
function isInWindow(date: string, today: string, horizonDays: number): boolean {
  return date >= today && date <= addDays(today, horizonDays);
}
```

`today` se resuelve como `new Date().toISOString().slice(0, 10)` con la TZ del proceso (UTC en producción). Tolerancia de 1 día permite usuarios en zonas horarias muy distantes.

## Frontend

### `OfficeScene`

Estado calculado por desk:

```ts
function deskState(desk: Desk, bookings: Booking[], me: User, date: string): DeskState {
  const b = bookings.find(b => b.deskId === desk.id);
  if (!b) return "free";
  if (b.userId === me.id) return "mine";
  if (b.type === "fixed") return "fixed";  // change 008
  return "occupied";
}
```

| Estado | Color | Click |
|--------|-------|-------|
| free | verde | abre modal "Reservar" |
| mine | cian pulsante | abre modal "Liberar" |
| occupied | rojo | tooltip "ocupado por X" |
| fixed | violeta | tooltip "puesto fijo de X" |

### Modal "Reservar"

```
┌─ Reservar A1 ────────────────────┐
│ jueves 7 de mayo de 2026         │
│                                  │
│ ¿Quieres reservar este puesto?  │
│                                  │
│   [Cancelar]    [Reservar]       │
└──────────────────────────────────┘
```

Al confirmar:
1. Si user ya tiene reserva ese día (otro desk) → confirm extra: "Liberarás A2".
2. POST → 201 → cierra modal y refresca snapshot del día.
3. Si 409 → reload snapshot (alguien reservó primero) y mensaje legible.

## Migración nueva

`backend/src/infra/db/migrations/0002_bookings_indexes.sql`:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_user_date_daily
  ON bookings(user_id, date) WHERE type='daily';
```

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Race condition simultánea | UNIQUE(desk_id, date) gana por SQL |
| Cliente reserva en pasado por TZ tricky | Tolerancia de 1 día en server |
| Borrado de desk con bookings activos | `ON DELETE CASCADE` en FK; advertencia en UI admin antes de borrar |
| Snapshot desactualizado tras 409 | El cliente refetch el snapshot al recibir 409 |
