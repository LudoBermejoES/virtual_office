import { describe, it, expect } from "vitest";
import { WsHub, officeRoom } from "../../../../src/infra/ws/hub.js";
import type { HubSocket } from "../../../../src/infra/ws/hub.js";

function makeSocket(readyState: number): HubSocket & { sent: string[] } {
  const sent: string[] = [];
  return {
    readyState,
    sent,
    send(data: string) {
      sent.push(data);
    },
  };
}

describe("WsHub", () => {
  it("officeRoom genera 'office:<id>'", () => {
    expect(officeRoom(7)).toBe("office:7");
  });

  it("broadcast envía a todos los sockets OPEN del room", () => {
    const hub = new WsHub();
    const a = makeSocket(1);
    const b = makeSocket(1);
    hub.join("office:1", a);
    hub.join("office:1", b);

    hub.broadcast("office:1", { type: "desk.unfixed", deskId: 5 });

    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(1);
    expect(JSON.parse(a.sent[0]!)).toEqual({ type: "desk.unfixed", deskId: 5 });
  });

  it("broadcast ignora sockets en estado CLOSED", () => {
    const hub = new WsHub();
    const open = makeSocket(1);
    const closed = makeSocket(3);
    hub.join("office:1", open);
    hub.join("office:1", closed);

    hub.broadcast("office:1", { type: "desk.unfixed", deskId: 5 });

    expect(open.sent).toHaveLength(1);
    expect(closed.sent).toHaveLength(0);
  });

  it("leave elimina al socket; broadcast no lo recibe", () => {
    const hub = new WsHub();
    const a = makeSocket(1);
    hub.join("office:1", a);
    hub.leave("office:1", a);
    hub.broadcast("office:1", { type: "desk.unfixed", deskId: 1 });
    expect(a.sent).toHaveLength(0);
  });

  it("roomSize retorna el número de sockets en el room", () => {
    const hub = new WsHub();
    expect(hub.roomSize("office:1")).toBe(0);
    hub.join("office:1", makeSocket(1));
    hub.join("office:1", makeSocket(1));
    expect(hub.roomSize("office:1")).toBe(2);
  });

  it("broadcast en room vacío no falla", () => {
    const hub = new WsHub();
    expect(() =>
      hub.broadcast("office:1", { type: "desk.unfixed", deskId: 1 }),
    ).not.toThrow();
  });
});
