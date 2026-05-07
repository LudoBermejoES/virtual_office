## Context

El change 023 introdujo la convención: object layers cuyo nombre empieza por `sprites_` se procesan al cargar la oficina (`OfficeScene`) creando `Phaser.GameObjects.Sprite` con `setDepth(layerIndex)`. Cada Point tiene properties `sprite` (id en `SPRITE_MANIFEST`) y opcional `tag` (animación Aseprite).

Hasta ahora estos layers se editan **fuera del navegador**, en Tiled escritorio, y se vuelcan al servidor con el upload de mapa completo (change 005). Eso tiene fricción: requiere instalar Tiled, conocer la convención de naming, escribir properties a mano, y subir un `.tmj` nuevo cada vez.

Este change añade un **editor online dedicado a esa convención**, que vive en el admin panel y trabaja sobre el TMJ ya subido de la oficina actual. Ámbito acotado: solo manipula object layers `sprites_*`. El resto del TMJ (tilelayers, `desks`, `voice_rooms`, `npcs`, tilesets, properties de tiles) es **inmutable** desde aquí.

## Goals / Non-Goals

**Goals**

- Que un admin pueda añadir/mover/borrar sprites en el mapa sin abrir Tiled.
- Round-trip seguro: el TMJ resultante es idéntico al de entrada salvo por las capas `sprites_*` editadas.
- Reutilizar la pipeline de render existente (`renderTiledSprites`) para previsualización.
- Persistencia explícita: nada se guarda automáticamente; el admin pulsa "Guardar".
- Detectar conflictos cuando dos admins editan a la vez (último gana es inaceptable porque puede borrar trabajo del otro).

**Non-Goals**

- No es un Tiled completo. NO se editan tilelayers ni terrain ni propiedades de tiles.
- NO se editan los object layers del sistema (`desks`, `voice_rooms`, `npcs`). Esos siguen sus propios flujos (changes 006, 014, 019, etc.).
- NO se gestionan tilesets ni se suben PNGs nuevos.
- NO hay colaboración en tiempo real (sin OT/CRDT). El locking es optimista sobre hash.
- NO se versionan los cambios (sin historial persistente). Solo undo/redo en memoria durante la sesión.
- NO se gestiona el catálogo de sprites desde aquí (el `SPRITE_MANIFEST` se sigue editando en código; gestionar sprites por UI es un change futuro).

## Decisiones

### Decisión 1: Replace completo de capas `sprites_*` en cada PATCH

El endpoint `PATCH /api/offices/:id/map/sprites-layers` recibe **el conjunto completo de object layers `sprites_*`** (no un diff por operación). El servidor:

1. Carga el `.tmj` actual.
2. Verifica el `expected_hash` (sha256 del archivo en disco) que envía el cliente.
3. Elimina del TMJ todos los layers cuyo `name` empiece por `sprites_`.
4. Inserta en su lugar los layers que llegaron en el body, **respetando el orden** que indica el cliente (depth = índice).
5. Vuelve a serializar el JSON con la misma indentación (2 espacios) y reescribe el archivo.
6. Devuelve el nuevo hash.

**Por qué replace en vez de diff**: simplifica enormemente la lógica del servidor (no hay merge, no hay reorderings parciales, no hay cambios de id de Point). El payload es pequeño (decenas de Points como mucho). El cliente ya tiene el estado completo en memoria.

### Decisión 2: Orden completo de capas controlado por el cliente

El depth de un sprite se deriva del **índice del layer en `tmj.layers[]`** (heredado del change 023). Para que el editor sea útil el admin necesita poder **intercalar** capas `sprites_*` entre tilelayers y otros object layers (ej: poner `sprites_jardin` entre `ground` y `furniture` para que la mesa tape al gato).

El editor permite por tanto reordenar **todas** las capas del TMJ, incluidas las del sistema (tilelayers, `desks`, `voice_rooms`, `npcs`). Lo que NO permite es:

- Renombrar capas del sistema (sus nombres son contratos con otros subsistemas — ver changes 006, 014, 019).
- Borrar capas del sistema.
- Editar el contenido de capas del sistema (tilelayer.data, objetos de desks, etc.).
- Crear capas que no sean `sprites_*`.

Adicionalmente el editor permite hacer **toggle de visibilidad** en cualquier capa (incluida una del sistema) y eso se persiste en el TMJ vía `visible: false` (Tiled lo soporta nativamente y los renderers lo respetan).

**Contrato PATCH**: el cliente envía `layer_order: string[]` con los nombres de **todas** las capas en el nuevo orden, más `sprites_layers: Record<name, SpritesLayer>` con la definición completa de cada capa `sprites_*` y `layers_visibility: Record<name, boolean>` con los toggles cambiados. El servidor:

1. Reorganiza `tmj.layers[]` siguiendo `layer_order`.
2. Para cada nombre en `layer_order` que sea capa del sistema, busca la capa original por nombre y la coloca tal cual.
3. Para cada nombre en `layer_order` que sea `sprites_*`, sustituye con la definición de `sprites_layers[name]`.
4. Aplica `visible` según `layers_visibility` (si una capa no aparece ahí, mantiene su visibilidad anterior).

Validación server-side: `layer_order` debe contener **exactamente** el conjunto `{ todas las capas del sistema del TMJ original } ∪ { todas las claves de sprites_layers }`. Sin huecos, sin nombres extra. Si falta una capa del sistema o sobra una desconocida → 400.

### Decisión 3: Edición desacoplada del render principal

El editor usa una **escena Phaser separada** (`MapEditorScene`) y NO la `OfficeScene` viva. Esto permite:

- Estado de edición (sprite seleccionado, drag) sin interferir con UI normal.
- Salir del editor sin necesidad de reset complejo.
- Tests e2e más sencillos (la escena se monta solo en `/admin/map-editor`).

La escena reusa los helpers `preloadTiledSprites` + `renderTiledSprites` para el primer pintado, y luego mantiene los sprites en un mapa `editorId → Phaser.GameObjects.Sprite` para mover/borrar.

### Decisión 4: Identificadores efímeros del cliente

Tiled da a los objects un `id` numérico global. El editor asigna `id` nuevos solo a objects creados (incrementando desde `max(id)+1` del TMJ original). Cuando se borra y vuelve a crear el mismo Point lógico, recibe un id nuevo: NO intentamos preservar el id original. Esto evita reconciliación complicada y es consistente con el comportamiento de Tiled cuando se duplica/recrea.

### Decisión 5: Conflict detection con sha256 del fichero

El cliente recibe en `GET /api/offices/:id/map/raw` el `tmj_hash` (sha256). Lo envía de vuelta en `PATCH ... { expected_hash, layers }`. Si no coincide con el actual en disco, el servidor responde `409 conflict` con el hash actual y el cliente ofrece recargar.

**Por qué sha256 en vez de mtime**: mtime es frágil con sistemas de archivos / despliegues / git checkouts. Hash es determinista.

**Filename del TMJ estable**: el upload original (change 005) guarda el TMJ con nombre `map_<sha256[:12]>.tmj` derivado del contenido. Eso rompe la edición porque cada PATCH cambiaría el filename → invalidaría las URLs cacheadas en clientes con la oficina abierta y obligaría a actualizar `offices.tmj_filename` en cada guardado.

**Decisión confirmada**: cambiar `computeTmjFilename` a un nombre **estable** (`map.tmj`) por oficina. El `tmj_hash` del contenido se devuelve aparte en la respuesta del endpoint. Esto:

- Mantiene la URL del fichero estable: clientes ya abiertos siguen funcionando.
- Simplifica el PATCH: reescribir `map.tmj` in-place.
- Mantiene la integridad: el hash sigue detectando conflictos a nivel de contenido.
- **Migración**: oficinas existentes tienen `tmj_filename = "map_<hash>.tmj"`. Se ejecuta una migración en el arranque del backend (junto a las migraciones SQL existentes) que para cada oficina con filename viejo: `mv` del fichero a `map.tmj` y `UPDATE offices SET tmj_filename = 'map.tmj'` en la misma transacción. Idempotente: si ya está migrada, no hace nada. Implementación TS (no SQL puro porque toca disco).

### Decisión 6: Validación con Zod en el borde

Schema:

```ts
const SpritesLayerSchema = z.object({
  name: z.string().regex(/^sprites_[a-z0-9_]+$/),
  type: z.literal("objectgroup"),
  visible: z.boolean().optional(),
  opacity: z.number().min(0).max(1).optional(),
  objects: z.array(z.object({
    id: z.number().int().positive(),
    point: z.literal(true),
    x: z.number(),
    y: z.number(),
    properties: z.array(z.object({
      name: z.enum(["sprite", "tag"]),
      type: z.literal("string"),
      value: z.string().min(1),
    })).min(1),
  })),
});

const PatchBody = z.object({
  expected_hash: z.string().regex(/^[a-f0-9]{64}$/),
  layers: z.array(SpritesLayerSchema),
});
```

Adicionalmente, el servidor valida que cada `properties[].sprite` exista en el `SPRITE_MANIFEST` server-side (espejo del cliente, vive en `packages/shared/sprite-manifest.ts`). Eso impide que un cliente comprometido inserte ids arbitrarios.

### Decisión 7: Manifest compartido en `packages/shared`

Se mueve `SPRITE_MANIFEST` de `frontend/src/render/sprite-manifest.ts` a `packages/shared/src/sprite-manifest.ts`. Tanto frontend como backend lo importan. Justificación: el backend necesita validar ids al guardar, y mantener dos copias divergiría.

### Decisión 8: Undo/redo local con stack de snapshots

Cada operación atómica (insertar, mover, borrar, cambiar tag, crear/borrar capa) push-ea un snapshot completo del estado de capas `sprites_*` al stack. Tope a 50 entradas. Atajos `Ctrl+Z` / `Ctrl+Shift+Z`. No se persiste; al salir del editor se pierde.

### Decisión 9: Sin auto-save, con dirty flag

El editor mantiene un `isDirty` flag. Si el admin intenta navegar fuera con cambios sin guardar, se muestra confirm dialog. El botón "Guardar" envía el PATCH; "Descartar" recarga del servidor.

### Decisión 10: Drag granular al pixel, no al tile

Mover sprites se hace al pixel (snap opcional al tile con tecla `Shift` mantenida). Tiled permite ambos modos; nuestros sprites no están alineados a grid (un gato puede estar en `(123, 87)`), así que el default es libre.

## Risks / Trade-offs

- **Reescritura del TMJ entero**: en cada PATCH reescribimos el archivo. Si dos admins guardan casi a la vez, el primero gana y el segundo recibe 409. Aceptable para el volumen esperado (≤5 admins por oficina, edición ocasional).
- **Hash file-level no contenido**: si un proceso externo (tmj-optimize, despliegue) reescribe el TMJ con el mismo contenido lógico pero distinto hash (whitespace, orden de keys), invalida sesiones de edición abiertas. Mitigación: documentar que el editor es la única vía de modificar `sprites_*`; otros flujos usan endpoints distintos.
- **Phaser para edición**: Phaser está pensado para juego, no edición. Hit-testing y drag funcionan pero requieren cuidado con `setInteractive` y bounds. Si en el futuro queremos selección múltiple con rectángulo lasso, etc., probablemente migremos a una capa DOM/SVG superpuesta. De momento, picking simple basta.
- **Manifest compartido**: mover `SPRITE_MANIFEST` rompe el import existente. Hay que actualizar `OfficeScene` y los tests del 023. Bajo coste.
- **Sin colaboración real**: dos admins editando = uno pierde sesión. Aceptable a corto plazo; si crece el equipo de admins, pasar a CRDT/WS.

## Migration Plan

1. Mover `SPRITE_MANIFEST` a `packages/shared/src/sprite-manifest.ts` y re-exportar en frontend para no romper imports existentes.
2. Añadir `expected_hash` calculado en `GET /api/offices/:id/map/raw` (cambio aditivo).
3. Implementar `PATCH .../map/sprites-layers` con replace + validación.
4. Añadir entrada en el admin panel "Editor de sprites" (botón nuevo).
5. Implementar `MapEditorScene` + paneles overlay. Las primeras versiones pueden no tener undo/redo; añadirlo en la última tarea.
6. Tests por Scenario en orden: validación servidor → render editor → interacciones → conflictos → undo.

## Open Questions

- ¿Permitimos que un admin renombre un layer `sprites_*` (ej. `sprites_floor` → `sprites_decoration`)? **Decisión preliminar**: sí, con validación regex. Renombrar = borrar el viejo, insertar el nuevo en la misma posición.
- ¿Mostramos los object layers del sistema (`desks`, `voice_rooms`) como overlay informativo (rectángulos en el canvas) para que el admin sepa dónde NO poner sprites encima? **Decisión preliminar**: sí, en modo solo-lectura con opacidad 0.3.
- ¿Vista previa de animaciones en el panel de sprites? **Decisión preliminar**: sí, cargar el aseprite y mostrar el sprite animado a tamaño reducido. Reutilizar `createFromAseprite`.
