# Propuesta: Daily Desk Booking

## Motivación

El caso de uso central de la oficina virtual: cualquier usuario puede escoger un puesto libre para un día concreto y ese puesto pasa a verse ocupado para los demás. Este change implementa el modelo de bookings, los endpoints, las reglas de unicidad por (desk, fecha), y la UI para reservar/liberar.

## Alcance

**En scope:**
- Endpoint `POST /api/desks/:id/bookings` que reserva un desk en una fecha.
- Endpoint `DELETE /api/desks/:id/bookings` que libera (con `?date=YYYY-MM-DD`).
- Endpoint `GET /api/offices/:id?date=YYYY-MM-DD` ahora incluye `bookings` del día.
- Reglas:
  - Un usuario solo puede tener una reserva por día (N desks, 1 user, 1 día → 1 reserva).
  - Un desk solo puede tener una reserva por día (UNIQUE(desk_id, date)).
  - No se puede reservar en fechas pasadas.
  - El horizonte máximo de reserva es 60 días en el futuro (configurable).
- UI en `OfficeScene`: click sobre desk libre → modal "¿Reservar A1 el jueves 7 de mayo?". Si tiene reserva propia ese día, modal "¿Liberar y mover a B2?".
- Estados visuales: libre (verde), ocupado por ti (cian pulsante), ocupado por otro (rojo), fixed (violeta — viene en `008`).

**Fuera de scope:**
- Puestos fijos (`type=fixed`) — change `008`.
- Notificaciones realtime — change `009`.
- Navegación entre días con UI — change `010`.
- Avatar circular en el desk ocupado — change `011`.

## Dominios afectados

`reservas`, `oficinas` (extiende el endpoint de detalle).

## Orden y dependencias

Change `007`. Depende de `003-google-auth` y `006-desk-zone-drawing`.

## Impacto de seguridad

- Solo el dueño del booking puede liberarlo (excepto admin, que puede liberar cualquiera para casos administrativos).
- UNIQUE constraint en SQL evita race conditions de doble reserva.
- Reservas en pasado y futuro lejano rechazadas para limitar superficie de abuso.

## Rollback

`DELETE FROM bookings`. Las oficinas y desks persisten.
