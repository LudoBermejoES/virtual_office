# Propuesta: Zonas y salas extraídas del mapa Tiled

## Motivación

Actualmente el sistema solo aprovecha del `.tmj` los tiles y el object layer `desks`. Tiled permite definir mucho más: rectángulos con propiedades (salas reunión, cocina, hall), polígonos (zonas), spawn points y regiones interactivas. Hoy un puesto es solo un `(x, y)` aislado; los usuarios no saben "estoy en la zona Mar" ni "esa sala está reservada para la reunión X". Aprovechar las object layers extra acerca el sistema a una "oficina viva" sin tocar el modelo de bookings.

## Alcance

**En scope:**
- Object layers reconocidas en el `.tmj`:
  - `desks` (ya existe).
  - `zones`: rectángulos/polígonos con propiedad `name` y `kind` ∈ `{"open", "meeting", "kitchen", "phone-booth", "hall"}`.
  - `rooms`: rectángulos con `name` (subconjunto de `zones` con paredes; servirán a futuro como base para reservas de sala).
  - `labels`: puntos con `text` y `font` ∈ `{"display", "body"}` para rotular el plano (ej.: "Cocina", "Sala Mar").
- Almacenamiento backend: nueva tabla `office_features` con `(id, office_id, kind, name, geometry_json, properties_json)`. Migración `0004_office_features.sql`.
- Parser: `parseTiledFeatures(tmj)` extrae zonas/salas/labels del object layer y devuelve un array tipado. Se invoca al subir el mapa (extiende `005-office-map-upload`) y al re-subir.
- Endpoint `GET /api/offices/:id` extiende su payload con `features: { zones, rooms, labels }`.
- Renderizado frontend: `ZoneRenderer` dibuja overlays semitransparentes con el color del kind; tooltips muestran `name` al pasar el ratón; los labels se renderizan con la fuente arcade correcta.
- Indicador en HUD: "Estás en zona Mar" si el cursor está sobre un puesto contenido en una zona con nombre.

**Fuera de scope:**
- Reserva de salas (futuro change 020+).
- Permisos por zona.
- Heatmaps de ocupación.

## Dominios afectados

`oficinas` (parser, modelo, endpoint, renderizado).

## Orden y dependencias

Change `014`. Depende de `005-office-map-upload` y `006-desk-zone-drawing` (mapa cargado y desks definidos).

## Impacto de seguridad

Las propiedades extraídas de `.tmj` son texto controlado por el admin que sube el mapa — mismo modelo de confianza que ya existe. Validar:
- `name`: máx 80 chars, sin caracteres de control.
- `kind`: enum estricto.
- `geometry_json`: rectángulo o polígono con coordenadas dentro del mapa.
- Total de features ≤ 200 por oficina (cota dura).

## Rollback

- Borrar el plugin de parser y el endpoint extendido.
- Migración revertible: `DROP TABLE office_features` (no afecta datos de bookings).
