---
name: tmj-optimize
description: Optimiza bundles Tiled (.tmj + tilesets PNG/WebP) del proyecto Virtual Office extrayendo sólo los tiles realmente usados y generando un atlas WebP compacto. Úsala siempre que el usuario mencione optimizar, compactar, reducir o "limpiar" un mapa Tiled; suba un `.tmj` con un tileset grande; tenga un PNG de tileset que pesa varios MB pero usa pocos tiles; se queje de que el mapa pesa mucho, tarda en cargar o consume mucha memoria; o reporte que el mapa optimizado se ve vacío/transparente/roto en Phaser. También aplica cuando el usuario habla de bundles `mapas/*.tmj`, de la utilidad `pnpm tmj-optimize`, o pregunta cómo reducir el tamaño de los assets del mapa.
---

# tmj-optimize

CLI del proyecto Virtual Office para reducir el peso de los bundles Tiled descartando tiles no usados y produciendo un único atlas WebP.

## Cuándo invocar la herramienta

- El usuario sube o referencia un `.tmj` y un PNG/WebP de tileset (`mapas/*.tmj`, `data/maps/*.tmj`, etc.).
- Pregunta cómo reducir el peso del bundle, o lo menciona indirectamente ("este mapa pesa mucho", "el tileset es enorme", "solo uso X tiles").
- Tiene un mapa optimizado pero "se ve vacío" o "transparente" en Phaser → ver sección de troubleshooting.
- Va a desplegar/subir un mapa nuevo a la app y quiere asegurarse de que está minimizado.

Si el usuario sólo pregunta sin pedir acción, explica brevemente qué hace `tmj-optimize` y ofrece ejecutarlo. No lo ejecutes sobre archivos del usuario sin su confirmación si la ejecución implica sobrescribir algo.

## Cómo ejecutarla

Desde la raíz del repo:

```bash
pnpm tmj-optimize <input.tmj>
```

Genera junto al input dos archivos:
- `<basename>.optimized.tmj`
- `<basename>.optimized.webp`

### Flags

| Flag | Default | Cuándo usarla |
|------|---------|---------------|
| `--out-dir DIR` | mismo dir del input | Para no mezclar el original con el optimizado |
| `--padding N` | `0` | Si hay bleeding entre tiles al hacer zoom no entero (probar `2`) |
| `--lossless` | activo | Default. Pixel-art y cualquier mapa estilizado |
| `--lossy --quality N` | — | Solo para tilesets de aspecto fotográfico/grandes gradientes |

### Ejemplo end-to-end

```bash
pnpm tmj-optimize mapas/teimas.tmj
# Salida típica:
# Tiles totales en tilesets originales: 36924
# Tiles usados (incluyendo animaciones): 83
# Reducción del área del atlas: 99.8% (85072896 → 207360 px²)
# Tamaño WebP final: 5.1 KB (lossless)
```

## Qué hace internamente

1. Parsea el TMJ con Zod (rechaza tilesets externos `.tsx`, mapas `infinite`, orientaciones no `orthogonal`).
2. Recorre `tilelayer.data` y los `objectgroup` con tile-objects para construir el conjunto de GIDs realmente usados.
3. Cierre transitivo por animaciones: si un tile tiene `animation`, incluye también los tiles destino.
4. Asigna nuevos `localId` ordenando por `(tilesetIndex, sourceLocalId)` ASC (determinista).
5. Compone el atlas con `sharp.composite()` y lo guarda como WebP.
6. Reescribe el TMJ con un único tileset apuntando al WebP, remapeando cada GID y preservando los bits de flip (`0xE0000000`). Tile-properties y animaciones migran al nuevo `localId`. Object layers de rectángulos/points (`desks`, `voice_rooms`) se preservan intactos.

## Después de optimizar: subir a la app

El admin del Virtual Office sube bundles vía panel HTML, no por CLI. Tras generar `<x>.optimized.tmj` y `<x>.optimized.webp`, indícale al usuario:

1. Abrir la app (`https://teimas.ludobermejo.es` o `http://localhost:5173`).
2. Botón ⚙ del HUD → pestaña **OFICINAS** → "Actualizar mapa ▼" en su oficina.
3. En el campo `Mapa .tmj` seleccionar `<x>.optimized.tmj`, en `Tilesets` el `<x>.optimized.webp` (uno solo).
4. "GUARDAR".

Si los marcadores `desks`/`voice_rooms` están en el mismo TMJ, el backend re-importará puestos manteniendo labels existentes (T1, T2, ...). No se pierden reservas.

## Troubleshooting

### `external_tileset_not_supported`
El TMJ referencia un `.tsx`. Solución: en Tiled, `Map → Convert to embedded` y volver a guardar el `.tmj` antes de optimizar.

### `infinite_not_supported`
El TMJ tiene `infinite: true`. En Tiled, `Map → Resize Map` para fijar dimensiones, o desmarca `Infinite` en `Map Properties`.

### `only_orthogonal_supported`
Solo orthogonal. Mapas isométricos / hexagonales no se soportan.

### El mapa optimizado se ve **vacío o transparente** en Phaser
El frontend Phaser hace `addTilesetImage(basename(image_filename))`. Si el `tilesets[0].name` del TMJ no coincide con el basename del WebP, Phaser falla silenciosamente. La herramienta ya genera `name` derivado del basename del fichero (p.ej. `teimas.optimized` para `teimas.optimized.webp`). Si manualmente editas el TMJ, mantén esa convención.

### Aparece el mismo tile repetido donde no debería
Probablemente animaciones rotas. Confirma que `tilesets[].tiles[].animation` apunta a `tileid` válidos y que el TMJ original no tenía corrupción.

### Tamaño del WebP no baja
- Si tu tileset es realista/fotográfico, prueba `--lossy --quality 80`.
- Si la mayoría de los tiles ya estaban en uso (mapa muy denso), la reducción será baja por construcción.

## Limitaciones conocidas

- No re-optimiza ya optimizados (corre, pero la reducción será 0%).
- No soporta tilesets externos `.tsx` ni mapas `infinite` (errores claros).
- No deduplica tiles visualmente idénticos (sería un escaneo pixel-a-pixel).
- No "extruye" bordes; sólo padding transparente con `--padding`.

## Tests

Hay 42 tests unit en `tools/tmj-optimize/tests/`. Para correrlos:

```bash
pnpm --filter @virtual-office/tmj-optimize test
```

Si modificas el pipeline, ejecuta también el typecheck del workspace:

```bash
pnpm --filter @virtual-office/tmj-optimize typecheck
```

## Más detalle

- Spec OpenSpec archivada: `openspec/changes/archive/2026-05-06-022-tmj-optimizer-cli/`
- Capability `herramientas`: `openspec/specs/herramientas/spec.md`
- README del workspace: `tools/tmj-optimize/README.md`
- Para errores no listados, ver `references/troubleshooting.md`.
