# Delta — UI Game

## ADDED Requirements

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
