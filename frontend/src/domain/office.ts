export function computeMapScale(
  canvasWidth: number,
  canvasHeight: number,
  mapWidth: number,
  mapHeight: number,
): number {
  if (mapWidth <= 0 || mapHeight <= 0) return 1;
  return Math.min(canvasWidth / mapWidth, canvasHeight / mapHeight);
}
