# Tareas: Salas de voz por zona Tiled (MVP)

El ciclo TDD por tarea: escribe el test (red) → implementa lo mínimo (green) → refactoriza → marca [x].

## 1. Infraestructura LiveKit

- [ ] 1.1 Añadir `livekit/livekit-server:latest` a `docker-compose.yml` con `network_mode: host`, montaje de `livekit.yaml`.
- [ ] 1.2 Crear `infra/livekit.yaml.example` con keys placeholder y rangos UDP 50000-60000.
- [ ] 1.3 Documentar en `README.md` cómo arrancar LiveKit local (`docker compose up livekit`) y qué variables de `.env` necesita el backend (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WEBHOOK_KEY`).

## 2. Migración SQL y modelo `voice_rooms`

- [ ] 2.1 (test integration) Aplicar migración `0010_voice_rooms.sql` crea tabla con UNIQUE(office_id, slug) — escribir test primero.
- [ ] 2.2 Escribir migración SQL idempotente con `CREATE TABLE IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS`.
- [ ] 2.3 Crear `backend/src/infra/repos/voice-rooms.ts` con `listByOffice(db, officeId)`, `findById`, `replaceForOffice(db, officeId, rooms)`.

## 3. Importación de salas desde TMJ

- [ ] 3.1 (test unit) `parseTiledVoiceRooms(tmj)` extrae rectángulos del object layer `voice_rooms` con `name`, `kind`, `max_users` — escribir test primero.
- [ ] 3.2 (test unit) `parseTiledVoiceRooms` rechaza nombres duplicados y `max_users` fuera de rango [1, 50].
- [ ] 3.3 Implementar parser en `backend/src/domain/tiled-voice.ts` con Zod.
- [ ] 3.4 (test integration) POST/PATCH `/api/offices/:id` con TMJ que incluye `voice_rooms` persiste filas correctamente — escribir test primero.
- [ ] 3.5 Llamar al parser desde `routes/offices.ts` después de `importDesksFromTiled`, vía `voiceRoomsRepo.replaceForOffice`.

## 4. Endpoint GET /api/offices/:id/voice-rooms

- [ ] 4.1 (test integration) `GET /api/offices/:id/voice-rooms` devuelve la lista para usuarios autenticados de esa oficina — escribir test primero.
- [ ] 4.2 (test integration) Devuelve 403 para usuarios sin acceso a la oficina.
- [ ] 4.3 Implementar en `routes/offices.ts`.
- [ ] 4.4 Incluir las salas en la respuesta de `GET /api/offices/:id` para evitar segunda llamada.

## 5. Servicio de tokens LiveKit

- [ ] 5.1 Añadir dependencia `livekit-server-sdk` al backend.
- [ ] 5.2 Crear `backend/src/services/voice-tokens.service.ts` con `mintToken({userId, name, avatarUrl, officeId, voiceRoomId, ttlSeconds})`.
- [ ] 5.3 (test unit) `mintToken` produce JWT con grants `roomJoin`, `canPublish`, `canSubscribe` para `office:{N}:room:{N}` y identidad `user:{N}` — escribir test primero.

## 6. Endpoint POST /api/voice/token

- [ ] 6.1 (test integration) `POST /api/voice/token` con `{officeId, voiceRoomId}` válido devuelve `{url, token}` — escribir test primero.
- [ ] 6.2 (test integration) Devuelve 403 si el usuario no pertenece a esa oficina.
- [ ] 6.3 (test integration) Devuelve 404 si la sala no existe en esa oficina.
- [ ] 6.4 (test integration) Rate limit 10 req/min por usuario.
- [ ] 6.5 Crear `backend/src/http/routes/voice.ts` y registrarlo en `server.ts`.

## 7. Endpoints admin: kick y mute

- [ ] 7.1 (test integration) `POST /api/voice/rooms/:roomId/kick` con `{userId}` admin → 204, llama a LiveKit `removeParticipant` — escribir test primero.
- [ ] 7.2 (test integration) Member intenta kick → 403.
- [ ] 7.3 (test integration) `POST /api/voice/rooms/:roomId/mute` con `{userId, muted: true}` admin → 204, llama a `mutePublishedTrack`.
- [ ] 7.4 (test integration) Member intenta mute → 403.
- [ ] 7.5 Implementar en `routes/voice.ts` usando `RoomServiceClient` del SDK; mockear el cliente en tests.
- [ ] 7.6 Logs Winston: `voice.kicked`, `voice.muted_by_admin`.

## 8. Webhook receiver de LiveKit

- [ ] 8.1 (test integration) `POST /api/voice/livekit-webhook` con firma válida y evento `participant_joined` emite `voice.user_joined` por WS de oficina — escribir test primero.
- [ ] 8.2 (test integration) Firma inválida → 401.
- [ ] 8.3 (test integration) Evento `participant_left` emite `voice.user_left`.
- [ ] 8.4 (test integration) Evento `track_muted`/`track_unmuted` emite `voice.user_muted`.
- [ ] 8.5 Implementar usando `WebhookReceiver` de `livekit-server-sdk`; parsear `room.name` para extraer `officeId`/`voiceRoomId`.

## 9. Tipos compartidos

- [ ] 9.1 Añadir a `packages/shared/src/voice.ts`: `VoiceRoomDef`, `WsServerMessage` extendido con `voice.user_joined|left|speaking|muted`.
- [ ] 9.2 Re-exportar desde `packages/shared/src/index.ts`.

## 10. Frontend: cliente LiveKit

- [ ] 10.1 Añadir dependencia `livekit-client` al frontend.
- [ ] 10.2 Crear `frontend/src/voice/voice-client.ts` con clase `VoiceClient`: `connect(token, url)`, `disconnect()`, `setMicEnabled(bool)`, eventos `onSpeakerChange`, `onParticipantJoined/Left`, `onMuteChange`.
- [ ] 10.3 (test unit) `VoiceClient` con `livekit-client` mockeado: connect llama a `Room.connect`, eventos se propagan.

## 11. Frontend: store de voz

- [ ] 11.1 Crear `frontend/src/state/voice.ts` con zustand: `currentRoomId`, `participants: Map<userId, VoiceParticipant>`, `micEnabled`, `selfSpeaking`, acciones `connectTo`, `disconnect`, `toggleMic`.
- [ ] 11.2 (test unit) reductor de `participants` ante eventos joined/left/speaking/muted.

## 12. Frontend: detección de zona y auto-join

- [ ] 12.1 (test unit) `detectVoiceRoom(deskX, deskY, rooms)` devuelve la sala que contiene el punto, o `null` — escribir test primero.
- [ ] 12.2 En `OfficeScene`, tras renderizar desks/snapshot, calcular sala del usuario y llamar a `voiceStore.connectTo(roomId)` o `disconnect()`.
- [ ] 12.3 Manejar cambio de reserva: al recibir WS `desk.booked` con `userId === me`, recalcular sala.

## 13. Frontend: indicadores en avatar

- [ ] 13.1 (test unit) `drawSpeakerRing(scene, x, y, kind)` crea círculo con color según `"speaking"`/`"muted"`/`null`.
- [ ] 13.2 En `OfficeScene.renderDesks`, añadir anillo según estado de voz del ocupante (de `voiceStore.participants`).
- [ ] 13.3 Subscribir a cambios del store y rerenderizar el anillo sin recrear el avatar.

## 14. Frontend: panel lateral de participantes

- [ ] 14.1 Crear `frontend/src/ui/voice-side-panel.ts` con `mountVoiceSidePanel()` / `unmountVoiceSidePanel()`.
- [ ] 14.2 Renderizar lista de participantes desde `voiceStore`, con avatar, nombre, icono micro, estado hablando.
- [ ] 14.3 Mensaje "Ve a una sala para hablar" cuando `currentRoomId === null`.
- [ ] 14.4 Click derecho en participante (solo admin): menú con "Mutear" / "Kickear" que llaman a `/api/voice/rooms/:id/{kick,mute}`.

## 15. Frontend: controles HUD

- [ ] 15.1 Botón micro on/off en HUDScene (icono 🎙/🔇), atajo `M`.
- [ ] 15.2 Botón salir de voz, atajo `Shift+M`. Tras pulsar, `voiceStore.disconnect()` y se queda fuera hasta cambiar de zona o pulsar "reconectar".
- [ ] 15.3 Estado visual: micro gris cuando no en sala, verde cuando activo, rojo cuando muteado.

## 16. Renderizado de salas en el mapa

- [ ] 16.1 (test unit) `drawVoiceRoomOverlay(scene, room)` dibuja rectángulo semitransparente con etiqueta del nombre.
- [ ] 16.2 En `OfficeScene.create`, dibujar todos los `voice_rooms` recibidos en el snapshot.
- [ ] 16.3 La sala donde está el usuario actual se resalta (borde más grueso o color distinto).

## 17. Verificación

- [ ] 17.1 `pnpm test` (unit + integration) en verde.
- [ ] 17.2 `openspec validate --all --strict` en verde.
- [ ] 17.3 Prueba manual con dos navegadores: dos usuarios reservan puestos en la misma zona, se oyen; uno se mueve a otra zona, deja de oír; admin kickea, el usuario sale; admin mutea, el usuario no se oye.
- [ ] 17.4 Prueba manual de NAT: usuario detrás de NAT estricto se conecta correctamente (TURN funciona).
- [ ] 17.5 Prueba manual con LiveKit caído: la app no se rompe, los controles de voz aparecen deshabilitados.
