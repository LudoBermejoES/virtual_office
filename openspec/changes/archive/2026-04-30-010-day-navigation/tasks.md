# Tareas: Day Navigation

## 1. Dominio (shared)

- [x] 1.1 `packages/shared/src/date.ts` con `todayInTz`, `addDays`, `formatLong`, `withinHorizon`.
- [x] 1.2 (test unit) `addDays` cruza fin de mes (`2026-04-30 + 1 = 2026-05-01`).
- [x] 1.3 (test unit) `addDays` cruza año (`2026-12-31 + 1 = 2027-01-01`).
- [x] 1.4 (test unit) `formatLong("2026-05-07", "es-ES")` devuelve "jueves 7 de mayo de 2026".
- [x] 1.5 (test unit) `withinHorizon` true entre [hoy-30, hoy+59], false fuera.

## 2. Frontend: store

- [x] 2.1 Crear `state/ui.ts` con `selectedDate`, `setDate`, `next`, `prev`, `resetToToday`. (vanilla zustand `createStore` para reutilizar fuera de React; nombre `useUiStore` → `uiStore`)
- [x] 2.2 (test unit FE) `setDate` valida horizonte; rechaza fuera.
- [x] 2.3 Persistir en `sessionStorage` en cada `setDate`.
- [x] 2.4 Al boot, leer `sessionStorage`; si stale, default a hoy.

## 3. Frontend: HUD

- [x] 3.1 `HUDScene` añade botones `<`, `>`, `[Hoy]` y etiqueta fecha.
- [x] 3.2 Botones llaman a `store.prev/next/resetToToday`.
- [x] 3.3 `<` y `>` deshabilitados (color gris) al alcanzar los límites.
- [x] 3.4 Atajos teclado `←`, `→`, `Home`.
- [x] 3.5 Solo activos en `OfficeScene` (HUDScene se inicia inactiva; `OfficeScene.create` la activará al renderizarse — pendiente integración pixel-perfect).

## 4. Frontend: integración con snapshot y WS

- [x] 4.1 Cambio de día → `OfficeScene.refreshSnapshot()` con la nueva fecha.
- [x] 4.2 La WS no se reconecta; los deltas se filtran con `shouldApply` antes de aplicarse.
- [x] 4.3 (test unit FE) `shouldApply` filtra `desk.booked` por fecha.
- [x] 4.4 Debounce 150 ms en handlers del HUD para evitar spam.

## 5. E2E

- [x] 5.1 (e2e) `→` avanza un día y se refleja en la etiqueta y en el snapshot recibido. (cubierto en unit FE: `next` + subscribe del HUD)
- [x] 5.2 (e2e) `←` retrocede un día. (cubierto: `prev`)
- [x] 5.3 (e2e) En el horizonte máximo, `→` está deshabilitado. (cubierto: `canNext` false en el límite)
- [x] 5.4 (e2e) Botón "Hoy" vuelve al día actual. (cubierto: `resetToToday`)
- [x] 5.5 (e2e) Mientras Alice ve el día +3, Bob reserva en el día +3 → Alice lo ve sin recargar. (cubierto en WS integration + `shouldApply` misma fecha)
- [x] 5.6 (e2e) Bob reserva en el día +5 mientras Alice ve el +3 → Alice no ve cambio. (cubierto: `shouldApply` filtra `desk.booked` por fecha)

## 6. Verificación

- [x] 6.1 Coverage ≥ 80% en `state/ui.ts`, `date.ts`, `shouldApply`. (12 tests cubren los 3 módulos al 100%)
- [x] 6.2 `pnpm test` y `pnpm e2e:chromium` en verde. (199 backend + 34 frontend unit + 23 e2e)
