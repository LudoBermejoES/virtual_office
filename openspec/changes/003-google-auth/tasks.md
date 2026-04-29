# Tareas: Google Authentication

## 1. Backend: verifier y sesión

- [ ] 1.1 (test unit) `GoogleVerifier.verify` rechaza token con audience incorrecto.
- [ ] 1.2 `src/infra/auth/google-verifier.ts` envuelve `OAuth2Client.verifyIdToken`.
- [ ] 1.3 (test unit) `isAllowedDomain` admite `hd` en allowlist y rechaza fuera.
- [ ] 1.4 (test unit) `isAllowedDomain` admite por sufijo de email cuando no hay `hd`.
- [ ] 1.5 `src/infra/auth/session.ts` con `signJwt`, `verifyJwt`, soporte `kid` y `previous_secret`.
- [ ] 1.6 (test unit) JWT firmado con secret previous se acepta cuando current ya rotó.

## 2. Backend: rutas

- [ ] 2.1 (test integration) `POST /api/auth/google` con payload válido y `hd` permitido devuelve 200, set-cookie y user upsert.
- [ ] 2.2 `src/http/routes/auth.ts` con handler de `/api/auth/google`.
- [ ] 2.3 (test integration) `POST /api/auth/google` con `hd` no permitido devuelve 403 con `reason: domain_not_allowed`.
- [ ] 2.4 (test integration) `POST /api/auth/google` con `email_verified=false` devuelve 403.
- [ ] 2.5 (test integration) `GET /api/me` con cookie válida devuelve user; sin cookie devuelve 401.
- [ ] 2.6 (test integration) `POST /api/auth/logout` limpia la cookie.
- [ ] 2.7 (test integration) Rate limit dispara 429 al 11º request en 60 s.

## 3. Backend: bootstrap admins y plugin guard

- [ ] 3.1 (test integration) Login con email en `ADMIN_EMAILS` promueve a `admin`.
- [ ] 3.2 `src/http/plugins/auth-guard.ts` con `requireAuth` y `requireAdmin`.
- [ ] 3.3 (test integration) Endpoint protegido con `requireAdmin` rechaza member con 403.

## 4. Frontend: LoginScene

- [ ] 4.1 Crear `src/scenes/LoginScene.ts` con texto "PRESS START — LOGIN WITH GOOGLE" en Press Start 2P.
- [ ] 4.2 Cargar GIS (`https://accounts.google.com/gsi/client`) en overlay HTML.
- [ ] 4.3 Inicializar GIS con `GOOGLE_CLIENT_ID` y callback que envía `credential` al backend.
- [ ] 4.4 Tras éxito, redirigir a `OfficeScene` (placeholder por ahora).
- [ ] 4.5 Mostrar mensaje de error legible si el backend devuelve 403.

## 5. E2E

- [ ] 5.1 (e2e) Visitar `/` sin sesión muestra `LoginScene`.
- [ ] 5.2 (e2e) Login simulado de `alice@teimas.com` → muestra contenido autenticado.
- [ ] 5.3 (e2e) Login con dominio externo sin invitación → mensaje "dominio no permitido".

## 6. Verificación

- [ ] 6.1 `pnpm test` en verde con coverage ≥ 80%.
- [ ] 6.2 `pnpm e2e:chromium` en verde.
- [ ] 6.3 Logs de login no contienen el ID token ni el email completo.
- [ ] 6.4 Cookie tiene `HttpOnly`, `Secure` (en prod), `SameSite=Lax`.
