# Propuesta: Selector de fecha tipo calendario en HUD

## Motivación

Hoy la navegación entre días en el HUD se limita a las flechas `<` `>` (tecla `←` `→`) avanzando un día por pulsación. Si el usuario quiere ver una fecha lejana (por ejemplo dentro de 3 semanas para reservar puesto antes de un viaje), debe pulsar la flecha decenas de veces. Es tedioso y poco descubrible.

Queremos que **al hacer clic en la etiqueta de fecha del HUD**, se despliegue un calendario mensual con estética arcade, manteniendo la coherencia tipográfica (Press Start 2P + VT323) y de paleta del resto de la app.

## Alcance

**En scope:**

### A. Etiqueta de fecha clicable

- En `HUDScene`, el `dateLabel` (`Phaser.GameObjects.Text`) recibe `setInteractive({ useHandCursor: true })` y un handler `pointerdown` que monta el overlay del calendario.
- Cursor pointer al pasar por encima.
- Atajo de teclado `c` (de "calendar") para abrir/cerrar.

### B. Overlay HTML `DayPickerOverlay`

- Componente nuevo `frontend/src/ui/day-picker.ts` con `mountDayPicker(anchorEl?)` y `unmountDayPicker()`.
- Posición: anclado debajo del `dateLabel` cuando se abre, centrado horizontalmente bajo el label en pantalla. Si no cabe (margen inferior), se ancla por encima.
- Render: grid mensual 7 columnas × 6 filas como máximo.
- Header: nombre del mes y año en mayúsculas (Press Start 2P, color `--color-success`), flechas `<` `>` para navegar mes.
- Días de semana (LU MA MI JU VI SA DO) en VT323, `--color-muted`.
- Celdas:
  - Día seleccionado: fondo `--color-accent` (rosa), texto oscuro.
  - Día = hoy: borde verde brillante.
  - Día fuera de horizonte (`< hoy - HISTORY_VISIBLE_DAYS` o `> hoy + BOOKING_HORIZON_DAYS - 1`): atenuado, `cursor: default`, click ignorado.
  - Día normal: hover suave, `cursor: pointer`.
- Click en celda válida: `uiStore.getState().setDate(iso)` → desmonta overlay.

### C. Cierre del overlay

- Click fuera del panel: cierra.
- Tecla `Esc`: cierra.
- Click en otro día: cierra.
- Click en `dateLabel` con overlay abierto: cierra (toggle).

### D. Navegación de meses

- Flecha `<` del header retrocede un mes.
- Flecha `>` avanza un mes.
- No se permite navegar a meses cuyas fechas estén todas fuera del horizonte (las flechas se deshabilitan visualmente).

### E. Estética arcade

- Caja con borde 2px en `--color-success` y fondo `--color-bg-2`.
- Tipografías:
  - Header (mes/año): Press Start 2P, 12px.
  - Días de semana: VT323, 14px.
  - Días numéricos: VT323, 18px.
- Sin sombras suaves; bordes pixelados (`image-rendering: pixelated` ya global).
- Sonido retro `beep-click` al cambiar de mes o seleccionar día (reusa `soundManager`).

### F. Atajos de teclado dentro del overlay

- `←` `→`: día anterior / siguiente (sin cambiar mes salvo cambio natural).
- `↑` `↓`: semana anterior / siguiente.
- `Enter`: selecciona el día actualmente enfocado.
- `Esc`: cierra sin cambiar.

**Fuera de scope:**

- Selector de rango (sólo día único).
- Sincronización del mes mostrado con la fecha seleccionada al reabrir (siempre arranca en el mes de la fecha seleccionada — ya por defecto).
- Soporte i18n más allá del castellano (mes y días en castellano).

## Operación

- Sin cambios de DB, sin migración, sin endpoint nuevo.
- Solo frontend.
- Tests unit Vitest del cálculo de grid y de navegación; sin necesidad de e2e dedicado (los e2e existentes de `day-navigation` siguen pasando).
