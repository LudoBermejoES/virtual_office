import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let backendProcess: ReturnType<typeof spawn> | null = null;
let tmpDbDir: string | null = null;

const E2E_PORT = 18081;

export default async function globalSetup() {
  tmpDbDir = mkdtempSync(join(tmpdir(), "virtual-office-e2e-"));
  const dbPath = join(tmpDbDir, "test.db");

  await new Promise<void>((resolve, reject) => {
    backendProcess = spawn("node", ["dist/server.js"], {
      cwd: join(__dirname, "../../../../backend"),
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(E2E_PORT),
        DB_PATH: dbPath,
        SESSION_SECRET: "e2e-test-secret-al-menos-32-chars!",
        LOG_LEVEL: "error",
        SENTRY_DSN: "",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        ADMIN_EMAILS: "",
      },
      stdio: "pipe",
    });

    backendProcess.stderr?.on("data", (d: Buffer) => {
      if (process.env["DEBUG_E2E"]) process.stderr.write(d);
    });

    backendProcess.on("error", reject);
    backendProcess.on("exit", (code) => {
      if (code !== null && code !== 0) reject(new Error(`Backend salió con código ${code}`));
    });

    const timeout = setTimeout(
      () => reject(new Error("Backend e2e no arrancó en 15s")),
      15_000,
    );

    const checkReady = () => {
      fetch(`http://localhost:${E2E_PORT}/healthz`)
        .then((res) => {
          if (res.ok) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(checkReady, 300);
          }
        })
        .catch(() => setTimeout(checkReady, 300));
    };

    setTimeout(checkReady, 800);
  });

  process.env["PLAYWRIGHT_BASE_URL"] = `http://localhost:${E2E_PORT}`;

  return async () => {
    backendProcess?.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 500));
    if (tmpDbDir) rmSync(tmpDbDir, { recursive: true, force: true });
  };
}
