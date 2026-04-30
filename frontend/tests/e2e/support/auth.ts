import type { APIRequestContext, BrowserContext } from "@playwright/test";
import type { TestUser } from "./types.js";

const BACKEND = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:18081";
const FRONTEND_HOSTNAME = new URL(
  process.env["PLAYWRIGHT_FRONTEND_URL"] ?? "http://localhost:5173",
).hostname;

export async function loginAs(
  request: APIRequestContext,
  context: BrowserContext,
  user: TestUser,
): Promise<{ id: number; email: string; role: string }> {
  const res = await request.post(`${BACKEND}/api/test/session`, { data: user });
  if (!res.ok()) {
    throw new Error(`loginAs failed: ${res.status()} — ${await res.text()}`);
  }

  const rawHeaders = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie");
  const cookies = rawHeaders.flatMap((h) =>
    h.value.split(",").map((part) => part.trim()),
  );

  const parsedCookies = cookies
    .map((cookie) => {
      const parts = cookie.split(";").map((p) => p.trim());
      const [nameValue, ...attrs] = parts;
      const eqIdx = nameValue!.indexOf("=");
      if (eqIdx === -1) return null;
      const name = nameValue!.slice(0, eqIdx).trim();
      const value = nameValue!.slice(eqIdx + 1).trim();

      const attrMap: Record<string, string | boolean> = {};
      for (const attr of attrs) {
        const [k, v] = attr.split("=");
        attrMap[k!.trim().toLowerCase()] = v ? v.trim() : true;
      }

      let sameSite: "Strict" | "Lax" | "None" | undefined;
      const ss = attrMap["samesite"];
      if (ss === "Strict" || ss === "strict") sameSite = "Strict";
      else if (ss === "None" || ss === "none") sameSite = "None";
      else sameSite = "Lax";

      return {
        name,
        value,
        domain: FRONTEND_HOSTNAME,
        path: typeof attrMap["path"] === "string" ? attrMap["path"] : "/",
        httpOnly: attrMap["httponly"] === true,
        secure: attrMap["secure"] === true,
        sameSite,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (parsedCookies.length > 0) {
    await context.addCookies(parsedCookies);
  }

  return res.json<{ id: number; email: string; role: string }>();
}
