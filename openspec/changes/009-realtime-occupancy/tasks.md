# Tareas: Realtime Occupancy

## 1. Tipos compartidos

- [ ] 1.1 `packages/shared/src/ws.ts` con `WsServerMessage`, `WsClientMessage`, `PublicUser`.
- [ ] 1.2 `parseServerMessage(string)` y `parseClientMessage(string)` con Zod.
- [ ] 1.3 (test unit) Parser rechaza mensajes desconocidos.

## 2. Backend: hub

- [ ] 2.1 `src/infra/ws/hub.ts` con `join`, `leave`, `broadcast`, `roomSize`.
- [ ] 2.2 (test unit) `broadcast` envía a todos los sockets OPEN del room.
- [ ] 2.3 (test unit) `broadcast` ignora sockets en estado CLOSED.

## 3. Backend: endpoint WS

- [ ] 3.1 Registrar `@fastify/websocket`.
- [ ] 3.2 `src/http/ws/occupancy.ts` con `GET /ws/offices/:id` autenticado.
- [ ] 3.3 (test integration) Conectar sin cookie → cierre con 4001.
- [ ] 3.4 (test integration) Conectar con cookie inválida → cierre con 4001.
- [ ] 3.5 (test integration) Conectar con cookie válida → mensaje inicial `{ type: "snapshot.ts", at }`.
- [ ] 3.6 Heartbeat: cliente sin tráfico 60 s → cierre con 4002.

## 4. Backend: emisión desde services

- [ ] 4.1 Modificar `booking-service.create` para `hub.broadcast` `desk.booked`.
- [ ] 4.2 Modificar `booking-service.delete` para `hub.broadcast` `desk.released`.
- [ ] 4.3 Modificar fixed assignment para `desk.fixed` y `desk.unfixed`.
- [ ] 4.4 Modificar `office-service` (subir/cambiar mapa, crear/borrar desk) para `office.updated`.
- [ ] 4.5 (test integration) `POST /api/desks/:id/bookings` produce `desk.booked` en el room.
- [ ] 4.6 (test integration) `DELETE` produce `desk.released`.
- [ ] 4.7 (test integration) `POST /api/desks/:id/fixed` produce `desk.fixed`.
- [ ] 4.8 (test integration) `PATCH /api/offices/:id` (cambio de mapa) produce `office.updated`.

## 5. Frontend: cliente

- [ ] 5.1 `src/realtime/socket.ts` con `connectOffice` y reconexión exponencial.
- [ ] 5.2 (test unit FE) `connectOffice` reintenta tras close 1006 con backoff.
- [ ] 5.3 (test unit FE) `connectOffice` no reintenta tras close 4001.
- [ ] 5.4 Buffer de mensajes durante el snapshot inicial; flush tras llegar.
- [ ] 5.5 `state/office.ts` integra `apply(msg)` con todos los tipos.
- [ ] 5.6 (test unit FE) `apply(desk.booked)` actualiza el store correctamente.

## 6. E2E

- [ ] 6.1 (e2e) Alice y Bob abiertos en sesiones distintas: Alice reserva A1 → Bob lo ve en rojo sin recargar.
- [ ] 6.2 (e2e) Alice libera A1 → Bob lo ve verde sin recargar.
- [ ] 6.3 (e2e) Admin asigna fijo a Carol → ambos ven A1 en violeta sin recargar.
- [ ] 6.4 (e2e) Bob desconecta wifi 5 s y reconecta → la WS reconecta y el snapshot se refresca.
- [ ] 6.5 (e2e) Alice cambia de día con la navegación (change 010) → la WS sigue conectada y solo se refetch el snapshot.

## 7. Verificación

- [ ] 7.1 Coverage ≥ 80% en `hub.ts`, `socket.ts`, `apply`.
- [ ] 7.2 `pnpm test` y `pnpm e2e:chromium` en verde.
- [ ] 7.3 Documentar limitación: cluster mode PM2 requiere Redis pub/sub para multi-instance (pendiente, fuera de scope).
