import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Una "strip" representa una fila lógica de animación. Un PNG puede contener
 * varias strips si su altura es múltiplo del `tile` (grid 2D).
 */
export interface Strip {
  /** Nombre lógico de la animación (basename sin ext, con sufijo `__rowN` si N>1). */
  filename: string;
  /** Ruta absoluta del PNG fuente. */
  fullPath: string;
  /** Ancho en píxeles del PNG fuente. */
  width: number;
  /** Frames en esta strip = width / tile. */
  frameCount: number;
  /** Índice de fila dentro del PNG fuente (0 si single-row). */
  sourceRow: number;
}

export interface StripMeta {
  width: number;
  height: number;
}

const IMAGE_RE = /\.png$/i;

export function listStrips(dir: string, recursive = false): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (recursive) walk(full);
        continue;
      }
      if (st.isFile() && IMAGE_RE.test(entry)) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out.sort((a, b) => a.localeCompare(b));
}

export interface ValidateResult {
  ok: boolean;
  reason?: string;
}

export function validateStrip(meta: StripMeta, tile: number): ValidateResult {
  if (meta.height % tile !== 0 || meta.height === 0) {
    return {
      ok: false,
      reason: `strip_height_not_multiple_of_tile: alto ${meta.height} no es múltiplo de ${tile}`,
    };
  }
  if (meta.width % tile !== 0 || meta.width === 0) {
    return {
      ok: false,
      reason: `strip_width_not_multiple_of_tile: ancho ${meta.width} no es múltiplo de ${tile}`,
    };
  }
  return { ok: true };
}
