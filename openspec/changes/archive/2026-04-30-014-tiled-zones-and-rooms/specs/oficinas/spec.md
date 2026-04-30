# Delta — Oficinas

## ADDED Requirements

### Requirement: Object layers extra del mapa Tiled
El sistema MUST aceptar y procesar las object layers `zones`, `rooms` y `labels` del fichero `.tmj` cuando estén presentes. Estas layers son opcionales: una oficina sin ellas sigue siendo válida. Cada feature MUST tener un `name` ≤ 80 caracteres ASCII/Unicode latino y, según su kind, propiedades específicas.

#### Scenario: Mapa con zona "Cocina"
- GIVEN un `.tmj` que contiene una object layer `zones` con un rectángulo `name="Cocina"` y `properties.kind="kitchen"`
- WHEN el admin sube el bundle Tiled vía `POST /api/offices`
- THEN el sistema persiste una fila en `office_features` con `kind="zone"` y `name="Cocina"`
- AND `GET /api/offices/:id` incluye esta zona en `features.zones`

#### Scenario: Mapa con polígono cóncavo
- GIVEN un `.tmj` con una zona definida por un polígono de 6 puntos
- WHEN se sube el mapa
- THEN el polígono se persiste con coordenadas absolutas (sumando el origen del objeto)
- AND `features.zones[i].geometry` es `{ type: "polygon", points: [{x,y}, ...] }`

#### Scenario: Mapa sin object layers extra
- GIVEN un `.tmj` con solo la layer `desks`
- WHEN se sube el mapa
- THEN `features` viene como `{ zones: [], rooms: [], labels: [] }`

### Requirement: Validación de features
El sistema MUST rechazar el bundle si alguna feature tiene `name` con caracteres de control, `kind` fuera del enum, geometría fuera del rango del mapa, polígono con menos de 3 o más de 64 puntos, o si el total de features supera 200.

#### Scenario: Feature con kind inválido
- GIVEN un `.tmj` con una zona cuyo `kind="restroom"` (no está en el enum)
- WHEN se sube el bundle
- THEN la respuesta es 400 con `reason="invalid_feature_kind"`

#### Scenario: Polígono fuera del mapa
- GIVEN un `.tmj` con un polígono que tiene un punto en `x = mapWidth + 10`
- WHEN se sube el bundle
- THEN la respuesta es 400 con `reason="feature_out_of_bounds"`

#### Scenario: Más de 200 features
- GIVEN un `.tmj` con 201 zonas
- WHEN se sube el bundle
- THEN la respuesta es 413 con `reason="too_many_features"`

### Requirement: Renderizado de zonas en OfficeScene
El sistema MUST dibujar las zonas y rooms como polígonos semi-transparentes (alpha 0.15) por debajo de los desks (depth -10), con el color asociado al `kind` derivado del tema arcade. Las labels MUST renderizarse con la fuente `Press Start 2P` o `VT323` según `properties.font`.

#### Scenario: Zona cocina visible
- GIVEN una oficina con una zona `kind="kitchen"`
- WHEN un usuario abre `OfficeScene`
- THEN se dibuja un rectángulo con relleno `THEME.warning` alpha 0.15
- AND el rectángulo está por debajo de los desks (depth -10)

#### Scenario: Label con fuente display
- GIVEN una oficina con una label `name="Mar"`, `font="display"`, `size=24`
- WHEN se renderiza la escena
- THEN aparece el texto "Mar" con `fontFamily: "Press Start 2P"` y `fontSize: "24px"`

### Requirement: Indicador de zona actual
El sistema MUST mostrar en el HUD el nombre de la zona que contiene el puntero del ratón cuando el cursor está sobre una zona o room nombrados, y MUST limpiar el indicador cuando el cursor sale de cualquier zona.

#### Scenario: Hover sobre zona Cocina
- GIVEN una oficina con una zona `name="Cocina"`
- WHEN el usuario mueve el ratón sobre el área de Cocina
- THEN el HUD muestra "📍 Cocina"

#### Scenario: Salir de cualquier zona
- GIVEN el cursor estaba sobre una zona y se mueve fuera
- WHEN no contiene ninguna zona
- THEN el indicador del HUD queda vacío
