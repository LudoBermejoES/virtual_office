# Diseño: Image Collection mode para `spritesheet`

## Por qué dos modos en vez de uno

Atlas y Image Collection resuelven problemas distintos:

- **Atlas** (modo actual) optimiza HTTP requests y memoria GPU pegando todo en una textura. Solo viable si todos los frames comparten tamaño.
- **Collection** preserva PNGs originales con sus tamaños. Más requests pero soporta tamaños mezclados sin trampa.

Forzar a uno solo de los dos limita casos de uso. Detección automática mantiene UX simple para el caso común y permite mezclar cuando hace falta.

## Layout de archivos modificado

```
tools/spritesheet/src/
├── cli.ts                ← detecta `.png` vs `.tsx` en output, fuerza modo
├── pipeline.ts           ← rama atlas / rama collection
├── strips.ts             ← (existente)
├── layout.ts             ← (existente, solo para modo atlas)
├── compose.ts            ← (existente, solo para modo atlas)
├── tsx.ts                ← (existente, solo para modo atlas)
├── frame-sizes.ts        ← NUEVO: lee/aplica manifest opcional
├── mode-detection.ts     ← NUEVO: decide atlas vs collection
├── collection-tsx.ts     ← NUEVO: genera XML Image Collection
└── collection-assets.ts  ← NUEVO: copia PNGs a la subcarpeta de output
```

## Detección de modo

`detectMode(strips, frameSizes)` retorna `"atlas" | "collection"`:

```ts
function detectMode(strips: Strip[], frameSizes: FrameSizesManifest): Mode {
  const sizes = strips.map(s => effectiveFrameSize(s, frameSizes));
  const allSquare = sizes.every(s => s.width === s.height);
  const allSame = sizes.every(s => s.width === sizes[0].width && s.height === sizes[0].height);
  return allSquare && allSame ? "atlas" : "collection";
}
```

`effectiveFrameSize`:
- Si el manifest declara `<filename>: { frame_width, frame_height }`, úsalo.
- Si no, asumir cuadrado: `frame_size = height` (cuando height ≤ width y `width % height === 0`). Esto cubre el 99% de casos sin manifest.
- Si height > width (vertical) o no múltiplo, error claro.

## Modo collection: pipeline

1. **Listar PNGs** y leer metadatos (igual que ahora).
2. **Cargar `frame_sizes.json`** del input dir si existe.
3. **Computar `effectiveFrameSize` por PNG** y sus `frame_count`, `row_count`.
4. **Generar lista lógica de "tiles"**: una entrada por (PNG × fila). Igual que ahora pero respetando `frame_width × frame_height` propios.
5. **Crear subcarpeta `<output>_assets/`** y copiar cada PNG fuente tal cual (sin recortar, sin recomponer).
6. **Generar el `.tsx` Image Collection** referenciando cada PNG con ruta relativa, declarando properties (`name`, `frame_width`, `frame_height`, `frame_count`) y la animación cuando frame_count > 1.

Diferencia clave con modo atlas: **no se compone una imagen única**. Los PNGs originales son la salida.

## Estructura del `<tile>` en collection

Cada PNG fuente con N filas produce N entradas `<tile>`:

```xml
<tile id="<i>">
  <properties>
    <property name="name" value="<basename>__row<row>"/>
    <property name="frame_width" type="int" value="..."/>
    <property name="frame_height" type="int" value="..."/>
    <property name="frame_count" type="int" value="..."/>
    <property name="row_index" type="int" value="..."/>
  </properties>
  <image source="<output>_assets/<filename>" width="<W>" height="<H>"/>
  <animation>
    <frame tileid="<i>" duration="<d>"/>
    ...
  </animation>
</tile>
```

Notas:

- `tileid` en `<animation>` apunta al **mismo `id` del tile padre** porque en Image Collection cada tile es una imagen completa: la animación interna (entre los frames del strip) la maneja Phaser usando `frame_width/frame_height/frame_count` de las properties, no Tiled. **El `<animation>` aquí es decorativo**, no lo usa Phaser pero Tiled lo muestra y otros tools pueden leerlo.

  Alternativa: omitir `<animation>` en modo collection y dejar las properties como única fuente. Más limpio. **Decisión: omitir animation en collection mode**, las properties son suficientes.

- Para sprites de un solo frame (`frame_count = 1`), igual: properties + image, sin animation.

## Frame sizes manifest

Formato JSON simple:

```json
{
  "cat.png": { "frame_width": 144, "frame_height": 48 },
  "butterfly.png": { "frame_width": 48, "frame_height": 48 }
}
```

- Solo se usa si existe `frame_sizes.json` en el input dir, o si `--frame-sizes <path>` lo apunta.
- Si un PNG no aparece en el manifest, se asume cuadrado (heurística por height).
- Si el manifest declara dimensiones inconsistentes (`width % frame_width != 0`), error claro.

## Output flexible

Detección por extensión de `<output>`:

- `output.png` o `output.webp` → fuerza modo atlas.
- `output.tsx` → fuerza modo collection.
- `output` (sin extensión) → autodetect.

Flags `--atlas` / `--collection` sobrescriben.

## Backwards compatibility

- 28 tests existentes pasan sin modificación: caso "todos PNGs 48x48 strip" sigue siendo atlas.
- Comando del README sin `--frame-sizes` y con tods cuadrados → comportamiento idéntico.
- El nombre del output sigue siendo configurable.

## Riesgos

### Detección errónea cuando el filename engaña

`animated_cat_48x48.png` con frames de 144×48: el filename dice "48x48" pero los frames son rectangulares. Sin manifest, la herramienta lo trataría como 36 frames de 48×48 (válido por heurística height=width=48), produciendo animación rota.

**Mitigación**: el manifest. Si el usuario sabe que el cat es 144×48, lo declara. Si no, la herramienta no puede adivinarlo.

**Documentar claramente** en el README: "Si tus sprites tienen frames rectangulares, usa un `frame_sizes.json`".

### Subcarpeta `_assets` muy llena

309 PNGs copiados son ~3 MB. Aceptable. No optimizamos prematuramente.

### Conflicto si el directorio output ya tiene archivos

Los PNGs se copian con `writeFile`. Si ya existen, se sobrescriben. Comportamiento esperado en re-runs.

## Tests

- `mode-detection.test.ts`: 3 cuadrados iguales → atlas. 2 cuadrados + 1 rectangular del manifest → collection. Sin manifest, todo cuadrado → atlas.
- `frame-sizes.test.ts`: parser JSON, validación de dimensiones, fallback a cuadrado.
- `collection-tsx.test.ts`: XML correcto, properties incluidas, ruta relativa al `_assets`.
- `collection-assets.test.ts`: PNGs copiados al subdir, mismos bytes que original.
- `pipeline.test.ts` ampliado: e2e con manifest produce TSX collection + subcarpeta.
