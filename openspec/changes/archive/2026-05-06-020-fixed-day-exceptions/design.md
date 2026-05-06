# Diseño: Excepciones por día en puestos fijos

## Decisiones clave

### 1. Modelo de datos: tabla separada con FK a `fixed_assignments`

Alternativas consideradas:
- Columna JSON `skipped_dates` en `fixed_assignments` — descartada: duro de indexar, propensa a race conditions, mal estilo SQL.
- Tabla independiente `fixed_assignment_exceptions` — elegida.

La FK `ON DELETE CASCADE` garantiza que al borrar la asignación fija (kick / reasignación), las excepciones desaparecen también.

UNIQUE `(fixed_assignment_id, date)` evita duplicados; un POST repetido es idempotente vía `INSERT OR IGNORE` en el repo.

### 2. La excepción **libera completamente** el puesto

Cuando hay excepción, el snapshot trata el puesto **igual que si no tuviera fijo** ese día:
- No aparece como ocupado.
- Otros usuarios pueden reservarlo con `daily`.
- Si nadie lo reserva, queda libre.

Esto es lo más útil: el dueño no va, otros pueden usarlo. Si el dueño cambia de idea y quiere su puesto, puede:
1. Hacer DELETE de la excepción → vuelve a ser fijo (si nadie lo reservó como daily mientras tanto).
2. Si alguien lo reservó como daily, el daily gana ese día (regla existente).

### 3. Permisos: titular o admin

`canManageFixedException(user, fixed)` retorna true si:
- `user.id === fixed.user_id` (eres el titular)
- `user.role === "admin"` (admin global)
- `office_admins` contiene `(user.id, office_id)` donde `office_id = desk.office_id`

Reusa `canAdminOffice` ya existente, añadiendo el check del titular.

### 4. Validación de fecha

- `date` debe parsear como `YYYY-MM-DD` válido.
- `date >= todayIso()` (no permitir excepciones de días pasados).
- `date` dentro del horizonte de reservas (`BOOKING_HORIZON_DAYS`).

Por consistencia con `bookings`, reutilizamos `parseIsoDate` y la misma comprobación de horizonte.

### 5. Snapshot extendido

En `GET /api/offices/:id`, el bucle de fijos hace ahora un join con la tabla de excepciones:

```sql
SELECT f.*, u.name, u.avatar_url
FROM fixed_assignments f
JOIN users u ON u.id = f.user_id
JOIN desks d ON d.id = f.desk_id
WHERE d.office_id = ?
  AND NOT EXISTS (
    SELECT 1 FROM fixed_assignment_exceptions e
    WHERE e.fixed_assignment_id = f.id AND e.date = ?
  )
```

O alternativamente, dos queries separadas y filtro en memoria. Optamos por **dos queries** por simplicidad y testabilidad (la lógica vive en TS, no en SQL).

### 6. WebSocket

Nuevos tipos en `WsServerMessage`:

```ts
{ type: "desk.fixed_skipped"; deskId: number; userId: number; date: string }
{ type: "desk.fixed_unskipped"; deskId: number; userId: number; date: string }
```

Solo se envían a clientes en el room de la oficina afectada. El cliente al recibirlos llama a `refreshSnapshot()` si la fecha coincide con `selectedDate`, o ignora si no.

### 7. UI: confirmaciones según rol y estado

`handleDeskClick` ya distingue estados (`fixed`, `mine`, `occupied`, `free`). Modificamos el caso `fixed`:

```ts
if (state === "fixed") {
  const b = this.detail.bookings.find(x => x.deskId === desk.id);
  const isMyFixed = b?.userId === this.meId;
  const isAdmin = officesStore.getState().meRole === "admin";
  if (!isMyFixed && !isAdmin) {
    this.showFeedback(`📌 Puesto fijo de ${b?.user.name}`);
    return;
  }
  // Permitir skip/unskip
  // ... preguntar al usuario y hacer POST/DELETE /api/desks/:id/fixed/skip
}
```

**Detalle**: si el usuario tiene una excepción ese día, el puesto **no aparece como `fixed`** en el snapshot, sino como `free`. Por tanto el flujo "deshacer la excepción" no llega por el caso `fixed`. Hay que ofrecerlo desde otro sitio: por ejemplo, si el usuario hace clic en un puesto `free` que es **su propio fijo con excepción**, ofrecer "Volver a tu puesto fijo".

Implementación: el snapshot del backend incluye un campo extra `fixedAssignmentSelf: { deskId, hasExceptionToday: boolean }` para que el frontend sepa cuál es su fijo. Más simple que recalcular.

### 8. Logs y auditoría

Cada operación deja un evento Winston:
```
{ event: "fixed.day_skipped", deskId, userId, date, byUserId, byEmail }
{ event: "fixed.day_unskipped", deskId, userId, date, byUserId, byEmail }
```

Sin tabla de audit log dedicada; queda en logs rotados.

## Riesgos

- **Race condition**: dos admins crean excepción el mismo día simultáneamente → UNIQUE constraint protege, segundo INSERT da `INSERT OR IGNORE`, idempotente.
- **Excepción huérfana**: si se borra el fijo, FK CASCADE limpia.
- **Cambio de fijo**: si el admin reasigna el fijo a otro usuario, las excepciones del anterior desaparecen (CASCADE). Correcto: la nueva persona empieza sin excepciones.

## Alternativas descartadas

- **`status: "skipped"` en una tabla unificada** — sobreingeniería para un caso simple.
- **Excepciones globales por usuario y día** (sin atar a fixed concreto) — confuso si el usuario cambia de fijo.
