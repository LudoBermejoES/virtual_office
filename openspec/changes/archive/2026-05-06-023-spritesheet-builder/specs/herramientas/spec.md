# Herramientas

## ADDED Requirements

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
