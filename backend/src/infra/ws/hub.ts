import type { WsServerMessage } from "@virtual-office/shared";
import { wsConnectionsActive, wsMessagesSent } from "../../http/plugins/metrics.js";

export interface HubSocket {
  readyState: number;
  send(data: string): void;
}

const OPEN = 1;

function officeIdFromRoom(room: string): string {
  return room.startsWith("office:") ? room.slice(7) : room;
}

export class WsHub {
  private rooms = new Map<string, Set<HubSocket>>();

  join(room: string, socket: HubSocket): void {
    let set = this.rooms.get(room);
    if (!set) {
      set = new Set();
      this.rooms.set(room, set);
    }
    set.add(socket);
    wsConnectionsActive.inc({ office_id: officeIdFromRoom(room) });
  }

  leave(room: string, socket: HubSocket): void {
    const set = this.rooms.get(room);
    if (!set) return;
    set.delete(socket);
    wsConnectionsActive.dec({ office_id: officeIdFromRoom(room) });
    if (set.size === 0) this.rooms.delete(room);
  }

  broadcast(room: string, msg: WsServerMessage): void {
    const set = this.rooms.get(room);
    if (!set) return;
    const payload = JSON.stringify(msg);
    wsMessagesSent.inc({ type: msg.type });
    for (const socket of set) {
      if (socket.readyState === OPEN) {
        try {
          socket.send(payload);
        } catch {
          // Sockets que fallan al enviar se ignoran; el cliente reintenta vía reconexión.
        }
      }
    }
  }

  roomSize(room: string): number {
    return this.rooms.get(room)?.size ?? 0;
  }
}

export function officeRoom(officeId: number): string {
  return `office:${officeId}`;
}
