# Tareas: Selector de fecha en HUD

Ciclo TDD por tarea: test (red) → implementación (green) → refactor → marcar [x].

## 1. Lógica del grid mensual

- [x] 1.1 (test unit) `buildMonthGrid(2026, 4, "2026-05-06", {history:30, horizon:60})` produce 6 filas y la primera comienza en lunes — escribir test primero.
- [x] 1.2 (test unit) Día `2026-05-06` aparece marcado `isToday: true`.
- [x] 1.3 (test unit) Días `< hoy - 30 días` están marcados `isOutOfHorizon: true`.
- [x] 1.4 (test unit) Días `> hoy + 59 días` están marcados `isOutOfHorizon: true`.
- [x] 1.5 (test unit) Días del mes anterior/siguiente que aparecen en bordes tienen `inMonth: false`.
- [x] 1.6 (test unit) `prevMonthDisabled` cuando todo el mes anterior está fuera de horizonte.
- [x] 1.7 (test unit) `nextMonthDisabled` cuando todo el mes siguiente está fuera de horizonte.
- [x] 1.8 Implementar `frontend/src/ui/day-picker-grid.ts` con `buildMonthGrid` y tipos `DayCell`, `MonthGrid`.

## 2. Componente day-picker

- [x] 2.1 (test unit) `mountDayPicker(anchor)` añade un overlay con id `day-picker` al body — escribir test primero.
- [x] 2.2 (test unit) `mountDayPicker` segunda llamada sin `unmount` previo es idempotente.
- [x] 2.3 (test unit) `unmountDayPicker()` quita el overlay.
- [x] 2.4 (test unit) `isDayPickerOpen()` retorna estado.
- [x] 2.5 (test unit) Click en una celda válida llama a `uiStore.setDate(iso)` y desmonta.
- [x] 2.6 (test unit) Click en celda fuera de horizonte no llama a setDate.
- [x] 2.7 (test unit) Botón `<` del header retrocede mes (cambia el grid renderizado).
- [x] 2.8 (test unit) Botón `>` del header avanza mes.
- [x] 2.9 (test unit) Botón `<` deshabilitado cuando `prevMonthDisabled`.
- [x] 2.10 Implementar `frontend/src/ui/day-picker.ts`.

## 3. Cierre del overlay

- [x] 3.1 (test unit) Click fuera del overlay cierra — escribir test primero.
- [x] 3.2 (test unit) Click dentro del overlay no cierra.
- [x] 3.3 (test unit) Tecla `Esc` cierra.
- [x] 3.4 Implementar listeners y cleanup al unmount.

## 4. Integración en HUDScene

- [x] 4.1 (test unit) Click en `dateLabel` monta day-picker — escribir test primero.
- [x] 4.2 (test unit) Click en `dateLabel` con picker abierto lo cierra (toggle).
- [x] 4.3 (test unit) Atajo `c` también abre/cierra.
- [x] 4.4 Modificar `HUDScene.create` y `mountSelectorOverlay` (no, eso es otro overlay) — añadir `setInteractive` al `dateLabel` y `pointerdown`.
- [x] 4.5 Cleanup del picker en `Phaser.Scenes.Events.SHUTDOWN`.

## 5. Estilos CSS

- [x] 5.1 Añadir bloque `.day-picker*` a `frontend/src/style.css` con grid 7 columnas, paleta arcade, hover, estados.
- [x] 5.2 Verificar que no rompe estilos existentes de admin-panel ni tooltip.

## 6. Verificación

- [x] 6.1 `pnpm test` (unit) en verde.
- [x] 6.2 `pnpm typecheck && pnpm lint && pnpm format:check` en verde.
- [x] 6.3 `pnpm e2e:chromium` no introduce regresiones (los tests de navegación entre días siguen pasando).
- [x] 6.4 `openspec validate --all --strict` en verde.
- [x] 6.5 Prueba manual:
  - Click en la fecha del HUD abre calendario.
  - Click en otro día cambia la fecha y cierra.
  - Esc cierra sin cambiar.
  - Días fuera del horizonte aparecen atenuados y no responden al click.
  - Las flechas de mes navegan correctamente y se deshabilitan en los extremos del horizonte.
