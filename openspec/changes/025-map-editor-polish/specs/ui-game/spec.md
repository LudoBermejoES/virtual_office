# UI Game — Delta para change 025-map-editor-polish

## ADDED Requirements

### Requirement: Undo / Redo en el editor online de sprites

El editor MUST mantener una pila de snapshots del estado de capas y sprites para permitir deshacer y rehacer operaciones del usuario durante una sesión de edición.

#### Scenario: Undo restaura estado anterior

- **GIVEN** un admin acaba de mover un sprite de `(100, 100)` a `(250, 180)`
- **WHEN** pulsa `Ctrl+Z`
- **THEN** el sprite vuelve a `(100, 100)`
- **AND** un `Ctrl+Shift+Z` lo devuelve a `(250, 180)`

#### Scenario: Undo de borrado de capa

- **GIVEN** existe la capa `sprites_floor` con 3 sprites y el admin la borra
- **WHEN** pulsa `Ctrl+Z`
- **THEN** la capa vuelve con sus 3 sprites en sus posiciones originales

#### Scenario: Stack con tope

- **GIVEN** el admin realiza 60 operaciones consecutivas sin guardar
- **THEN** el stack de undo conserva las 50 más recientes
- **AND** las 10 primeras ya no son recuperables

#### Scenario: Redo se descarta tras nueva operación

- **GIVEN** el admin hizo una operación, después un undo, y ahora puede hacer redo
- **WHEN** realiza una operación nueva (cualquier mutación)
- **THEN** el stack de redo se vacía: ya no se puede rehacer la operación abandonada

### Requirement: Previsualización animada en panel de sprites disponibles

Cada entrada del `SPRITE_MANIFEST` mostrada en el panel SPRITES MUST reproducir una animación reducida del `defaultTag` (o primer tag) del Aseprite cacheado.

#### Scenario: Animación visible en cada entrada

- **GIVEN** el manifest contiene `cat` con `defaultTag=walk` (12 frames a 100ms cada uno)
- **WHEN** se monta el panel SPRITES
- **THEN** la entrada `cat` muestra la animación `walk` en bucle infinito a tamaño reducido (32×32)
- **AND** los frames cambian cada 100ms aproximadamente

#### Scenario: Sin tag definido

- **GIVEN** el manifest contiene una entrada sin `defaultTag` y el JSON no tiene `frameTags`
- **WHEN** se monta el panel
- **THEN** la entrada se muestra como imagen estática del primer frame, sin error en consola
