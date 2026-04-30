# Delta — UI Game

## ADDED Requirements

### Requirement: Tiles animados desde Tiled
El sistema MUST reproducir las animaciones de tile definidas en el `.tmj` (campo `animation` por tile) sin requerir configuración adicional. El backend MUST persistir el array de animaciones por tileset para que el cliente las reciba al cargar la oficina.

#### Scenario: Tile con animación de 4 frames
- GIVEN un `.tmj` con un tile cuya `animation` tiene 4 entradas de 200 ms cada una
- WHEN un usuario abre la oficina en el navegador
- THEN el tile cicla por los 4 frames a 200 ms cada uno
- AND el ciclo es continuo

### Requirement: Sprite del usuario sentado en su puesto
El sistema MUST renderizar un sprite animado "sentado" en cada puesto que tenga booking activo (daily o fixed) sobre la fecha visible. El sprite MUST tener tinta determinística basada en el `userId` (usando la misma función `colorForUser` que el avatar fallback). El avatar circular del usuario MUST quedar elevado por encima del sprite.

#### Scenario: Desk ocupado muestra sprite sentado
- GIVEN Alice ha reservado A1 para hoy
- WHEN Bob abre `OfficeScene`
- THEN A1 muestra un sprite `desk-sit-idle` animado a 4 fps
- AND el sprite tiene tinta `colorForUser(Alice.id)`
- AND el avatar circular de Alice queda 28 px por encima del sprite

#### Scenario: Desk libre sin sprite
- GIVEN A2 sin reserva
- WHEN se renderiza la escena
- THEN A2 NO muestra ningún sprite sentado

### Requirement: NPCs decorativos opcionales
El sistema MUST aceptar una object layer `npcs` en el `.tmj` con puntos cuya propiedad `sprite` esté en el enum `{ "cat-idle", "bird-idle", "roomba-idle", "plant-sway" }`. Los puntos con `sprite` desconocidos MUST descartarse silenciosamente con un warning en logs. La cota dura es 50 NPCs por oficina.

#### Scenario: NPC plant en object layer
- GIVEN un `.tmj` con un punto en la layer `npcs` con `sprite="plant-sway"`
- WHEN se sube el mapa
- THEN al renderizar la escena aparece el sprite de planta animado en esa posición

#### Scenario: Sprite desconocido descartado
- GIVEN un `.tmj` con un NPC cuya propiedad `sprite="dragon"`
- WHEN se sube el mapa
- THEN el NPC se descarta sin error
- AND queda log warning con el nombre del sprite descartado

#### Scenario: 51 NPCs rechazados
- GIVEN un `.tmj` con 51 puntos en `npcs`
- WHEN se sube el mapa
- THEN la respuesta es 413 con `reason="too_many_npcs"`

### Requirement: Cap de sprites animados concurrentes
El sistema MUST limitar a 100 los sprites animados activos simultáneamente. Cuando hay más sprites en escena, MUST animar solo los 100 más cercanos al centro de cámara y dejar el resto en frame 0 (visibles, estáticos), recalculando el conjunto cada 500 ms o cuando la cámara se mueve.

#### Scenario: 150 sprites con cap 100
- GIVEN una oficina con 80 desks ocupados + 70 NPCs (total 150 sprites)
- WHEN se renderiza la escena
- THEN exactamente 100 sprites tienen animación corriendo
- AND los 50 restantes están en frame 0 sin animar
- AND los 100 animados son los más cercanos al centro de cámara
