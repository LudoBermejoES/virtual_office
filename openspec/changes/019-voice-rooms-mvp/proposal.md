# Propuesta: Salas de voz por zona Tiled (MVP)

## Motivación

Hoy los usuarios ven el mapa de la oficina y saben quién está reservado en cada puesto, pero **no pueden hablar entre ellos**. Para una oficina virtual real esto rompe la metáfora: en una oficina física entras a una sala de reuniones y oyes a quienes están dentro. Queremos replicar esa experiencia con audio (y, en changes posteriores, vídeo y compartir pantalla) usando un modelo "Discord-like" de canales pero **anclado al mapa Tiled**: cada zona del mapa marcada como sala de voz es un canal independiente.

## Alcance

**En scope:**

### A. Infraestructura: LiveKit self-hosted

- `livekit-server` corriendo en la **misma máquina** que el backend Fastify, vía Docker compose junto al servicio principal.
- Puerto 7880 (signaling WebSocket), puertos UDP 50000-60000 (RTP/SRTP).
- Sin Redis: single-node basta para el volumen previsto.
- TURN embebido de LiveKit habilitado para usuarios detrás de NAT estricto.
- Secrets `LIVEKIT_API_KEY` y `LIVEKIT_API_SECRET` en `.env` del backend.

### B. Definición de salas en el mapa Tiled

- Nuevo tipo de objeto en el `objectgroup` `voice_rooms` del TMJ.
- Cada objeto rectángulo del layer es una sala. Propiedades Tiled:
  - `name` (string, obligatorio): identificador legible (p.ej. `"Cafetería"`, `"Reunión 1"`).
  - `kind` (string): siempre `"voice"` por ahora (reservado para futuras salas vídeo/screen-only).
  - `max_users` (int, opcional, default 16): aforo máximo.
- Las salas se importan al subir/actualizar el mapa, igual que los puestos. Tabla nueva `voice_rooms (id, office_id, slug, name, max_users, x, y, width, height)`.
- Validación: nombres no duplicados dentro de una oficina; `max_users` entre 1 y 50.

### C. Tokens LiveKit firmados por el backend

- Endpoint `POST /api/voice/token` (auth required). Body: `{ officeId, voiceRoomId }`.
- El backend valida que el usuario tiene acceso a esa oficina y que la sala existe.
- Devuelve `{ url: string, token: string }` donde `token` es un JWT firmado con `LIVEKIT_API_SECRET`, que concede `roomJoin`, `canPublish`, `canSubscribe` para una room cuyo nombre es `office:{officeId}:room:{voiceRoomId}`.
- Identidad del participante: `user:{userId}`. Metadata: `{ name, avatarUrl }`.
- TTL del token: 1 hora (refrescable).

### D. Auto-join al entrar en una zona de voz

- En el frontend, cuando el usuario tiene **un puesto reservado** y ese puesto está dentro de un rectángulo de `voice_rooms`, se solicita token y se hace `connect()` automático a la room.
- Voz **activa por defecto** (no muteado). Detección por VAD nativo de LiveKit/WebRTC.
- Si el puesto del usuario está fuera de toda sala, no entra a ninguna voz.
- Si el usuario no tiene puesto reservado, no entra a voz.
- Si el usuario cambia de reserva a un puesto en otra sala, **sale** de la actual y **entra** en la nueva (`disconnect()` + `connect()`).

### E. Indicadores visuales

- En el avatar del puesto: anillo verde brillante alrededor del avatar mientras el usuario habla (track audio activo y por encima del umbral VAD).
- Anillo rojo si está muteado (mic local off).
- Sin indicador si no está conectado a voz o si su track audio está silencioso.
- Dibujo del rectángulo de la sala visible siempre (color tenue) con el nombre flotante encima.

### F. Lista lateral de conectados

- Panel HTML en el lado derecho del HUD, fijo, con la lista de participantes de **la sala donde estás tú**.
- Cada fila: avatar circular + nombre + icono micro (verde hablando / gris silencio / rojo muteado).
- Si no estás en ninguna sala, el panel muestra un mensaje "Ve a una sala para hablar".

### G. Controles HUD

- Botón micro (toggle on/off, atajo `M`).
- Botón "salir de voz" (desconecta de la sala actual, atajo `Shift+M`). Reentras al moverte de puesto o pulsando "reconectar voz".

### H. Permisos: kick y mute por admin

- `POST /api/voice/rooms/:roomId/kick` body `{ userId }`: solo `admin` o office-admin de la oficina propietaria. Llama a `removeParticipant` de LiveKit. **Sin cooldown**: el usuario puede volver inmediatamente al moverse o reconectar.
- `POST /api/voice/rooms/:roomId/mute` body `{ userId, muted: bool }`: igualmente solo admin. Llama a `mutePublishedTrack` de LiveKit. Mientras el usuario esté conectado a esa room, su track está forzado a mute server-side; al salir y volver, el estado se resetea.
- Audit log Winston: `voice.kicked`, `voice.muted_by_admin`.

### I. Eventos WebSocket de presencia (opcional, decoración)

Por el WS existente de oficina, broadcast de:

- `voice.user_joined { roomId, userId, name }`
- `voice.user_left { roomId, userId }`
- `voice.user_speaking { roomId, userId, speaking: bool }` (rate-limited a ~5/seg)
- `voice.user_muted { roomId, userId, muted: bool }`

Estos eventos los emite el backend al recibir webhooks de LiveKit (`room_started`, `participant_joined`, `participant_left`, `track_muted/unmuted`).

**Fuera de scope (changes posteriores):**

- Push-to-talk configurable, selector de dispositivo, ajuste de volumen por participante (change 020).
- Cámara/vídeo (change 021).
- Compartir pantalla (change 022).
- Spatial audio por distancia entre puestos (change 023).
- Persistencia de quién entró/salió (no se guarda nunca, solo presencia en vivo).

## Notas de operación

- Migración SQL `0010_voice_rooms.sql`: tabla `voice_rooms` con FK a `offices`.
- Reusa el endpoint de upload de mapa: el TMJ ya admite layers extra; añadimos `voice_rooms` al parser de features junto con `desks` y `zones`.
- LiveKit emite webhooks HTTP a `/api/voice/livekit-webhook` firmados con HMAC. El backend valida la firma y traduce a eventos WS.
- Coste de operación: 0 (self-hosted, OSS Apache 2.0). CPU/RAM aceptables para decenas de usuarios concurrentes en una sola instancia.
- Si LiveKit no está disponible, los endpoints `/api/voice/*` devuelven 503 y la UI oculta los controles de voz, sin romper el resto.
