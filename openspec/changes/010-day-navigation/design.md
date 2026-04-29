# Diseño técnico: Day Navigation

## UI

`HUDScene` añade tres elementos:

```
┌──────────────────────────────────────────────────────┐
│  [<]  jueves 7 de mayo de 2026  [>]      [Hoy]      │
└──────────────────────────────────────────────────────┘
```

- `<` y `>` son botones de Phaser con look pixel arcade.
- Etiqueta de fecha es un `Text` con Press Start 2P 16px o VT323 24px (más legible).
- `[Hoy]` aparece solo si la fecha actual ≠ hoy.

## Estado

```ts
// store/ui.ts
type UiStore = {
  selectedDate: string;     // YYYY-MM-DD
  setDate(d: string): void;
  next(): void;             // selectedDate + 1
  prev(): void;             // selectedDate - 1
  today(): void;            // hoy en TZ del navegador
};
```

`setDate` valida horizonte y hace `refetchOffice(officeId, date)` (snapshot del día).

## Atajos teclado

```
ArrowLeft   → ui.prev()
ArrowRight  → ui.next()
Home        → ui.today()
```

Solo activos en `OfficeScene` (no en modales o admin scene).

## Cálculo de fecha cliente

`packages/shared/src/date.ts`:

```ts
export function todayInTz(tz: string = "Europe/Madrid"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date());
}
export function addDays(date: string, n: number): string { ... }
export function formatLong(date: string, locale = "es-ES"): string {
  // "jueves 7 de mayo de 2026"
}
```

`Intl.DateTimeFormat("en-CA")` da el formato YYYY-MM-DD canonical para el día local.

## Límites de navegación

- Hacia adelante: hasta `today + BOOKING_HORIZON_DAYS - 1`. Día siguiente al límite: botón `>` deshabilitado.
- Hacia atrás: hasta `today - HISTORY_VISIBLE_DAYS` (default 30). Botón `<` deshabilitado en el límite.

## Persistencia

`sessionStorage.setItem("teimas-space:date", date)` en cada `setDate`. Al abrir la app:

```ts
const stored = sessionStorage.getItem("teimas-space:date");
const today = todayInTz();
ui.selectedDate = (stored && stored >= today - 0) ? stored : today;
```

Decisión: si la pestaña se cierra y reabre al día siguiente, el día visitado anterior puede ser ayer; en ese caso volvemos a hoy.

## Snapshot en cambio de día

```
ui.setDate(new) →
  refetch GET /api/offices/:id?date=new →
    store.replaceBookings(response.bookings)
```

La WebSocket sigue abierta (nivel oficina, no día). Solo se aplican deltas que afecten al día seleccionado actual:

```ts
function shouldApply(msg: WsServerMessage, selectedDate: string): boolean {
  if (msg.type === "desk.booked" || msg.type === "desk.released") {
    return msg.date === selectedDate;
  }
  return true; // fixed y office.updated afectan a todos los días
}
```

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Cambio de día rápido (spam de teclado) → races | Debounce 150 ms en `setDate` |
| TZ del usuario distinta a la del server hace que "hoy" diverja | `todayInTz` usa la TZ del navegador; backend tolera 1 día |
| Cambio de horario verano/invierno | `Intl.DateTimeFormat` lo gestiona |
