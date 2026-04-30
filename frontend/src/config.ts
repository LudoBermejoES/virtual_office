export const BASE_URL = import.meta.env.VITE_API_URL ?? "";
export const WS_BASE =
  import.meta.env.VITE_WS_URL ??
  (typeof window !== "undefined" ? `ws://${window.location.host}` : "ws://localhost");
