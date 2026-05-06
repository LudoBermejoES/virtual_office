# Diseño: Salas de voz por zona Tiled (MVP)

## Resumen arquitectónico

Tres componentes nuevos:

1. **LiveKit SFU** (Go binary o contenedor Docker) corriendo junto al backend. Maneja el media plane: WebRTC, ICE, codec Opus, simulcast, NAT traversal vía TURN embebido.
2. **Backend Fastify** (cambios menores): nuevo módulo `voice/` con endpoints de tokens, kick, mute, webhook receiver. Usa `livekit-server-sdk` (npm) que es solo HTTP/JWT — no tiene dependencias nativas.
3. **Frontend** (Phaser + nuevo módulo `voice/`): cliente `livekit-client` (npm) que se conecta al SFU vía su WebSocket propio, **independiente** del WebSocket de oficina existente.

```
┌──────────┐  WebRTC (UDP)  ┌──────────────┐
│ Browser  │◄──────────────►│  livekit-    │
│ (phaser) │  signaling WS  │  server      │
│          │◄──────────────►│              │
└────┬─────┘                └──────┬───────┘
     │                             │ webhooks (HTTP)
     │ /api/voice/token (POST)     │
     │ /api/me (GET)               ▼
     │ WS oficina (presencia) ┌──────────┐
     └───────────────────────►│ backend  │
                              │ Fastify  │
                              │ +sqlite  │
                              └──────────┘
```

## Modelo de datos

### Tabla `voice_rooms`

```sql
CREATE TABLE voice_rooms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  office_id   INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'voice',
  max_users   INTEGER NOT NULL DEFAULT 16,
  x           INTEGER NOT NULL,
  y           INTEGER NOT NULL,
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (office_id, slug)
);
CREATE INDEX idx_voice_rooms_office ON voice_rooms (office_id);
```

`slug` se genera del `name` Tiled (lowercase, sin acentos, espacios → guión). Si dos zonas comparten nombre, error de validación al subir el mapa.

### Sin tabla de presencia

La presencia (quién está conectado a qué sala) **vive solo en LiveKit y en memoria del cliente**. El backend la consulta puntualmente vía LiveKit Room Service API si la necesita (ej: para mostrar contadores en UI fuera de la sala, futuro). Para el MVP no hace falta.

## Mapping de salas a rooms LiveKit

Nombre de room en LiveKit: `office:{officeId}:room:{voiceRoomId}`.

Esto permite:
- Aislamiento por oficina (un usuario solo recibe tokens para rooms de oficinas a las que pertenece).
- Aislamiento por sala (cambiar de zona = cambiar de room).
- Inspección/admin desde LiveKit CLI por convención de naming.

## Flujo de auto-join

```
Frontend                               Backend           LiveKit
   │                                      │                 │
   │ (usuario reserva puesto en zona V)   │                 │
   │  detecta zona en cliente             │                 │
   │ POST /api/voice/token {officeId, voiceRoomId}          │
   │ ────────────────────────────────────►│                 │
   │                                      │ valida acceso   │
   │                                      │ firma JWT       │
   │ ◄──────────── {url, token} ──────────│                 │
   │                                      │                 │
   │ new Room(); room.connect(url, token) │                 │
   │ ─────────────────────────────────────────────────────► │
   │                                      │   webhook       │
   │                                      │ ◄ participant_joined
   │                                      │                 │
   │                                      │ broadcast WS    │
   │ ◄──────── voice.user_joined ─────────│                 │
   │                                      │                 │
```

## Mapeo cliente → zona

```ts
function detectVoiceRoom(deskX: number, deskY: number, rooms: VoiceRoomDef[]): VoiceRoomDef | null {
  return rooms.find(r =>
    deskX >= r.x && deskX <= r.x + r.width &&
    deskY >= r.y && deskY <= r.y + r.height,
  ) ?? null;
}
```

Esto se ejecuta cuando:
- Llega `office.snapshot` con la nueva reserva del usuario.
- Cambia el puesto reservado del usuario (mensaje WS `desk.booked` con `userId === me`).

Si `currentRoom !== detectedRoom`: `disconnect()` + (si hay nueva) `connect()`.

## Indicadores en el avatar

`livekit-client` emite `room.activeSpeakersChanged` con la lista de participantes hablando. El frontend mantiene `Set<userId>` de speakers actuales y dibuja un anillo verde sobre el avatar correspondiente en el render de desks.

Para el muteado: `participant.isMicrophoneEnabled` o evento `trackMuted`/`trackUnmuted`. Anillo rojo cuando `!isMicrophoneEnabled`.

## Endpoints HTTP nuevos

| Método | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| POST | /api/voice/token | requireAuth | `{officeId, voiceRoomId}` | `{url, token}` |
| GET | /api/offices/:id/voice-rooms | requireAuth | — | `VoiceRoomDef[]` |
| POST | /api/voice/rooms/:roomId/kick | requireAdminOffice | `{userId}` | `204` |
| POST | /api/voice/rooms/:roomId/mute | requireAdminOffice | `{userId, muted}` | `204` |
| POST | /api/voice/livekit-webhook | (validate signature) | LiveKit event | `204` |

`requireAdminOffice` es el helper existente que valida `role=admin` global o `office_admins` para esa oficina.

## Webhook receiver

```ts
app.post("/api/voice/livekit-webhook", async (req, reply) => {
  const event = livekitWebhookReceiver.receive(req.rawBody, req.headers["authorization"]);
  switch (event.event) {
    case "participant_joined":
      const [, officeId, , roomId] = parseRoom(event.room.name);
      hub.broadcast(officeRoom(officeId), {
        type: "voice.user_joined",
        roomId: Number(roomId),
        userId: parseInt(event.participant.identity.replace("user:", ""), 10),
        name: event.participant.metadata?.name,
      });
      break;
    // ...
  }
  return reply.status(204).send();
});
```

LiveKit firma el webhook con HMAC; `livekit-server-sdk` proporciona `WebhookReceiver` para validar.

## Voice activation vs PTT

**MVP**: solo voice activation por VAD nativa. El usuario puede mutearse manualmente con el botón `M`.

PTT viene en el change 020 con persistencia de preferencia y configuración de tecla.

## UI side panel

Componente HTML overlay (`#voice-side-panel`) similar al admin panel pero pegado al borde derecho:

```
┌───────────────────────┐
│ 🔊 SALA: CAFETERÍA    │
├───────────────────────┤
│ ● Ludo        🎙      │
│   Pedro       🔇      │
│ ● María       🎙      │
└───────────────────────┘
```

- Verde (●) si hablando.
- Icono 🎙 con borde verde si activo, 🔇 si muteado.
- Click derecho en una fila (admin only): menú "Mutear" / "Kickear".

## Riesgos y decisiones

### Riesgo: latencia de auto-join

El `POST /api/voice/token` + `room.connect()` puede tardar ~500ms-1s. Mostramos un estado "Conectando…" en el panel lateral mientras tanto.

### Riesgo: LiveKit caído

Si el endpoint de token falla o `connect()` da timeout, la UI muestra "Voz no disponible" y deja al usuario seguir usando el resto de la app. El backend de oficina sigue funcionando independientemente.

### Decisión: rate-limit del token endpoint

10 req/min por usuario. Un usuario abusivo no puede generar tokens infinitos. LiveKit ya rate-limita conexiones simultáneas con la misma identidad.

### Decisión: TTL del token

1 hora. Si el usuario está más tiempo conectado, `livekit-client` refresca el token automáticamente vía `room.options.token` actualizado, o pide nuevo token al backend al detectar `disconnected`.

### Decisión: identidad estable

`user:{userId}` (numérico). Si el mismo usuario abre dos pestañas, **la segunda desconecta a la primera** (LiveKit fuerza identidad única). Aceptable para el MVP. Cambiará en el change 020 si añadimos sesiones múltiples.

### Decisión: nada de spatial en el MVP

LiveKit lo permite vía `setVolume()` por participante en el cliente. Lo dejamos para change 023 cuando se haya validado que la voz plana funciona bien.

## Configuración de despliegue (`docker-compose.yml`)

```yaml
services:
  livekit:
    image: livekit/livekit-server:latest
    network_mode: host  # necesario para UDP RTP
    command: --config /etc/livekit.yaml
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml:ro
    restart: unless-stopped
```

`livekit.yaml`:
```yaml
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
webhook:
  api_key: ${LIVEKIT_API_KEY}
  urls:
    - http://backend:3000/api/voice/livekit-webhook
turn:
  enabled: true
  domain: localhost
  tls_port: 5349
  udp_port: 3478
```

(Detalle de cert TLS y dominio de TURN se ajustará en producción.)
