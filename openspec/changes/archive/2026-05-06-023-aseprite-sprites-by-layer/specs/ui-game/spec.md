# UI Game

## ADDED Requirements

### Requirement: Sprites Aseprite anclados a object layers de Tiled con depth respetado

El cliente MUST renderizar sprites animados con formato Aseprite (PNG + JSON hash) en las posiciones marcadas por Points de cualquier object layer del TMJ cuyo nombre empiece por `sprites_`, asignando a cada sprite un `depth` igual al índice de su layer en `tmj.layers[]`, de forma que los sprites queden visualmente entre los tilelayers vecinos.

#### Scenario: Layer `sprites_overlay` por encima de tilelayers

- **WHEN** el TMJ tiene un object layer llamado `sprites_overlay` cuyo índice en `tmj.layers[]` es 5, después de varios tilelayers
- **THEN** cada Point del object layer produce un `Phaser.GameObjects.Sprite` con `setDepth(5)`, quedando renderizado por encima de los tilelayers anteriores

#### Scenario: Layer `sprites_below_furniture` por debajo de tilelayers

- **WHEN** el TMJ tiene un object layer `sprites_below_furniture` con índice 2, anterior al tilelayer "Muebles" en índice 3
- **THEN** los sprites del layer 2 se renderizan con `setDepth(2)` y aparecen por detrás del tilelayer "Muebles"

#### Scenario: Múltiples object layers de sprites

- **WHEN** el TMJ contiene varios `sprites_*` (p.ej. `sprites_floor`, `sprites_overlay`, `sprites_air`)
- **THEN** cada uno se procesa por separado, los sprites de cada layer reciben el `depth` de su propio layer

#### Scenario: Object layers con otros nombres se ignoran

- **WHEN** un object layer se llama `npcs`, `desks`, `voice_rooms` o cualquier nombre que no empiece por `sprites_`
- **THEN** la lógica de sprites Aseprite no procesa ese layer; el sistema sigue funcionando como hasta ahora para esos layers

### Requirement: Properties `sprite` y opcional `tag` en cada Point

Cada Point dentro de un object layer `sprites_*` MUST llevar una property `sprite` (string) que identifique al sprite del manifest del cliente, y opcionalmente una property `tag` (string) que indique qué animación reproducir.

#### Scenario: Sprite con tag explícito

- **WHEN** un Point declara `sprite="cat"` y `tag="walk"`
- **THEN** el cliente reproduce la animación `walk` definida en `meta.frameTags` del JSON Aseprite del gato

#### Scenario: Sprite sin tag usa el `defaultTag` del manifest

- **WHEN** un Point declara solo `sprite="cat"` y el manifest tiene `defaultTag: "walk"` para `cat`
- **THEN** el cliente reproduce `walk`

#### Scenario: Sprite sin tag y sin defaultTag

- **WHEN** un Point declara solo `sprite="butterfly"` y el manifest no tiene `defaultTag`
- **THEN** el cliente reproduce la primera animación creada por `createFromAseprite()` para ese sprite

#### Scenario: Sprite no presente en el manifest

- **WHEN** un Point declara `sprite="dragon"` pero el manifest no tiene esa entrada
- **THEN** el cliente emite `console.warn` y descarta el Point sin renderizar nada (no lanza error)

#### Scenario: Object no es un Point

- **WHEN** un object layer `sprites_*` contiene un rectángulo (con width y height) o un text object
- **THEN** el cliente emite `console.warn` indicando que solo se aceptan Points y descarta ese object sin error

#### Scenario: Property `sprite` ausente

- **WHEN** un Point en un layer `sprites_*` no tiene la property `sprite`
- **THEN** el cliente emite `console.warn` y descarta el Point

### Requirement: Carga perezosa de los sprites referenciados

El cliente MUST cargar (vía `Phaser.Scene.load.aseprite`) sólo los sprites efectivamente referenciados por algún Point en el TMJ, no todos los sprites declarados en el manifest.

#### Scenario: Sprite no referenciado en el TMJ

- **WHEN** el manifest declara los sprites `cat` y `butterfly`, pero el TMJ solo contiene Points con `sprite="cat"`
- **THEN** el cliente carga únicamente `cat`; el PNG y JSON de `butterfly` no se descargan

#### Scenario: Sprite ya cargado anteriormente

- **WHEN** la scene ya tiene la textura registrada para un id (porque otra escena lo cargó antes, o el usuario navegó a otra oficina con el mismo sprite)
- **THEN** la carga no se duplica
