# Delta — Oficinas

## ADDED Requirements

### Requirement: Panel de administración accesible desde el HUD

El sistema MUST mostrar un botón ⚙ en el HUD cuando el usuario autenticado tiene `role="admin"`. Al hacer clic, MUST abrirse el panel de administración como overlay HTML sobre Phaser. El botón MUST destruirse al cerrar `HUDScene`.

#### Scenario: Botón visible para admin

- GIVEN un usuario con `role="admin"` logado y en `HUDScene`
- WHEN se monta la escena
- THEN aparece un botón ⚙ en el HUD
- AND al hacer clic se abre el panel de administración

#### Scenario: Botón invisible para member

- GIVEN un usuario con `role="member"` logado y en `HUDScene`
- WHEN se monta la escena
- THEN no aparece ningún botón ⚙ en el HUD

#### Scenario: Panel se cierra con ✕

- GIVEN el panel de administración está abierto
- WHEN el usuario hace clic en el botón ✕
- THEN el overlay desaparece y Phaser recupera el foco

### Requirement: Gestión de oficinas desde el panel

El sistema MUST permitir a un super-admin crear, renombrar y eliminar oficinas desde el panel de administración sin salir de la aplicación.

#### Scenario: Crear primera oficina desde NoOfficeScene

- GIVEN un super-admin logado sin ninguna oficina en el sistema
- WHEN se muestra `NoOfficeScene`
- THEN aparece un botón "CREAR PRIMERA OFICINA"
- AND al hacer clic se abre el panel con la pestaña Oficinas activa y el formulario de creación visible

#### Scenario: Crear oficina con nombre y mapa

- GIVEN el panel de administración abierto en la pestaña Oficinas
- WHEN el admin introduce un nombre y sube un bundle TMJ válido y hace clic en "CREAR"
- THEN se llama a `POST /api/offices` con los datos
- AND la nueva oficina aparece en la lista del panel
- AND el selector de oficinas del HUD se actualiza

#### Scenario: Renombrar oficina

- GIVEN el panel de administración abierto con al menos una oficina
- WHEN el admin hace clic en el nombre de la oficina, lo edita y confirma
- THEN se llama a `PATCH /api/offices/:id` con el nuevo nombre
- AND la lista se actualiza con el nuevo nombre

#### Scenario: Eliminar oficina con confirmación

- GIVEN el panel abierto con al menos una oficina
- WHEN el admin hace clic en "Eliminar" de una oficina
- THEN aparece un diálogo de confirmación con el nombre de la oficina
- AND si confirma, se llama a `DELETE /api/offices/:id`
- AND la oficina desaparece de la lista

#### Scenario: Acceder al editor de puestos desde el panel

- GIVEN el panel abierto con una oficina que tiene mapa
- WHEN el admin hace clic en "Editar puestos"
- THEN el panel se cierra
- AND se inicia `AdminMapScene` con los datos de esa oficina

### Requirement: Gestión de office-admins desde el panel

El sistema MUST exponer `GET /api/offices/:id/admins` para listar los admins de una oficina. El sistema MUST permitir a un super-admin añadir y eliminar office-admins desde el panel.

#### Scenario: Listar office-admins de una oficina

- GIVEN el panel abierto en la sección de office-admins de una oficina
- WHEN se expande la sección
- THEN se llama a `GET /api/offices/:id/admins`
- AND se muestra la lista de emails de los admins actuales

#### Scenario: Añadir office-admin por email

- GIVEN la sección office-admins expandida
- WHEN el super-admin introduce un email de un usuario registrado y hace clic en "AÑADIR"
- THEN se llama a `GET /api/users?email=` para resolver el user_id
- AND se llama a `POST /api/offices/:id/admins` con ese user_id
- AND el email aparece en la lista

#### Scenario: Eliminar office-admin

- GIVEN la sección office-admins expandida con al menos un admin
- WHEN el super-admin hace clic en ✕ junto a un email
- THEN se llama a `DELETE /api/offices/:id/admins/:userId`
- AND el email desaparece de la lista

### Requirement: Listado y búsqueda de usuarios (solo admin)

El sistema MUST exponer `GET /api/users` (lista) y `GET /api/users?email=` (búsqueda) protegidos por `requireAdmin`. El sistema MUST permitir a un super-admin cambiar el rol de un usuario mediante `PATCH /api/users/:id`.

#### Scenario: Listar usuarios

- GIVEN un super-admin autenticado
- WHEN hace `GET /api/users`
- THEN la respuesta es 200 con array de `{ id, name, email, role, avatar_url, created_at }`

#### Scenario: Buscar usuario por email

- GIVEN un super-admin autenticado
- WHEN hace `GET /api/users?email=alice@teimas.com`
- THEN la respuesta es 200 con array filtrado (puede ser vacío)

#### Scenario: No-admin no puede listar usuarios

- GIVEN un usuario con `role="member"`
- WHEN hace `GET /api/users`
- THEN la respuesta es 403

#### Scenario: Promover usuario a super-admin

- GIVEN un super-admin autenticado y un usuario con `role="member"`
- WHEN hace `PATCH /api/users/:id` con `{ role: "admin" }`
- THEN la respuesta es 200
- AND ese usuario pasa a tener `role="admin"` en DB

#### Scenario: Degradar super-admin a member

- GIVEN un super-admin autenticado y otro usuario con `role="admin"`
- WHEN hace `PATCH /api/users/:id` con `{ role: "member" }`
- THEN la respuesta es 200
- AND ese usuario pasa a tener `role="member"` en DB

### Requirement: Listado de asignaciones fijas por oficina

El sistema MUST exponer `GET /api/offices/:id/fixed-assignments` (solo admin de esa oficina) que devuelve todas las asignaciones fijas de la oficina con datos del puesto y del usuario asignado.

#### Scenario: Listar asignaciones fijas de una oficina

- GIVEN un admin (super o de la oficina) autenticado
- WHEN hace `GET /api/offices/:id/fixed-assignments`
- THEN la respuesta es 200 con array de `{ id, desk: { id, label }, user: { id, name, email, avatar_url }, assigned_by: { id, name }, created_at }`

#### Scenario: Eliminar asignación fija desde el panel

- GIVEN el panel abierto en la pestaña Asignaciones Fijas con al menos una asignación
- WHEN el admin hace clic en "Eliminar" de una asignación
- THEN se llama a `DELETE /api/desks/:deskId/fixed`
- AND la asignación desaparece de la lista
