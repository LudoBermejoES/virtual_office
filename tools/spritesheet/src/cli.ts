#!/usr/bin/env node
import { runPipeline } from "./pipeline.js";

interface CliArgs {
  inputDir: string;
  outputImage: string;
  tile: number;
  duration: number;
  webp: boolean;
  recursive: boolean;
  skipInvalid: boolean;
  help: boolean;
  version: boolean;
}

const VERSION = "0.1.0";

const HELP = `spritesheet ${VERSION}

Uso:
  spritesheet <input-dir> <output.png> [opciones]

Apila todos los PNGs del directorio (cada uno una tira horizontal de frames
de tamaño tile×tile) en un único spritesheet vertical y genera un .tsx de
Tiled con una animación por cada PNG fuente.

Opciones:
  --tile N           Tamaño de frame cuadrado (default: 48)
  --duration N       ms por frame en la animación (default: 200)
  --webp             Salida WebP lossless (default: PNG)
  --recursive        Recorrer subdirectorios (default: solo top-level)
  --skip-invalid     Saltar PNGs que no validan en lugar de abortar
  --help, -h         Esta ayuda
  --version, -v      Imprime versión
`;

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    inputDir: "",
    outputImage: "",
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
    if (arg.startsWith("--")) {
      throw new Error(`unknown_flag: ${arg}`);
    }
    positionals.push(arg);
  }

  if (positionals[0]) args.inputDir = positionals[0];
  if (positionals[1]) args.outputImage = positionals[1];
  if (positionals.length > 2) {
    throw new Error(`unexpected_args: ${positionals.slice(2).join(" ")}`);
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
  if (!args.inputDir || !args.outputImage) {
    process.stderr.write(`falta input-dir o output\n\n${HELP}`);
    return 1;
  }

  try {
    const report = await runPipeline({
      inputDir: args.inputDir,
      outputImage: args.outputImage,
      tile: args.tile,
      duration: args.duration,
      webp: args.webp,
      recursive: args.recursive,
      skipInvalid: args.skipInvalid,
    });
    const kb = (report.outputBytes / 1024).toFixed(1);
    const lines = [
      `PNGs procesados: ${report.pngCount} → ${report.rowCount} filas/strips`,
      `Frames totales: ${report.framesTotal}`,
      `Animaciones: ${report.animations} (+ ${report.staticTiles} tiles estáticos)`,
      `Spritesheet: ${report.outputImagePath} (${kb} KB)`,
      `Tileset: ${report.outputTsxPath}`,
    ];
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
