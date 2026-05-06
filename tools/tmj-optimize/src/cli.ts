#!/usr/bin/env node
import { runPipeline } from "./pipeline.js";

interface CliArgs {
  input: string;
  outDir?: string;
  padding: number;
  lossless: boolean;
  quality: number;
  help: boolean;
  version: boolean;
}

const VERSION = "0.1.0";

const HELP = `tmj-optimize ${VERSION}

Uso:
  tmj-optimize <input.tmj> [opciones]

Opciones:
  --out-dir DIR      Directorio de salida (default: junto al input)
  --padding N        Píxeles entre tiles del atlas (default: 0)
  --lossless         WebP lossless (default)
  --lossy            WebP lossy con --quality
  --quality N        Calidad WebP en modo lossy (default: 90)
  --help, -h         Esta ayuda
  --version, -v      Imprime versión
`;

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    input: "",
    padding: 0,
    lossless: true,
    quality: 90,
    help: false,
    version: false,
  };

  let lossyFlag = false;
  let losslessFlag = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") continue; // separador opcional
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--version" || arg === "-v") {
      args.version = true;
      continue;
    }
    if (arg === "--out-dir") {
      const next = argv[++i];
      if (next !== undefined) args.outDir = next;
      continue;
    }
    if (arg === "--padding") {
      args.padding = parseInt(argv[++i] ?? "0", 10);
      if (Number.isNaN(args.padding) || args.padding < 0) {
        throw new Error("invalid_padding");
      }
      continue;
    }
    if (arg === "--lossless") {
      losslessFlag = true;
      continue;
    }
    if (arg === "--lossy") {
      lossyFlag = true;
      continue;
    }
    if (arg === "--quality") {
      args.quality = parseInt(argv[++i] ?? "90", 10);
      if (Number.isNaN(args.quality) || args.quality < 1 || args.quality > 100) {
        throw new Error("invalid_quality");
      }
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`unknown_flag: ${arg}`);
    }
    if (!args.input) {
      args.input = arg;
      continue;
    }
    throw new Error(`unexpected_arg: ${arg}`);
  }

  if (lossyFlag && losslessFlag) {
    throw new Error("incompatible_flags: --lossless y --lossy a la vez");
  }
  if (lossyFlag) args.lossless = false;
  if (losslessFlag) args.lossless = true;

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
  if (!args.input) {
    process.stderr.write(`falta el TMJ de entrada\n\n${HELP}`);
    return 1;
  }

  try {
    const report = await runPipeline({
      input: args.input,
      ...(args.outDir !== undefined ? { outDir: args.outDir } : {}),
      padding: args.padding,
      lossless: args.lossless,
      quality: args.quality,
    });
    const kb = (report.outputBytes / 1024).toFixed(1);
    process.stdout.write(
      [
        `Tiles totales en tilesets originales: ${report.totalSourceTiles}`,
        `Tiles usados (incluyendo animaciones): ${report.usedTiles}`,
        `Reducción del área del atlas: ${report.reductionPercent}% (${report.sourceArea} → ${report.outputArea} px²)`,
        `Tamaño WebP final: ${kb} KB (${args.lossless ? "lossless" : "lossy q=" + args.quality})`,
        `TMJ escrito en: ${report.outputTmjPath}`,
        `WebP escrito en: ${report.outputWebpPath}`,
        "",
      ].join("\n"),
    );
    return 0;
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    return 1;
  }
}

// Solo invocar si es el entrypoint
const invokedDirectly = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  void main(process.argv.slice(2)).then((code) => process.exit(code));
}
