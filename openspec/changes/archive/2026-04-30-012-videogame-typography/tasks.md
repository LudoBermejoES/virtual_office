# Tareas: Videogame Typography

## 1. Tema y paleta

- [x] 1.1 Consolidar variables CSS en `frontend/src/style.css` con la paleta definida en `design.md`.
- [x] 1.2 Crear `frontend/src/render/theme.ts` con constantes hex para Phaser.
- [x] 1.3 Eliminar cualquier color hardcoded fuera del tema en escenas y componentes.
- [x] 1.4 (test unit FE) `theme.ts` exporta todos los colores documentados.

## 2. Tipografías

- [x] 2.1 Auditar todos los `add.text` en escenas; sustituir cualquier `fontFamily` distinto de Press Start 2P o VT323 por la fuente correcta según tipo de texto.
- [x] 2.2 Auditar el HTML overlay; reemplazar cualquier fuente del sistema por `var(--font-display)` o `var(--font-body)`.
- [x] 2.3 Confirmar `setRoundPixels(true)` en todos los textos pixel.

## 3. Botones arcade

- [x] 3.1 Asset `public/assets/ui/frame-9slice.png` con esquinas 16×16.
- [x] 3.2 Helper `arcadeButton(scene, x, y, label, onClick)` en `src/ui/arcade-button.ts`.
- [x] 3.3 Refactor `LoginScene`, modales y HUD para usar `arcadeButton`.
- [x] 3.4 Efecto press: el label baja 2 px en `pointerdown`.

## 4. Sonidos retro

- [x] 4.1 Assets en `public/assets/audio/` (beep-click, beep-booked, beep-error). Volumen <= -12 dB.
- [x] 4.2 `src/ui/sound.ts` con singleton + persistencia `localStorage` del estado mute.
- [x] 4.3 Toggle visual de altavoz en HUD; muted por defecto.
- [x] 4.4 (test unit FE) `sound.toggle()` alterna y persiste.

## 5. Visual regression

- [x] 5.1 Configurar `expect.toMatchSnapshot` con `maxDiffPixelRatio: 0.001`.
- [x] 5.2 (e2e visual) Baseline de `LoginScene` en Chromium Linux.
- [x] 5.3 (e2e visual) Baseline de `OfficeScene` con un puesto libre, uno propio (mine), uno ocupado y uno fijo.
- [x] 5.4 (e2e visual) Baseline de modal "Reservar" con la fecha formateada.
- [x] 5.5 Test que verifica que la fuente Press Start 2P está aplicada (computado del `font-family` del botón principal).

## 6. Documentación

- [x] 6.1 Crear `doc/fe/THEME.md` con tabla de paleta, tamaños tipográficos, capturas.
- [x] 6.2 Capturas de las 4 pantallas representativas, generadas por Playwright y exportadas a `doc/fe/img/`.
- [x] 6.3 Reglas de mantenimiento: no introducir nuevas fuentes ni colores sin actualizar la guía.

## 7. Verificación

- [x] 7.1 `pnpm test` y `pnpm e2e:chromium` (incluyendo visual) en verde.
- [x] 7.2 Inspección manual: no aparece ninguna fuente del sistema en ninguna pantalla.
- [x] 7.3 Lighthouse contraste WCAG AA en los textos sobre los fondos definidos.
- [x] 7.4 Coverage ≥ 80% para `theme.ts`, `arcade-button.ts`, `sound.ts`.
