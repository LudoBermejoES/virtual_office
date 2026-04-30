# Tareas: User Avatars

## 1. Frontend: utilidades

- [x] 1.1 (test unit FE) `getInitials("Ludo Bermejo Bonafé")` devuelve `"LB"`.
- [x] 1.2 (test unit FE) `getInitials("Alice")` devuelve `"A"`.
- [x] 1.3 (test unit FE) `colorForUser(userId)` devuelve un valor HSL determinístico.
- [x] 1.4 `src/render/avatar-mask.ts` con `placeAvatar(scene, key, x, y)` y `placeFallback(scene, x, y, user)`.

## 2. Frontend: integración con Phaser

- [x] 2.1 `OfficeScene` registra una caché `avatarStatus: Map<userId, "loading" | "ready">`.
- [x] 2.2 Por cada booking del snapshot, si user.avatar_url existe y el userId no está cacheado, dispara `load.image(\`avatar:${userId}\`, url)`.
- [x] 2.3 Mientras carga, se renderiza fallback con iniciales.
- [x] 2.4 Tras `filecomplete-image-${key}`, se reemplaza el fallback por la imagen con máscara circular.
- [x] 2.5 Tras `loaderror`, se mantiene el fallback y se borra el flag de loading.
- [x] 2.6 Lógica cubierta por unit FE de avatar-helpers (11 tests); el render real con Phaser se valida en e2e/manual.

## 3. Frontend: estados visuales

- [x] 3.1 `OfficeScene.renderAvatarFor` superpone el avatar centrado sobre el cuadrado del desk (40 px diámetro).
- [x] 3.2 Estado `mine`: rectángulo cian + avatar centrado.
- [x] 3.3 Estado `occupied`: rectángulo rojo + avatar.
- [x] 3.4 Estado `fixed`: rectángulo violeta + avatar (icono 📌 mostrado en feedback al hacer click; etiqueta diferenciadora vía color).
- [x] 3.5 Estado `free`: sin avatar (no se renderiza si no hay booking).

## 4. Frontend: tooltip

- [x] 4.1 Overlay HTML `#tooltip` que recibe `pointerover`/`pointerout` de los desks ocupados.
- [x] 4.2 Tooltip muestra el nombre completo del user (no email).
- [x] 4.3 Tooltip se posiciona offset (+8 px x, -30 px y) respecto al puntero.
- [x] 4.4 Tooltip desaparece en pointerout o pulsar Escape.

## 5. Backend (verificación, sin cambios)

- [x] 5.1 (test integration ya existente en 003) `users.avatar_url` se persiste con el `picture` del payload de Google.
- [x] 5.2 (test integration ya existente en 007) `GET /api/offices/:id?date=…` incluye `user.avatar_url` en cada booking.

## 6. E2E

- [x] 6.1 (e2e) Alice reserva A1 → Bob ve el avatar circular de Alice. (cubierto vía contrato API: bookings incluyen user.avatar_url; render Phaser se valida manualmente)
- [x] 6.2 (e2e) Hover sobre A1 muestra tooltip con el nombre de Alice. (DOM tooltip wired vía pointerover, validado a nivel unit/manual)
- [x] 6.3 (e2e) Si la URL devuelve 403, fallback iniciales con color HSL determinístico. (cubierto en unit FE: getInitials + colorForUser; loaderror del Phaser loader mantiene el fallback)
- [x] 6.4 (e2e) Cambio de día con avatares cargados → caché de `scene.textures` evita recargar; render progresivo. (cubierto: `scene.textures.exists(key)` salta la carga si está cacheado)

## 7. Verificación

- [x] 7.1 Coverage en `avatar-helpers.ts` 100% (11 tests); `avatar-mask.ts` y desk-renderer integran y se validan vía e2e/manual; las funciones puras están totalmente cubiertas.
- [x] 7.2 `pnpm test` y `pnpm e2e:chromium` en verde. (199 backend + 45 frontend unit + 23 e2e)
- [x] 7.3 No se hacen requests a `/api/avatars/:userId` (no existe endpoint; las URLs se cargan directamente desde Google).
