## Why

Tras el change 027 los admins pueden crear weeklies vía el modal de reserva (cambios 026+027), y tras el 028 podrán saltarse o borrar weeklies un día concreto. Lo que sigue faltando: una **vista global** donde el admin vea TODAS las weeklies activas de su oficina y las pueda gestionar en bulk sin tener que ir desk por desk.

Casos reales:

- "¿Quién viene los lunes este mes?" — necesita listar weeklies filtradas por dow.
- "Ana se va de la empresa, hay que liberar todos sus puestos recurrentes" — necesita filtrar por user y borrar varias weeklies de un golpe.
- "El desk 5 ya no se va a usar" — listar weeklies por desk.
- "¿Qué excepciones hay activas esta semana?" — listar `weekly_assignment_exceptions` con su weekly asociada.

Hoy todas estas operaciones son posibles vía API (change 027 ya tiene `GET /api/offices/:id/weekly`) pero la UI obliga a abrir un modal por desk. Para una oficina con 50 desks y 30 weeklies, gestión inviable.

## What Changes

- **Frontend** — Nueva pestaña/sección "RECURRENCIAS" en el admin panel actual, junto a "OFICINAS", "USUARIOS", "FIJOS".
- **UI listado** — Tabla con columnas `Desk · Usuario · Día · Acciones`. Filtros: por usuario, por desk, por dow. Orden por defecto: día → desk.
- **UI acciones inline** — Por fila: botón "Borrar weekly" (con confirm). Si la weekly tiene excepciones activas, mostrar contador "X excepciones" (tooltip con fechas) y botón para listar/limpiar excepciones.
- **Backend (mínimo)** — Posible endpoint nuevo `GET /api/offices/:id/weekly/exceptions` para listar excepciones activas (futuras) por oficina, con join a weekly+desk+user. Si el coste es bajo, se mete en la respuesta del `GET /api/offices/:id/weekly` actual añadiendo un campo `exceptions: [date]` por weekly.
- **No incluye**: vista calendario, exportar a CSV, búsqueda fuzzy. Solo tabla + filtros + acciones inline.

## Impact

- **Specs afectadas**:
  - `ui-game` (pestaña nueva en admin panel).
  - `reservas` (posible adición al payload de `GET /api/offices/:id/weekly` con excepciones embebidas).
- **Código nuevo**:
  - Sección/función nueva en `frontend/src/ui/admin-panel.ts` para la pestaña "RECURRENCIAS".
  - Si añadimos campo `exceptions[]` al payload, adaptación pequeña en `backend/src/http/routes/weekly.ts` y repo.
- **Sin breaking changes**.
- **Sin nuevas dependencias**.

## Dependencias

- Requiere **change 028 implementado** primero. Sin endpoints de excepciones, no tiene sentido mostrarlas en la UI ni ofrecer "limpiar excepciones" como acción.
- El `GET` ya existe del 027.

## Notas

Este change es **principalmente frontend**. El esfuerzo está en filtros, tabla con scroll y wiring con los endpoints existentes/nuevos del 028. Un panel admin completo dedicado a recurrencias.
