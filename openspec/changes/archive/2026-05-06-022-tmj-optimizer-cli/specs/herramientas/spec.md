# Herramientas

## Purpose

Define las utilidades CLI de uso interno (no expuestas al runtime) que asisten al desarrollo y operación del proyecto Virtual Office: scripts de mantenimiento, optimización de assets y bootstrap.

## Requirements

## ADDED Requirements

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
