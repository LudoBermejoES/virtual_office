// Garantiza que SESSION_SECRET esté presente antes de que cualquier módulo
// llame a loadEnv(), evitando process.exit(1) al importar env.ts.
// Los tests que necesitan SESSION_SECRET ausente usan vi.stubEnv + vi.resetModules().
if (!process.env["SESSION_SECRET"]) {
  process.env["SESSION_SECRET"] = "supersecretodealmenos32caracteresaqui";
}
