# Propuesta: Panel de administración

## Motivación

El sistema tiene toda la API de administración implementada (crear oficinas, gestionar puestos, invitar usuarios, asignar office-admins, asignaciones fijas), pero **no hay ninguna interfaz de usuario** para acceder a ella. Un super-admin que hace login ve "Aún no hay oficinas" sin forma de crear una. Un admin que quiere invitar a alguien externo no tiene dónde hacerlo.

El resultado es que el sistema es inutilizable sin herramientas externas (curl, scripts) para las operaciones básicas de configuración.

## Alcance

**En scope:**

### A. Botón de acceso al panel en el HUD

Un icono ⚙ en el HUD, visible solo cuando el usuario tiene `role="admin"` o `is_admin=true` en alguna oficina. Al hacer clic abre el panel de administración como overlay HTML encima de Phaser.

### B. Panel de administración (overlay HTML)

Panel con tres secciones navegables mediante pestañas:

#### Sección 1: Oficinas

- **Lista de oficinas** con nombre, número de puestos, fecha de creación.
- **Crear oficina**: formulario con nombre + subida de bundle Tiled (TMJ + tilesets). Si no se sube mapa, la oficina se crea sin mapa (campo `tmj_filename` vacío, se puede añadir después).
- **Editar nombre** de una oficina.
- **Subir / reemplazar mapa** de una oficina existente.
- **Eliminar oficina** (con confirmación).
- **Gestionar office-admins** de cada oficina: ver lista, añadir por email, eliminar.
- **Botón "Editar puestos"** que cierra el panel y abre `AdminMapScene` para esa oficina.

#### Sección 2: Usuarios e invitaciones

- **Lista de usuarios** registrados: nombre, email, rol, fecha de registro, avatar.
- **Promover/degradar** usuario a super-admin (solo super-admin puede hacer esto).
- **Lista de invitaciones**: email, estado (pendiente/aceptada/caducada), quién invitó, fecha de expiración.
- **Crear invitación**: campo email + botón "Invitar".
- **Revocar invitación** pendiente.
- **Renovar invitación** caducada.

#### Sección 3: Asignaciones fijas

- **Lista global** de asignaciones fijas: oficina, puesto (label), usuario asignado, quién asignó, fecha.
- **Eliminar asignación fija** desde el panel (sin tener que entrar en el mapa).

### C. Flujo de primer uso

Cuando un super-admin hace login y no hay oficinas, en lugar de la pantalla "Aún no hay oficinas" con mensaje pasivo, se muestra un **botón "Crear primera oficina"** que abre directamente el formulario de creación del panel.

**Fuera de scope:**
- Editor visual de puestos sobre el mapa (eso es `AdminMapScene`, ya implementado).
- Gestión de reservas desde el panel (las reservas las hace cada usuario).
- Configuración de métricas o backups desde UI.
- Roles adicionales más allá de `admin` / `member`.

## Dominios afectados

`oficinas` (oficinas, puestos, office_admins, asignaciones fijas), `invitaciones`.

## Orden y dependencias

Change `018`. Depende de `001-project-foundation`, `003-google-auth`, `006-invitations`, `008-fixed-desk-assignment`, `016-multi-office-selector`.

## Impacto de seguridad

- El panel solo se monta si el frontend recibe `role="admin"` en `/api/me` o `is_admin=true` en alguna oficina de `/api/offices`. La API ya valida permisos server-side — el panel es solo UI.
- Las operaciones de super-admin (promover usuarios, gestionar office-admins globales) solo aparecen en la UI si `role="admin"`.

## Rollback

Eliminar el overlay HTML y el botón del HUD no afecta a ninguna funcionalidad existente.
