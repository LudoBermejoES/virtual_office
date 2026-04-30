import { parseServerMessage } from "@virtual-office/shared";
import type { WsServerMessage } from "@virtual-office/shared";
import { WS_BASE } from "../config.js";

export interface ConnectOptions {
  officeId: number;
  onMessage: (msg: WsServerMessage) => void;
  onOpen?: () => void;
  onClose?: (code: number) => void;
  /** Inyectar un constructor de WebSocket en tests (default: window.WebSocket) */
  webSocketImpl?: typeof WebSocket;
  /** Inyectar setTimeout en tests para controlar el tiempo */
  setTimeoutImpl?: (cb: () => void, ms: number) => unknown;
}

export interface ConnectHandle {
  close: () => void;
  /** Solo para tests: forzar abrir un nuevo socket */
  state: () => "connected" | "reconnecting" | "closed";
}

const MAX_DELAY = 30_000;

export function connectOffice(opts: ConnectOptions): ConnectHandle {
  const WSImpl = opts.webSocketImpl ?? globalThis.WebSocket;
  const setTimeoutImpl =
    opts.setTimeoutImpl ?? ((cb: () => void, ms: number) => setTimeout(cb, ms));

  let socket: WebSocket | null = null;
  let attempt = 0;
  let stopped = false;
  let phase: "connected" | "reconnecting" | "closed" = "reconnecting";

  const open = (): void => {
    if (stopped) return;
    socket = new WSImpl(`${WS_BASE}/ws/offices/${opts.officeId}`);
    socket.onopen = () => {
      attempt = 0;
      phase = "connected";
      opts.onOpen?.();
    };
    socket.onmessage = (e: MessageEvent) => {
      try {
        opts.onMessage(parseServerMessage(typeof e.data === "string" ? e.data : ""));
      } catch {
        // ignorar mensajes malformados
      }
    };
    socket.onclose = (e: CloseEvent) => {
      opts.onClose?.(e.code);
      if (e.code === 4001 || e.code === 1000) {
        phase = "closed";
        return;
      }
      if (stopped) return;
      phase = "reconnecting";
      const delay = Math.min(MAX_DELAY, 1000 * 2 ** attempt++);
      setTimeoutImpl(open, delay);
    };
  };

  open();

  return {
    close() {
      stopped = true;
      phase = "closed";
      socket?.close(1000);
    },
    state() {
      return phase;
    },
  };
}

export function applyMessage(
  state: {
    bookings: Map<
      string,
      {
        deskId: number;
        userId: number;
        type: "daily" | "fixed";
        user: { id: number; name: string; avatar_url: string | null };
      }
    >;
  },
  msg: WsServerMessage,
  date: string,
  onOfficeUpdated: (officeId: number) => void = () => {},
): void {
  switch (msg.type) {
    case "desk.booked":
      if (msg.date !== date) return;
      state.bookings.set(`${msg.deskId}:${msg.date}`, {
        deskId: msg.deskId,
        userId: msg.user.id,
        type: "daily",
        user: msg.user,
      });
      return;
    case "desk.released":
      if (msg.date !== date) return;
      state.bookings.delete(`${msg.deskId}:${msg.date}`);
      return;
    case "desk.fixed":
      state.bookings.set(`${msg.deskId}:${date}`, {
        deskId: msg.deskId,
        userId: msg.user.id,
        type: "fixed",
        user: msg.user,
      });
      return;
    case "desk.unfixed":
      state.bookings.delete(`${msg.deskId}:${date}`);
      return;
    case "office.updated":
      onOfficeUpdated(msg.officeId);
      return;
    case "snapshot.ts":
    case "auth.expired":
      return;
  }
}
