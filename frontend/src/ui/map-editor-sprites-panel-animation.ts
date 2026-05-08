/**
 * Helper para construir la animación CSS de la preview de un sprite Aseprite
 * en el panel SPRITES (change 025).
 *
 * El helper separa los datos del sprite (tamaño de frame, número de frames,
 * duración) de la presentación. Quien llama (`buildSpriteAnimationCss`) decide
 * la escala a la que se renderiza el preview pasando `targetHeight`. El
 * helper genera `@keyframes` y `animation` consistentes con esa escala: el
 * `background-position-x` final coincide con el ancho del PNG escalado, y
 * `background-size` debe coincidir.
 *
 * Asume que todos los frames del tag tienen la misma duración (limitación de
 * CSS `steps()`). Si el tag no existe o no tiene frames, devuelve `null`.
 */

interface AsepriteFrame {
  frame: { x: number; y: number; w: number; h: number };
  duration: number;
}

interface AsepriteJson {
  frames?: Record<string, AsepriteFrame>;
  meta?: {
    frameTags?: Array<{ name: string; from: number; to: number }>;
  };
}

export interface SpriteAnimationCss {
  keyframes: string;
  animation: string;
  /** Identificador único de la regla `@keyframes` para inyectarla en el DOM. */
  keyframesName: string;
  /** Ancho de un frame ESCALADO al targetHeight en píxeles. */
  frameWidthScaled: number;
  /** Alto del frame ESCALADO (= targetHeight) en píxeles. */
  frameHeightScaled: number;
  /** Número total de frames del tag. */
  totalFrames: number;
}

export function buildSpriteAnimationCss(
  jsonAseprite: AsepriteJson | undefined,
  tagName: string | undefined,
  spriteId: string,
  targetHeight: number,
): SpriteAnimationCss | null {
  if (!jsonAseprite) return null;
  const frames = jsonAseprite.frames;
  if (!frames) return null;

  const tags = jsonAseprite.meta?.frameTags ?? [];
  let from = 0;
  let to = -1;
  if (tagName) {
    const tag = tags.find((t) => t.name === tagName);
    if (tag) {
      from = tag.from;
      to = tag.to;
    }
  }
  if (to < 0) {
    // Sin tag o tag desconocido: usar el primer tag disponible.
    if (tags.length > 0) {
      from = tags[0]!.from;
      to = tags[0]!.to;
    } else {
      return null;
    }
  }

  const firstFrame = frames[String(from)];
  if (!firstFrame) return null;
  const w = firstFrame.frame.w;
  const h = firstFrame.frame.h;
  const totalFrames = to - from + 1;
  const totalDurationMs = totalFrames * firstFrame.duration;

  // Escalamos al alto pedido manteniendo el ratio. Trabajamos en píxeles ya
  // escalados para que el `@keyframes` y el `background-size` que usa el panel
  // queden en la misma unidad. Si calculamos el `keyframes` con el ancho del
  // PNG original pero el panel pone `background-size` escalado, el cursor de
  // la animación se sale del PNG y se ven sprites mezclados / cortados.
  const scale = targetHeight / h;
  const frameWidthScaled = w * scale;
  const frameHeightScaled = targetHeight;
  const totalWidthScaled = frameWidthScaled * totalFrames;

  // Nombre único por sprite. Si en el futuro se reutiliza el mismo sprite en
  // varias filas no choca; CSS permite múltiples elementos con la misma anim.
  const keyframesName = `vo-sprite-anim-${spriteId.replace(/[^a-z0-9_-]/gi, "_")}`;

  // Animación lineal de `background-position-x` desde 0 hasta -totalWidthScaled
  // con `steps(totalFrames)` para saltos discretos entre frames. La unidad
  // coincide con el `background-size` que pone el panel.
  const keyframes = `@keyframes ${keyframesName} {\n  from { background-position-x: 0; }\n  to { background-position-x: -${String(totalWidthScaled)}px; }\n}`;
  const animation = `${keyframesName} ${String(totalDurationMs)}ms steps(${String(totalFrames)}) infinite`;

  return {
    keyframes,
    animation,
    keyframesName,
    frameWidthScaled,
    frameHeightScaled,
    totalFrames,
  };
}
