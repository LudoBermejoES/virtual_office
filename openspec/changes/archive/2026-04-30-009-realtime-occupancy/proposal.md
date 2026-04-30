# Propuesta: Realtime Occupancy

## Motivación

El usuario quiere ver en tiempo real cuándo otros reservan o liberan puestos. Sin esto, dos usuarios deben recargar la página para ver la realidad. Este change añade un canal WebSocket que difunde deltas a todos los clientes conectados a la misma oficina.

## Alcance

**En scope:**
- WebSocket en `wss://host/ws/offices/:id` autenticado por la cookie de sesión.
- Hub interno en backend que mantiene rooms `office:<id>`.
- Mensajes broadcast: `desk.booked`, `desk.released`, `desk.fixed`, `desk.unfixed`, `office.updated`.
- Reconexión exponencial en cliente (1s, 2s, 4s, … hasta 30s).
- El cliente combina snapshot inicial vía REST + deltas vía WS para evitar race conditions.

**Fuera de scope:**
- Presence (mostrar quién está conectado mirando) — futuro.
- Mensajería entre usuarios.
- Push notifications fuera del navegador.

## Dominios afectados

`realtime`, modificación menor de `oficinas` (cabecera de `office.updated`).

## Orden y dependencias

Change `009`. Depende de `007-daily-desk-booking`. Beneficia a `008` retroactivamente (los fixed también propagan delta).

## Impacto de seguridad

- WS exige cookie de sesión válida en el upgrade. Sin cookie → 401.
- Solo se difunden cambios dentro de la oficina del room; no hay cross-office leak.
- Los mensajes incluyen solo datos públicos del usuario (id, name, avatar_url) — nunca el email.

## Rollback

Cerrar el endpoint WS. El frontend cae al modo "snapshot manual" (refetch tras cada acción) hasta que se restaure.
