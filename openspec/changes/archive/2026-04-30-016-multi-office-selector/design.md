# Diseño técnico: selector de oficina

## DB

Migración `0006_multi_office.sql`:

```sql
ALTER TABLE users ADD COLUMN default_office_id INTEGER REFERENCES offices(id) ON DELETE SET NULL;

CREATE TABLE office_admins (
  office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  granted_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (office_id, user_id)
);
CREATE INDEX idx_office_admins_user ON office_admins(user_id);
```

## Endpoints nuevos / extendidos

### `GET /api/offices`

Ya existe. Devuelve la lista. Extender el shape:

```json
[
  { "id": 1, "name": "Compostela", "is_admin": true, "is_default": true },
  { "id": 2, "name": "Madrid", "is_admin": false, "is_default": false }
]
```

`is_admin` = `users.is_admin OR EXISTS(office_admins WHERE office_id=:id AND user_id=:me)`.

### `PATCH /api/me`

Body: `{ default_office_id: number | null }`. Verifica que la oficina existe y devuelve `204`.

### `POST /api/offices/:id/admins`

Body: `{ user_id: number }`. Solo super-admin (`users.is_admin=1`). Devuelve `201`.

### `DELETE /api/offices/:id/admins/:userId`

Solo super-admin. Devuelve `204`.

## Lógica de autorización

Helper `canAdminOffice(user, officeId)`:

```ts
export function canAdminOffice(user: SessionUser, officeId: number, db: Database): boolean {
  if (user.is_admin) return true;
  return !!db.prepare("SELECT 1 FROM office_admins WHERE office_id=? AND user_id=?").get(officeId, user.id);
}
```

Aplicar a:
- `POST /api/offices/:id` (re-subir mapa)
- `POST /api/desks` y `DELETE /api/desks/:id`
- `POST /api/fixed-assignments`
- Endpoints de invitaciones (que pasan a ser per-office)

## Frontend

### Dropdown HTML

`frontend/src/ui/office-selector.ts`:

```ts
mountOfficeSelector(parent, currentOfficeId, offices, onChange) {
  // Botón en HUD: nombre de oficina + chevron
  // Click: panel con lista; cada item con click → onChange(office.id)
  // Estilo arcade, usa --color-bg-2, --color-accent
}
```

Usa el patrón del modal de invitaciones (`mountInvitationsModal`).

### Estado

`frontend/src/state/office.ts` extiende `officeStore` con:

```ts
type OfficeStore = {
  current: OfficeDetail | null;
  list: OfficeSummary[];
  setCurrent: (id: number) => Promise<void>;  // fetch /api/offices/:id, swap
};
```

### Persistencia

`localStorage["vo_last_office"]`: id de la última oficina visitada. Al login, prioridad:

1. `users.default_office_id` (server)
2. `localStorage["vo_last_office"]` (client)
3. Primera oficina con `is_admin=true` (si admin)
4. Primera oficina visible
5. Pantalla "sin oficina"

## Bootstrap del primer admin

Script `backend/scripts/bootstrap-admin.ts` (manual, no automático):

```bash
node --experimental-strip-types backend/scripts/bootstrap-admin.ts admin@teimas.com
```

Crea user con `is_admin=1` si no existe. NO asigna `default_office_id` automáticamente.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Quedar sin admin en una oficina | Constraint mínima: si `office_admins` para una oficina queda en 0 y no hay super-admin, log warning (no error duro) |
| Cambiar de oficina deja sockets WS huérfanos | Al cambiar, `wsHandle?.close()` antes de connectar al nuevo room |
| Reservas en otra oficina invisibles | Documentar: cada oficina tiene su propio set de bookings; al cambiar, snapshot completo |
