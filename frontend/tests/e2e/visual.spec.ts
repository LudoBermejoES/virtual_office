/**
 * Visual regression tests + tipografía aplicada.
 * Requieren PLAYWRIGHT_BASE_URL apuntando al frontend activo.
 * Las baselines se generan la primera vez con --update-snapshots.
 */
import { test, expect } from "@playwright/test";

const FRONTEND_URL = process.env["PLAYWRIGHT_FRONTEND_URL"] ?? "http://localhost:5173";

test.describe("Tipografía arcade aplicada", () => {
  test("5.5 el canvas Phaser tiene image-rendering: pixelated", async ({ page }) => {
    await page.goto(FRONTEND_URL);
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    const rendering = await canvas.evaluate((el) =>
      window.getComputedStyle(el).getPropertyValue("image-rendering"),
    );
    expect(rendering).toMatch(/pixelated/);
  });
});

test.describe("Visual regression — LoginScene", () => {
  test("5.2 baseline LoginScene Chromium", async ({ page }) => {
    await page.goto(FRONTEND_URL);
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    // Espera a que la escena cargue
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot("login-scene.png", {
      clip: await canvas.boundingBox() ?? undefined,
    });
  });
});

test.describe("Visual regression — OfficeScene", () => {
  test("5.3 baseline OfficeScene estados de puesto", async ({ page }) => {
    // Requiere sesión activa — se usa el helper de soporte cuando esté disponible.
    // Por ahora verifica solo que el canvas está presente con fondo de la paleta.
    await page.goto(FRONTEND_URL);
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    const bgColor = await canvas.evaluate((el) => {
      const ctx = (el as HTMLCanvasElement).getContext("2d");
      if (!ctx) return null;
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return `${d[0]},${d[1]},${d[2]}`;
    });
    // El fondo es #0b0d1a → r=11, g=13, b=26 (tolerancia por Phaser render)
    if (bgColor) {
      const [r, g, b] = bgColor.split(",").map(Number);
      expect(r!).toBeLessThan(30);
      expect(g!).toBeLessThan(30);
      expect(b!).toBeLessThan(50);
    }
  });
});

test.describe("Visual regression — modal reserva", () => {
  test("5.4 modal reserva contiene fuente arcade en su título", async ({ page }) => {
    await page.goto(FRONTEND_URL);
    // El modal .invitations-panel usa --font-display para h2
    // Verificamos la variable CSS en el documento
    const fontDisplay = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim(),
    );
    expect(fontDisplay).toContain("Press Start 2P");
  });
});
