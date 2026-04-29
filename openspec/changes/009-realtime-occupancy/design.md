# Diseño técnico: Realtime Occupancy

## Stack

- **Backend**: `@fastify/websocket` (envoltorio de `ws`).
- **Frontend**: `WebSocket` nativo del navegador.
- **Mensajes**: JSON, schema con Zod en backend; tipos compartidos en `packages/shared/src/ws.ts`.

## Endpoint

```
GET /ws/offices/:id   (Upgrade WebSocket)
  - Validar cookie session → user
  - Verificar que el office existe y user puede acceder
  - Asociar conexión al room `office:<id>`
  - Empezar a emitir mensajes
```

## Mensajes

```ts
// packages/shared/src/ws.ts
export type WsServerMessage =
  | { type: "desk.booked";   deskId: number; date: string; user: PublicUser }
  | { type: "desk.released"; deskId: number; date: string }
  | { type: "desk.fixed";    deskId: number; user: PublicUser }
  | { type: "desk.unfixed";  deskId: number }
  | { type: "office.updated"; officeId: number };

export type WsClientMessage =
  | { type: "ping" };

export type PublicUser = { id: number; name: string; avatar_url: string | null };
```

`office.updated` se emite cuando el mapa o los desks cambian (changes `005`/`006`).

## Hub

```ts
class WsHub {
  private rooms = new Map<string, Set<WebSocket>>();

  join(room: string, socket: WebSocket) { ... }
  leave(room: string, socket: WebSocket) { ... }
  broadcast(room: string, msg: WsServerMessage) {
    const peers = this.rooms.get(room);
    if (!peers) return;
    const payload = JSON.stringify(msg);
    for (const ws of peers) if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}
```

Cada acción HTTP que muta estado emite a través del hub:

```ts
// service/booking-service.ts
await repo.create(...);
hub.broadcast(`office:${officeId}`, { type: "desk.booked", deskId, date, user });
```

## Cliente

```ts
// frontend/src/realtime/socket.ts
export function connectOffice(officeId: number, onMsg: (m: WsServerMessage) => void) {
  let socket: WebSocket;
  let attempt = 0;

  const open = () => {
    socket = new WebSocket(`${WS_BASE}/ws/offices/${officeId}`);
    socket.onmessage = e => {
      try { onMsg(parseServerMessage(e.data)); }
      catch (err) { logger.warn("malformed ws message", err); }
    };
    socket.onclose = ev => {
      if (ev.code === 4001) return;          // unauthorized — no reintentar
      const delay = Math.min(30_000, 1000 * 2 ** attempt++);
      setTimeout(open, delay);
    };
    socket.onopen = () => { attempt = 0; };
  };

  open();
  return () => socket.close(1000);
}
```

`OfficeScene` aplica los deltas al store:

```ts
store.apply = (msg) => match(msg)
  .with({ type: "desk.booked" },   m => bookings.set(`${m.deskId}:${m.date}`, ...))
  .with({ type: "desk.released" }, m => bookings.delete(`${m.deskId}:${m.date}`))
  .with({ type: "desk.fixed" },    m => fixed.set(m.deskId, m.user))
  .with({ type: "desk.unfixed" },  m => fixed.delete(m.deskId))
  .with({ type: "office.updated" }, m => refetchOffice(m.officeId))
  .exhaustive();
```

## Race condition snapshot vs delta

Posible si la WS conecta antes del snapshot REST y un mensaje llega para un desk que el snapshot todavía no devolvió.

Solución:

1. Cliente abre la WS y bufferea mensajes.
2. Cliente pide `GET /api/offices/:id?date=…`.
3. Cuando llega la response, aplica el snapshot al store.
4. Procesa los mensajes bufferizados.
5. A partir de aquí procesa en stream.

Ack: el server emite `{ type: "snapshot.ts", at: <iso> }` al unirse al room, y cualquier delta posterior tiene un `at` >= ese; el cliente descarta deltas anteriores al snapshot. Versión 1: simplemente bufferiza durante la fetch, suficiente para una oficina pequeña.

## Heartbeat

Cliente envía `{ type: "ping" }` cada 30 s. Backend responde con un frame ping nativo. Si el server no recibe nada en 60 s, cierra la conexión con código `4002` (idle).

## Autorización en upgrade

```ts
fastify.register(websocket, { options: { ... } });

fastify.get("/ws/offices/:id", { websocket: true, preHandler: requireAuth }, (conn, req) => {
  const officeId = Number(req.params.id);
  hub.join(`office:${officeId}`, conn.socket);
  conn.socket.on("close", () => hub.leave(`office:${officeId}`, conn.socket));
});
```

`requireAuth` lee cookie y rechaza upgrade si inválida. Fastify cierra el socket con 401 Upgrade Required.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Cluster mode PM2 reparte conexiones entre workers; broadcast no llega entre workers | Para oficina pequeña: 1 instancia. Si se necesita multi-instance, integrar Redis pub/sub en una iteración futura |
| Mensajes lost durante reconexión | Cliente refetch el snapshot del día tras reconexión |
| Cookie expira durante WS abierto | Server envía `{ type: "auth.expired" }` y cierra; cliente redirige a login |
| Mensaje malformado del servidor | Cliente loguea warn y descarta |
