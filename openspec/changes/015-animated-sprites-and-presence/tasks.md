# Tareas: sprites animados y presencia

## 1. Tiles animados Tiled

- [ ] 1.1 Crear migración `0005_tileset_animations.sql` con columna `animations_json` en `office_tilesets`.
- [ ] 1.2 Extender el parser `office-map.parser.ts` para extraer `tilesets[*].tiles[*].animation`.
- [ ] 1.3 Persistir el array de animaciones por tileset.
- [ ] 1.4 (test integration) Mapa con tile animado se persiste y devuelve el array intacto en `GET /api/offices/:id`.
- [ ] 1.5 (test e2e) Mapa con un tile animado de 4 frames a 200 ms muestra la animación visualmente.

## 2. Sprite del usuario sentado

- [ ] 2.1 Asset `frontend/public/assets/sprites/desk-sit.png` (128×48, 4 frames de 32×48). Generar con script o descargar opensource.
- [ ] 2.2 Carga del spritesheet en `BootScene.preload`.
- [ ] 2.3 Definir animación `desk-sit-idle` (4 fps, repeat -1) en `OfficeScene`.
- [ ] 2.4 Crear `frontend/src/render/seat-sprite.ts` con `placeSeatSprite(scene, x, y, user)` que aplica tinta determinística.
- [ ] 2.5 Reposicionar avatar circular a `y - 28` cuando hay sprite sentado.
- [ ] 2.6 Integrar `placeSeatSprite` en `OfficeScene.renderDesks` para desks con booking.
- [ ] 2.7 (test unit FE) `placeSeatSprite` aplica el tint correcto para un userId dado.

## 3. NPCs decorativos

- [ ] 3.1 Assets para `cat-idle`, `bird-idle`, `roomba-idle`, `plant-sway`. Descargar de fuentes CC0 (OpenGameArt o Itch.io).
- [ ] 3.2 Carga de los spritesheets NPC en `BootScene.preload`.
- [ ] 3.3 Definir las animaciones `npc-cat-idle`, `npc-bird-idle`, etc. con sus tasas de frame específicas.
- [ ] 3.4 Parser backend extrae object layer `npcs`; valida `sprite` contra enum, descarta valores desconocidos con warning.
- [ ] 3.5 Cota dura: máx 50 NPCs por oficina; 413 si se excede.
- [ ] 3.6 Render `OfficeScene.renderNpcs` los dibuja al cargar la escena.
- [ ] 3.7 (test integration) Subir mapa con `sprite="cat-idle"` lo persiste; con `sprite="dragon"` lo descarta.

## 4. Pool de sprites

- [ ] 4.1 Crear `frontend/src/render/sprite-pool.ts` con cap configurable (default 100).
- [ ] 4.2 Recomputar el conjunto activo cada 500 ms o en `cameraMove`.
- [ ] 4.3 Sprites fuera del cap se dejan en frame 0 (no se destruyen, no se animan).
- [ ] 4.4 (test unit FE) Con 150 sprites simulados y cap=100, exactamente 100 están animados.
- [ ] 4.5 En entorno de test, cap configurable a 10.

## 5. Documentación

- [ ] 5.1 Sección en `doc/fe/THEME.md` sobre sprites: cómo añadir uno nuevo, atribución CC0.
- [ ] 5.2 Sección en `doc/be/README.md` sobre object layer `npcs` y enum permitido.
- [ ] 5.3 Capturas: oficina sin sprites vs con sprites, en `doc/fe/img/`.

## 6. Verificación

- [ ] 6.1 `pnpm test` en verde.
- [ ] 6.2 `pnpm e2e:chromium` en verde, incluyendo el test de tile animado.
- [ ] 6.3 Inspección manual: mapa de prueba con cat, plant y un desk ocupado; las tres animaciones corren simultáneamente sin tirones.
- [ ] 6.4 `openspec validate --all --strict` en verde.
