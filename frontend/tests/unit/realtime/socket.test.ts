import { describe, it, expect, vi } from "vitest";
import { connectOffice, applyMessage } from "../../../src/realtime/socket.js";
import type { WsServerMessage } from "@virtual-office/shared";

class FakeSocket {
  static instances: FakeSocket[] = [];
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }

  close(_code?: number): void {
    this.onclose?.({ code: 1000 } as CloseEvent);
  }

  triggerOpen(): void {
    this.onopen?.({} as Event);
  }
  triggerClose(code: number): void {
    this.onclose?.({ code } as CloseEvent);
  }
  triggerMessage(data: string): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

describe("connectOffice", () => {
  it("reintenta tras close 1006 con backoff (1s, 2s, …)", () => {
    FakeSocket.instances = [];
    const setTimeoutCalls: Array<{ ms: number }> = [];
    const setTimeoutImpl = (_cb: () => void, ms: number): unknown => {
      setTimeoutCalls.push({ ms });
      return 0;
    };

    connectOffice({
      officeId: 1,
      onMessage: () => {},
      webSocketImpl: FakeSocket as unknown as typeof WebSocket,
      setTimeoutImpl,
    });

    expect(FakeSocket.instances).toHaveLength(1);
    FakeSocket.instances[0]!.triggerClose(1006);
    expect(setTimeoutCalls).toEqual([{ ms: 1000 }]);
  });

  it("no reintenta tras close 4001", () => {
    FakeSocket.instances = [];
    const setTimeoutCalls: Array<{ ms: number }> = [];
    const setTimeoutImpl = (_cb: () => void, ms: number): unknown => {
      setTimeoutCalls.push({ ms });
      return 0;
    };

    const handle = connectOffice({
      officeId: 1,
      onMessage: () => {},
      webSocketImpl: FakeSocket as unknown as typeof WebSocket,
      setTimeoutImpl,
    });
    FakeSocket.instances[0]!.triggerClose(4001);

    expect(setTimeoutCalls).toEqual([]);
    expect(handle.state()).toBe("closed");
  });

  it("close() detiene reconexiones", () => {
    FakeSocket.instances = [];
    const setTimeoutCalls: Array<unknown> = [];
    const setTimeoutImpl = (_cb: () => void, ms: number): unknown => {
      setTimeoutCalls.push(ms);
      return 0;
    };

    const handle = connectOffice({
      officeId: 1,
      onMessage: () => {},
      webSocketImpl: FakeSocket as unknown as typeof WebSocket,
      setTimeoutImpl,
    });
    handle.close();
    expect(handle.state()).toBe("closed");
  });

  it("delivers messages via onMessage parsed", () => {
    FakeSocket.instances = [];
    const onMessage = vi.fn();
    connectOffice({
      officeId: 1,
      onMessage,
      webSocketImpl: FakeSocket as unknown as typeof WebSocket,
    });
    FakeSocket.instances[0]!.triggerMessage(
      JSON.stringify({ type: "desk.released", deskId: 1, date: "2026-05-04" }),
    );
    expect(onMessage).toHaveBeenCalledWith({
      type: "desk.released",
      deskId: 1,
      date: "2026-05-04",
    });
  });
});

describe("applyMessage", () => {
  function makeState() {
    return {
      bookings: new Map<
        string,
        {
          deskId: number;
          userId: number;
          type: "daily" | "fixed";
          user: { id: number; name: string; avatar_url: string | null };
        }
      >(),
    };
  }

  it("desk.booked agrega al store con la fecha correcta", () => {
    const state = makeState();
    const msg: WsServerMessage = {
      type: "desk.booked",
      deskId: 7,
      date: "2026-05-04",
      user: { id: 11, name: "Alice", avatar_url: null },
    };
    applyMessage(state, msg, "2026-05-04");
    const stored = state.bookings.get("7:2026-05-04");
    expect(stored).toMatchObject({ deskId: 7, userId: 11, type: "daily" });
  });

  it("desk.booked en otra fecha distinta a la actual no afecta el store", () => {
    const state = makeState();
    applyMessage(
      state,
      {
        type: "desk.booked",
        deskId: 7,
        date: "2026-06-01",
        user: { id: 11, name: "Alice", avatar_url: null },
      },
      "2026-05-04",
    );
    expect(state.bookings.size).toBe(0);
  });

  it("desk.released elimina la entrada del día actual", () => {
    const state = makeState();
    state.bookings.set("7:2026-05-04", {
      deskId: 7,
      userId: 11,
      type: "daily",
      user: { id: 11, name: "Alice", avatar_url: null },
    });
    applyMessage(
      state,
      { type: "desk.released", deskId: 7, date: "2026-05-04" },
      "2026-05-04",
    );
    expect(state.bookings.size).toBe(0);
  });

  it("desk.fixed agrega al store como fixed", () => {
    const state = makeState();
    applyMessage(
      state,
      {
        type: "desk.fixed",
        deskId: 9,
        user: { id: 22, name: "Bob", avatar_url: null },
      },
      "2026-05-04",
    );
    expect(state.bookings.get("9:2026-05-04")?.type).toBe("fixed");
  });

  it("desk.unfixed elimina del store", () => {
    const state = makeState();
    state.bookings.set("9:2026-05-04", {
      deskId: 9,
      userId: 22,
      type: "fixed",
      user: { id: 22, name: "Bob", avatar_url: null },
    });
    applyMessage(state, { type: "desk.unfixed", deskId: 9 }, "2026-05-04");
    expect(state.bookings.size).toBe(0);
  });

  it("office.updated invoca el callback con officeId", () => {
    const state = makeState();
    const cb = vi.fn();
    applyMessage(state, { type: "office.updated", officeId: 3 }, "2026-05-04", cb);
    expect(cb).toHaveBeenCalledWith(3);
  });
});
