# Herramientas

## Purpose

Define las utilidades CLI de uso interno (no expuestas al runtime) que asisten al desarrollo y operación del proyecto Virtual Office: scripts de mantenimiento, optimización de assets y bootstrap.

## Requirements

### Requirement: Optimizador de bundles Tiled

El proyecto MUST proveer un comando CLI `tmj-optimize` que tome un `.tmj` con sus tilesets y produzca un `.tmj` y un único `.webp` que sólo contengan los tiles realmente usados, recolocados en una grid compacta y con los GIDs del mapa remapeados al nuevo atlas.

#### Scenario: Ejecución básica

- **WHEN** un desarrollador ejecuta `pnpm tmj-optimize mapas/teimas.tmj`
- **THEN** el comando lee el TMJ y sus tilesets, identifica los tiles realmente referenciados en `tilelayer.data` y en object-tiles, y escribe `mapas/teimas.optimized.tmj` y `mapas/teimas.optimized.webp` en el mismo directorio del input

#### Scenario: Atlas compacto

- **WHEN** el TMJ usa N tiles distintos
- **THEN** el WebP resultante contiene exactamente esos N tiles (más sus dependencias por animación), distribuidos en una grid `cols × rows` con `cols = ceil(sqrt(N))` y `rows = ceil(N / cols)`

#### Scenario: GIDs remapeados conservando flip

- **WHEN** un GID original tenía bits de flip horizontal/vertical/diagonal
- **THEN** el GID en el TMJ optimizado conserva esos mismos bits y apunta al nuevo `localId` del tile en el atlas único

#### Scenario: Cierre por animaciones

- **WHEN** un tile usado tiene `animation` con destinos `[A, B, C]`
- **THEN** el atlas incluye también A, B y C aunque no aparezcan directamente en `tilelayer.data`, y la entrada `tiles[].animation` del TMJ output los referencia con sus nuevos `localId`

#### Scenario: Object layers preservados

- **WHEN** el TMJ contiene `objectgroup` con rectángulos, points o text (ej. `desks`, `voice_rooms`)
- **THEN** el TMJ optimizado los copia íntegros, sólo remapeando los `object.gid` cuando se trate de tile-objects

#### Scenario: Tile properties preservadas

- **WHEN** un tile usado tenía `properties` declaradas en `tilesets[].tiles[]`
- **THEN** esas properties aparecen en el TMJ output asociadas al nuevo `localId` del tile

#### Scenario: Tilesets externos rechazados

- **WHEN** el TMJ referencia un tileset externo (`source: "*.tsx"`)
- **THEN** el comando aborta con código de salida ≠ 0 y mensaje a stderr indicando que se debe embeber el tileset en Tiled antes de optimizar

#### Scenario: Mapas infinitos rechazados

- **WHEN** el TMJ tiene `infinite: true`
- **THEN** el comando aborta con mensaje "infinite_not_supported"

#### Scenario: Reporte de reducción

- **WHEN** el comando termina con éxito
- **THEN** imprime a stdout un resumen con: tiles totales en tilesets originales, tiles usados, reducción porcentual del área del atlas y tamaño del WebP resultante

### Requirement: Configuración del optimizador

El comando `tmj-optimize` MUST aceptar flags para controlar la salida sin romper el comportamiento por defecto de "todo en lossless".

#### Scenario: Directorio de salida

- **WHEN** se invoca con `--out-dir DIR`
- **THEN** los ficheros `.optimized.tmj` y `.optimized.webp` se escriben en `DIR` (creando el directorio si no existe), preservando el basename del input

#### Scenario: Padding entre tiles

- **WHEN** se invoca con `--padding 2`
- **THEN** el atlas inserta 2 píxeles transparentes entre tiles adyacentes (sin afectar al primero/último de cada fila/columna), y `tilesets[0].spacing` del TMJ output refleja ese valor

#### Scenario: Modo lossy

- **WHEN** se invoca con `--lossy --quality 80`
- **THEN** el WebP se codifica en modo lossy con calidad 80 en lugar de lossless

#### Scenario: Lossless por defecto

- **WHEN** no se especifican flags de codificación
- **THEN** el WebP se codifica en lossless

#### Scenario: Flags incompatibles

- **WHEN** se invoca con `--lossless --lossy` simultáneamente
- **THEN** el comando aborta con mensaje de error y código ≠ 0

### Requirement: Constructor de spritesheet desde tiras animadas

El proyecto MUST proveer un comando CLI `spritesheet` que tome un directorio con tiras horizontales de frames PNG (cada frame de tamaño fijo cuadrado, default 48×48) y produzca un único spritesheet apilado verticalmente más un Tileset Tiled `.tsx` con una animación por cada PNG fuente.

#### Scenario: Ejecución básica

- **WHEN** un desarrollador ejecuta `pnpm spritesheet <input-dir> <output.png>`
- **THEN** la herramienta lista los PNGs del directorio (alfabéticamente), apila cada uno como una fila del spritesheet, escribe el PNG resultante en `output.png` y un `output.tsx` junto a él

#### Scenario: Layout determinista

- **WHEN** el directorio contiene N PNGs y el strip más ancho tiene M frames
- **THEN** el spritesheet tiene `M*tile` de ancho y `N*tile` de alto, con `cols=M` y `rows=N`, y cada strip se coloca en la fila `i` con `firstLocalId = i*cols`

#### Scenario: Animaciones agrupadas en `.tsx`

- **WHEN** un PNG fuente tiene `frameCount > 1`
- **THEN** el `.tsx` declara un `<tile id="<firstLocalId>"><animation>` con N `<frame tileid="<id>" duration="<duration>"/>`, uno por cada frame del strip, en orden

#### Scenario: Strip de un solo frame

- **WHEN** un PNG fuente tiene un único frame (`frameCount === 1`)
- **THEN** el `.tsx` declara un `<tile>` con `<properties><property name="name" value="<basename sin ext>"/></properties>`, sin elemento `<animation>`

#### Scenario: Identificación de cada animación

- **WHEN** se genera el `.tsx`
- **THEN** el primer tile de cada strip incluye una property `name` con el basename del PNG fuente sin extensión, lo que permite localizar la animación en Tiled por su nombre

#### Scenario: Strip más estrecho que el más ancho

- **WHEN** el directorio mezcla strips de distintos `frameCount`
- **THEN** las filas correspondientes a strips más cortos rellenan con transparencia los slots vacíos a la derecha, sin afectar a las animaciones declaradas

#### Scenario: PNG con grid 2D de varias filas

- **WHEN** un PNG fuente tiene `height === N * tile` con N > 1
- **THEN** la herramienta lo trata como `N` animaciones independientes (una por fila), nombradas `<basename>__row<i>`, y las apila en el spritesheet como `N` filas consecutivas

#### Scenario: Validación de altura múltiplo

- **WHEN** un PNG fuente tiene `height % tile ≠ 0`
- **THEN** el comando aborta con código ≠ 0 indicando el filename y la altura encontrada

#### Scenario: Validación de ancho múltiplo

- **WHEN** un PNG fuente tiene `width % tile ≠ 0`
- **THEN** el comando aborta con código ≠ 0 indicando el filename y la anchura encontrada

#### Scenario: Directorio vacío

- **WHEN** el directorio no contiene PNGs
- **THEN** el comando aborta con error claro (no genera ficheros parciales)

### Requirement: Configuración del constructor de spritesheet

El comando `spritesheet` MUST aceptar flags para configurar el tamaño de frame, la duración de los frames de animación, el formato de salida y el modo recursivo, manteniendo defaults razonables para el caso típico de Modern Interiors (48×48 a 200ms).

#### Scenario: Tamaño de frame personalizado

- **WHEN** se invoca con `--tile 32`
- **THEN** la herramienta valida cada strip contra `tile=32`, calcula el layout con celdas de 32 px y declara `tilewidth=32` y `tileheight=32` en el `.tsx`

#### Scenario: Duración de frame personalizada

- **WHEN** se invoca con `--duration 100`
- **THEN** cada `<frame>` del `.tsx` lleva `duration="100"`

#### Scenario: Formato WebP

- **WHEN** se invoca con `--webp`
- **THEN** el spritesheet se codifica en WebP lossless en lugar de PNG; el `.tsx` apunta al fichero `.webp` correspondiente

#### Scenario: Recursivo

- **WHEN** se invoca con `--recursive`
- **THEN** la herramienta recorre subdirectorios del input-dir; sin la flag se limita al top-level
