# Herramientas

## ADDED Requirements

### Requirement: Modo Image Collection en `spritesheet`

El comando `spritesheet` MUST detectar automáticamente cuándo los strips del directorio tienen frames de tamaños distintos y emitir un Tileset Tiled `.tsx` de tipo Image Collection en lugar del atlas único habitual, preservando los PNGs originales con sus dimensiones nativas.

#### Scenario: Detección automática de tamaños mezclados

- **WHEN** el directorio contiene PNGs cuyos `frame_width`/`frame_height` (deducidos o leídos del manifest) no son todos iguales
- **THEN** la herramienta opera en modo Image Collection: crea una subcarpeta `<output>_assets/`, copia cada PNG sin modificar y genera un `.tsx` que declara `columns="0"` y un elemento `<grid>` para indicar Image Collection a Tiled

#### Scenario: Modo atlas para tamaños homogéneos

- **WHEN** todos los PNGs producen frames del mismo tamaño cuadrado
- **THEN** la herramienta sigue operando en modo atlas (un único PNG/WebP apilado + `.tsx` simple), manteniendo el comportamiento del change 023

#### Scenario: Forzar modo collection

- **WHEN** el usuario invoca con `--collection`
- **THEN** la herramienta opera en modo Image Collection aunque todos los tamaños sean iguales

#### Scenario: Forzar modo atlas con tamaños mezclados aborta

- **WHEN** el usuario invoca con `--atlas` pero los tamaños no son todos iguales
- **THEN** la herramienta aborta con código ≠ 0 indicando que se requiere `--collection` o que los tamaños sean homogéneos

### Requirement: Properties de frame en `<tile>` Image Collection

En modo Image Collection, cada `<tile>` del `.tsx` MUST llevar properties que el frontend consumidor pueda usar para registrar la animación correcta en Phaser sin recalcular dimensiones.

#### Scenario: Properties por tile

- **WHEN** se genera un tile en modo Image Collection
- **THEN** el `<tile>` incluye properties `name` (basename con sufijo `__row<i>` si multi-row), `frame_width`, `frame_height`, `frame_count` y `row_index`

#### Scenario: Imagen referenciada con ruta relativa al subdir

- **WHEN** se genera el `<tile>`
- **THEN** el `<image source>` apunta a `<output_basename>_assets/<filename>` con dimensiones reales del PNG

### Requirement: Manifest de frame sizes

El comando `spritesheet` MUST aceptar un manifest opcional `frame_sizes.json` en el input dir (o vía flag `--frame-sizes <path>`) que declare explícitamente las dimensiones de frame para PNGs cuyos frames no son cuadrados o cuyo tamaño no se puede deducir.

#### Scenario: Manifest presente en input dir

- **WHEN** existe `frame_sizes.json` en el input dir con `{"cat.png": { "frame_width": 144, "frame_height": 48 }}`
- **THEN** la herramienta usa esos valores para `cat.png` al validar y al declarar properties

#### Scenario: Manifest vía flag

- **WHEN** se invoca con `--frame-sizes /path/to/manifest.json`
- **THEN** la herramienta carga el manifest desde esa ruta en lugar de del input dir

#### Scenario: Sin manifest, frames cuadrados

- **WHEN** no hay manifest y un PNG tiene `width % height === 0`
- **THEN** la herramienta asume `frame_size = height` (cuadrado)

#### Scenario: Manifest inconsistente

- **WHEN** el manifest declara `frame_width = 144` pero `png.width % 144 !== 0`
- **THEN** la herramienta aborta con error indicando filename y dimensiones esperadas/encontradas
