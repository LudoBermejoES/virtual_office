import { WebSocket } from "ws";

export interface AwaitMessageOptions {
  timeout?: number;
}

export function connectWs(url: string, cookie?: string): WebSocket {
  const headers = cookie ? { cookie } : undefined;
  return new WebSocket(url, { headers });
}

export function awaitMessage<T = unknown>(
  socket: WebSocket,
  predicate: (msg: T) => boolean,
  { timeout = 2000 }: AwaitMessageOptions = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`awaitMessage: timeout tras ${timeout}ms esperando mensaje`));
    }, timeout);

    const onMessage = (raw: Buffer | string) => {
      let msg: T;
      try {
        msg = JSON.parse(raw.toString()) as T;
      } catch {
        return;
      }
      if (predicate(msg)) {
        clearTimeout(timer);
        socket.off("message", onMessage);
        resolve(msg);
      }
    };

    socket.on("message", onMessage);
    socket.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
