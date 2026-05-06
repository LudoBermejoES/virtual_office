import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

const FrameSizeSchema = z.object({
  frame_width: z.number().int().positive(),
  frame_height: z.number().int().positive(),
});

const ManifestSchema = z.record(z.string(), FrameSizeSchema);

export type FrameSize = z.infer<typeof FrameSizeSchema>;
export type FrameSizesManifest = Record<string, FrameSize>;

export function loadFrameSizesManifest(path: string): FrameSizesManifest {
  if (!existsSync(path)) return {};
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    throw new Error(`frame_sizes_unreadable: ${path} — ${(e as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`frame_sizes_invalid_json: ${path} — ${(e as Error).message}`);
  }
  const result = ManifestSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `frame_sizes_invalid_schema: ${result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
    );
  }
  return result.data;
}
