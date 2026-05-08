# UI Game — Delta para change 030-admin-custom-avatars

## ADDED Requirements

### Requirement: Modal admin para gestionar avatar de un usuario

La pestaña `USUARIOS` del admin panel MUST exponer, por cada usuario listado, un botón "Avatar" que abre un modal dedicado para subir o resetear su avatar custom.

#### Scenario: Botón "Avatar" en cada fila

- **GIVEN** un admin con la pestaña `USUARIOS` activa
- **WHEN** se renderiza la lista de usuarios
- **THEN** cada fila muestra, junto a los datos del usuario, un botón "Avatar"

#### Scenario: Modal con usuario sin override

- **GIVEN** un usuario con `avatar_locked = 0` (avatar viene de Google o no tiene)
- **WHEN** el admin pulsa "Avatar" en su fila
- **THEN** se abre un modal con título "Avatar de <name>"
- **AND** muestra una preview del `avatar_url` actual (o placeholder con iniciales si es null)
- **AND** muestra etiqueta "Origen: Google" (o "Sin avatar" si null)
- **AND** muestra un input file (`accept="image/png,image/webp,image/jpeg"`) y un botón "Subir"
- **AND** NO muestra botón "Resetear"

#### Scenario: Modal con usuario que ya tiene avatar custom

- **GIVEN** un usuario con `avatar_locked = 1`
- **WHEN** el admin pulsa "Avatar"
- **THEN** el modal muestra etiqueta "Origen: Custom"
- **AND** muestra además del input/Subir, un botón "Resetear"

#### Scenario: Subir un fichero válido

- **GIVEN** el modal abierto con input file y un PNG seleccionado
- **WHEN** el admin pulsa "Subir"
- **THEN** se hace `POST /api/users/:id/avatar` con `multipart/form-data` parte `file`
- **AND** al recibir 200, el modal cierra y la lista de usuarios se recarga (la nueva preview aparece tras la recarga)

#### Scenario: Resetear avatar custom

- **GIVEN** el modal abierto en modo `avatar_locked = 1`
- **WHEN** el admin pulsa "Resetear"
- **THEN** aparece `window.confirm("¿Quitar el avatar custom de <name>? Volverá a usarse el de Google en su próximo login.")`
- **AND** si confirma, se llama `DELETE /api/users/:id/avatar`
- **AND** al recibir 200, el modal cierra y la lista se recarga

#### Scenario: ESC y click fuera cierran sin acción

- **GIVEN** el modal abierto
- **WHEN** el admin pulsa ESC, o hace click en el overlay fuera del cuadro
- **THEN** el modal cierra y se llama `onClose`
- **AND** no se llama ni POST ni DELETE
