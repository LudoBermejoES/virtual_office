# Tareas: sprites animados y presencia

El ciclo TDD por tarea: escribe el test (red) → implementa lo mínimo (green) → refactoriza → marca [x].

## 1. Tiles animados Tiled

- [x] 1.1 (test integration) Mapa con tile animado: se persiste el array de animaciones y se devuelve intacto en `GET /api/offices/:id` — escribir el test primero.
- [x] 1.2 Crear migración `0005_tileset_animations.sql` con columna `animations_json` en `office_tilesets`.
- [x] 1.3 Extender el parser `office-map.parser.ts` para extraer `tilesets[*].tiles[*].animation`.
- [x] 1.4 Persistir el array de animaciones por tileset.
- [x] 1.5 (test e2e) Mapa con un tile animado de 4 frames a 200 ms muestra la animación visualmente en el canvas.

## 2. Sprite del usuario sentado

- [x] 2.1 (test unit FE) `placeSeatSprite` aplica el tint correcto y determinístico para un `userId` dado — escribir el test primero.
- [x] 2.2 (test unit FE) `placeSeatSprite` no renderiza sprite en desks sin booking (caso negativo) — escribir el test primero.
- [x] 2.3 Asset `frontend/public/assets/sprites/desk-sit.png` (128×48, 4 frames de 32×48) — descargar de fuente CC0.
- [x] 2.4 Carga del spritesheet en `BootScene.preload`.
- [x] 2.5 Definir animación `desk-sit-idle` (4 fps, repeat -1) en `OfficeScene`.
- [x] 2.6 Crear `frontend/src/render/seat-sprite.ts` con `placeSeatSprite(scene, x, y, user)`.
- [x] 2.7 Reposicionar avatar circular a `y - 28` cuando hay sprite sentado.
- [x] 2.8 Integrar `placeSeatSprite` en `OfficeScene.renderDesks` para desks con booking.

## 3. NPCs decorativos

- [x] 3.1 (test integration) Subir mapa con `sprite="cat-idle"` lo persiste; con `sprite="dragon"` lo descarta con warning — escribir el test primero.
- [x] 3.2 (test integration) Subir mapa con 51 NPCs devuelve 413 — escribir el test primero.
- [x] 3.3 (test unit FE) `renderNpcs` con objeto NPC de sprite desconocido no añade ningún sprite a la escena — escribir el test primero.
- [x] 3.4 Assets para `cat-idle`, `bird-idle`, `roomba-idle`, `plant-sway` — descargar de fuentes CC0 (OpenGameArt o Itch.io).
- [x] 3.5 Carga de los spritesheets NPC en `BootScene.preload`.
- [x] 3.6 Definir las animaciones `npc-cat-idle`, `npc-bird-idle`, etc. con sus tasas de frame específicas.
- [x] 3.7 Parser backend extrae object layer `npcs`; valida `sprite` contra enum, descarta valores desconocidos con warning.
- [x] 3.8 Cota dura: máx 50 NPCs por oficina; 413 si se excede.
- [x] 3.9 Render `OfficeScene.renderNpcs` los dibuja al cargar la escena.

## 4. Pool de sprites

- [x] 4.1 (test unit FE) Con 150 sprites simulados y cap=100, exactamente 100 están animados — escribir el test primero.
- [x] 4.2 (test unit FE) Sprites fuera del cap están en frame 0 y no animados — escribir el test primero.
- [x] 4.3 Crear `frontend/src/render/sprite-pool.ts` con cap configurable (default 100).
- [x] 4.4 Recomputar el conjunto activo cada 500 ms o en `cameraMove`.
- [x] 4.5 Sprites fuera del cap se dejan en frame 0 (no se destruyen, no se animan).
- [x] 4.6 En entorno de test, cap configurable a 10.

## 5. Documentación

- [x] 5.1 Sección en `doc/fe/THEME.md` sobre sprites: cómo añadir uno nuevo, atribución CC0.
- [x] 5.2 Sección en `doc/be/README.md` sobre object layer `npcs` y enum permitido.
- [ ] 5.3 Capturas: oficina sin sprites vs con sprites, en `doc/fe/img/`.

## 6. Verificación

- [x] 6.1 `pnpm test` en verde.
- [x] 6.2 `pnpm e2e:chromium` en verde, incluyendo el test de tile animado.
- [ ] 6.3 Inspección manual: mapa de prueba con cat, plant y un desk ocupado; las tres animaciones corren simultáneamente sin tirones.
- [x] 6.4 `openspec validate --all --strict` en verde.
