# Diseño: Selector de fecha en HUD

## Por qué overlay HTML y no widget Phaser

- A11y nativa (focus, teclado, lectores de pantalla).
- Estilable con CSS variables y tipografías ya cargadas globalmente.
- No interfiere con la cámara/zoom ni con el `setViewport` del map.
- Igual patrón que `admin-panel`, `office-selector` y `tooltip` ya existentes.

## Arquitectura

```
HUDScene (Phaser)
  dateLabel.on("pointerdown") ─► mountDayPicker(dateLabel.world coords)
                                   │
                                   ▼
                       day-picker.ts (HTML overlay)
                                   │
                          uiStore.setDate(iso)
                                   │
                                   ▼
                       OfficeScene escucha subscribe
                       y llama refreshSnapshot()
```

## Construcción del grid

Función pura `buildMonthGrid(year, month, today, horizon)` en `frontend/src/ui/day-picker-grid.ts`:

```ts
interface DayCell {
  iso: string;          // "YYYY-MM-DD"
  day: number;          // 1..31
  inMonth: boolean;     // false si es del mes anterior/siguiente para rellenar
  isToday: boolean;
  isOutOfHorizon: boolean;
}

interface MonthGrid {
  year: number;
  month: number;        // 0..11
  weeks: DayCell[][];   // 6 filas × 7 columnas
  prevMonthDisabled: boolean;
  nextMonthDisabled: boolean;
}
```

Reglas:
- La primera fila contiene los días del mes anterior necesarios para que la columna 0 sea lunes (semana ISO).
- La última fila puede contener días del mes siguiente.
- `isOutOfHorizon` = `iso < addDaysIso(today, -HISTORY_VISIBLE_DAYS) || iso > addDaysIso(today, BOOKING_HORIZON_DAYS - 1)`.
- `prevMonthDisabled` = todo el mes anterior está fuera de horizonte.
- `nextMonthDisabled` = todo el mes siguiente está fuera de horizonte.

Esto se testea sin DOM.

## API del componente

```ts
// frontend/src/ui/day-picker.ts
export function mountDayPicker(anchor?: { x: number; y: number }): void;
export function unmountDayPicker(): void;
export function isDayPickerOpen(): boolean;
```

Estado interno:
- `currentMonth`: `{ year, month }` que se inicializa con la fecha seleccionada del store.
- `focusedDate`: para navegación con teclado.

Subscribe a `uiStore` para si el `selectedDate` cambia mientras está abierto, refresca highlight.

## Posicionamiento

Al montar, recibe `anchor` (coordenadas en pantalla del `dateLabel`):

```ts
const PADDING = 8;
overlay.style.left = `${anchor.x - overlayWidth / 2}px`;
overlay.style.top = `${anchor.y + 32 + PADDING}px`; // 32 = altura del label
// si no cabe debajo, posicionar encima
```

Clamp para que no se salga de la viewport.

## Estética

CSS añadido a `frontend/src/style.css`:

```css
.day-picker {
  position: fixed;
  z-index: 200;
  background: var(--color-bg-2);
  border: 2px solid var(--color-success);
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(7, 32px);
  gap: 2px;
  font-family: var(--font-body);
}
.day-picker__header { /* Press Start 2P */ }
.day-picker__cell {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; user-select: none;
}
.day-picker__cell--today { border: 1px solid var(--color-success); }
.day-picker__cell--selected {
  background: var(--color-accent);
  color: var(--color-bg);
}
.day-picker__cell--out {
  opacity: 0.3; cursor: default;
}
.day-picker__cell--out-of-month {
  opacity: 0.5;
}
```

## Decisiones

### Por qué `c` y no `Space`

`Space` lo usaremos para PTT en change futuro (019 voice). Reservado.

### Por qué se cierra al cambiar día y no se queda abierto

Patrón Discord / Slack: el calendario es un elemento de selección, no un panel persistente. Cerrarlo evita que el usuario vea el grid mientras consulta el mapa.

### Por qué bloque CSS y no inline styles

Los overlays HTML del proyecto mezclan inline (admin-panel) con CSS global (tooltip). Aquí el cálculo de grid 7 columnas y los estados visuales se expresan mejor en CSS, igual que las modales del CSS existente. Coherencia con `.upload-panel` y similares.

## Riesgos

- **Cierre inesperado por click en el mapa Phaser**: Phaser y DOM coexisten; el click en el canvas no propaga al document por defecto, pero sí dispara `mousedown` del browser. Usamos `document.addEventListener("mousedown", outsideClick, { capture: true })` para detectar clicks fuera del overlay.
- **Mes con 6 semanas vs 5**: el grid siempre renderiza 6 filas para que la altura sea estable y no salte al cambiar de mes.

## Tests

- `buildMonthGrid` con varios meses, hoy en distintas posiciones, horizonte que recorta días al inicio/final.
- `mountDayPicker / unmountDayPicker` sobre DOM mock: monta una vez, idempotencia, click fuera cierra, Esc cierra.
- Click en celda llama a `uiStore.setDate(iso)`.
- Mes navegado fuera de horizonte deshabilita las flechas correspondientes.

Sin e2e dedicado: el e2e existente de navegación entre días sigue cubriendo el flujo principal.
