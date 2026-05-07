# Oficinas — Delta para change 024-online-map-editor

## ADDED Requirements

### Requirement: Endpoint de actualización de capas y orden de capas del TMJ

El sistema MUST exponer `PATCH /api/offices/:id/map/sprites-layers` que reescribe atómicamente el TMJ aplicando: (a) reemplazo del conjunto de object layers `sprites_*` por las definiciones enviadas por el cliente, (b) reordenación completa del array `layers` según el orden indicado por el cliente (mezclando capas del sistema y `sprites_*`), y (c) toggles de visibilidad por capa. Preserva el contenido íntegro de las capas del sistema, exige rol admin y detecta conflictos por hash.

#### Scenario: Body del PATCH

- **WHEN** un admin envía la petición
- **THEN** el body acepta el formato:

  ```json
  {
    "expected_hash": "<sha256 hex 64>",
    "layer_order": ["ground", "sprites_jardin", "furniture", "desks", "sprites_overlay"],
    "sprites_layers": {
      "sprites_jardin": { "name": "sprites_jardin", "type": "objectgroup", "objects": [] },
      "sprites_overlay": { "name": "sprites_overlay", "type": "objectgroup", "objects": [] }
    },
    "layers_visibility": { "furniture": false }
  }
  ```

- **AND** `layer_order` debe contener exactamente la unión de los nombres de capas del sistema del TMJ original y las claves de `sprites_layers` (ni más ni menos).
- **AND** `layers_visibility` es opcional; si se omite, todas las capas mantienen su visibilidad original.

#### Scenario: Reordenación e intercalado

- **GIVEN** el TMJ original tiene `layers = [ground, furniture, desks, sprites_floor]`
- **WHEN** el cliente envía `layer_order = [ground, sprites_jardin, furniture, sprites_overlay, desks]` con `sprites_layers = { sprites_jardin: {...}, sprites_overlay: {...} }`
- **THEN** el TMJ resultante tiene `layers` exactamente en ese orden
- **AND** las capas del sistema (`ground`, `furniture`, `desks`) preservan su contenido byte a byte
- **AND** las capas `sprites_floor` original desaparece (no está en `sprites_layers` ni en `layer_order`)
- **AND** las capas `sprites_jardin` y `sprites_overlay` toman el contenido de `sprites_layers`

#### Scenario: Toggle de visibilidad

- **GIVEN** el TMJ original tiene una capa `furniture` con `visible: true` (o sin la propiedad)
- **WHEN** el cliente envía `layers_visibility: { "furniture": false }`
- **THEN** el TMJ resultante tiene `furniture` con `visible: false`
- **AND** el resto de propiedades de `furniture` (data, type, etc.) permanecen idénticas

#### Scenario: Conflicto por hash

- **WHEN** el `expected_hash` enviado no coincide con el sha256 actual del fichero en disco
- **THEN** el servidor responde 409 con body `{ error: "tmj_hash_mismatch", current_hash: "<actual>" }`
- **AND** el fichero NO se modifica

#### Scenario: Sin sesión

- **WHEN** se envía la petición sin cookie de sesión válida
- **THEN** el servidor responde 401

#### Scenario: Sin rol admin

- **GIVEN** un usuario autenticado pero no admin
- **WHEN** envía el PATCH
- **THEN** el servidor responde 403

#### Scenario: Body con schema inválido

- **WHEN** el body falla la validación Zod (capa `sprites_*` con nombre que no cumple `^sprites_[a-z0-9_]+$`, properties faltantes, coords no numéricas, expected_hash mal formado, etc.)
- **THEN** el servidor responde 400 con `application/problem+json` describiendo los errores

#### Scenario: layer_order incompleto

- **GIVEN** el TMJ original tiene una capa del sistema `desks`
- **WHEN** el cliente envía `layer_order` que NO incluye `desks`
- **THEN** el servidor responde 400 con `{ error: "layer_order_missing_system_layer", missing: ["desks"] }`
- **AND** el fichero NO se modifica

#### Scenario: layer_order con nombre desconocido

- **WHEN** `layer_order` contiene un nombre que no es ni una capa del sistema del TMJ original ni una clave de `sprites_layers`
- **THEN** el servidor responde 400 con `{ error: "layer_order_unknown_name", unknown: ["foo"] }`
- **AND** el fichero NO se modifica

#### Scenario: layers_visibility sobre capa inexistente

- **WHEN** `layers_visibility` contiene un nombre que no existe en el TMJ resultante
- **THEN** el servidor responde 400 con `{ error: "visibility_unknown_layer", unknown: ["foo"] }`
- **AND** el fichero NO se modifica

#### Scenario: Sprite id desconocido

- **WHEN** alguno de los Points en `sprites_layers` lleva `properties.sprite` con un id que no existe en el `SPRITE_MANIFEST` server-side
- **THEN** el servidor responde 422 con `{ error: "unknown_sprite_id", id: "<id>" }`
- **AND** el fichero NO se modifica

#### Scenario: Rate limit

- **WHEN** una IP excede 30 peticiones por minuto a este endpoint
- **THEN** las peticiones extra reciben 429

#### Scenario: GET expone hash

- **WHEN** el cliente llama `GET /api/offices/:id/map/raw`
- **THEN** la respuesta incluye `tmj_hash` (sha256 hex de 64 chars del fichero actual)
- **AND** ese mismo valor es el que el cliente debe enviar como `expected_hash` en el PATCH siguiente
