# Diseño técnico: Videogame Typography

## Fuentes

Cargadas desde el change `001` con FontFace API antes de iniciar Phaser. Este change formaliza dónde se usa cada una:

| Uso | Fuente | Tamaños |
|-----|--------|---------|
| Títulos, botones, etiquetas de fecha, labels de desk | Press Start 2P | 16, 24 |
| Cuerpo, mensajes, tooltips, descripción de modales | VT323 | 20, 24 |

Se descarta Pixelify Sans en esta primera versión para no introducir una tercera fuente.

## Paleta

```css
:root {
  --color-bg: #0b0d1a;          /* azul muy oscuro */
  --color-bg-2: #131526;
  --color-fg: #f5f5f5;          /* casi blanco */
  --color-muted: #8e92a8;
  --color-accent: #ff66cc;      /* rosa arcade */
  --color-success: #36e36c;     /* verde reserva libre / propia */
  --color-danger: #ff4d6d;      /* rojo ocupado */
  --color-warning: #ffd166;
  --color-fixed: #b66dff;       /* violeta fixed */
  --color-cyan: #5cf6ff;        /* cian pulse para "mine" */
}
```

Las constantes equivalentes en TypeScript viven en `src/render/theme.ts`:

```ts
export const THEME = {
  bg: 0x0b0d1a,
  fg: 0xf5f5f5,
  free: 0x36e36c,
  occupied: 0xff4d6d,
  mine: 0x5cf6ff,
  fixed: 0xb66dff,
};
```

## Componentes con look arcade

### Botones 9-slice

Asset `public/assets/ui/frame-9slice.png` (96×96, esquinas 16×16). Componente Phaser:

```ts
function arcadeButton(scene, x, y, label, onClick) {
  const frame = scene.add.nineslice(x, y, "frame-9slice", 0, 200, 56, 16, 16, 16, 16)
    .setOrigin(0.5).setInteractive({ useHandCursor: true });
  const text = scene.add.text(x, y, label, {
    fontFamily: "Press Start 2P",
    fontSize: "16px",
    color: "#f5f5f5",
  }).setOrigin(0.5).setRoundPixels(true);
  frame.on("pointerdown", () => {
    text.setY(y + 2); // efecto press
    soundButton.play();
  });
  frame.on("pointerup", () => { text.setY(y); onClick(); });
  return { frame, text };
}
```

### Modales HTML

Modales (login, invitación, upload mapa, asignar fijo) usan HTML overlay con la misma paleta y fuentes:

```css
.modal {
  background: var(--color-bg-2);
  border: 4px solid var(--color-accent);
  font-family: var(--font-body);
  color: var(--color-fg);
}
.modal h2 {
  font-family: var(--font-display);
  font-size: 16px;
}
```

## Sonidos (opcional, mute por defecto)

`public/assets/audio/`:
- `beep-click.wav` — click de botón
- `beep-booked.wav` — confirmación de reserva
- `beep-error.wav` — error 4xx

Toggle en HUD: un icono de altavoz que persiste estado en `localStorage`. Por defecto muted.

## Phaser config

```ts
{
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: false, mipmapFilter: "NEAREST" },
}
```

## Visual regression

Tests Playwright con `page.screenshot({ clip })` recortado al canvas Phaser. Baselines en `tests/e2e/visual/__screenshots__/`. Toleran 0.1% diff de píxeles (anti-flake leve por antialiasing del navegador en bordes del canvas). Cualquier baseline cambia solo en commit dedicado.

## Documentación

`doc/fe/THEME.md` (creado en este change) con:
- Tabla de variables CSS y su uso.
- Tabla de tamaños de Press Start 2P (8, 16, 24, 32) con captura.
- Capturas representativas de `LoginScene`, `OfficeScene`, modal de reserva, modal admin.
- Reglas: "no usar fuentes fuera de las dos definidas; no introducir colores fuera de la paleta sin actualizar la guía".

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Press Start 2P pixela mal a tamaños no múltiplo de 8 | Linter visual: tamaño cuestionable → warning en revisión |
| Visual regression flaky entre sistemas operativos | Configurar Playwright `expect.toMatchSnapshot` con `maxDiffPixelRatio: 0.001` y solo correr en Chromium Linux en CI |
| FOUT si la fuente no termina antes de Phaser | Ya resuelto en `001` con `await document.fonts.load` |
