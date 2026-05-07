/**
 * Servicio puro para aplicar las ediciones del editor online (change 024) sobre
 * un TMJ:
 *
 *  1. Reorganizar el array `layers` siguiendo `layer_order`.
 *  2. Reemplazar las capas `sprites_*` por las definiciones enviadas en
 *     `sprites_layers`.
 *  3. Conservar las capas del sistema (tilelayers + object layers no
 *     `sprites_*`) byte a byte, salvo por la propiedad `visible` cuando esté en
 *     `layers_visibility`.
 *
 * Validaciones de coherencia (no de schema, que las hace Zod aparte):
 *  - `layer_order` debe contener exactamente la unión de capas del sistema del
 *    TMJ original y las claves de `sprites_layers`.
 *  - `layers_visibility` solo puede mencionar capas que existan en el TMJ
 *    resultante.
 *
 * Ver `openspec/changes/024-online-map-editor/design.md` Decisión 2.
 */
import { z } from "zod";
import { SPRITE_MANIFEST } from "@virtual-office/shared";

const SPRITES_LAYER_NAME_REGEX = /^sprites_[a-z0-9_]+$/;

export const SpritesLayerSchema = z.object({
  name: z.string().regex(SPRITES_LAYER_NAME_REGEX),
  type: z.literal("objectgroup"),
  visible: z.boolean().optional(),
  opacity: z.number().min(0).max(1).optional(),
  objects: z.array(
    z.object({
      id: z.number().int().positive(),
      point: z.literal(true),
      x: z.number(),
      y: z.number(),
      properties: z
        .array(
          z.object({
            name: z.enum(["sprite", "tag"]),
            type: z.literal("string"),
            value: z.string().min(1),
          }),
        )
        .min(1),
    }),
  ),
});

export const PatchSpritesLayersSchema = z.object({
  expected_hash: z.string().regex(/^[a-f0-9]{64}$/),
  layer_order: z.array(z.string().min(1)),
  sprites_layers: z.record(z.string(), SpritesLayerSchema),
  layers_visibility: z.record(z.string(), z.boolean()).optional(),
});

export type SpritesLayer = z.infer<typeof SpritesLayerSchema>;
export type PatchSpritesLayersBody = z.infer<typeof PatchSpritesLayersSchema>;

/**
 * Comprueba que cada objeto tenga property `sprite` cuyo valor exista en el
 * `SPRITE_MANIFEST`. Devuelve el primer id desconocido o null si todo OK.
 */
export function findUnknownSpriteId(layers: Record<string, SpritesLayer>): string | null {
  for (const layer of Object.values(layers)) {
    for (const obj of layer.objects) {
      const spriteProp = obj.properties.find((p) => p.name === "sprite");
      if (!spriteProp) return "<missing>";
      if (!(spriteProp.value in SPRITE_MANIFEST)) return spriteProp.value;
    }
  }
  return null;
}

interface TmjLayer {
  type?: string;
  name?: string;
  visible?: boolean;
  [key: string]: unknown;
}

interface Tmj {
  layers?: TmjLayer[];
  [key: string]: unknown;
}

export type CoherenceError =
  | { kind: "layer_order_missing_system_layer"; missing: string[] }
  | { kind: "layer_order_unknown_name"; unknown: string[] }
  | { kind: "layer_order_duplicate"; duplicates: string[] }
  | { kind: "visibility_unknown_layer"; unknown: string[] }
  | { kind: "sprites_layers_name_mismatch"; key: string; layerName: string };

/**
 * Valida coherencia entre el body y el TMJ original. Devuelve el primer error
 * encontrado o null si todo es coherente.
 */
export function checkCoherence(tmj: Tmj, body: PatchSpritesLayersBody): CoherenceError | null {
  const original = tmj.layers ?? [];
  const systemNames = new Set<string>();
  for (const l of original) {
    if (typeof l.name !== "string") continue;
    if (l.type === "objectgroup" && l.name.startsWith("sprites_")) continue;
    systemNames.add(l.name);
  }
  const newSpritesNames = new Set(Object.keys(body.sprites_layers));

  // Cada clave de sprites_layers debe coincidir con el `name` interno.
  for (const [key, layer] of Object.entries(body.sprites_layers)) {
    if (key !== layer.name) {
      return { kind: "sprites_layers_name_mismatch", key, layerName: layer.name };
    }
  }

  // Sin duplicados en layer_order.
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const n of body.layer_order) {
    if (seen.has(n)) dups.push(n);
    seen.add(n);
  }
  if (dups.length > 0) return { kind: "layer_order_duplicate", duplicates: dups };

  // layer_order debe contener exactamente { systemNames ∪ newSpritesNames }.
  const expected = new Set([...systemNames, ...newSpritesNames]);
  const got = new Set(body.layer_order);

  const missing: string[] = [];
  for (const n of expected) if (!got.has(n)) missing.push(n);
  if (missing.length > 0) return { kind: "layer_order_missing_system_layer", missing };

  const unknown: string[] = [];
  for (const n of got) if (!expected.has(n)) unknown.push(n);
  if (unknown.length > 0) return { kind: "layer_order_unknown_name", unknown };

  // layers_visibility solo puede mencionar capas que existan tras aplicar.
  if (body.layers_visibility) {
    const visUnknown: string[] = [];
    for (const n of Object.keys(body.layers_visibility)) {
      if (!expected.has(n)) visUnknown.push(n);
    }
    if (visUnknown.length > 0) return { kind: "visibility_unknown_layer", unknown: visUnknown };
  }

  return null;
}

/**
 * Aplica las ediciones al TMJ en memoria. NO muta el tmj de entrada; devuelve
 * uno nuevo. Asume que `checkCoherence` ya pasó.
 */
export function applyLayerEdits(tmj: Tmj, body: PatchSpritesLayersBody): Tmj {
  const original = tmj.layers ?? [];
  const systemByName = new Map<string, TmjLayer>();
  for (const l of original) {
    if (typeof l.name !== "string") continue;
    if (l.type === "objectgroup" && l.name.startsWith("sprites_")) continue;
    systemByName.set(l.name, l);
  }

  const visibility = body.layers_visibility ?? {};
  const out: TmjLayer[] = [];
  for (const name of body.layer_order) {
    const sysLayer = systemByName.get(name);
    if (sysLayer) {
      out.push(applyVisibility(sysLayer, name, visibility));
      continue;
    }
    const sprLayer = body.sprites_layers[name];
    if (sprLayer) {
      out.push(applyVisibility(sprLayer as unknown as TmjLayer, name, visibility));
      continue;
    }
    // No debería ocurrir si checkCoherence pasó, pero por defensa: ignorar.
  }

  return { ...tmj, layers: out };
}

function applyVisibility(layer: TmjLayer, name: string, vis: Record<string, boolean>): TmjLayer {
  if (!(name in vis)) return layer;
  return { ...layer, visible: vis[name]! };
}
