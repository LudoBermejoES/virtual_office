# Voz

## Purpose

Permitir a los usuarios autenticados hablar entre ellos por audio en tiempo real cuando ocupan puestos dentro de una misma zona del mapa Tiled marcada como sala de voz, replicando el modelo "Discord-like" de canales pero anclado a la geometría de la oficina.

## Requirements

## ADDED Requirements

### Requirement: Definición de salas de voz en el mapa Tiled

El servidor SHALL importar las salas de voz desde el object layer `voice_rooms` del TMJ al subir o reemplazar el mapa, persistiéndolas en la tabla `voice_rooms`.

#### Scenario: TMJ con object layer voice_rooms

- **WHEN** un admin sube un TMJ que contiene un `objectgroup` llamado `voice_rooms` con N rectángulos válidos (cada uno con `name` y opcionalmente `properties.kind="voice"` y `properties.max_users`)
- **THEN** se crean N filas en la tabla `voice_rooms` ligadas a `office_id`, con `slug` derivado del `name` y `max_users` por defecto 16 si no se especifica

#### Scenario: Nombres duplicados dentro de una oficina

- **WHEN** el TMJ contiene dos rectángulos con el mismo `name` en `voice_rooms`
- **THEN** la subida falla con `400 invalid_voice_rooms` y mensaje indicando el nombre duplicado

#### Scenario: max_users fuera de rango

- **WHEN** un rectángulo declara `max_users: 0` o `max_users: 100`
- **THEN** la subida falla con `400 invalid_voice_rooms` indicando el valor inválido

#### Scenario: Reemplazo de mapa actualiza salas

- **WHEN** un admin reemplaza el mapa de una oficina existente
- **THEN** las salas anteriores se eliminan y se insertan las nuevas; los participantes conectados a salas eliminadas son desconectados de LiveKit en el siguiente tick

#### Scenario: Servir salas en el detail de oficina

- **WHEN** un usuario autenticado consulta `GET /api/offices/:id`
- **THEN** la respuesta incluye `voiceRooms: VoiceRoomDef[]` con todas las salas de esa oficina

### Requirement: Tokens de acceso firmados para LiveKit

El servidor SHALL emitir tokens JWT firmados con `LIVEKIT_API_SECRET` que permiten al portador conectarse a una sala concreta de LiveKit con permisos de publicar y suscribir.

#### Scenario: POST /api/voice/token con sala válida

- **WHEN** un usuario autenticado de la oficina X solicita `POST /api/voice/token` con `{officeId: X, voiceRoomId: Y}` correspondiente a una sala existente
- **THEN** el servidor devuelve `200 {url: string, token: string}` donde `token` es un JWT con grants `roomJoin`, `canPublish`, `canSubscribe` para `office:X:room:Y` e identidad `user:{userId}`

#### Scenario: Usuario sin acceso a la oficina

- **WHEN** un usuario que no pertenece a la oficina X solicita un token para una sala de X
- **THEN** la respuesta es `403 not_authorized` y no se firma JWT alguno

#### Scenario: Sala inexistente

- **WHEN** se solicita token para `voiceRoomId` que no existe en esa oficina
- **THEN** la respuesta es `404 voice_room_not_found`

#### Scenario: TTL del token

- **THEN** el JWT emitido tiene un `exp` de exactamente 1 hora desde su emisión

#### Scenario: Rate limit

- **WHEN** un usuario hace más de 10 solicitudes a `/api/voice/token` en 60 segundos
- **THEN** las solicitudes adicionales reciben `429 rate_limited`

### Requirement: Kick de un participante por admin

El servidor SHALL permitir a admins globales y office-admins de la oficina propietaria expulsar a un usuario de una sala de voz, desconectándolo inmediatamente del SFU.

#### Scenario: Admin expulsa a un usuario

- **WHEN** un admin envía `POST /api/voice/rooms/:roomId/kick` con `{userId}` válido
- **THEN** el servidor llama a `removeParticipant` en LiveKit para `user:{userId}` y responde `204`; el evento `voice.user_left` se difunde por el WS de oficina

#### Scenario: Usuario expulsado puede reconectar

- **WHEN** un usuario es expulsado y luego solicita un nuevo token
- **THEN** el servidor le firma un token nuevo sin restricciones (no hay cooldown en el MVP)

#### Scenario: Member intenta kick

- **WHEN** un usuario sin permisos de admin envía `POST /api/voice/rooms/:roomId/kick`
- **THEN** la respuesta es `403 not_authorized`

### Requirement: Mute server-side por admin

El servidor SHALL permitir a admins forzar el silenciamiento server-side del track de audio de un usuario en una sala concreta.

#### Scenario: Admin mutea

- **WHEN** un admin envía `POST /api/voice/rooms/:roomId/mute` con `{userId, muted: true}`
- **THEN** el servidor invoca `mutePublishedTrack` en LiveKit y responde `204`; el evento `voice.user_muted {muted: true}` se difunde

#### Scenario: Admin desmutea

- **WHEN** un admin envía `{userId, muted: false}` para un usuario previamente muteado
- **THEN** el servidor desmutea server-side y difunde `voice.user_muted {muted: false}`

#### Scenario: Estado de mute no persiste entre conexiones

- **WHEN** un usuario muteado por admin se desconecta y vuelve a conectar a la misma sala
- **THEN** entra desmuteado (el estado se resetea al salir de la room)

### Requirement: Webhook de LiveKit traducido a eventos WS

El servidor SHALL recibir webhooks firmados de LiveKit y traducirlos a eventos `voice.*` en el WebSocket de oficina existente, sin persistir presencia en SQLite.

#### Scenario: participant_joined

- **WHEN** LiveKit envía un webhook `participant_joined` con room `office:X:room:Y` e identidad `user:Z` y firma válida
- **THEN** el servidor difunde por el room WS de la oficina X el mensaje `{type: "voice.user_joined", roomId: Y, userId: Z, name, avatarUrl}`

#### Scenario: participant_left

- **WHEN** LiveKit envía `participant_left`
- **THEN** se difunde `{type: "voice.user_left", roomId: Y, userId: Z}`

#### Scenario: track muted/unmuted

- **WHEN** LiveKit envía `track_muted` o `track_unmuted` para un track de audio
- **THEN** se difunde `{type: "voice.user_muted", roomId, userId, muted: bool}`

#### Scenario: Firma inválida

- **WHEN** la cabecera `Authorization` del webhook no valida con la clave esperada
- **THEN** la respuesta es `401` y no se difunde nada

### Requirement: Auto-join del cliente al entrar en una sala

El cliente frontend SHALL conectar automáticamente al SFU LiveKit cuando el usuario tenga un puesto reservado dentro del rectángulo de una sala de voz, y desconectar cuando salga del rectángulo o pierda la reserva.

#### Scenario: Usuario reserva puesto dentro de una sala

- **WHEN** el usuario reserva un puesto cuyas coordenadas (x, y) están dentro del rectángulo de la sala V
- **THEN** el cliente solicita un token a `/api/voice/token` y conecta a la room LiveKit `office:X:room:V`, con micro activo y sin mute

#### Scenario: Usuario cambia a un puesto en otra sala

- **WHEN** el usuario cambia su reserva del puesto en sala V a un puesto en sala W
- **THEN** el cliente desconecta de V y conecta a W de inmediato

#### Scenario: Usuario reserva fuera de toda sala

- **WHEN** el usuario reserva un puesto cuyas coordenadas no están en ninguna sala
- **THEN** el cliente desconecta de cualquier sala previa y no entra a ninguna

#### Scenario: Usuario libera su reserva

- **WHEN** el usuario libera su reserva del día
- **THEN** el cliente desconecta de la sala actual

### Requirement: Indicador visual de habla y mute en avatar

El cliente SHALL pintar un anillo verde alrededor del avatar de un usuario mientras esté hablando, y un anillo rojo si está muteado.

#### Scenario: Participante habla

- **WHEN** el evento `activeSpeakersChanged` de LiveKit indica que `user:Z` está hablando
- **THEN** el avatar del puesto del usuario Z muestra un anillo verde brillante

#### Scenario: Participante se mutea

- **WHEN** un participante mutea su micrófono local o el evento `voice.user_muted {muted: true}` llega por WS
- **THEN** su avatar muestra un anillo rojo en lugar de verde

#### Scenario: Participante deja de hablar

- **WHEN** un participante deja de hablar durante más de 500ms
- **THEN** el anillo verde se elimina

### Requirement: Panel lateral de participantes de la sala actual

El cliente SHALL mostrar un panel HTML fijo en el borde derecho con la lista de participantes de la sala donde el usuario está conectado, y un mensaje vacío en otro caso.

#### Scenario: Conectado a una sala

- **WHEN** el usuario está conectado a la sala V
- **THEN** el panel lateral muestra el nombre de la sala y la lista ordenada de participantes con avatar circular, nombre y estado de micro

#### Scenario: No conectado

- **WHEN** el usuario no está conectado a ninguna sala
- **THEN** el panel muestra "Ve a una sala para hablar"

#### Scenario: Acciones de admin

- **WHEN** un admin hace clic derecho en una fila de la lista
- **THEN** aparece un menú con "Mutear" y "Kickear" que invocan `/api/voice/rooms/:roomId/{mute,kick}`

### Requirement: Controles HUD de micro y desconexión

El cliente SHALL ofrecer dos controles en el HUD: toggle de micro y salida manual de la sala.

#### Scenario: Toggle de micro con botón

- **WHEN** el usuario pulsa el botón micro o la tecla `M`
- **THEN** el cliente alterna `room.localParticipant.setMicrophoneEnabled(!current)`; el icono cambia entre 🎙 (verde) y 🔇 (rojo)

#### Scenario: Salida manual con Shift+M

- **WHEN** el usuario pulsa `Shift+M`
- **THEN** el cliente desconecta de la sala actual y permanece desconectado hasta que pulse "reconectar voz" o cambie de puesto

#### Scenario: Estado visible cuando fuera de sala

- **WHEN** el usuario no está en ninguna sala
- **THEN** el botón micro aparece deshabilitado en color gris
