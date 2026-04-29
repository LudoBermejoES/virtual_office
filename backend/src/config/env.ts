import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("debug"),

  DB_PATH: z.string().default("./data/virtual-office.db"),

  SESSION_SECRET: z.string().min(32, "SESSION_SECRET debe tener al menos 32 caracteres"),
  SESSION_SECRET_PREVIOUS: z.string().optional().default(""),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  TEIMAS_DOMAINS: z.string().default("teimas.com,teimas.es,teimassolutions.com"),
  ADMIN_EMAILS: z.string().default(""),

  INVITATION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  PUBLIC_BASE_URL: z.string().default("http://localhost:5173"),

  SENTRY_DSN: z.string().optional().default(""),

  OFFICE_MAPS_DIR: z.string().default("./data/maps"),
  MAX_TMJ_BYTES: z.coerce.number().int().positive().default(1_048_576),
  MAX_TILESET_BYTES: z.coerce.number().int().positive().default(2_097_152),
  MAX_MAP_TOTAL_BYTES: z.coerce.number().int().positive().default(10_485_760),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    process.stderr.write(`[virtual-office] Variables de entorno inválidas:\n${issues}\n`);
    process.exit(1);
  }
  return result.data;
}

export function parseEnv(raw: Record<string, string | undefined>): Env {
  return envSchema.parse(raw);
}

export const env = loadEnv();
