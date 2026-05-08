# UI Game

## Purpose

Define la presentación arcade de la oficina virtual en el cliente: la vista del mapa Tiled con sus puestos y avatares, la navegación entre días, la tipografía pixel y la paleta de colores, y los componentes interactivos (botones 9-slice, sonidos retro).

## Requirements


### Requirement: Navegación entre días con teclado y botones
El sistema MUST permitir al usuario avanzar y retroceder entre días desde la `OfficeScene` mediante botones HUD y atajos de teclado, dentro del intervalo `[hoy - HISTORY_VISIBLE_DAYS, hoy + BOOKING_HORIZON_DAYS - 1]`.

#### Scenario: Avanzar un día
- GIVEN un usuario viendo la oficina con fecha actual
- WHEN pulsa `→` o el botón `>`
- THEN la etiqueta muestra el día siguiente formateado en castellano (`"viernes 8 de mayo de 2026"`)
- AND el snapshot del nuevo día se refresca

#### Scenario: Retroceder un día
- GIVEN un usuario en la fecha actual
- WHEN pulsa `←` o el botón `<`
- THEN se muestra el día anterior

#### Scenario: Botón "Hoy" volver
- GIVEN un usuario navegado a una fecha distinta de hoy
- WHEN pulsa `Home` o el botón `[Hoy]`
- THEN la fecha vuelve a la de hoy del navegador

#### Scenario: Límite hacia adelante
- GIVEN la fecha seleccionada coincide con `hoy + BOOKING_HORIZON_DAYS - 1`
- WHEN se intenta avanzar
- THEN la acción no produce cambio
- AND el botón `>` queda deshabilitado

#### Scenario: Límite hacia atrás
- GIVEN la fecha seleccionada coincide con `hoy - HISTORY_VISIBLE_DAYS`
- WHEN se intenta retroceder
- THEN la acción no produce cambio
- AND el botón `<` queda deshabilitado

### Requirement: Persistencia de día en la sesión del navegador
El sistema MUST recordar el último día visitado durante la sesión del navegador, restaurándolo al recargar; MUST NOT persistir entre cierres y aperturas de pestaña distintos.

#### Scenario: Recarga conserva el día
- GIVEN un usuario que navegó a `2026-05-09`
- WHEN recarga la página
- THEN al volver a `OfficeScene` la fecha es `2026-05-09`

#### Scenario: Reapertura tras cerrar pestaña
- GIVEN un usuario cerró la pestaña ayer mientras estaba en `2026-05-09`
- WHEN abre una nueva pestaña hoy `2026-05-10`
- THEN la fecha mostrada es la del día actual `2026-05-10`

### Requirement: Aplicación selectiva de deltas en realtime
El sistema MUST filtrar los mensajes WebSocket de tipo `desk.booked` y `desk.released` para que solo modifiquen el snapshot visible cuando coinciden con la fecha seleccionada en el cliente. Los mensajes `desk.fixed`, `desk.unfixed` y `office.updated` afectan a todos los días.

#### Scenario: Reserva del día visible
- GIVEN Alice ve el día `2026-05-04`
- WHEN llega `{ type: "desk.booked", deskId: A1.id, date: "2026-05-04", user }`
- THEN A1 cambia a estado ocupado en su pantalla

#### Scenario: Reserva en otro día
- GIVEN Alice ve el día `2026-05-04`
- WHEN llega `{ type: "desk.booked", deskId: A1.id, date: "2026-05-08", user }`
- THEN la pantalla de Alice no cambia

#### Scenario: Asignación fija propaga a cualquier día
- GIVEN Alice ve el día `2026-05-04`
- WHEN llega `{ type: "desk.fixed", deskId: A1.id, user }`
- THEN A1 se renderiza como fijo en la vista de Alice

### Requirement: Avatar circular en puestos ocupados
El sistema MUST renderizar la fotografía de Google del usuario que ocupa un puesto, recortada con una máscara circular, centrada sobre el cuadrado del puesto en `OfficeScene`. La fuente del avatar es siempre `users.avatar_url`, persistido durante el login con Google a partir del claim `picture` del ID token; este change NO MUST emitir requests a un endpoint propio de avatares.

#### Scenario: Avatar de Google visible en el puesto
- GIVEN Alice tiene `avatar_url="https://lh3.googleusercontent.com/...alice"` persistido en `users`
- AND Alice reserva A1 para hoy
- WHEN Bob carga la `OfficeScene`
- THEN A1 se renderiza con la imagen de Alice recortada en círculo, centrada en el cuadrado del puesto
- AND el cliente carga la imagen directamente desde la URL de `googleusercontent.com`

#### Scenario: Tooltip con nombre completo
- GIVEN A1 ocupado por Alice
- WHEN Bob pasa el ratón sobre A1
- THEN aparece un tooltip HTML mostrando el nombre completo de Alice cerca del puntero
- AND el tooltip desaparece al alejar el ratón o pulsar Escape

### Requirement: Fallback con iniciales cuando el avatar no carga
El sistema MUST mostrar un fallback compuesto por un círculo de color determinístico (basado en el `userId`) y las iniciales del nombre cuando el avatar no esté disponible o falle la carga. El fallback NUNCA MUST hacer reintentos infinitos contra Google.

#### Scenario: URL del avatar devuelve 403
- GIVEN Alice tiene una `avatar_url` cuya carga falla con 403
- WHEN Bob ve A1 ocupado por Alice
- THEN A1 muestra un círculo lleno con las iniciales `"A"` en blanco con tipografía pixel
- AND el color del círculo es determinístico para `Alice.id`
- AND el cliente NO MUST reintentar la carga de la imagen

#### Scenario: Sin avatar persistido
- GIVEN un usuario invitado externo cuyo `avatar_url` es null
- WHEN ocupa un puesto y otro usuario lo ve
- THEN se renderiza el fallback con sus iniciales

### Requirement: Carga progresiva sin flash
El sistema MUST mostrar el fallback con iniciales mientras la textura del avatar se descarga, reemplazándolo por la imagen real cuando esté lista, sin descartar el booking del snapshot.

#### Scenario: Snapshot inicial con varios avatares no cacheados
- GIVEN Alice carga la oficina con 5 puestos ocupados por usuarios cuyos avatares no están cacheados
- WHEN se renderiza la `OfficeScene`
- THEN cada puesto muestra inmediatamente el fallback con iniciales
- AND a medida que llegan los `filecomplete-image-*`, los fallbacks se reemplazan por las fotografías circulares
- AND no hay parpadeos o cuadrados vacíos en ningún momento

### Requirement: Tipografía pixel coherente
El sistema MUST emplear únicamente Press Start 2P para titulares, botones y etiquetas de fecha; y VT323 para cuerpo, mensajes y tooltips. Cualquier texto visible NUNCA MUST renderizarse con la fuente por defecto del sistema operativo o del navegador.

#### Scenario: Botones con fuente arcade
- GIVEN la `LoginScene` cargada en el navegador
- WHEN se inspecciona el `font-family` computado del botón principal "PRESS START"
- THEN el valor incluye `"Press Start 2P"` antes del fallback monoespaciado

#### Scenario: Cuerpo con VT323
- GIVEN un modal de reserva visible
- WHEN se inspecciona el `font-family` computado del párrafo descriptivo
- THEN el valor incluye `"VT323"` antes del fallback monoespaciado

### Requirement: Paleta arcade aplicada de forma consistente
El sistema MUST usar exclusivamente los colores definidos en `theme.ts` y en las variables CSS del proyecto para fondos, textos y estados de puesto. NUNCA MUST usarse colores hardcoded fuera del tema.

#### Scenario: Estado libre en color verde de tema
- GIVEN un puesto libre en `OfficeScene`
- WHEN se compara el color de relleno con `THEME.free`
- THEN coinciden exactamente

#### Scenario: Estado fixed en color violeta
- GIVEN un puesto fijo
- WHEN se inspecciona el borde
- THEN coincide con `THEME.fixed` (#b66dff)

### Requirement: Botones con look 9-slice
El sistema MUST renderizar los botones interactivos (LoginScene, modales, HUD) con un marco 9-slice de estética arcade y un efecto visual de presionar (descenso de 2 px del label en `pointerdown`).

#### Scenario: Press feedback
- GIVEN un botón arcade visible
- WHEN el usuario hace `mousedown` sobre él
- THEN el texto del botón baja 2 px verticalmente
- AND al `mouseup` vuelve a su posición y se ejecuta la acción

### Requirement: Sonido retro opcional
El sistema MUST exponer un toggle de sonido en el HUD que controla los efectos sonoros retro (click, booking, error). El estado del toggle MUST persistir en `localStorage` y por defecto MUST estar mute.

#### Scenario: Toggle mute persiste
- GIVEN un usuario activa el sonido y reserva un puesto
- WHEN recarga la página
- THEN el sonido sigue activo
- AND la reserva siguiente reproduce `beep-booked`

#### Scenario: Mute por defecto
- GIVEN un usuario nuevo sin `localStorage` previo
- WHEN abre la app por primera vez
- THEN el toggle muestra estado muted
- AND ninguna acción produce sonido hasta que active el toggle

### Requirement: Render pixel sin antialiasing
El sistema MUST configurar Phaser con `pixelArt: true`, `roundPixels: true` y filtro `NEAREST`, y MUST aplicar `image-rendering: pixelated` al canvas, para garantizar la estética pixel.

#### Scenario: Canvas con render pixelado
- GIVEN la app cargada
- WHEN se inspecciona la propiedad CSS `image-rendering` del canvas Phaser
- THEN el valor es `pixelated`

### Requirement: Visual regression sobre el tema
El sistema MUST mantener un suite de tests Playwright con baselines de las pantallas principales (login, oficina con los cuatro estados de puesto, modal de reserva), tolerando un diff máximo de 0.1% de píxeles.

#### Scenario: Cambio inadvertido de fuente
- GIVEN el suite visual con baselines establecidas
- WHEN un PR cambia la fuente de un botón a una distinta de Press Start 2P
- THEN el test visual falla con un diff superior al umbral
- AND el PR queda bloqueado hasta justificar la baseline o revertir el cambio

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

### Requirement: Selector de fecha tipo calendario al hacer clic en la etiqueta de fecha

El sistema MUST mostrar un overlay con calendario mensual cuando el usuario hace clic en la etiqueta de fecha del HUD, permitiendo elegir cualquier día dentro del horizonte de reservas mediante un único clic.

#### Scenario: Abrir el calendario

- **WHEN** un usuario en `OfficeScene` hace clic en la etiqueta de fecha del HUD
- **THEN** se monta un overlay HTML `#day-picker` posicionado bajo la etiqueta, mostrando el mes correspondiente a la fecha seleccionada con su grid de 6 semanas

#### Scenario: Toggle al volver a clicar la etiqueta

- **WHEN** el calendario está abierto y el usuario vuelve a clicar la etiqueta de fecha
- **THEN** el overlay se desmonta sin cambiar la fecha

#### Scenario: Atajo de teclado `c`

- **WHEN** el usuario pulsa la tecla `c` en `OfficeScene`
- **THEN** el calendario se abre o se cierra (toggle)

#### Scenario: Día seleccionado destacado

- **WHEN** el calendario se monta
- **THEN** la celda correspondiente a la fecha actualmente seleccionada del store aparece con fondo `--color-accent`

#### Scenario: Día de hoy destacado

- **WHEN** el calendario muestra el mes que contiene la fecha de hoy
- **THEN** la celda de hoy aparece con borde `--color-success`

#### Scenario: Días fuera del horizonte deshabilitados

- **WHEN** el grid contiene celdas con fecha anterior a `hoy - HISTORY_VISIBLE_DAYS` o posterior a `hoy + BOOKING_HORIZON_DAYS - 1`
- **THEN** dichas celdas aparecen atenuadas y no responden al clic

#### Scenario: Click en día válido

- **WHEN** el usuario hace clic en una celda de un día dentro del horizonte
- **THEN** se invoca `uiStore.setDate(iso)` con la fecha de esa celda y el overlay se desmonta

#### Scenario: Cierre por click fuera

- **WHEN** el usuario hace clic en cualquier punto fuera del overlay
- **THEN** el overlay se desmonta sin cambiar la fecha

#### Scenario: Cierre por Esc

- **WHEN** el usuario pulsa `Esc` con el overlay abierto
- **THEN** el overlay se desmonta sin cambiar la fecha

### Requirement: Navegación de meses dentro del calendario

El sistema MUST ofrecer flechas para retroceder y avanzar de mes dentro del calendario, deshabilitándolas cuando el mes destino está completamente fuera del horizonte.

#### Scenario: Avanzar mes

- **WHEN** el usuario pulsa la flecha `>` del header del calendario
- **THEN** el grid se vuelve a renderizar con el mes siguiente y la cabecera muestra su nombre y año

#### Scenario: Retroceder mes

- **WHEN** el usuario pulsa la flecha `<` del header
- **THEN** el grid muestra el mes anterior

#### Scenario: Flecha de mes anterior deshabilitada

- **WHEN** todo el mes anterior está fuera de horizonte (todas sus fechas < `hoy - HISTORY_VISIBLE_DAYS`)
- **THEN** la flecha `<` aparece atenuada y no responde al clic

#### Scenario: Flecha de mes siguiente deshabilitada

- **WHEN** todo el mes siguiente está fuera de horizonte
- **THEN** la flecha `>` aparece atenuada y no responde al clic

### Requirement: Estética arcade del calendario

El calendario MUST emplear las tipografías y paleta arcade del resto de la app: Press Start 2P para el header de mes/año, VT323 para días de la semana y números, paleta `--color-bg-2`, `--color-success`, `--color-accent`, `--color-muted`.

#### Scenario: Tipografía del header

- **WHEN** el calendario se monta
- **THEN** el header (mes y año) usa `font-family: "Press Start 2P"` en color `--color-success`

#### Scenario: Tipografía de las celdas

- **WHEN** el calendario se monta
- **THEN** los días de la semana y los números de los días usan `font-family: "VT323"`

#### Scenario: Borde de la caja

- **WHEN** el calendario se monta
- **THEN** la caja contenedora tiene un borde de 2px en `--color-success` y fondo `--color-bg-2`

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

### Requirement: Modal admin para reservar/liberar a nombre de otro usuario

Cuando un usuario con rol admin pulsa un puesto en `OfficeScene`, el sistema MUST abrir un modal que permita seleccionar a quién reservar o liberar el puesto para el día actualmente seleccionado en el HUD, en lugar de aplicar la acción directamente al admin.

#### Scenario: Admin pulsa puesto vacío

- **GIVEN** un admin con la oficina abierta y la fecha `D` seleccionada
- **WHEN** pulsa un puesto que no tiene reserva ese día
- **THEN** se abre un modal con header "Reservar puesto <label> — <fecha formateada>"
- **AND** muestra un input de filtro y una lista de usuarios visibles
- **AND** el propio admin aparece como primer item con etiqueta "(yo)"
- **AND** el resto aparece en orden alfabético por nombre

#### Scenario: Admin filtra y reserva

- **GIVEN** el modal abierto sobre un puesto vacío
- **WHEN** el admin escribe parte del nombre o email en el filtro y pulsa sobre un usuario, después "Reservar"
- **THEN** se llama `POST /api/desks/:id/bookings` con `{ date, userId }`
- **AND** el modal se cierra al recibir 201
- **AND** la reserva aparece en el mapa con el avatar del usuario destino

#### Scenario: Admin pulsa puesto ocupado

- **GIVEN** un admin y un puesto con reserva diaria del usuario U el día `D`
- **WHEN** pulsa el puesto
- **THEN** el modal se abre en modo "ocupado" con header "Liberar puesto <label> — <fecha>"
- **AND** muestra "Reservado por <name> (<email>)"
- **AND** muestra un botón "Liberar reserva" en color de aviso

#### Scenario: Admin libera reserva ajena

- **GIVEN** el modal abierto en modo ocupado
- **WHEN** el admin pulsa "Liberar reserva"
- **THEN** se llama `DELETE /api/desks/:id/bookings` con `{ date, userId: <U> }`
- **AND** el modal se cierra al recibir 204
- **AND** el desk vuelve a estado libre en el mapa

#### Scenario: Puesto con fijo asignado

- **GIVEN** un admin pulsa un puesto que tiene `fixed_assignment` activo el día `D`
- **WHEN** el modal se abre
- **THEN** muestra "Asignado fijo a <name>" y un texto explicativo "Para gestionar fijos, usa el admin panel"
- **AND** los botones de reservar/liberar quedan deshabilitados

#### Scenario: ESC y click fuera cierran el modal

- **GIVEN** el modal abierto
- **WHEN** el admin pulsa ESC o hace click fuera de la caja del modal
- **THEN** el modal se desmonta sin acción
- **AND** no se llama a ningún endpoint

#### Scenario: Usuario no-admin no ve el modal

- **GIVEN** un usuario con rol member
- **WHEN** pulsa cualquier puesto del mapa
- **THEN** el flujo previo se mantiene exactamente (click en libre reserva para sí mismo, click en propio libera)
- **AND** el modal admin no aparece nunca

### Requirement: Checkboxes por día de la semana en el modal admin de reserva

El modal admin de reserva (introducido en change 026) MUST mostrar 7 checkboxes (`L M X J V S D`) al lado del nombre de cada usuario en el modo `book`, para crear o borrar `weekly_assignments` desde el mismo flujo. Los checkboxes reflejan el estado actual y los cambios se aplican al pulsar "Guardar".

#### Scenario: Estado inicial refleja weeklies existentes

- **GIVEN** el modal abierto en modo `book` para `desk5` y la fecha de hoy
- **AND** existe `weekly_assignment(desk_id=5, user_id=A, dow=0)`
- **WHEN** el modal monta
- **THEN** el usuario A muestra el checkbox `L` marcado y los otros desmarcados
- **AND** los demás usuarios muestran sus checkboxes desmarcados

#### Scenario: Checkbox conflictivo deshabilitado

- **GIVEN** el usuario B ya tiene `weekly_assignment(desk_id=7, user_id=B, dow=0)` en otro desk
- **WHEN** se abre el modal sobre `desk5`
- **THEN** el checkbox `L` de B aparece deshabilitado con tooltip "B ya tiene un fijo semanal en otro puesto los lunes"
- **AND** los demás dows de B siguen habilitados

#### Scenario: Marcar checkbox crea weekly al guardar

- **GIVEN** el modal abierto, ningún cambio aún
- **WHEN** el admin marca el checkbox `M` del usuario A y pulsa "Guardar"
- **THEN** se ejecuta `POST /api/desks/:id/weekly` con `{ userId: A, dow: 1 }`
- **AND** el modal se cierra al éxito
- **AND** consultas posteriores de la oficina para martes incluyen el slot

#### Scenario: Desmarcar checkbox borra weekly al guardar

- **GIVEN** A tiene `weekly L` en desk5 (checkbox `L` marcado)
- **WHEN** el admin desmarca `L` y pulsa "Guardar"
- **THEN** se ejecuta `DELETE /api/desks/:id/weekly/:weeklyId` correspondiente
- **AND** el modal se cierra al éxito

#### Scenario: Múltiples cambios se aplican en orden

- **GIVEN** A tiene weekly `L` y B no tiene ningún weekly en este desk
- **WHEN** el admin desmarca `L` de A, marca `M` y `J` de B y pulsa "Guardar"
- **THEN** se ejecutan las 3 llamadas (1 DELETE + 2 POST)
- **AND** si una falla, las anteriores se mantienen y el modal muestra el error en el HUD

#### Scenario: Modo release no muestra checkboxes

- **GIVEN** el modal abierto en modo `release` (puesto ocupado por una reserva diaria)
- **WHEN** el modal monta
- **THEN** muestra solo el botón "Liberar reserva" sin la rejilla de checkboxes
- **AND** la liberación afecta solo al daily booking, no a weeklies del desk

#### Scenario: Modo fixed no permite weeklies

- **GIVEN** un desk con `fixed_assignment`
- **WHEN** el admin pulsa el desk
- **THEN** el modal se abre en modo `fixed` con el aviso habitual
- **AND** no se muestra rejilla de checkboxes (las weeklies no son aplicables sobre desks con fixed)

### Requirement: Modal de gestión de weekly al pulsar un puesto recurrente

Cuando un usuario pulsa un puesto cuya reserva visible para el día seleccionado es de tipo `weekly`, el sistema MUST abrir un modal específico que ofrece acciones según el rol del usuario y si la weekly es propia.

#### Scenario: User pulsa su propia weekly del día

- **GIVEN** un usuario miembro autenticado con `weekly_assignment` en `desk5` los lunes
- **AND** la fecha seleccionada es un lunes sin excepción activa para esa weekly
- **WHEN** pulsa `desk5`
- **THEN** se abre un modal con título "Tu puesto fijo recurrente — <fecha>"
- **AND** muestra dos botones: "Saltarme hoy" y "Cancelar"
- **AND** "Saltarme hoy" llama `POST /api/desks/5/weekly/<weeklyId>/exceptions { date }`

#### Scenario: User pulsa su weekly cuando ya tiene excepción

- **GIVEN** el usuario tiene weekly en `desk5` los lunes y una excepción activa para `2026-05-04`
- **AND** la fecha seleccionada es `2026-05-04`
- **WHEN** pulsa `desk5`
- **THEN** el desk se ve libre para él, así que el modal weekly NO aparece
- **AND** sigue el flujo normal de "puesto libre" (puede reservarlo daily, etc.)

#### Scenario: User pulsa weekly ajena

- **GIVEN** Bob (no admin) ve `desk5` ocupado por Ana (weekly)
- **WHEN** Bob pulsa `desk5`
- **THEN** el sistema muestra solo `showFeedback("Ocupado por Ana")` igual que con dailies ajenas
- **AND** no se abre modal de weekly

#### Scenario: Admin pulsa weekly de cualquiera (incluso suya)

- **GIVEN** un admin pulsa `desk5` ocupado por una weekly (de él o de otro)
- **WHEN** la fecha seleccionada coincide con el dow de la weekly
- **THEN** se abre un modal con título "Puesto recurrente de <name> — <día>"
- **AND** muestra tres botones:
  - "Saltar este <día>" (crea exception solo para esa fecha)
  - "Quitar todos los <día>" (borra la weekly entera, requiere confirm extra)
  - "Cancelar"

#### Scenario: Admin elige "Quitar todos los <día>" — confirm

- **GIVEN** el modal admin abierto
- **WHEN** el admin pulsa "Quitar todos los miércoles"
- **THEN** aparece un confirm `window.confirm("¿Quitar la asignación recurrente entera? Esto afectará a todos los miércoles futuros.")`
- **AND** si confirma, se llama `DELETE /api/desks/:id/weekly/:weeklyId`
- **AND** si cancela, no pasa nada

#### Scenario: Bug fix — admin pulsa weekly proyectada ya no da 404

- **GIVEN** un admin pulsa un desk ocupado por una weekly
- **WHEN** se abre el flujo (modal nuevo de este change)
- **THEN** se llama al endpoint correcto (`/weekly/.../exceptions` o `/weekly/...`)
- **AND** NO se llama `DELETE /api/desks/:id/bookings` (que devolvería 404 porque el booking weekly no es una row real en `bookings`)
