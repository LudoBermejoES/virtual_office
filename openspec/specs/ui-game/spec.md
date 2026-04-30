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
