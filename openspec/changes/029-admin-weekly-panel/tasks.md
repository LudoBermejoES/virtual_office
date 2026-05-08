# Tasks

> Depende de que el change 028 esté implementado y archivado.

## 1. Backend (mínimo)

- [ ] 1.1 Decidir: ¿añadir campo `exceptions: string[]` al payload de `GET /api/offices/:id/weekly` o crear endpoint dedicado? (preferencia: campo embebido si la query es barata).
- [ ] 1.2 Test integración: weekly con N excepciones futuras devuelve `exceptions: [...]` ordenadas por fecha.
- [ ] 1.3 Implementar el cambio mínimo en `weeklyRepo.listByOffice` para incluir excepciones (LEFT JOIN + GROUP BY o N+1 si es más simple).

## 2. UI: pestaña "Recurrencias"

- [ ] 2.1 Test unit: pestaña no aparece para member.
- [ ] 2.2 Test unit: pestaña carga `GET /api/offices/:id/weekly` y renderiza tabla.
- [ ] 2.3 Test unit: filtros por usuario y por dow reducen filas.
- [ ] 2.4 Test unit: botón borrar con confirm llama `DELETE /api/desks/:id/weekly/:weeklyId`.
- [ ] 2.5 Test unit: badge de excepciones aparece cuando weekly tiene `exceptions.length > 0`.
- [ ] 2.6 Implementar la pestaña en `frontend/src/ui/admin-panel.ts` (nueva sección `RECURRENCIAS` siguiendo el patrón de las existentes).
- [ ] 2.7 Implementar el popover de excepciones con "Limpiar todas".

## 3. Validación final

- [ ] 3.1 `openspec validate --all --strict` en verde.
- [ ] 3.2 `pnpm typecheck && pnpm lint && pnpm format:check` en verde.
- [ ] 3.3 `pnpm test` en verde.
