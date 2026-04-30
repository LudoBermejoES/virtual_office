# Diseño técnico: Panel de administración

## A. Punto de entrada — botón HUD

En `HUDScene.ts`, junto al selector de oficinas, se añade un botón ⚙ HTML que solo se renderiza cuando `meRole === "admin"` (obtenido de `/api/me` al arrancar la escena). Al hacer clic llama a `mountAdminPanel(meRole, currentOfficeId)`.

```ts
if (meRole === "admin") {
  const btn = document.createElement("button");
  btn.textContent = "⚙";
  btn.className = "hud-admin-btn";
  btn.onclick = () => mountAdminPanel(meRole, currentOfficeId);
  document.body.appendChild(btn);
}
```

El botón se destruye en `HUDScene.shutdown()`.

---

## B. Componente AdminPanel

Fichero: `frontend/src/ui/admin-panel.ts`

### Estructura del overlay

```
div#admin-panel-overlay (posición fija, cubre toda la pantalla, fondo semitransparente)
  └── div#admin-panel (caja centrada, max-width 800px, scroll interno)
        ├── header: "⚙ ADMINISTRACIÓN" + botón ✕ cerrar
        ├── nav.admin-tabs: [OFICINAS] [USUARIOS] [INVITACIONES] [FIJOS]
        └── section.admin-content: contenido de la pestaña activa
```

### API interna

```ts
export function mountAdminPanel(meRole: "admin" | "member", currentOfficeId: number): void
export function unmountAdminPanel(): void
```

`mountAdminPanel` crea el overlay, carga los datos de la pestaña inicial (Oficinas) y registra listeners. `unmountAdminPanel` destruye el overlay y limpia listeners.

### Estado local del panel

```ts
interface AdminPanelState {
  activeTab: "offices" | "users" | "invitations" | "fixed";
  offices: OfficeRow[];
  users: UserRow[];
  invitations: InvitationRow[];
  fixedAssignments: FixedAssignmentRow[];
}
```

Estado local al componente — no va a zustand (es UI efímera de admin).

---

## C. Pestaña Oficinas

### Lista de oficinas

`GET /api/offices` — ya devuelve `is_admin`, `is_default`, nombre, etc.

Tabla con columnas: Nombre | Puestos (count via detail) | Mapa | Acciones.

Acciones por fila:
- **Editar nombre** — input inline + PATCH `/api/offices/:id` `{ name }`
- **Subir mapa** — abre `UploadMapModal` existente (ya implementado en `ui/upload-map-modal.ts`)
- **Editar puestos** — cierra panel y lanza `AdminMapScene` con esa oficina
- **Office admins** — expande sub-panel inline
- **Eliminar** — confirm dialog + DELETE `/api/offices/:id`

### Crear oficina

Formulario al pie de la lista:
```
[ Nombre de la oficina _________________ ] [ + CREAR ]
```
POST `/api/offices` con multipart (nombre + opcionalmente TMJ + tilesets). Si no se sube mapa, solo nombre — **pero la API actual requiere TMJ**. Solución: el formulario de creación siempre incluye subida de mapa (obligatorio en paso 1); si el usuario quiere crearlo sin mapa, eso es una limitación aceptable por ahora.

### Sub-panel office-admins

Al expandir la fila de una oficina:
```
Admins de "Oficina X":
  • ludo.bermejo@teimas.com  [✕ quitar]
  [ email nuevo _____________ ] [ + AÑADIR ]
```

- Listar: `GET /api/offices/:id/admins` — **este endpoint no existe aún, hay que crearlo**
- Añadir: `POST /api/offices/:id/admins` `{ user_id }` — existe, pero necesita buscar usuario por email primero
- Quitar: `DELETE /api/offices/:id/admins/:userId` — existe

Para buscar usuario por email se añade `GET /api/users?email=...` (nuevo endpoint, solo admin).

---

## D. Pestaña Usuarios

`GET /api/users` — **nuevo endpoint** (solo admin), devuelve lista de usuarios con id, name, email, role, avatar_url, created_at.

Tabla: Avatar | Nombre | Email | Rol | Fecha | Acciones.

Acciones (solo super-admin):
- **Promover a super-admin** — nuevo endpoint `POST /api/users/:id/promote` o PATCH role
- **Degradar a member** — mismo endpoint

No hay eliminación de usuarios (los usuarios se gestionan por su actividad, no manualmente).

---

## E. Pestaña Invitaciones

Usa los endpoints existentes:
- `GET /api/invitations` — lista (ya implementado, incluye `?include=all`)
- `POST /api/invitations` `{ email }` — crear
- `DELETE /api/invitations/:id` — revocar
- `POST /api/invitations/:id/renew` — **nuevo endpoint** para renovar (actualmente solo existe lógica interna)

Tabla: Email | Estado | Invitado por | Expira | Acciones.

Estados visuales: 🟢 Pendiente | ✅ Aceptada | 🔴 Caducada.

Acciones: [Revocar] para pendientes, [Renovar] para caducadas.

Ya existe `InvitationsModal` en `ui/invitations-modal.ts` — se puede reutilizar o integrar aquí.

---

## F. Pestaña Asignaciones Fijas

`GET /api/offices/:id/fixed-assignments` — **nuevo endpoint** que lista todas las asignaciones de una oficina con join a users y desks.

Selector de oficina al tope de la pestaña. Tabla: Puesto | Usuario | Asignado por | Fecha | [Eliminar].

Eliminar: `DELETE /api/desks/:id/fixed` — ya existe.

---

## G. Pantalla NoOfficeScene mejorada

Cuando `role === "admin"` y `offices.length === 0`, `NoOfficeScene` muestra un botón "CREAR PRIMERA OFICINA" que abre directamente `mountAdminPanel` con la pestaña Oficinas activa.

---

## H. Nuevos endpoints backend necesarios

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/users` | Lista usuarios (solo admin) |
| GET | `/api/users?email=` | Buscar usuario por email (solo admin) |
| PATCH | `/api/users/:id` | Cambiar role (solo super-admin) |
| GET | `/api/offices/:id/admins` | Listar office-admins |
| POST | `/api/invitations/:id/renew` | Renovar invitación caducada |
| GET | `/api/offices/:id/fixed-assignments` | Listar asignaciones fijas de una oficina |

---

## I. Estilos

El panel usa HTML/CSS puro (sin framework). Fuente `Press Start 2P` para títulos, `VT323` para contenido tabular. Paleta arcade existente. Sin dependencias CSS externas.

Variables CSS en `:root`:
```css
--panel-bg: #0d0d1a;
--panel-border: #36e36c;
--panel-text: #f5f5f5;
--panel-accent: #36e36c;
--panel-danger: #ff4d6d;
--panel-muted: #666;
```

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Panel lento si hay muchas oficinas/usuarios | Carga lazy por pestaña; no se carga todo al abrir |
| Crear oficina sin mapa bloquea | Formulario obliga a subir TMJ en creación |
| Editar nombre hace PATCH pero API no lo soporta | Verificar: `PATCH /api/offices/:id` existe y acepta `{ name }` |
| office-admins endpoint GET falta | Se crea en este change |
