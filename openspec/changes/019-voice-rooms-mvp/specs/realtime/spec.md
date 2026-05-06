# Realtime

## ADDED Requirements

### Requirement: Eventos de presencia de voz por WebSocket

El servidor SHALL difundir por el canal WebSocket de oficina los eventos `voice.*` traducidos desde los webhooks de LiveKit, sin persistir presencia en SQLite.

#### Scenario: voice.user_joined

- **WHEN** un participante se conecta a la room LiveKit `office:X:room:Y`
- **THEN** todos los clientes WS conectados al room de la oficina X reciben `{type: "voice.user_joined", roomId: Y, userId, name, avatarUrl}`

#### Scenario: voice.user_left

- **WHEN** un participante se desconecta o es expulsado
- **THEN** todos los clientes reciben `{type: "voice.user_left", roomId: Y, userId}`

#### Scenario: voice.user_muted

- **WHEN** el track de audio de un participante es muteado o desmuteado (por el propio usuario o por admin)
- **THEN** todos los clientes reciben `{type: "voice.user_muted", roomId: Y, userId, muted: bool}`

#### Scenario: voice.user_speaking (rate-limited)

- **WHEN** un participante empieza o deja de hablar y han pasado al menos 200ms desde el último evento del mismo tipo para ese usuario
- **THEN** se difunde `{type: "voice.user_speaking", roomId: Y, userId, speaking: bool}`

#### Scenario: Aislamiento por oficina

- **WHEN** un evento ocurre en una sala de la oficina X
- **THEN** solo los clientes WS en el room de la oficina X reciben el evento; clientes de otras oficinas no
