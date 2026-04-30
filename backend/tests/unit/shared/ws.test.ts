import { describe, it, expect } from "vitest";
import { parseServerMessage, parseClientMessage } from "@virtual-office/shared";

describe("parseServerMessage", () => {
  it("acepta tipos conocidos", () => {
    expect(parseServerMessage(JSON.stringify({ type: "snapshot.ts", at: "2026-04-30T10:00:00Z" }))).toEqual({
      type: "snapshot.ts",
      at: "2026-04-30T10:00:00Z",
    });
    expect(
      parseServerMessage(
        JSON.stringify({
          type: "desk.booked",
          deskId: 1,
          date: "2026-05-04",
          user: { id: 7, name: "Alice", avatar_url: null },
        }),
      ),
    ).toMatchObject({ type: "desk.booked", deskId: 1 });
  });

  it("rechaza JSON malformado", () => {
    expect(() => parseServerMessage("{not json")).toThrow("malformed_json");
  });

  it("rechaza objeto sin type", () => {
    expect(() => parseServerMessage(JSON.stringify({ deskId: 1 }))).toThrow("missing_type");
  });

  it("rechaza tipo desconocido", () => {
    expect(() => parseServerMessage(JSON.stringify({ type: "user.idle" }))).toThrow(
      "unknown_type:user.idle",
    );
  });
});

describe("parseClientMessage", () => {
  it("acepta ping", () => {
    expect(parseClientMessage(JSON.stringify({ type: "ping" }))).toEqual({ type: "ping" });
  });

  it("rechaza tipos desconocidos", () => {
    expect(() => parseClientMessage(JSON.stringify({ type: "subscribe" }))).toThrow(
      "unknown_type:subscribe",
    );
  });
});
