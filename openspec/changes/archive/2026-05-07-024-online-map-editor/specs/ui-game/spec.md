# UI Game — Delta para change 024-online-map-editor

## ADDED Requirements

### Requirement: Editor online de sprites en el mapa

El sistema MUST proveer una escena de admin "Editor de sprites" accesible desde el admin panel que permita gestionar visualmente los object layers `sprites_*` del TMJ de la oficina actual, sin requerir Tiled de escritorio.

#### Scenario: Acceso restringido a admin

- **GIVEN** un usuario autenticado sin rol admin
- **WHEN** abre el admin panel
- **THEN** el botón "Editor de sprites" no aparece
- **AND** acceder a la ruta del editor responde con redirección o pantalla de no autorizado

#### Scenario: Apertura y render inicial

- **GIVEN** un admin abre el editor para una oficina con TMJ subido
- **WHEN** la escena monta
- **THEN** se renderiza el mismo mapa que ve el usuario final, con los sprites ya colocados de capas `sprites_*` visibles con su `depth` correcto
- **AND** un panel lateral lista todos los layers del TMJ (tilelayers + object layers) marcando los `sprites_*` como editables

#### Scenario: Capas del sistema mostradas como reordenables pero no editables

- **GIVEN** el TMJ contiene tilelayers (`ground`, `furniture`) y object layers `desks`, `voice_rooms`, `npcs`
- **WHEN** se abre el editor
- **THEN** el panel de capas las muestra todas en su orden actual, marcadas como "sistema"
- **AND** las capas del sistema permiten **reordenar** (botones ↑/↓ habilitados) y **toggle de visibilidad** (botón 👁)
- **AND** las capas del sistema NO permiten renombrar, borrar ni editar contenido (botones ✎ y ✕ ocultos o deshabilitados con tooltip)

#### Scenario: Crear capa de sprites

- **GIVEN** un admin en el editor
- **WHEN** pulsa "Nueva capa de sprites" e introduce el nombre `sprites_overlay`
- **THEN** la capa aparece en el panel y queda activa
- **AND** intentar crear una con nombre que no encaja con `^sprites_[a-z0-9_]+$` muestra error inline sin crearla

#### Scenario: Borrar capa de sprites

- **GIVEN** existe una capa `sprites_floor` con 3 sprites
- **WHEN** el admin pulsa borrar y confirma
- **THEN** la capa desaparece del panel y los 3 sprites del canvas se eliminan
- **AND** el estado queda marcado como modificado (dirty)

#### Scenario: Renombrar capa de sprites

- **GIVEN** existe `sprites_floor`
- **WHEN** el admin la renombra a `sprites_decoration` (válido)
- **THEN** la capa cambia de nombre conservando todos sus sprites y posición en el array de layers

#### Scenario: Intercalar capa de sprites entre capas del sistema

- **GIVEN** el TMJ tiene `layers = [ground, furniture, desks]` y el admin acaba de crear `sprites_jardin`
- **AND** `sprites_jardin` aparece al final del panel
- **WHEN** el admin pulsa ↑ en `sprites_jardin` repetidamente hasta colocarla entre `ground` y `furniture`
- **THEN** el panel muestra el orden `[ground, sprites_jardin, furniture, desks]`
- **AND** los sprites de `sprites_jardin` se redibujan con un `setDepth` que los coloca por encima de `ground` pero por debajo de `furniture`
- **AND** los tilelayers y object layers del sistema preservan su contenido íntegro

#### Scenario: Reordenar capa del sistema

- **GIVEN** el TMJ tiene `layers = [ground, furniture, desks]`
- **WHEN** el admin pulsa ↑ en `furniture`
- **THEN** el panel y el TMJ resultante muestran `[furniture, ground, desks]`
- **AND** los tiles de `ground` ahora se renderizan por encima de los de `furniture`
- **AND** el contenido de las capas (data de tiles, objetos de desks) no cambia

#### Scenario: Toggle visibilidad de capa

- **GIVEN** una capa `furniture` visible en el editor
- **WHEN** el admin pulsa el botón 👁 de la fila de `furniture`
- **THEN** la capa se oculta en el canvas (no se renderiza)
- **AND** el botón 👁 cambia a indicar el estado oculto (ej. tachado o color reducido)
- **AND** el estado queda marcado como dirty (la visibilidad se persistirá en el TMJ)

#### Scenario: Insertar sprite con drag desde el panel

- **GIVEN** existe la capa activa `sprites_overlay` y el manifest contiene `cat`
- **WHEN** el admin arrastra el item `cat` del panel sobre el canvas en `(150, 200)`
- **THEN** se crea un Phaser.Sprite en esa posición con la animación por defecto
- **AND** el estado de la capa contiene un Point nuevo con properties `sprite=cat`

#### Scenario: Mover sprite existente

- **GIVEN** un sprite seleccionado en `(100, 100)`
- **WHEN** el admin lo arrastra a `(250, 180)`
- **THEN** el sprite se redibuja en la nueva posición
- **AND** sus coords en el estado de la capa son `(250, 180)`

#### Scenario: Snap al tile con Shift

- **GIVEN** el TMJ tiene `tilewidth=48`, `tileheight=48`
- **WHEN** el admin arrastra un sprite manteniendo `Shift` pulsado y suelta cerca de `(247, 99)`
- **THEN** el sprite queda en `(240, 96)` (múltiplo de 48 más cercano)

#### Scenario: Borrar sprite seleccionado

- **GIVEN** un sprite seleccionado
- **WHEN** el admin pulsa `Supr`
- **THEN** el sprite desaparece del canvas y del estado

#### Scenario: Cambiar tag de animación

- **GIVEN** un sprite seleccionado con sprite=`cat` y aseprite con tags `walk`, `idle`
- **WHEN** el admin selecciona `idle` en el dropdown del popover
- **THEN** la animación cambia en vivo a `idle`
- **AND** el Point del estado refleja `properties.tag=idle`

#### Scenario: Undo de operación

- **GIVEN** el admin acaba de mover un sprite
- **WHEN** pulsa `Ctrl+Z`
- **THEN** el sprite vuelve a su posición previa
- **AND** un `Ctrl+Shift+Z` lo devuelve a la posición tras el movimiento

#### Scenario: Guardar cambios

- **GIVEN** el admin tiene cambios sin guardar (`isDirty=true`)
- **WHEN** pulsa "Guardar"
- **THEN** se hace `PATCH /api/offices/:id/map/sprites-layers` con `expected_hash` y todas las capas `sprites_*`
- **AND** ante respuesta 200, `isDirty` pasa a false y el `tmj_hash` local se actualiza

#### Scenario: Conflicto al guardar

- **GIVEN** otro admin guardó cambios mientras este editaba
- **WHEN** este pulsa "Guardar"
- **THEN** el servidor responde 409 y la UI muestra modal con opciones "Recargar (perder cambios)" o "Cancelar"
- **AND** elegir "Recargar" recarga el TMJ y reconstruye la escena desde cero

#### Scenario: Navegación con cambios pendientes

- **GIVEN** `isDirty=true`
- **WHEN** el admin intenta cerrar la pestaña o navegar fuera
- **THEN** se muestra confirmación nativa pidiendo confirmar la pérdida de cambios

#### Scenario: Previsualización animada en panel

- **GIVEN** el manifest contiene `cat` con `defaultTag=walk`
- **WHEN** se abre el panel de sprites disponibles
- **THEN** el item `cat` muestra la animación `walk` en bucle a tamaño reducido
