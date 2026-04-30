import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseEnv } from "../../../../src/config/env.js";

vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  setTag: vi.fn(),
}));

import * as Sentry from "@sentry/node";
import { initSentry } from "../../../../src/infra/observability/sentry.js";

const baseEnv = {
  SESSION_SECRET: "supersecretodealmenos32caracteresaqui",
  TEIMAS_DOMAINS: "teimas.com",
  ADMIN_EMAILS: "",
  SENTRY_DSN: "https://fake@sentry.io/1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// task 4.1
describe("initSentry con GIT_SHA definido", () => {
  it("pasa release: env.GIT_SHA a Sentry.init", () => {
    const env = parseEnv({ ...baseEnv, GIT_SHA: "abc123" });
    initSentry(env);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ release: "abc123" }),
    );
  });

  it("llama a Sentry.setTag con release = GIT_SHA", () => {
    const env = parseEnv({ ...baseEnv, GIT_SHA: "abc123" });
    initSentry(env);
    expect(Sentry.setTag).toHaveBeenCalledWith("release", "abc123");
  });
});

// task 4.2
describe("initSentry sin GIT_SHA", () => {
  it("no pasa release a Sentry.init", () => {
    const env = parseEnv({ ...baseEnv });
    initSentry(env);
    const call = (Sentry.init as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call).not.toHaveProperty("release");
  });

  it("no llama a Sentry.setTag", () => {
    const env = parseEnv({ ...baseEnv });
    initSentry(env);
    expect(Sentry.setTag).not.toHaveBeenCalled();
  });
});
