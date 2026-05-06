#!/usr/bin/env node
import { runPipeline } from "./pipeline.js";
import type { Mode } from "./mode-detection.js";

interface CliArgs {
  inputDir: string;
  output: string;
  tile: number;
  duration: number;
  webp: boolean;
  recursive: boolean;
  skipInvalid: boolean;
  forceMode?: Mode;
  frameSizesPath?: string;
  help: boolean;
  version: boolean;
}

const VERSION = "0.2.0";

const HELP = `spritesheet ${VERSION}

Uso:
  spritesheet <input-dir> <output> [opciones]

Detecta automáticamente el modo según los tamaños de los PNGs:
  - Modo atlas: todos los frames son del mismo tamaño cuadrado.
    Output: <output>.png + <output>.tsx (un único atlas).
  - Modo collection: tamaños mezclados.
    Output: <output>.tsx (Image Collection) + <output>_assets/ con copias.

Si <output> termina en .png/.webp se fuerza atlas; si termina en .tsx se
fuerza collection. También puedes usar --atlas o --collection.

Opciones:
  --tile N           Tamaño de frame cuadrado para validación inicial (default: 48)
  --duration N       ms por frame en la animación (default: 200)
  --webp             Atlas en WebP lossless (solo modo atlas)
  --recursive        Recorrer subdirectorios
  --skip-invalid     Saltar PNGs que no validan en lugar de abortar
  --collection       Forzar modo Image Collection
  --atlas            Forzar modo atlas (aborta si tamaños mezclados)
  --frame-sizes PATH Manifest JSON con frame_width/frame_height por filename
  --help, -h         Ayuda
  --version, -v      Versión
`;

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    inputDir: "",
    output: "",
    tile: 48,
    duration: 200,
    webp: false,
    recursive: false,
    skipInvalid: false,
    help: false,
    version: false,
  };

  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") continue;
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--version" || arg === "-v") {
      args.version = true;
      continue;
    }
    if (arg === "--tile") {
      const next = argv[++i];
      const n = parseInt(next ?? "0", 10);
      if (!Number.isFinite(n) || n <= 0) throw new Error("invalid_tile");
      args.tile = n;
      continue;
    }
    if (arg === "--duration") {
      const next = argv[++i];
      const n = parseInt(next ?? "0", 10);
      if (!Number.isFinite(n) || n <= 0) throw new Error("invalid_duration");
      args.duration = n;
      continue;
    }
    if (arg === "--webp") {
      args.webp = true;
      continue;
    }
    if (arg === "--recursive") {
      args.recursive = true;
      continue;
    }
    if (arg === "--skip-invalid") {
      args.skipInvalid = true;
      continue;
    }
    if (arg === "--collection") {
      args.forceMode = "collection";
      continue;
    }
    if (arg === "--atlas") {
      args.forceMode = "atlas";
      continue;
    }
    if (arg === "--frame-sizes") {
      const next = argv[++i];
      if (!next) throw new Error("missing_frame_sizes_path");
      args.frameSizesPath = next;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`unknown_flag: ${arg}`);
    }
    positionals.push(arg);
  }

  if (positionals[0]) args.inputDir = positionals[0];
  if (positionals[1]) args.output = positionals[1];
  if (positionals.length > 2) {
    throw new Error(`unexpected_args: ${positionals.slice(2).join(" ")}`);
  }

  // Inferir modo por extensión del output si no se forzó
  if (!args.forceMode && args.output) {
    if (args.output.endsWith(".tsx")) args.forceMode = "collection";
    else if (args.output.endsWith(".png") || args.output.endsWith(".webp")) {
      args.forceMode = "atlas";
    }
  }

  return args;
}

export async function main(argv: string[]): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n\n${HELP}`);
    return 1;
  }

  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (args.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (!args.inputDir || !args.output) {
    process.stderr.write(`falta input-dir o output\n\n${HELP}`);
    return 1;
  }

  try {
    const report = await runPipeline({
      inputDir: args.inputDir,
      output: args.output,
      tile: args.tile,
      duration: args.duration,
      webp: args.webp,
      recursive: args.recursive,
      skipInvalid: args.skipInvalid,
      ...(args.forceMode !== undefined ? { forceMode: args.forceMode } : {}),
      ...(args.frameSizesPath !== undefined ? { frameSizesPath: args.frameSizesPath } : {}),
    });
    const kb = (report.outputBytes / 1024).toFixed(1);
    const lines = [
      `Modo: ${report.mode}`,
      `PNGs procesados: ${report.pngCount} → ${report.tileCount} tiles/strips`,
      `Frames totales: ${report.framesTotal}`,
      `Animaciones: ${report.animations} (+ ${report.staticTiles} tiles estáticos)`,
    ];
    if (report.outputImagePath) {
      lines.push(`Atlas: ${report.outputImagePath} (${kb} KB)`);
    }
    if (report.assetsDir) {
      lines.push(`Assets: ${report.assetsDir}/`);
    }
    lines.push(`Tileset: ${report.outputTsxPath}`);
    if (report.skipped.length > 0) {
      lines.push(`Saltados: ${report.skipped.length}`);
      for (const s of report.skipped.slice(0, 10)) {
        lines.push(`  - ${s.filename}: ${s.reason}`);
      }
      if (report.skipped.length > 10) {
        lines.push(`  ... y ${report.skipped.length - 10} más`);
      }
    }
    lines.push("");
    process.stdout.write(lines.join("\n"));
    return 0;
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    return 1;
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  void main(process.argv.slice(2)).then((code) => process.exit(code));
}
