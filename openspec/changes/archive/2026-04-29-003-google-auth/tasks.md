# Tareas: Google Authentication

## 1. Backend: verifier y sesión

- [x] 1.1 (test unit) `GoogleVerifier.verify` rechaza token con audience incorrecto.
- [x] 1.2 `src/infra/auth/google-verifier.ts` envuelve `OAuth2Client.verifyIdToken`.
- [x] 1.3 (test unit) `isAllowedDomain` admite `hd` en allowlist y rechaza fuera.
- [x] 1.4 (test unit) `isAllowedDomain` admite por sufijo de email cuando no hay `hd`.
- [x] 1.5 `src/infra/auth/session.ts` con `signJwt`, `verifyJwt`, soporte `kid` y `previous_secret`.
- [x] 1.6 (test unit) JWT firmado con secret previous se acepta cuando current ya rotó.

## 2. Backend: rutas

- [x] 2.1 (test integration) `POST /api/auth/google` con payload válido y `hd` permitido devuelve 200, set-cookie y user upsert.
- [x] 2.2 `src/http/routes/auth.ts` con handler de `/api/auth/google`.
- [x] 2.3 (test integration) `POST /api/auth/google` con `hd` no permitido devuelve 403 con `reason: domain_not_allowed`.
- [x] 2.4 (test integration) `POST /api/auth/google` con `email_verified=false` devuelve 403.
- [x] 2.5 (test integration) `GET /api/me` con cookie válida devuelve user; sin cookie devuelve 401.
- [x] 2.6 (test integration) `POST /api/auth/logout` limpia la cookie.
- [x] 2.7 (test integration) Rate limit dispara 429 al 11º request en 60 s.

## 3. Backend: bootstrap admins y plugin guard

- [x] 3.1 (test integration) Login con email en `ADMIN_EMAILS` promueve a `admin`.
- [x] 3.2 `src/http/plugins/auth-guard.ts` con `requireAuth` y `requireAdmin`.
- [x] 3.3 (test integration) Endpoint protegido con `requireAdmin` rechaza member con 403.

## 4. Frontend: LoginScene

- [x] 4.1 Crear `src/scenes/LoginScene.ts` con texto "PRESS START — LOGIN WITH GOOGLE" en Press Start 2P.
- [x] 4.2 Cargar GIS (`https://accounts.google.com/gsi/client`) en overlay HTML.
- [x] 4.3 Inicializar GIS con `GOOGLE_CLIENT_ID` y callback que envía `credential` al backend.
- [x] 4.4 Tras éxito, redirigir a `OfficeScene` (placeholder por ahora).
- [x] 4.5 Mostrar mensaje de error legible si el backend devuelve 403.

## 5. E2E

- [x] 5.1 (e2e) Visitar `/` sin sesión muestra `LoginScene`.
- [x] 5.2 (e2e) Login simulado de `alice@teimas.com` → muestra contenido autenticado.
- [x] 5.3 (e2e) Login con dominio externo sin invitación → mensaje "dominio no permitido".

## 6. Verificación

- [x] 6.1 `pnpm test` en verde con coverage ≥ 80%.
- [x] 6.2 `pnpm e2e:chromium` en verde.
- [x] 6.3 Logs de login no contienen el ID token ni el email completo.
- [x] 6.4 Cookie tiene `HttpOnly`, `Secure` (en prod), `SameSite=Lax`.
