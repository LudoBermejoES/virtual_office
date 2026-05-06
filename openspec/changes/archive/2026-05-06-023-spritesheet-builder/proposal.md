# Propuesta: CLI `spritesheet` para empaquetar tiras animadas en un único PNG + Tileset Tiled

## Motivación

El proyecto consume packs de assets externos (p.ej. *Modern Interiors*) que vienen como **directorios con muchos PNGs**, cada uno representando una **tira horizontal de frames** de una animación (objetos animados, NPCs idle, etc.). Cada frame es típicamente 48×48 px.

Hoy, para usar uno de esos packs en Tiled hay que:

1. Abrir cada PNG manualmente.
2. Apilarlos verticalmente en un editor de imagen.
3. Crear el tileset en Tiled.
4. Añadir manualmente cada animación marcando frames.

Es tedioso, propenso a errores y bloquea iterar. Queremos una herramienta CLI que tome un directorio de strips PNG y produzca:

- Un único **spritesheet PNG vertical** (todos los strips uno bajo el otro).
- Un **Tileset Tiled `.tsx`** con todos los frames como tiles, y una **animación por cada PNG original** que agrupa sus frames consecutivos.

Lo soltaremos al lado del `tmj-optimize` como segunda utilidad de la familia.

## Alcance

**En scope:**

### A. Nuevo workspace `tools/spritesheet/`

- Paquete pnpm `@virtual-office/spritesheet` siguiendo el patrón de `tmj-optimize` (TypeScript estricto, `sharp` + `zod`, `tsx`, `vitest`).
- `bin: spritesheet` y atajo en root: `pnpm spritesheet <dir> <output.png>`.

### B. Comando

```
pnpm spritesheet <input-dir> <output.png> [opciones]
```

- `<input-dir>` (obligatorio): directorio con los PNGs (top-level por defecto).
- `<output.png>` (obligatorio): ruta del spritesheet resultante. La herramienta escribe también `<output>.tsx` junto a él.
- `--tile N` (default `48`): tamaño de frame cuadrado (alto y ancho).
- `--duration N` (default `200`): ms por frame en la animación Tiled.
- `--webp` (default off): salida WebP lossless en lugar de PNG.
- `--recursive` (default off): recorrer subdirectorios.
- `--help`, `--version`.

### B.1 Soporte de PNGs con varias filas (grids 2D)

Los packs reales (p.ej. *Modern Interiors*) traen muchos PNGs con varias filas: una animación por fila, con cada fila siendo una variante (diferente color, dirección, o estado). La herramienta detecta esto automáticamente:

- Si un PNG tiene `height === tile`: una sola fila, una sola animación. La animación lleva el nombre del basename del PNG.
- Si un PNG tiene `height === N * tile` con N > 1: el PNG es una grid de N filas × M columnas. Se generan N animaciones independientes, una por cada fila. Los nombres de animación son `<basename>__row<i>` (i = 0..N-1).

En ambos casos las animaciones se apilan en el spritesheet final como filas separadas, igual que el caso simple.

### C. Pipeline

1. Listar todos los `*.png` (y `*.webp` si los hay) del directorio en orden alfabético por filename.
2. Para cada PNG:
   - Leer dimensiones con `sharp`.
   - Validar `imageheight === tile` (debe ser una tira horizontal de un único renglón).
   - Validar `imagewidth % tile === 0` (múltiplo del tamaño de frame).
   - Calcular `frameCount = imagewidth / tile`.
3. Calcular dimensiones del spritesheet:
   - `outWidth = max(imagewidth de cada PNG)` redondeado a múltiplo de `tile`.
   - `outHeight = sum(tile)` × cada PNG.
   - `cols = outWidth / tile`, `rows = N` (un PNG por fila).
4. Componer el spritesheet con `sharp.composite()`. Cada PNG se pega en `(0, fila * tile)`. Las filas con PNG más estrecho dejan transparencia a la derecha.
5. Guardar como PNG (o WebP si `--webp`).
6. Construir el `.tsx` (XML) con Tiled spec:
   - `image="<basename del output>"` con `imagewidth` / `imageheight`.
   - `tilewidth=tile`, `tileheight=tile`, `columns=cols`, `tilecount = cols * rows`.
   - Para cada PNG con `frameCount > 1`: declarar un `<tile id="<primer localId del strip>">` con `<animation>` listando `<frame tileid="<localId>" duration="<duration>"/>` para cada frame.
   - Para cada PNG con `frameCount === 1`: incluir `<tile id="..."><properties><property name="name" value="<basename sin ext>"/></properties></tile>` para que sea localizable en Tiled.
   - El primer tile de cada animación lleva además `properties.name = basename sin extensión` para identificarla.

### D. Validaciones

Aborta con código ≠ 0 y mensaje claro si:

- El directorio no existe o está vacío.
- Algún PNG no se puede leer.
- Algún PNG tiene `height % tile ≠ 0` o `width % tile ≠ 0` (mensaje incluye filename y dimensiones leídas).
- El output ya existe y no es seguro sobrescribir (advertencia, no bloqueo: por defecto sobrescribe).

### E. Reporte stdout

```
Procesando: 12 PNGs en /Users/.../3_Animated_objects
Frames totales: 84 (cols=10, rows=12)
Animaciones generadas: 9 (3 strips de un solo frame se incluyen como tile estático)
Spritesheet: out/animated.png (1.2 MB)
Tileset: out/animated.tsx
```

### F. Output `.tsx` ejemplo

```xml
<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.12.1" name="animated"
         tilewidth="48" tileheight="48" tilecount="84" columns="10">
  <image source="animated.png" width="480" height="576"/>
  <tile id="0">
    <properties>
      <property name="name" value="chair_swivel"/>
    </properties>
    <animation>
      <frame tileid="0" duration="200"/>
      <frame tileid="1" duration="200"/>
      <frame tileid="2" duration="200"/>
    </animation>
  </tile>
  <tile id="10">
    <properties>
      <property name="name" value="lamp_blink"/>
    </properties>
    <animation>
      <frame tileid="10" duration="200"/>
      <frame tileid="11" duration="200"/>
    </animation>
  </tile>
</tileset>
```

### G. Tests

Unit Vitest del pipeline puro:

- `listStrips(dir, recursive)` lista PNGs en orden alfabético.
- `validateStrip(meta, tile)` acepta strips válidas y rechaza con mensaje claro las inválidas.
- `computeLayout(strips, tile)` produce `{cols, rows, outWidth, outHeight, placements}` correcto.
- `buildTsxXml(layout, options)` produce XML válido con animaciones agrupadas, contadores correctos, properties en el primer tile.

Integration con fixtures generados al vuelo (sharp.create produce PNGs de 96×48, 144×48, etc.):

- Pipeline e2e crea PNG y .tsx en disco temporal.
- El PNG resultante tiene dimensiones esperadas.
- El XML parsea (con DOMParser u otro) y declara las animaciones esperadas.

### H. Documentación

`tools/spritesheet/README.md` con: qué hace, uso, flags, ejemplo end-to-end con `Modern Interiors` (anonimizado, paths de ejemplo), limitaciones.

Actualizar el README raíz para mencionar la nueva tool en la sección "Estructura del repo".

**Fuera de scope:**

- Strips multi-fila (PNGs ya en grid 2D). En V1 solo strips horizontales.
- Mezcla con sub-carpetas que tengan distintos `tile` (todo el directorio comparte tamaño).
- Generar `.tmj` con un mapa de ejemplo (sólo `.tsx`, que es lo reutilizable).
- Convertir el resultado a un atlas optimizado (eso lo hace `tmj-optimize` luego).
- Detectar duplicados visuales entre PNGs.

## Operación

- Sin impacto runtime, sin migraciones.
- Mismo patrón que `tmj-optimize`; usa `INIT_CWD` para resolver paths relativos cuando se invoca vía `pnpm spritesheet` desde el root.
- `sharp` ya instalado en el monorepo.
