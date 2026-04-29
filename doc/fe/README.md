# Arquitectura Frontend — Teimas Space

> Phaser 4 + TypeScript + Vite. Escenas separadas por responsabilidad, estado fuera de Phaser, comunicación con backend mediante REST + WebSocket. Estética videojuego con tipografías pixel.

## Resumen ejecutivo

| Decisión | Elección | Por qué |
|----------|----------|---------|
| Framework de juego | **Phaser 4** | Ground-up rebuild del renderer WebGL; estable a inicios 2026; mejor rendimiento móvil |
| Mapa de oficina | **Tiled `.tmj` + tilesets** | Phaser carga nativo con `load.tilemapTiledJSON` y `addTilesetImage`; admin puede pre-colocar puestos en object layer "desks" |
| Lenguaje | **TypeScript** | Mismas razones que el backend; tipos compartidos en `packages/shared` |
| Bundler / dev | **Vite 6** | Plantilla oficial de Phaser; HMR rapidísimo |
| Estado | **Stores ligeros (`zustand` o `nanostores`)** | Phaser maneja render; el estado de dominio vive fuera para poder testearlo |
| HTTP | **fetch nativo** + capa thin `apiClient.ts` | Sin sobrediseño |
| Realtime | **WebSocket nativo** | El navegador ya lo trae; sin Socket.IO |
| Tipografía | **Press Start 2P** (titulares) + **VT323** (cuerpo) | Free en Google Fonts; estética arcade reconocible |
| UI overlay | **HTML+CSS encima del canvas** para formularios | Phaser pinta el mapa; HTML pinta los modales/inputs |
| Tests | Vitest + Playwright | Ver `doc/tests/README.md` |

---

## Estructura de carpetas

```
frontend/
├── public/
│   ├── fonts/
│   │   ├── PressStart2P-Regular.woff2
│   │   └── VT323-Regular.woff2
│   └── assets/
│       └── ui/
│           ├── frame-9slice.png
│           ├── button-up.png
│           ├── button-down.png
│           └── circle-mask.png
├── src/
│   ├── main.ts                  ← bootstrap Phaser + montaje overlay HTML
│   ├── index.html
│   ├── style.css                ← variables CSS, fuentes globales, reset
│   ├── config.ts                ← endpoint del backend, dimensiones canvas
│   ├── api/
│   │   ├── client.ts            ← fetch wrapper con cookies de sesión
│   │   ├── auth.ts
│   │   ├── offices.ts
│   │   ├── desks.ts
│   │   ├── bookings.ts
│   │   └── invitations.ts
│   ├── realtime/
│   │   ├── socket.ts            ← WS client con reconexión exponencial
│   │   └── messages.ts          ← tipos compartidos con backend
│   ├── state/
│   │   ├── session.ts           ← user actual
│   │   ├── office.ts            ← oficina + desks + bookings del día
│   │   └── ui.ts                ← día seleccionado, modal abierto, etc.
│   ├── domain/                  ← lógica pura testeable sin canvas
│   │   ├── date.ts              ← navegación de días, formatos
│   │   ├── booking.ts
│   │   └── geometry.ts          ← hit testing point-in-rect, distancia mínima
│   ├── scenes/
│   │   ├── BootScene.ts         ← carga de assets y fuentes
│   │   ├── LoginScene.ts        ← botón "Login con Google"
│   │   ├── OfficeScene.ts       ← mapa + zonas + avatares
│   │   ├── AdminMapScene.ts     ← subir mapa + dibujar zonas
│   │   └── HUDScene.ts          ← capa superior: navegación día, "tú"
│   ├── ui/                      ← overlays HTML (forms, modales)
│   │   ├── login-button.ts
│   │   ├── invite-modal.ts
│   │   ├── upload-map-modal.ts
│   │   └── day-navigator.ts
│   ├── render/
│   │   ├── desk-renderer.ts     ← cuadrado fijo coloreado por estado
│   │   ├── avatar-mask.ts       ← círculo con foto del user
│   │   └── theme.ts             ← paleta de colores arcade
│   └── types/
│       └── shared.ts            ← tipos eco del backend
├── vite.config.ts
├── tsconfig.json
└── tests/                        ← ver doc/tests/README.md
```

---

## Flujo de arranque

```
main.ts
  ├─► carga fuentes (FontFace API, await ready)
  ├─► crea Phaser.Game con BootScene
  └─► monta overlay HTML root #ui
        └─► dispatcher de modales según state.ui

BootScene
  ├─► precarga atlas, frames, máscaras
  ├─► fetch /api/me
  │     ├─► 401  → start LoginScene
  │     └─► 200  → fetch /api/offices, conecta WS, start OfficeScene
  └─► transición fade
```

### Carga de fuentes pixel

Las fuentes pixel **se cargan vía CSS `@font-face` antes de arrancar Phaser** y se esperan con la FontFace API. Si Phaser arranca antes, la primera frame usa fallback y aparece un *flash of unstyled text* horrible.

```css
@font-face {
  font-family: "Press Start 2P";
  src: url("/fonts/PressStart2P-Regular.woff2") format("woff2");
  font-display: block;
}
@font-face {
  font-family: "VT323";
  src: url("/fonts/VT323-Regular.woff2") format("woff2");
  font-display: block;
}
```

```ts
await Promise.all([
  document.fonts.load("16px 'Press Start 2P'"),
  document.fonts.load("20px 'VT323'"),
]);
new Phaser.Game(config);
```

### Tamaños recomendados

- Press Start 2P: múltiplos de 8 (8, 16, 24, 32). Fuera de eso pixela mal.
- VT323: cualquier tamaño, escala bien.
- Sin antialiasing en Phaser para mantener look pixel: `Phaser.Scale.NEAREST` y `text.setRoundPixels(true)`.

---

## Escenas de Phaser

### `BootScene`

Carga assets, espera fuentes, decide si ir a `LoginScene` u `OfficeScene` según sesión.

### `LoginScene`

Renderiza un botón grande estilo arcade "PRESS START — LOGIN WITH GOOGLE". Click → redirect al endpoint OAuth (POST con id_token) usando Google Identity Services en HTML overlay. Cuando termina, recarga.

### Render del mapa con Tiled + Phaser

Phaser 4 soporta Tiled JSON nativamente:

```ts
// preload
this.load.tilemapTiledJSON("office", `/maps/${office.id}/${office.tmj_filename}`);
for (const t of office.tilesets) {
  this.load.image(`tiles:${office.id}:${t.ordinal}`, `/maps/${office.id}/${t.filename}`);
}

// create
const map = this.make.tilemap({ key: "office" });
const tilesets = office.tilesets.map(t =>
  // el primer arg es el `name` del tileset DENTRO del .tmj (no el filename)
  map.addTilesetImage(t.tiled_name, `tiles:${office.id}:${t.ordinal}`)
);
for (const layer of map.layers) {
  map.createLayer(layer.name, tilesets);
}
```

Cada tile renderizado es internamente una instancia de [`Phaser.Tilemaps.Tile`](https://docs.phaser.io/api-documentation/class/tilemaps-tile); no la manipulamos directamente, pero está disponible si en el futuro necesitamos lógica por tile (p. ej. tiles con `properties.isCorridor` para pathfinding).

### Object layer "desks" del Tiled

Si el `.tmj` incluye un object layer llamado `desks`, el backend lo parsea al subir y crea Desks. En el frontend solo consumimos el array `desks` ya importado vía `GET /api/offices/:id`. La fuente original de la verdad es el backend; el cliente no vuelve a leer el object layer.

### `OfficeScene`

La escena principal:

```
┌──────────────────────────────────────────────────────┐
│  [<]  jueves 7 mayo 2026  [>]              👤 Ludo │  ← HUDScene encima
├──────────────────────────────────────────────────────┤
│                                                      │
│           ┌──────────────────────────────┐           │
│           │      mapa de la oficina      │           │
│           │   ┌─┐    ┌─┐    ┌─┐    ┌─┐  │           │
│           │   │A│    │B│    │C│    │D│  │           │
│           │   └─┘    └─┘    └─┘    └─┘  │  cuadros │
│           │                              │  fijos   │
│           └──────────────────────────────┘           │
│                                                      │
│  Click en un puesto libre → modal "¿Reservar?"      │
└──────────────────────────────────────────────────────┘
```

Cada puesto se modela como un punto `(x, y)` y se renderiza como un cuadrado de ancho fijo (`DESK_SIZE_PX = 48`) centrado en ese punto. La constante vive en `packages/shared/src/desk.ts` para que backend y frontend coincidan exactamente.

Capas (z-order):

1. `Phaser.Tilemaps.TilemapLayer` por cada layer del `.tmj` (suelo, paredes, mobiliario, decoración).
2. `Phaser.GameObjects.Rectangle` por cada desk → relleno semitransparente según estado (libre / ocupado-tú / ocupado-otro / fixed).
3. `Phaser.GameObjects.Container` por cada desk ocupado con la foto circular del user.
4. HUDScene flota encima en otra `Scene` con `scene.launch`.

Estados del cuadrado:

| Estado | Color | Borde |
|--------|-------|-------|
| libre | verde 30% alpha | verde sólido |
| ocupado por otro | rojo 30% alpha | rojo sólido |
| ocupado por ti | cian 50% alpha | cian sólido pulsante |
| fixed (fijo) | violeta 40% alpha + icono 📌 | violeta sólido |

### `AdminMapScene`

Modo edición. Solo accesible para admin. Permite:

- **Subir mapa Tiled**: overlay HTML con un dropzone que acepta el `.tmj` y los PNG/WebP de los tilesets en una sola operación multipart. El cliente valida en local que los nombres de imagen referenciados en el `.tmj` están entre los ficheros adjuntos antes de enviar.
- **Colocar puestos manualmente**: click sobre el mapa coloca un pin (`x`, `y`) y abre el prompt para etiquetarlo. El cuadrado de tamaño fijo `DESK_SIZE_PX` se previsualiza alrededor del pin.
- **Importar puestos desde Tiled**: si el `.tmj` subido incluye un object layer `desks`, los puestos se crean automáticamente al subir; el admin solo retoca lo necesario.
- Mover un puesto seleccionado arrastrándolo.
- Cambiar la etiqueta de un puesto seleccionado.
- Eliminar un puesto seleccionado.
- Snap a grid de `tile_width × tile_height` (en lugar de 8 px) con Shift presionado: alinear pins al grid del Tiled queda natural.

Mientras está activa, `OfficeScene` se oculta (`scene.pause`).

### `HUDScene`

- Botones día anterior / siguiente.
- Indicador "tú" con avatar circular en esquina.
- Si admin: botón ⚙️ → abre `AdminMapScene` y modal de invitaciones.

---

## Máscara circular para avatares

Phaser 4 soporta `Image.setMask(circleMask)`. Se precarga un atlas con un círculo blanco de varios tamaños (24, 32, 48 px). Se aplica como `BitmapMask` o `GeometryMask` sobre la `Image` cargada del avatar URL de Google.

Pseudo-código:

```ts
const photo = scene.add.image(x, y, "avatar:" + userId);
const mask = scene.add.graphics().fillCircle(x, y, 16);
photo.setMask(mask.createGeometryMask());
photo.setDisplaySize(32, 32);
```

Para evitar n peticiones, los avatares se cargan dinámicamente en un atlas via `scene.textures.addImage(key, htmlImg)` cuando llega el booking.

### Caché y CORS

Las URLs de avatar de Google (`googleusercontent.com`) sirven con CORS abierto, así que se pueden cargar como `Image` sin proxy. Si en el futuro se rompe, montar un proxy en backend `/api/avatars/:userId`.

---

## Comunicación con el backend

### REST (cargas iniciales y mutaciones)

```ts
// src/api/client.ts
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) throw await ApiError.from(res);
  return res.status === 204 ? (undefined as T) : res.json();
}
```

### WebSocket (deltas)

```ts
// src/realtime/socket.ts
export function connectOffice(officeId: number, onMsg: (m: WsMessage) => void) {
  let attempt = 0;
  let socket: WebSocket;

  const open = () => {
    socket = new WebSocket(`${WS_BASE}/ws/offices/${officeId}`);
    socket.onmessage = e => onMsg(JSON.parse(e.data));
    socket.onclose = () => {
      const delay = Math.min(30_000, 1000 * 2 ** attempt++);
      setTimeout(open, delay);
    };
    socket.onopen = () => { attempt = 0; };
  };
  open();
  return () => socket.close();
}
```

### Combinación

```
load OfficeScene
  ├─► api.getOffice(id, date)            ← snapshot del día
  └─► connectOffice(id, msg => store.apply(msg))
                                         ← deltas

cambiar día
  └─► api.getOffice(id, newDate)         ← snapshot del nuevo día
                                         (mantiene la misma WS abierta)
```

---

## Estado

`zustand` (3 KB, sin React, listo para vanilla TS) gestiona stores.

```ts
type OfficeStore = {
  office: Office | null;
  desks: Map<number, Desk>;
  bookings: Map<string, Booking>;   // key = `${deskId}:${date}`
  selectedDate: string;
  setDate(d: string): void;
  apply(msg: WsMessage): void;
};
```

Las escenas de Phaser **leen** del store; no guardan estado de dominio. Cuando el store cambia, las escenas se re-render via subscription explícita en `update()` o `events.emit("office:changed")`.

Ventaja: el store es testeable sin tocar Phaser.

---

## Navegación entre días

- HUDScene tiene dos botones `<` y `>`.
- Click → `store.setDate(addDays(current, ±1))` → escena recarga snapshot.
- Atajos teclado: ←/→.
- Slider/calendar opcional en la v2.

Día por defecto = hoy en la TZ del navegador (`new Date().toISOString().slice(0,10)` ajustado a TZ local con `Intl.DateTimeFormat`).

---

## Colocación de puestos (modo admin)

```
1. admin click "Nuevo puesto" (o tecla 'N')
2. cursor cambia a crosshair pixel
3. click sobre el mapa → coloca el pin con un cuadrado preview
4. shift+move → snapping a grid 8 px
5. modal pide label (A1, etc.)
6. POST /api/offices/:id/desks { label, x, y }
```

Edición rápida sin re-crear:

```
- click sobre puesto → seleccionado
- arrastrar → mueve el pin (PATCH al soltar con { x, y })
- F2 → renombra label (PATCH con { label })
- supr → DELETE
```

Validación en cliente antes de enviar:

- `0 ≤ x ≤ map_width`, `0 ≤ y ≤ map_height`.
- Distancia Chebyshev a cualquier puesto existente ≥ `DESK_MIN_SEPARATION` (los cuadrados no se solapan).
- Etiqueta no usada en la oficina.

El código de validación es **el mismo** que en el backend (importado de `packages/shared/src/geometry.ts`). El cliente solo evita roundtrip innecesario; el backend revalida siempre.

---

## Tipografía videojuego

Tres fuentes a elegir según uso:

| Uso | Fuente | Tamaño |
|-----|--------|--------|
| Títulos / botones | Press Start 2P | 16, 24, 32 |
| Cuerpo / etiquetas | VT323 | 20, 24 |
| Highlights mono | Pixelify Sans (alt) | — |

CSS reset:

```css
:root {
  --font-display: "Press Start 2P", monospace;
  --font-body: "VT323", monospace;

  --color-bg: #0b0d1a;
  --color-fg: #f5f5f5;
  --color-accent: #ff66cc;
  --color-success: #36e36c;
  --color-danger: #ff4d6d;
  --color-fixed: #b66dff;
}
body {
  font-family: var(--font-body);
  background: var(--color-bg);
  color: var(--color-fg);
  image-rendering: pixelated;
}
button {
  font-family: var(--font-display);
  font-size: 16px;
  /* 9-slice frame para look arcade */
}
```

Phaser:

```ts
this.add.text(x, y, "RESERVAR", {
  fontFamily: "Press Start 2P",
  fontSize: "16px",
  color: "#f5f5f5",
}).setRoundPixels(true);
```

`setRoundPixels(true)` evita el blur sub-pixel. `Phaser.Scale.NEAREST` en la config global mantiene el look pixel cuando se escala.

---

## Configuración Phaser

```ts
// src/main.ts
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: "game",
  width: 1280,
  height: 720,
  backgroundColor: "#0b0d1a",
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: false,
  },
  scene: [BootScene, LoginScene, OfficeScene, AdminMapScene, HUDScene],
};
```

`pixelArt: true` activa el render sin smoothing y `roundPixels`.

---

## Accesibilidad

- Phaser no es accesible per se, así que los botones críticos (login, navegación día, reservar) tienen contraparte HTML overlay con `<button>` real, focus ring, soporte teclado.
- Toda acción del juego debe tener atajo de teclado.
- Contraste verificado para los estados de color de las zonas (alpha 30% + borde sólido cumple WCAG AA).
- `aria-live` para anuncios "Ludo ha reservado A1".

---

## Performance

- **Atlas único** para UI: un solo `loadAtlas` con todos los frames de botones, máscaras, iconos.
- **Mapa de la oficina** se carga como textura única; el polígono se pinta encima con Graphics, no con sprites por desk.
- **Avatares** se descargan bajo demanda (lazy) cuando entran en viewport. Si la oficina tiene 100 desks pero solo 30 están ocupados, se cargan 30 imágenes.
- **Phaser 4** maneja millones de sprites con `SpriteGPULayer` si en el futuro hay muchos efectos; para esta app no es necesario.

---

## Anti-patrones

| Anti-patrón | Por qué lo evitamos | Alternativa |
|-------------|----------------------|-------------|
| Estado de dominio dentro de la Scene | Imposible testear sin Phaser | Store externo |
| `setInterval` para refrescar bookings | Race conditions, lag | WS con snapshot inicial |
| Renderizar formularios en Phaser | UX pésima (sin teclado virtual, sin a11y) | HTML overlay |
| Mezclar lógica de fechas en escenas | Tests de fecha imposibles | `domain/date.ts` puro |
| Cargar las fuentes después de Phaser | FOUT en la primera frame | FontFace API antes del `new Phaser.Game` |
| `image-rendering: auto` | Pierde look pixel | `image-rendering: pixelated` global |

---

## Fuentes consultadas

- [Phaser 4 release & 2026 perf — Seeles AI](https://www.seeles.ai/resources/blogs/phaser-js-game-development-2026)
- [Phaser project structure — Phaser Plus](https://phaser-plus.kalevski.dev/docs/guide/project-structure)
- [Phaser best practices — Genieee](https://genieee.com/phaser-game-development-best-practices/)
- [Press Start 2P — Google Fonts](https://fonts.google.com/specimen/Press+Start+2P)
- [VT323 — Google Fonts](https://fonts.google.com/specimen/VT323)
- [Pixelify Sans — Google Fonts](https://fonts.google.com/specimen/Pixelify+Sans)
- [WebSockets 2026 architecture — ZeonEdge](https://zeonedge.com/nl/blog/building-real-time-applications-websockets-2026-architecture-scaling)
- [Testing Phaser with Vitest — DEV](https://dev.to/davidmorais/testing-phaser-games-with-vitest-3kon)
