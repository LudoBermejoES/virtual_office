export interface WsPublicUser {
  id: number;
  name: string;
  avatar_url: string | null;
}

export type WsServerMessage =
  | { type: "snapshot.ts"; at: string }
  | { type: "desk.booked"; deskId: number; date: string; user: WsPublicUser }
  | { type: "desk.released"; deskId: number; date: string }
  | { type: "desk.fixed"; deskId: number; user: WsPublicUser }
  | { type: "desk.unfixed"; deskId: number }
  | { type: "office.updated"; officeId: number }
  | { type: "auth.expired" };

export type WsClientMessage = { type: "ping" };

const KNOWN_SERVER_TYPES = [
  "snapshot.ts",
  "desk.booked",
  "desk.released",
  "desk.fixed",
  "desk.unfixed",
  "office.updated",
  "auth.expired",
];

const KNOWN_CLIENT_TYPES = ["ping"];

export function parseServerMessage(raw: string): WsServerMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("malformed_json");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { type?: unknown }).type !== "string"
  ) {
    throw new Error("missing_type");
  }
  const obj = parsed as { type: string };
  if (!KNOWN_SERVER_TYPES.includes(obj.type)) {
    throw new Error(`unknown_type:${obj.type}`);
  }
  return obj as WsServerMessage;
}

export function parseClientMessage(raw: string): WsClientMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("malformed_json");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { type?: unknown }).type !== "string"
  ) {
    throw new Error("missing_type");
  }
  const obj = parsed as { type: string };
  if (!KNOWN_CLIENT_TYPES.includes(obj.type)) {
    throw new Error(`unknown_type:${obj.type}`);
  }
  return obj as WsClientMessage;
}
