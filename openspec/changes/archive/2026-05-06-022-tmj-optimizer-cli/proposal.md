# Propuesta: CLI para optimizar bundles Tiled (`tmj-optimize`)

## Motivación

Los mapas de Tiled (`.tmj`) que subimos a la app referencian tilesets PNG/WebP **completos**, aunque el mapa real use sólo una fracción de los tiles. El bundle `mapas/Office.png` tiene 848 tiles (768×2544 px, 132 KB), pero el mapa `teimas.tmj` posiblemente use menos del 20%. Esto:

- Aumenta el peso de los assets servidos al cliente sin necesidad.
- Penaliza el primer render en Phaser (más memoria de textura).
- Hace incómodo iterar el mapa en un repo: cada PNG es un activo grande aunque cambie poco.

Queremos una utilidad CLI que tome un `.tmj` con su tileset PNG/WebP y produzca un `.tmj` "compactado" + un único WebP que contenga **solo los tiles realmente usados**, recolocados en una grid mínima, con los GID del mapa remapeados.

## Alcance

**En scope:**

### A. Workspace nuevo `tools/tmj-optimize/`

- Paquete pnpm independiente `@virtual-office/tmj-optimize` (privado, no se publica en npm).
- TypeScript estricto, igual que el resto del proyecto.
- Dependencias mínimas: `sharp` para componer el atlas, `zod` para validar el TMJ.
- `package.json` raíz declara `tools/*` en `workspaces` para que pnpm lo enlace.
- `bin` en el `package.json` del paquete: `tmj-optimize`.

### B. Comando

```
pnpm tmj-optimize <input.tmj> [--out-dir DIR] [--padding N] [--lossless|--lossy] [--quality N]
```

- `<input.tmj>` (obligatorio): ruta al TMJ original. Sus tilesets se resuelven relativos a esa ruta (igual que Tiled).
- `--out-dir DIR` (opcional, default: misma carpeta que input). El output mantiene el basename del input con sufijo `.optimized.tmj` y `.optimized.webp`.
- `--padding N` (opcional, default `0`). Píxeles de gap entre tiles del atlas para evitar bleeding en zoom no entero.
- `--lossless` / `--lossy` (default `--lossless`). El bleeding y los artefactos en mapas de pixel-art son inaceptables → lossless por defecto.
- `--quality N` (default `90`, sólo aplica con `--lossy`).
- `--help` y `--version`.

### C. Pipeline funcional

1. **Parsear** el TMJ con Zod, validando estructura mínima (mapa ortogonal, tilesets embebidos).
2. **Cargar** cada PNG/WebP de tileset con `sharp`, registrar dimensiones y `firstgid`.
3. **Recorrer todas las `tilelayer.data`** acumulando GIDs ≠ 0 (tras enmascarar los bits de flip 0xE0000000).
4. **Recorrer object layers** con objetos que tengan `gid` (tile-objects), añadirlos al set.
5. **Cierre por animaciones**: para cada tile usado que tenga `animation`, añadir todos los `tileid` destino al set. Iterar hasta punto fijo.
6. **Asignar nuevos local IDs** ordenando los GIDs usados por `(tilesetIndex ASC, originalLocalId ASC)`. Mapeo `oldGid → newLocalId`.
7. **Componer el atlas** con `sharp.composite()`:
   - Calcular `cols = ceil(sqrt(N))`, `rows = ceil(N / cols)`.
   - Para cada tile usado, recortarlo del PNG fuente (`extract`) y pegarlo en su posición destino.
   - Aplicar padding entre tiles si `--padding > 0`.
   - Guardar como WebP.
8. **Construir el TMJ optimizado**:
   - Un único `tilesets[]` con `firstgid: 1`, `image: <basename>.optimized.webp`, `columns: cols`, `tilewidth/tileheight` heredados, `imagewidth/imageheight` calculados.
   - Migrar `tiles` (animaciones y properties) al `tileset[0]` con sus nuevos `localId`.
   - Recorrer `tilelayer.data` y reemplazar cada GID por `1 + newLocalId`, preservando los bits de flip.
   - Recorrer object layers tile-objects, remapear `gid`.
   - Object layers de rectángulos/points (`desks`, `voice_rooms`, etc.) **se preservan intactos**.
9. **Escribir** los dos ficheros en `out-dir`.

### D. Validaciones y errores

Aborta con código de salida ≠ 0 y mensaje claro a stderr si:

- TMJ con tilesets externos (`source: "*.tsx"`). Mensaje: `tileset externo no soportado, embeber con Tiled (Map → Convert to embedded)`.
- TMJ con `infinite: true` (chunks). Mensaje: `mapas infinitos no soportados`.
- TMJ con `orientation` distinta de `"orthogonal"`. Mensaje: `solo se soportan mapas ortogonales`.
- Imagen de tileset no encontrada o no PNG/WebP.
- Algún GID en `data` apunta fuera de los rangos de `firstgid` declarados (TMJ corrupto).

### E. Reporte stdout/stderr

Al terminar, imprime resumen:

```
Tiles totales en tilesets originales: 848
Tiles usados (incluyendo animaciones): 124
Reducción del área del atlas: 85% (de 768×2544 a 528×528)
Tamaño WebP final: 14.2 KB (lossless)
TMJ escrito en: mapas/teimas.optimized.tmj
WebP escrito en: mapas/teimas.optimized.webp
```

### F. Tests

- **Unit Vitest** del pipeline puro (sin sharp, sin fs):
  - `extractUsedGids(tmj)` con TMJ minimal.
  - `applyAnimationClosure(used, allTiles)` cierre transitivo.
  - `buildGidMapping(usedGids, tilesets)` produce mapping reproducible y ordenado.
  - `remapGidPreservingFlip(gid, mapping)` preserva 0xE0000000.
  - `buildOutputTmj(input, mapping, atlasInfo)` cuadra dimensiones, animaciones y properties.
- **Integration** con fixture pequeño:
  - `fixtures/tiny.tmj` (4×4, dos tilesets de 2×2) + PNGs generados al vuelo.
  - Ejecutar el pipeline completo, verificar que el WebP existe, dimensiones correctas, TMJ output parsea OK.

### G. Documentación

- `tools/tmj-optimize/README.md` con: qué hace, cómo se ejecuta, flags, limitaciones, ejemplo end-to-end con `mapas/teimas.tmj`.
- Mención en el `README.md` raíz dentro de la sección "Estructura del repo".

**Fuera de scope:**

- Optimizar varios TMJs en un solo comando (basta con `for` en bash).
- Soportar tilesets `.tsx` externos. (Si el usuario los tiene, primero los embebe en Tiled.)
- Optimizar PNGs ya pequeños (la utilidad siempre escribe el WebP, aunque la reducción sea mínima).
- Subir el bundle resultante automáticamente a la oficina (puede hacerlo el admin a mano vía panel).
- Server-side optimization on upload. Si en el futuro se quiere, sería un change aparte que reusa este módulo.

## Operación

- Sin impacto en runtime: el código solo corre on-demand desde la línea de comandos del desarrollador.
- Sin migración SQL.
- Sin secretos.
- Hace falta declarar el workspace `tools/*` en el `pnpm-workspace.yaml`.
- `sharp` tiene binarios nativos pero `pnpm` los gestiona automáticamente; en CI no hay que cambiar nada.
