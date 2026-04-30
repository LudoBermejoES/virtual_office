# Diseño técnico: Fixed Desk Assignment

## Decisión: tabla aparte, no filas en `bookings`

Dos alternativas:

1. **Materializar fixed bookings** como filas reales en `bookings` con `type='fixed'`, una por cada día del horizonte.
2. **Tabla `fixed_assignments` separada** y materializar virtualmente en lectura.

Elegimos **(2)**:

- No infla la tabla `bookings` con N×horizonte filas.
- Cambiar la asignación es un único UPDATE en lugar de un DELETE+INSERT en cascada.
- La consulta `GET /api/offices/:id?date=X` hace `LEFT JOIN` para inyectar la fixed cuando corresponde.

## Migración

`migrations/0003_fixed_assignments.sql`:

```sql
CREATE TABLE fixed_assignments (
  id INTEGER PRIMARY KEY,
  desk_id INTEGER NOT NULL UNIQUE REFERENCES desks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`UNIQUE(desk_id)` y `UNIQUE(user_id)` aseguran 1:1.

## Endpoints

```
POST   /api/desks/:id/fixed     admin   { userId }   → 201 { fixed }
DELETE /api/desks/:id/fixed     admin                 → 204
```

### Reglas

- `POST` falla con 409 si el desk ya tiene fixed (para reasignar, primero DELETE).
- `POST` falla con 409 si el user ya tiene un fixed en otro desk.
- `POST` falla con 404 si user o desk no existen.
- Asignar fixed cuando hay daily booking en el día actual: el fixed gana en futuras consultas pero **no** borra el daily existente. Decisión: log warn y dejar al admin la decisión.

## Lectura: `GET /api/offices/:id?date=YYYY-MM-DD`

Algoritmo:

```
1. SELECT desks WHERE office_id=:id
2. SELECT b.*, u.* FROM bookings b JOIN users u ON ... WHERE b.date=:date AND b.desk_id IN (...)
3. SELECT f.*, u.* FROM fixed_assignments f JOIN users u ON ... WHERE f.desk_id IN (...)
4. para cada desk:
     - si tiene daily booking en :date → reportar { type: 'daily', user: ... }
     - else if tiene fixed → reportar { type: 'fixed', user: ... }
     - else → libre
```

Resultado: `bookings` siempre muestra el "ocupante efectivo del día", combinando los dos modelos.

## Frontend

### Estado del desk

```ts
type DeskState = "free" | "mine" | "occupied" | "fixed";
```

Se calcula:

```ts
function deskState(desk, bookings, me): DeskState {
  const b = bookings.find(b => b.deskId === desk.id);
  if (!b) return "free";
  if (b.type === "fixed" && b.userId === me.id) return "fixed"; // visualmente fixed aunque sea el mío
  if (b.type === "fixed") return "fixed";
  if (b.userId === me.id) return "mine";
  return "occupied";
}
```

### Render

- Color violeta `--color-fixed` (#b66dff).
- Icono 📌 emoji o sprite custom encima del cuadrado.
- Click sobre fixed → tooltip "Puesto fijo de Ludo" sin acción para non-admin; para admin abre opción "Liberar fijo".

### Modal admin "Asignar fijo"

- En `AdminMapScene`: click derecho sobre un desk → menú "Asignar como puesto fijo".
- Modal lista usuarios buscables; al seleccionar, POST.
- Si el desk o el user ya tiene fixed, el error 409 se muestra con mensaje legible.

## Validaciones que no aplica

- `POST /api/desks/:id/bookings` con `type='daily'` sigue funcionando incluso si el desk tiene fixed: el daily gana en ese día. Decisión: documentado, no es un caso de uso pero no se prohibe.
  - Nota: este caso es controvertido. Marcar como "fuera de scope" y rechazar con 409 desk_has_fixed_assignment quizá sea mejor. Decisión inicial: **rechazar 409** para evitar confusión, y abrir un change futuro si se necesita la cesión temporal.

## Migración de UI

`OfficeScene.deskRenderer` ya soporta el estado `fixed` desde `006`. Aquí solo se materializa correctamente desde el backend.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Daily preexistente coexiste con fixed nuevo | El admin decide; UI muestra warning |
| Borrar usuario rompe fixed | `ON DELETE CASCADE` lo elimina automáticamente |
| Usuario deja la empresa pero su fixed sigue | Endpoint admin lista fixed huérfanos (futuro) |
