# Delta — Autenticación

## ADDED Requirements

### Requirement: Endpoint de sesión para tests automatizados
El sistema MUST exponer `POST /api/test/session` únicamente cuando la variable de entorno `TEST_AUTH=on` esté activa y `NODE_ENV` sea distinto de `production`. El endpoint MUST aceptar `{ email, role }`, crear el usuario si no existe, marcarlo como admin si `role==="admin"`, y devolver una cookie de sesión firmada idéntica a la del flujo Google.

#### Scenario: Generación de sesión válida
- GIVEN el servidor arrancado con `TEST_AUTH=on` y `NODE_ENV=test`
- WHEN se hace `POST /api/test/session` con `{ email: "alice@teimas.com", role: "member" }`
- THEN la respuesta es 200 con `Set-Cookie: vo_session=<jwt>; HttpOnly; Secure; SameSite=Lax`
- AND el JWT es válido para el resto de endpoints autenticados
- AND existe una fila en `users` con ese email

#### Scenario: Creación de admin
- GIVEN el servidor arrancado con `TEST_AUTH=on`
- WHEN se hace `POST /api/test/session` con `role: "admin"`
- THEN el usuario queda con `is_admin = 1` en la base de datos
- AND la cookie permite acceder a endpoints `/api/admin/*`

### Requirement: Salvaguarda de producción para test-auth
El sistema NUNCA MUST registrar el endpoint `POST /api/test/session` cuando `NODE_ENV=production`, incluso si `TEST_AUTH=on` está presente. El sistema MUST fallar el arranque con error fatal si ambas condiciones coinciden, en lugar de arrancar sin el endpoint.

#### Scenario: Fail-fast en producción
- GIVEN variables `NODE_ENV=production` y `TEST_AUTH=on`
- WHEN se invoca `buildServer({ env })`
- THEN la función lanza `Error("FATAL: TEST_AUTH=on en NODE_ENV=production")`
- AND el proceso no completa el arranque

#### Scenario: TEST_AUTH off
- GIVEN el servidor arrancado con `TEST_AUTH=off`
- WHEN se hace `POST /api/test/session`
- THEN la respuesta es 404 (la ruta no está registrada)
