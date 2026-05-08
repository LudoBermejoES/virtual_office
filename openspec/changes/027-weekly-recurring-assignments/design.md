## Context

El proyecto tiene hoy dos modelos de reserva:

1. **Daily booking** (change 007). Tabla `bookings(desk_id, user_id, date)` con UNIQUE(desk_id, date) y UNIQUE(user_id, date). Una reserva = un día concreto.
2. **Fixed assignment** (change 008). Tabla `fixed_assignments(desk_id, user_id)` con UNIQUE(desk_id) y UNIQUE(user_id). Una asignación fija = todos los días.
3. **Fixed exception** (change 020). Tabla `fixed_exceptions(fixed_assignment_id, date)` para "Ana hoy no viene".

Falta el caso intermedio: **"Ana viene los lunes y miércoles"**. Hoy un admin tiene que:

- Asignación fija a Ana (lunes y miércoles ocupados, OK).
- Pelearse los martes/jueves: Ana tendría fijo y Bob no podría reservar ese mismo desk los martes/jueves porque el desk pertenece al fijo de Ana.

Este change introduce **`weekly_assignments`**: una asignación recurrente por día de la semana. Distintos usuarios pueden compartir el mismo desk si sus dows no chocan. El admin lo gestiona desde el modal de reserva (change 026), reusando la lista de usuarios y añadiendo un checkbox por día de la semana.

## Decisiones

### Decisión 1: `dow` con convención ISO 8601 (0=lunes ... 6=domingo)

El locale del proyecto es es-ES, donde la semana empieza en lunes. Phaser/JS tienen `Date.getDay()` que devuelve 0=domingo, así que toda conversión vive en una función helper:

```ts
// packages/shared/src/dow.ts
export function dowOfDate(isoDate: string): number {
  // Lunes=0 ... Domingo=6
  return (new Date(isoDate + "T00:00:00Z").getUTCDay() + 6) % 7;
}
```

El backend almacena 0–6 con esta convención y la UI muestra "Lunes/Martes/...". Cero ambigüedad.

### Decisión 2: Excepciones en tabla aparte `weekly_exceptions`

Esquema:

```sql
CREATE TABLE weekly_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekly_assignment_id INTEGER NOT NULL REFERENCES weekly_assignments(id) ON DELETE CASCADE,
  date TEXT NOT NULL,  -- ISO yyyy-mm-dd
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(weekly_assignment_id, date)
);
```

Paralelo a `fixed_exceptions`. **No** generalizamos la tabla `fixed_exceptions` existente porque eso requiere migración + cambios en código del change 020 que ya está en producción. El coste de mantener dos tablas paralelas es bajo; el coste del refactor del 020 es alto.

### Decisión 3: Weekly indefinida (sin `end_date`)

Empezamos sin fecha de fin. Si un weekly deja de aplicar (Ana cambia de oficina, deja la empresa), el admin lo borra. Si más adelante surge la necesidad real, abrimos un change que añada `end_date TEXT NULL`. Sin sobre-ingeniería.

### Decisión 4: Tabla `weekly_assignments`

```sql
CREATE TABLE weekly_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  desk_id INTEGER NOT NULL REFERENCES desks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dow INTEGER NOT NULL CHECK (dow >= 0 AND dow <= 6),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  UNIQUE(desk_id, dow),
  UNIQUE(user_id, dow)
);
```

`UNIQUE(desk_id, dow)`: dos personas no pueden tener el mismo desk el mismo dow.
`UNIQUE(user_id, dow)`: un usuario no puede tener dos desks distintos el mismo dow (debe elegir uno). Esto evita conflictos con la regla `bookings.UNIQUE(user_id, date)` cuando proyectamos el weekly a una fecha concreta.

### Decisión 5: Reglas de precedencia al computar el booking de un día

Para un (desk, date) determinado, el "booking efectivo" en orden:

1. Si hay **daily booking real** con esa (desk, date) → ése (puede haberlo creado el usuario o un admin via change 026).
2. Si hay **fixed assignment** sobre ese desk y NO hay `fixed_exception` para esa date → fijo.
3. Si hay **weekly assignment** sobre ese desk con `dow` igual al de la date y NO hay `weekly_exception` para esa date → weekly.
4. Si nada de lo anterior → desk libre.

Para un (user, date) determinado, simétrico: la query sumamos sus dailies + fijos sin excepción + weeklies sin excepción.

**Conflictos posibles**:

- Daily contra weekly: gana daily (admin override). Si un admin reserva el desk a otro usuario el día que normalmente tiene weekly de Ana, Ana queda sin desk ese día. La excepción es **implícita** — no hace falta crear weekly_exception, el daily booking ya prevalece.
- Fixed contra weekly en el mismo desk: en `POST /api/desks/:id/weekly` validamos que el desk NO tenga fixed_assignment activo. 409 si lo tiene.

### Decisión 6: Endpoints

```
GET    /api/offices/:id/weekly       (admin only) — listado de weeklies de la oficina con join a user/desk.
POST   /api/desks/:id/weekly         (admin only) — body: { userId, dow }. Crea weekly.
DELETE /api/desks/:id/weekly/:weeklyId (admin only) — borra weekly y sus excepciones.
```

No exponemos endpoints de `weekly_exceptions` en este change (decisión 7 abajo). Si en futuro un usuario quiere saltarse un día de su weekly, el admin lo gestiona vía DELETE de la weekly entera o creando un daily booking conflictivo (que prevalece).

### Decisión 7: Scope acotado — sin UI de excepciones por usuario en este change

El proposal mencionaba "el usuario puede liberarse un día concreto". Decidimos **fuera de este change**:

- Más simple. La tabla `weekly_exceptions` se crea en este change (preparada), pero no la exponemos vía endpoint público a usuarios.
- Fallback: si el usuario quiere "saltarse hoy", el admin con el modal del 026 puede reservar el desk a otra persona (daily prevalece) o borrar la weekly entera si el cambio es definitivo.
- Si surge demanda real, abrimos change 028 con UI de excepciones.

### Decisión 8: UI — extensión del modal admin del change 026

En el modal de "reservar puesto X", al lado de cada usuario en la lista mostramos **7 checkboxes** etiquetados `L M X J V S D` (lunes a domingo). Estado:

- Si el usuario ya tiene weekly para ese (desk, dow): checkbox marcado y verde.
- Si no: desmarcado.

Confirmar el modal aplica diferencias:

- Cada cambio de checkbox = un POST `/api/desks/:id/weekly` (crear) o un DELETE `/api/desks/:id/weekly/:weeklyId` (borrar). Las llamadas se hacen secuencialmente al pulsar "Guardar".
- Si el admin además seleccionó al usuario y pulsa "Reservar" (botón principal), también se crea daily para ese día concreto. Operación combinable.

Para el "modo release" del modal (puesto ya ocupado), no aplica: solo se libera lo del día.

Para el "modo fixed", no aplica: el desk ya tiene fijo y los weeklies no se pueden crear ahí.

### Decisión 9: Listado en admin panel

Pestaña/sección nueva "Recurrencias semanales" en el admin panel actual. Tabla `desk · user · día · borrar`. Se carga vía `GET /api/offices/:id/weekly`. **Fuera del scope crítico**: si por tiempo no llego, lo dejo para change futuro y el admin gestiona desde el modal del 026.

## Risks / Trade-offs

- **Cómputo de oficina más caro**: añadir weeklies a la query del detalle de oficina implica un JOIN extra y filtrado por `dow`. Para volumen actual (50 desks, ~200 usuarios, decenas de weeklies por oficina) imperceptible. Si llegamos a oficinas grandes, índice por `(desk_id, dow)` ya cubre.
- **Modal admin más cargado**: 7 checkboxes por fila de usuario. Para una oficina con 100 usuarios = 700 checkboxes en el DOM. Aceptable; la lista hace scroll y solo se monta al abrir el modal.
- **Edge case `bookings.UNIQUE(user_id, date)`**: si Ana tiene weekly L en desk5 y daily real martes en desk7, OK (date distinta). Si Ana tiene weekly L en desk5 y un admin le reserva daily L en desk7, el daily gana en desk7 pero Ana **deja de aparecer** en desk5 ese L. Nuestra UI debe reflejar eso correctamente: el desk5 queda libre ese L.

## Migration Plan

1. Migración SQL `0NNN_weekly_assignments.sql` con tabla + tabla `weekly_exceptions` + índices.
2. Repo `weekly-assignments.ts` con `create`, `delete`, `listByOffice`, `findActiveForDate(deskId, isoDate)`.
3. Servicio `computeBookingsForDate` adaptado para incluir weeklies (refactor pequeño en `offices.ts`).
4. Endpoints CRUD weekly con guarda admin + tests integración.
5. Frontend: helper `dowOfDate` en shared, UI checkbox en modal admin, llamadas POST/DELETE.
6. Validación final.
