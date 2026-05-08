# Tasks

> Depende de que el change 028 esté implementado y archivado.

## 1. Backend (mínimo)

- [x] 1.1 Decidir: ¿añadir campo `exceptions: string[]` al payload de `GET /api/offices/:id/weekly` o crear endpoint dedicado? (preferencia: campo embebido si la query es barata). → embebido.
- [x] 1.2 Test integración: weekly con N excepciones futuras devuelve `exceptions: [...]` ordenadas por fecha.
- [x] 1.3 Implementar el cambio mínimo en `weeklyRepo.listByOffice` para incluir excepciones (LEFT JOIN + GROUP BY o N+1 si es más simple).

## 2. UI: pestaña "Recurrencias"

- [x] 2.1 Test unit: pestaña no aparece para member. → cubierto a nivel de panel: el botón ADMIN solo se muestra si `meRole === "admin"` (HUDScene); la pestaña RECURRENCIAS, como el resto, vive dentro del panel admin.
- [x] 2.2 Test unit: pestaña carga `GET /api/offices/:id/weekly` y renderiza tabla.
- [x] 2.3 Test unit: filtros por usuario y por dow reducen filas.
- [x] 2.4 Test unit: botón borrar con confirm llama `DELETE /api/desks/:id/weekly/:weeklyId`.
- [x] 2.5 Test unit: badge de excepciones aparece cuando weekly tiene `exceptions.length > 0`.
- [x] 2.6 Implementar la pestaña en `frontend/src/ui/admin-panel.ts` (extraída a `admin-recurrencias-tab.ts` para testabilidad; admin-panel solo wirea).
- [x] 2.7 Implementar el popover de excepciones con "Limpiar todas".

## 3. Validación final

- [x] 3.1 `openspec validate --all --strict` en verde.
- [x] 3.2 `pnpm typecheck && pnpm lint && pnpm format:check` en verde.
- [x] 3.3 `pnpm test` en verde.
