# Propuesta: Sprites animados y presencia viva

## Motivación

Hoy los puestos son cuadrados estáticos y la oficina parece un plano CAD. Tiled soporta tiles animados (`animation` array por tile) y permite poner sprite spawn points como objects. Aprovechándolo conseguimos:
- **Tiles animados** del propio mapa (ventiladores girando, pantallas con scanline, plantas que se mueven al viento) que el admin define en Tiled sin tocar código.
- **Sprite del usuario**: cada usuario con reserva activa aparece en su puesto como un sprite "sentado" con animación idle.
- **Presencia compartida**: el mapa pasa de "plano" a "oficina viva", reforzando la estética arcade del change 012.

## Alcance

**En scope:**

### A. Tiles animados de Tiled
- El parser del `.tmj` en backend extrae el `animation` array de cada tile y lo almacena en `office_tilesets.animations_json`.
- El frontend usa `Phaser.Tilemaps.AnimatedTile` (built-in en Phaser 4) para reproducir las animaciones automáticamente.

### B. Sprite del usuario sentado
- Spritesheet `desk-sit.png` (idle 4 frames, 32×48 px por frame) cargado desde `public/assets/sprites/`.
- Cuando un desk tiene un booking, se renderiza el sprite con tinta del color determinístico del usuario (ya existe en `avatar-helpers.ts`).
- El avatar circular del change `011` se sigue mostrando, ahora elevado para no chocar con el sprite (centrado encima del sprite, no del cuadrado).
- El sprite usa `roundPixels` y la animación corre a 4 FPS para encajar con el ritmo arcade.

### C. NPCs decorativos opcionales
- Tiled object layer `npcs` con puntos `{ name, sprite }`. Cada uno corresponde a un spritesheet pre-cargado: `cat-idle`, `bird-idle`, `roomba-idle`, `plant-sway`.
- Solo decoración: no afectan a bookings ni a estado.

### D. Render performance
- Pool de sprites: máx 100 sprites animados concurrentes por escena. Si una oficina tiene más bookings que 100, los sprites más alejados del centro de cámara dejan de animarse (siguen visibles, congelados).

**Fuera de scope:**
- Movimiento del usuario (caminar entre puestos) — sería un change posterior y requiere rediseñar el modelo.
- Chat o emotes.
- Custom skins (todos llevan el mismo sprite por ahora; el color los diferencia).

## Dominios afectados

`ui-game` (renderizado), extiende `oficinas` (parser de tilesets animados y NPCs).

## Orden y dependencias

Change `015`. Depende de `005` (mapa Tiled), `007` (bookings) y `011` (avatares).

## Impacto de seguridad

- Nuevos assets servidos desde `/assets/sprites/`. Validación de filename en cliente (no se pasan filenames del usuario al disco).
- El campo `npcs[].sprite` del Tiled MUST ser uno de los sprites pre-registrados (enum); cualquier valor desconocido se ignora silenciosamente.

## Rollback

- Borrar `frontend/src/render/sprite-renderer.ts` y los assets.
- Migración de `office_tilesets`: la columna `animations_json` se ignora si no se usa.
