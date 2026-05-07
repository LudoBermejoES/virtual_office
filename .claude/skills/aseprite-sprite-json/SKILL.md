---
name: aseprite-sprite-json
description: Crea, valida y arregla los sprites Aseprite del proyecto Virtual Office (PNG + JSON Hash) para que `Phaser.AnimationManager.createFromAseprite` los reproduzca correctamente. Úsala cuando el usuario añada un sprite nuevo a `frontend/public/sprites/<id>/`, registre una entrada nueva en `SPRITE_MANIFEST` (en `packages/shared/src/sprite-manifest.ts`), reporte que un sprite "se ve estático" o "no se anima" en `OfficeScene` o en el editor (`MapEditorScene`), reciba el error `Cannot read properties of undefined (reading 'duration')` desde `phaser.esm.js` con stack en `Animation.getFirstTick`, vea warnings tipo `[tiled-sprites] anim "<tag>" registrada pero sin frames válidos`, o pregunte cómo exportar desde Aseprite para que funcione con Phaser 4. También aplica si el usuario menciona arreglar/regenerar el JSON de un sprite, "pasar las claves del JSON a numéricas" o consolidar el formato del manifest.
---

# aseprite-sprite-json

Cómo crear y mantener los pares `<sprite>.png` + `<sprite>.json` que el editor online de sprites (change 024) y `OfficeScene` (change 023) consumen vía `scene.load.aseprite`.

## Cuándo invocar la skill

- El usuario añade una entrada nueva al `SPRITE_MANIFEST` y necesita los archivos.
- El usuario reporta que un sprite "no se anima", "solo se ve el primer frame", o "se queda quieto".
- Aparece el error `Cannot read properties of undefined (reading 'duration')` con `Animation.getFirstTick` en el stack.
- Aparece el warning `[tiled-sprites] anim "<tag>" registrada pero sin frames válidos`.
- El usuario pregunta cómo exportar desde Aseprite, qué formato usar o por qué no le funciona el JSON que ya tiene.
- Tras correr una conversión de sprites se quiere validar que cumple el formato.

Si el usuario pregunta sin pedir acción, explica el formato esperado y ofrece auditar/arreglar un sprite concreto.

## Formato esperado

Cada sprite vive en `frontend/public/sprites/<id>/` con dos archivos del mismo basename:

```
frontend/public/sprites/cat/
  animated_cat_48x48.png
  animated_cat_48x48.json
```

El `id` del sprite (clave en `SPRITE_MANIFEST`) es libre (`cat`, `butterfly`, `npc_guard`...). El nombre del PNG/JSON puede ser cualquiera siempre que el manifest apunte al path correcto.

### Estructura del JSON (Aseprite "Hash")

```json
{
  "frames": {
    "0": {
      "frame": { "x": 0, "y": 0, "w": 48, "h": 48 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 48, "h": 48 },
      "sourceSize": { "w": 48, "h": 48 },
      "duration": 100
    },
    "1": { "frame": { "x": 48, "y": 0, "w": 48, "h": 48 }, ..., "duration": 100 },
    "...": "..."
  },
  "meta": {
    "app": "https://www.aseprite.org/",
    "version": "1.3",
    "image": "animated_cat_48x48.png",
    "format": "RGBA8888",
    "size": { "w": 1728, "h": 48 },
    "scale": "1",
    "frameTags": [
      { "name": "walk", "from": 0, "to": 11, "direction": "forward", "color": "#000000ff" }
    ],
    "layers": [],
    "slices": []
  }
}
```

## La regla crítica que rompe Phaser 4

Las claves del objeto `frames` deben ser **strings numéricos** (`"0"`, `"1"`, `"2"`...), NO los nombres largos que exporta Aseprite por defecto (`"animated_cat_48x48 0.aseprite"`).

`Phaser.AnimationManager.createFromAseprite` itera `for (i = from; i <= to; i++) { frames[i.toString()] }` y si las claves no son numéricas devuelve `undefined`, registra una animación con `frames: []` y `duration: 0`, y al hacer `play(...)` casca en `getFirstTick` con `Cannot read properties of undefined (reading 'duration')`.

## Cómo exportar desde Aseprite

`File → Export Sprite Sheet`:

1. **Layout** → "By Rows" o "Packed" según cómo estén organizados los frames; lo importante es que el JSON refleje las coordenadas reales del PNG.
2. **Output**:
   - "Output File": el `.png` (eg. `animated_cat_48x48.png`).
   - "JSON Data": activado, mismo basename con `.json`.
   - **"Hash"** (no "Array").
   - **"Item Filename"**: poner literalmente `{frame}` (no `{spritename} {frame}.aseprite` ni nada más). Esto hace que las claves del JSON sean `"0"`, `"1"`, ...
3. **Meta**: marca al menos "Tags" (sin esto no hay `frameTags` y no podemos usar tags de animación).

Si el JSON ya está exportado y tiene claves largas, no hace falta volver a Aseprite: ver "Cómo arreglar un JSON con claves largas" abajo.

## Cómo añadir un sprite nuevo al proyecto

1. Coloca el `<sprite>.png` y `<sprite>.json` en `frontend/public/sprites/<id>/`.
2. Verifica el JSON con la sección "Validar el JSON" más abajo. Si falla la validación, pasa por "Cómo arreglar un JSON con claves largas".
3. Añade la entrada al manifest en [packages/shared/src/sprite-manifest.ts](packages/shared/src/sprite-manifest.ts):

   ```ts
   export const SPRITE_MANIFEST: SpriteManifest = {
     cat: { png: "/sprites/cat/animated_cat_48x48.png", json: "/sprites/cat/animated_cat_48x48.json", defaultTag: "walk" },
     // nuevo:
     butterfly: { png: "/sprites/butterfly/butterfly.png", json: "/sprites/butterfly/butterfly.json", defaultTag: "fly" },
   };
   ```

   `defaultTag` es opcional pero conviene definirlo: si un placement no tiene `tag` propio, se usa éste. Si no, se intenta el primer `frameTags[0].name` del JSON.

4. `pnpm --filter @virtual-office/shared build` para regenerar `dist/` (frontend y backend lo importan desde ahí).
5. Recarga el editor; el sprite aparece en el panel SPRITES con su preview.

## Validar el JSON

Comprueba que las claves de `frames` son numéricas:

```bash
node -e "
const j = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf-8'));
const keys = Object.keys(j.frames);
const firstNonNumeric = keys.find((k) => !/^\d+\$/.test(k));
if (firstNonNumeric) {
  console.error('FAIL: clave no numérica encontrada:', JSON.stringify(firstNonNumeric));
  process.exit(1);
}
const tags = j.meta?.frameTags ?? [];
if (tags.length === 0) console.error('AVISO: sin frameTags, sólo funcionará con primer frame estático');
for (const t of tags) {
  for (let i = t.from; i <= t.to; i++) {
    if (!j.frames[String(i)]) {
      console.error('FAIL: tag', t.name, 'referencia frame', i, 'que no existe');
      process.exit(1);
    }
    if (typeof j.frames[String(i)].duration !== 'number') {
      console.error('FAIL: frame', i, 'sin duration');
      process.exit(1);
    }
  }
}
console.log('OK', keys.length, 'frames,', tags.length, 'tag(s)');
" frontend/public/sprites/<id>/<name>.json
```

## Cómo arreglar un JSON con claves largas

Si el JSON tiene claves tipo `"animated_cat_48x48 0.aseprite"` en vez de `"0"`, las renombras manteniendo el orden:

```bash
node -e "
const fs = require('node:fs');
const path = process.argv[1];
const j = JSON.parse(fs.readFileSync(path, 'utf-8'));
const oldKeys = Object.keys(j.frames);
const newFrames = {};
oldKeys.forEach((k, i) => { newFrames[String(i)] = j.frames[k]; });
j.frames = newFrames;
fs.writeFileSync(path, JSON.stringify(j, null, 2));
console.log('Renamed', oldKeys.length, 'frames to numeric keys');
" frontend/public/sprites/<id>/<name>.json
```

Luego corre el validador. Asume que el orden alfabético de las claves originales coincide con el orden lógico de los frames; si en el PNG los frames van en otro orden el sprite saldrá mal animado y hay que reexportar desde Aseprite con el formato correcto.

## Troubleshooting

| Síntoma | Causa probable | Cómo arreglar |
|---------|----------------|---------------|
| Sprite estático mostrando solo frame 0 | Claves del JSON no numéricas | Validar y arreglar con scripts de arriba |
| Error `Cannot read properties of undefined (reading 'duration')` | Anim registrada vacía → claves no numéricas o frame referenciado por tag inexistente | Validar JSON; si falla por frame faltante, regenerar desde Aseprite |
| Warning `anim "<tag>" registrada pero sin frames válidos; salto play` | Mismo origen que el anterior, ya está cazado por el guardrail | Arreglar JSON; el guardrail evita que la escena casque |
| Animación sólo se reproduce una vez | `play(key, true)` pasa key directa sin `repeat: -1` | El código del proyecto ya usa `play({ key, repeat: -1 }, true)`; si añades nuevos sites de play, sigue ese patrón |
| Sprite aparece pero el frame visible es enorme/diminuto | El PNG tiene un tamaño por frame distinto al `frame.w/h` declarado en JSON | Reexportar desde Aseprite con el tamaño correcto, o ajustar el JSON manualmente si controlas el PNG |
| Error `No Aseprite data found for: <id>` en consola | El JSON no llegó a `cache.json`; manifest mal configurado o 404 | Verifica que el path del manifest exista en `frontend/public/sprites/...` y que el dev server lo sirva (200 al cargar la URL directa) |

## Donde está cada cosa

| Necesitas… | Archivo |
|------------|---------|
| Manifest de sprites disponibles | [packages/shared/src/sprite-manifest.ts](packages/shared/src/sprite-manifest.ts) |
| Render del sprite en escenas | [frontend/src/render/tiled-sprites.ts](frontend/src/render/tiled-sprites.ts) |
| Editor que permite insertar sprites | [frontend/src/scenes/MapEditorScene.ts](frontend/src/scenes/MapEditorScene.ts) |
| Carpeta donde viven los assets | [frontend/public/sprites/](frontend/public/sprites/) |
| Convención de tags Aseprite + flujo TMJ | `openspec/changes/archive/2026-05-06-023-aseprite-sprites-by-layer/` |
