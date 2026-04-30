export const THEME = {
  bg: 0x0b0d1a,
  bg2: 0x131526,
  fg: 0xf5f5f5,
  muted: 0x8e92a8,
  accent: 0xff66cc,
  success: 0x36e36c,
  free: 0x36e36c,
  occupied: 0xff4d6d,
  danger: 0xff4d6d,
  mine: 0x5cf6ff,
  fixed: 0xb66dff,
  warning: 0xffd166,
} as const;

export type ThemeColor = keyof typeof THEME;
