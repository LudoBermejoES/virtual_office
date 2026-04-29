# Tareas: User Avatars

## 1. Frontend: utilidades

- [ ] 1.1 (test unit FE) `getInitials("Ludo Bermejo Bonafé")` devuelve `"LB"`.
- [ ] 1.2 (test unit FE) `getInitials("Alice")` devuelve `"A"`.
- [ ] 1.3 (test unit FE) `colorForUser(userId)` devuelve un valor HSL determinístico.
- [ ] 1.4 `src/render/avatar-mask.ts` con `placeAvatar(scene, key, x, y)` y `placeFallback(scene, x, y, initials, color)`.

## 2. Frontend: integración con Phaser

- [ ] 2.1 `OfficeScene` registra una caché `avatars: Map<userId, "loading" | "ready">`.
- [ ] 2.2 Por cada booking del snapshot, si user.avatar_url existe y el userId no está cacheado, dispara `loader.image(\`avatar:${userId}\`, url)`.
- [ ] 2.3 Mientras carga, se renderiza fallback con iniciales.
- [ ] 2.4 Tras `filecomplete-image`, se reemplaza el fallback por la imagen con máscara circular.
- [ ] 2.5 Tras `loaderror`, se mantiene el fallback y se loggea warn.
- [ ] 2.6 (test unit FE con mock de `scene.textures`) cargar avatar de Google placeholder funciona.

## 3. Frontend: estados visuales

- [ ] 3.1 `render/desk-renderer.ts` extiende para superponer el avatar centrado sobre el cuadrado.
- [ ] 3.2 Estado `mine`: avatar + borde cian pulsante.
- [ ] 3.3 Estado `occupied`: avatar + borde rojo.
- [ ] 3.4 Estado `fixed`: avatar + icono 📌 + borde violeta.
- [ ] 3.5 Estado `free`: sin avatar.

## 4. Frontend: tooltip

- [ ] 4.1 Overlay HTML `#tooltip` que recibe eventos `pointerover`/`pointerout` de los desks ocupados.
- [ ] 4.2 Tooltip muestra el nombre completo del user (no email).
- [ ] 4.3 Tooltip se posiciona 8 px arriba del cuadrado.
- [ ] 4.4 Tooltip desaparece en pointerout o pulsar Escape.

## 5. Backend (verificación, sin cambios)

- [ ] 5.1 (test integration ya existente en 003) Confirma que `users.avatar_url` se persiste con el `picture` del payload de Google.
- [ ] 5.2 (test integration ya existente en 007) Confirma que el endpoint `GET /api/offices/:id?date=…` incluye `user.avatar_url` en cada booking.

## 6. E2E

- [ ] 6.1 (e2e) Alice reserva A1 → la pantalla de Bob muestra el cuadrado A1 con el avatar de Alice (Google) en círculo.
- [ ] 6.2 (e2e) Hover sobre A1 muestra tooltip con el nombre de Alice.
- [ ] 6.3 (e2e) Si la URL del avatar devuelve 403, se muestra un círculo de color con las iniciales `"A"`.
- [ ] 6.4 (e2e) Cambio de día con avatares cargados → no hay flash; los avatares de los nuevos bookings se cargan progresivamente.

## 7. Verificación

- [ ] 7.1 Coverage ≥ 80% en `avatar-mask.ts`, `desk-renderer.ts`, helpers de iniciales y color.
- [ ] 7.2 `pnpm test` y `pnpm e2e:chromium` en verde.
- [ ] 7.3 No se hacen requests a `/api/avatars/:userId` (no existe endpoint; las URLs se cargan directamente desde Google).
