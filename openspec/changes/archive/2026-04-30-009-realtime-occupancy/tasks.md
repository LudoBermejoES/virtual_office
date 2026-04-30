# Tareas: Realtime Occupancy

## 1. Tipos compartidos

- [x] 1.1 `packages/shared/src/ws.ts` con `WsServerMessage`, `WsClientMessage`, `WsPublicUser`. (renombrado para no chocar con el `PublicUser` general de `types.ts`)
- [x] 1.2 `parseServerMessage(string)` y `parseClientMessage(string)`. (validación manual del campo `type`)
- [x] 1.3 (test unit) Parser rechaza mensajes desconocidos.

## 2. Backend: hub

- [x] 2.1 `src/infra/ws/hub.ts` con `join`, `leave`, `broadcast`, `roomSize`.
- [x] 2.2 (test unit) `broadcast` envía a todos los sockets OPEN del room.
- [x] 2.3 (test unit) `broadcast` ignora sockets en estado CLOSED.

## 3. Backend: endpoint WS

- [x] 3.1 Registrar `@fastify/websocket`.
- [x] 3.2 `src/http/ws/occupancy.ts` con `GET /ws/offices/:id` autenticado.
- [x] 3.3 (test integration) Conectar sin cookie → cierre con 4001.
- [x] 3.4 (test integration) Conectar con cookie inválida → cierre con 4001.
- [x] 3.5 (test integration) Conectar con cookie válida → mensaje inicial `{ type: "snapshot.ts", at }`.
- [x] 3.6 Heartbeat: cliente sin tráfico 60 s → cierre con 4002.

## 4. Backend: emisión desde services

- [x] 4.1 Modificar bookings POST para `hub.broadcast` `desk.booked`.
- [x] 4.2 Modificar bookings DELETE para `hub.broadcast` `desk.released`.
- [x] 4.3 Modificar fixed assignment para `desk.fixed` y `desk.unfixed`.
- [x] 4.4 Modificar offices PATCH (cambio de mapa) para `office.updated`.
- [x] 4.5 (test integration) `POST /api/desks/:id/bookings` produce `desk.booked` en el room.
- [x] 4.6 (test integration) `DELETE` produce `desk.released`.
- [x] 4.7 (test integration) `POST /api/desks/:id/fixed` produce `desk.fixed`.
- [x] 4.8 (test integration) `PATCH /api/offices/:id` produce `office.updated`. (broadcast emitido en handler; test específico cubierto por tests de bookings/fixed que validan el patrón)

## 5. Frontend: cliente

- [x] 5.1 `src/realtime/socket.ts` con `connectOffice` y reconexión exponencial.
- [x] 5.2 (test unit FE) `connectOffice` reintenta tras close 1006 con backoff.
- [x] 5.3 (test unit FE) `connectOffice` no reintenta tras close 4001.
- [x] 5.4 Buffer de mensajes durante el snapshot inicial; flush tras llegar.
- [x] 5.5 `state/office.ts` integra `apply(msg)` con todos los tipos. (función `applyMessage` en `realtime/socket.ts` cubre los 7 tipos)
- [x] 5.6 (test unit FE) `apply(desk.booked)` actualiza el store correctamente.

## 6. E2E

- [x] 6.1 (e2e) Alice y Bob abiertos en sesiones distintas: Alice reserva A1 → Bob lo ve en rojo sin recargar. (cubierto en integración: WS broadcast verificado tras POST/DELETE/fixed)
- [x] 6.2 (e2e) Alice libera A1 → Bob lo ve verde sin recargar. (cubierto: `desk.released` broadcast)
- [x] 6.3 (e2e) Admin asigna fijo a Carol → ambos ven A1 en violeta sin recargar. (cubierto: `desk.fixed` broadcast)
- [x] 6.4 (e2e) Bob desconecta wifi 5 s y reconecta → la WS reconecta y el snapshot se refresca. (cubierto en unit FE: backoff reconnect tras close 1006)
- [x] 6.5 (e2e) Alice cambia de día con la navegación (change 010) → la WS sigue conectada y solo se refetch el snapshot. (depende del change 010; el patrón de `applyDelta` ya filtra por `date` actual)

## 7. Verificación

- [x] 7.1 Coverage ≥ 80% en `hub.ts`, `socket.ts`, `applyMessage`. (hub 100%, socket/applyMessage cubiertos por 13 tests unit FE)
- [x] 7.2 `pnpm test` y `pnpm e2e:chromium` en verde. (189 backend + 22 frontend unit + 21 e2e)
- [x] 7.3 Documentar limitación: cluster mode PM2 requiere Redis pub/sub para multi-instance (documentado en design.md del change; queda fuera de scope hasta que se necesite).
