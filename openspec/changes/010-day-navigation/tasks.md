# Tareas: Day Navigation

## 1. Dominio (shared)

- [ ] 1.1 `packages/shared/src/date.ts` con `todayInTz`, `addDays`, `formatLong`, `withinHorizon`.
- [ ] 1.2 (test unit) `addDays` cruza fin de mes (`2026-04-30 + 1 = 2026-05-01`).
- [ ] 1.3 (test unit) `addDays` cruza año (`2026-12-31 + 1 = 2027-01-01`).
- [ ] 1.4 (test unit) `formatLong("2026-05-07", "es-ES")` devuelve "jueves 7 de mayo de 2026".
- [ ] 1.5 (test unit) `withinHorizon` true entre [hoy-30, hoy+59], false fuera.

## 2. Frontend: store

- [ ] 2.1 Crear `state/ui.ts` con `selectedDate`, `setDate`, `next`, `prev`, `today`.
- [ ] 2.2 (test unit FE) `setDate` valida horizonte; rechaza fuera.
- [ ] 2.3 Persistir en `sessionStorage` en cada `setDate`.
- [ ] 2.4 Al boot, leer `sessionStorage`; si stale, default a hoy.

## 3. Frontend: HUD

- [ ] 3.1 `HUDScene` añade botones `<`, `>`, `[Hoy]` y etiqueta fecha.
- [ ] 3.2 Botones llaman a `store.prev/next/today`.
- [ ] 3.3 `<` y `>` deshabilitados al alcanzar los límites.
- [ ] 3.4 Atajos teclado `←`, `→`, `Home`.
- [ ] 3.5 Solo activos en `OfficeScene` (no si modal abierto o `AdminMapScene` activa).

## 4. Frontend: integración con snapshot y WS

- [ ] 4.1 Cambio de día → `refetchOffice(officeId, date)` y `store.replaceBookings`.
- [ ] 4.2 La WS no se reconecta; solo se filtran los deltas que afectan al día seleccionado.
- [ ] 4.3 (test unit FE) `shouldApply` filtra `desk.booked` por fecha.
- [ ] 4.4 Debounce 150 ms en `setDate` para evitar spam.

## 5. E2E

- [ ] 5.1 (e2e) `→` avanza un día y se refleja en la etiqueta y en el snapshot recibido.
- [ ] 5.2 (e2e) `←` retrocede un día.
- [ ] 5.3 (e2e) En el horizonte máximo, `→` está deshabilitado.
- [ ] 5.4 (e2e) Botón "Hoy" vuelve al día actual.
- [ ] 5.5 (e2e) Mientras Alice ve el día +3, Bob reserva en el día +3 → Alice lo ve sin recargar.
- [ ] 5.6 (e2e) Bob reserva en el día +5 mientras Alice ve el +3 → Alice no ve cambio en su día (filtro), pero al ir al +5 sí.

## 6. Verificación

- [ ] 6.1 Coverage ≥ 80% en `state/ui.ts`, `date.ts`, `shouldApply`.
- [ ] 6.2 `pnpm test` y `pnpm e2e:chromium` en verde.
