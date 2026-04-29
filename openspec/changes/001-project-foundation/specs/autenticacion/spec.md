# Delta — Autenticación

## ADDED Requirements

### Requirement: Configuración de sesión preparada
El sistema MUST exigir un secret de sesión válido al arrancar y rechazar el boot si no está presente, aunque todavía no emita ni valide cookies.

#### Scenario: Arranque sin SESSION_SECRET
- GIVEN no se define la variable `SESSION_SECRET`
- WHEN el proceso intenta arrancar
- THEN el proceso termina con código 1
- AND el log incluye un error indicando la variable obligatoria faltante

#### Scenario: Arranque con SESSION_SECRET válido
- GIVEN `SESSION_SECRET` con al menos 32 bytes de entropía
- WHEN el proceso arranca
- THEN el servidor escucha en el puerto configurado
- AND no se emiten cookies todavía (emisión llega en el change 003)
