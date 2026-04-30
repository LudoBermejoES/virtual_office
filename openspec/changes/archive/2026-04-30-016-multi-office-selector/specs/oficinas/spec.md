# Delta — Oficinas

## ADDED Requirements

### Requirement: Selector de oficina en HUD
El sistema MUST mostrar en el HUD un selector con el nombre de la oficina actual y un menú con todas las oficinas a las que el usuario tiene acceso. Al cambiar de oficina, el sistema MUST cerrar el WebSocket anterior, abrir el nuevo, refrescar el snapshot y persistir el id en `localStorage` con clave `vo_last_office`.

#### Scenario: Cambio de oficina
- GIVEN un usuario con acceso a las oficinas Compostela (id=1) y Madrid (id=2), actualmente en Compostela
- WHEN abre el selector y elige Madrid
- THEN la `OfficeScene` se reinicia con `officeId=2`
- AND el WS anterior se cierra y se abre uno nuevo a `/ws/offices/2`
- AND `localStorage["vo_last_office"] === "2"`

#### Scenario: Selector con una sola oficina
- GIVEN un usuario con acceso a una única oficina
- WHEN abre el HUD
- THEN el selector muestra el nombre de la oficina pero el menú no abre opciones (no hay alternativa)

### Requirement: Oficina por defecto del usuario
El sistema MUST permitir a cada usuario fijar una oficina por defecto via `PATCH /api/me { default_office_id }`. En el siguiente login, el usuario MUST ser dirigido a esa oficina si existe; si no, el sistema MUST aplicar la prioridad: `localStorage["vo_last_office"]` → primera oficina con `is_admin=true` → primera oficina visible → pantalla "sin oficina".

#### Scenario: Login con default_office_id
- GIVEN un usuario con `users.default_office_id=2` en DB
- WHEN hace login
- THEN se le redirige a `OfficeScene` con `officeId=2`

#### Scenario: Login sin default y sin localStorage
- GIVEN un usuario sin `default_office_id` y sin `localStorage["vo_last_office"]`
- AND con acceso a 2 oficinas
- WHEN hace login
- THEN se le redirige a la primera oficina visible (orden: id ascendente)

#### Scenario: Login sin oficinas
- GIVEN un usuario que aún no tiene acceso a ninguna oficina
- WHEN hace login
- THEN ve la pantalla "Aún no hay oficinas. Pide a un admin que cree una"

### Requirement: Permisos por oficina (office_admins)
El sistema MUST permitir asignar admins a oficinas concretas mediante la tabla `office_admins`. Las acciones de admin sobre una oficina (subir mapa, crear/borrar desks, asignar fijos, gestionar invitaciones) MUST permitirse a:
- Super-admin (`users.is_admin=1`).
- Office-admin (`office_admins` con `user_id=:me` y `office_id=:target`).

Solo el super-admin MUST poder crear o borrar entradas en `office_admins`.

#### Scenario: Office-admin sube mapa a su oficina
- GIVEN Alice con `office_admins(office_id=1, user_id=Alice)` y `users.is_admin=0`
- WHEN hace `POST /api/offices/1` con un nuevo bundle Tiled
- THEN la respuesta es 200 y el mapa se actualiza

#### Scenario: Office-admin no puede subir a otra oficina
- GIVEN Alice con `office_admins(office_id=1, user_id=Alice)`
- WHEN hace `POST /api/offices/2`
- THEN la respuesta es 403 con `reason="not_authorized"`

#### Scenario: Office-admin no puede otorgar admin
- GIVEN Alice como office-admin de oficina 1 (no super-admin)
- WHEN hace `POST /api/offices/1/admins { user_id: Bob.id }`
- THEN la respuesta es 403

#### Scenario: Super-admin otorga office-admin
- GIVEN Carla con `users.is_admin=1`
- WHEN hace `POST /api/offices/1/admins { user_id: Bob.id }`
- THEN la respuesta es 201
- AND existe una fila en `office_admins(office_id=1, user_id=Bob.id, granted_by=Carla.id)`

### Requirement: Lista de oficinas con flags por usuario
El sistema MUST devolver en `GET /api/offices` por cada oficina los flags `is_admin` (true si super-admin o office-admin) y `is_default` (true si coincide con `users.default_office_id` del usuario autenticado).

#### Scenario: Usuario office-admin
- GIVEN Alice con `office_admins(office_id=1)` y `default_office_id=null`
- WHEN hace `GET /api/offices`
- THEN la respuesta incluye `[{ id: 1, name: ..., is_admin: true, is_default: false }, { id: 2, ..., is_admin: false, is_default: false }]`
