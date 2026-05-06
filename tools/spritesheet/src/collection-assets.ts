import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Copia los PNGs (rutas absolutas) a la subcarpeta `<outputDir>/<assetsSubdir>/`.
 * Devuelve un mapa filename → ruta relativa desde outputDir.
 */
export async function copyAssets(
  pngPaths: string[],
  outputDir: string,
  assetsSubdir: string,
): Promise<Map<string, string>> {
  const fullSubdir = join(outputDir, assetsSubdir);
  await mkdir(fullSubdir, { recursive: true });
  const result = new Map<string, string>();
  for (const src of pngPaths) {
    const filename = src.split("/").pop()!;
    const dst = join(fullSubdir, filename);
    await copyFile(src, dst);
    result.set(src, `${assetsSubdir}/${filename}`);
  }
  return result;
}
