# Guía de tema — Virtual Office

## Paleta de colores

| Variable CSS | Hex | Uso |
|---|---|---|
| `--color-bg` | `#0b0d1a` | Fondo principal del body y Phaser |
| `--color-bg-2` | `#131526` | Fondo de modales y paneles |
| `--color-fg` | `#f5f5f5` | Texto principal, labels |
| `--color-muted` | `#8e92a8` | Texto secundario, botones deshabilitados |
| `--color-accent` | `#ff66cc` | Bordes de modales, énfasis arcade |
| `--color-success` | `#36e36c` | Puestos libres, acciones correctas |
| `--color-danger` | `#ff4d6d` | Puestos ocupados, errores |
| `--color-warning` | `#ffd166` | Avisos, botón "Hoy" |
| `--color-fixed` | `#b66dff` | Puestos con asignación fija |
| `--color-cyan` | `#5cf6ff` | Puesto propio (mine) |

## Constantes Phaser (theme.ts)

```ts
import { THEME } from "./src/render/theme.js";

THEME.bg       // 0x0b0d1a — fondo
THEME.fg       // 0xf5f5f5 — texto
THEME.free     // 0x36e36c — puesto libre
THEME.occupied // 0xff4d6d — puesto ocupado
THEME.mine     // 0x5cf6ff — puesto propio
THEME.fixed    // 0xb66dff — puesto fijo
THEME.accent   // 0xff66cc — acento
THEME.warning  // 0xffd166 — aviso
```

## Tipografías

| Variable CSS | Fuente | Uso |
|---|---|---|
| `--font-display` | Press Start 2P | Títulos, botones, labels de fecha, etiquetas de desk |
| `--font-body` | VT323 | Cuerpo, mensajes, tooltips, descripción de modales |

### Tamaños recomendados

| Uso | Fuente | Tamaño |
|---|---|---|
| Título principal | Press Start 2P | 20px |
| Botones HUD | Press Start 2P | 16px |
| Botones pequeños | Press Start 2P | 12px |
| Cuerpo texto | VT323 | 20-24px |
| Tooltips | VT323 | 18px |
| Feedback en escena | VT323 | 16px |

> Press Start 2P es una fuente de cuadrícula estricta. Usar solo tamaños múltiplo de 8 para máxima nitidez pixel.

## Componentes arcade

### arcadeButton

```ts
import { arcadeButton } from "./src/ui/arcade-button.js";

const { frame, text } = arcadeButton(scene, x, y, "LABEL", () => { /* onClick */ });
// frame: Phaser.GameObjects.NineSlice (frame-9slice.png, 200×56, esquinas 16)
// text:  Phaser.GameObjects.Text (Press Start 2P 16px)
// Efecto press: text baja 2px en pointerdown, vuelve en pointerup
```

### soundManager

```ts
import { soundManager } from "./src/ui/sound.js";

soundManager.isMuted()          // true por defecto
soundManager.toggle()           // alterna y persiste en localStorage
soundManager.play("beep-click") // solo reproduce si !isMuted()
// Sonidos: beep-click | beep-booked | beep-error
```

## Capturas de referencia

Las capturas se generan con Playwright en `tests/e2e/visual.spec.ts` y se almacenan en `tests/e2e/visual.spec.ts-snapshots/`. Regenerar con:

```bash
pnpm e2e:chromium -- --update-snapshots tests/e2e/visual.spec.ts
```

## Reglas de mantenimiento

1. **No introducir nuevas fuentes** sin actualizar esta guía y los specs de `012-videogame-typography`.
2. **No usar colores hardcoded** (`#rrggbb` o `0xRRGGBB`) fuera de `theme.ts`. Toda escena Phaser debe referenciar `THEME.*`.
3. **No usar colores inline en HTML overlay** — usar `var(--color-*)` de `style.css`.
4. **Todos los botones interactivos** en escenas Phaser deben usar `arcadeButton` del `src/ui/arcade-button.ts`.
5. **Cualquier nuevo texto Phaser** debe especificar `fontFamily: '"Press Start 2P"'` o `'"VT323"'` explícitamente — nunca `"sans-serif"` ni la fuente por defecto.
