/**
 * Día de la semana en convención ISO 8601 (es-ES): 0=lunes ... 6=domingo.
 *
 * Usado por el change 027 (weekly recurring assignments) para indexar
 * `weekly_assignments.dow`. JS nativo `Date.getUTCDay()` devuelve 0=domingo,
 * por eso la transformación `(getUTCDay() + 6) % 7`.
 *
 * Importante: la entrada es ISO `yyyy-mm-dd`. Se interpreta en UTC para
 * evitar saltos por DST/timezone local del cliente.
 */
export function dowOfDate(isoDate: string): number {
  const d = new Date(isoDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) {
    throw new Error(`dowOfDate: fecha inválida "${isoDate}"`);
  }
  return (d.getUTCDay() + 6) % 7;
}

/** Etiquetas en castellano para mostrar en UI. Índice = dow. */
export const DOW_LABELS_ES = ["L", "M", "X", "J", "V", "S", "D"] as const;

export const DOW_LABELS_LONG_ES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;
