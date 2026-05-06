# Troubleshooting tmj-optimize

Casos extra no listados en SKILL.md.

## El TMJ optimizado tiene `tilecount: 0`

Probablemente el `.tmj` no tiene `tilelayer.data` con tiles ≠ 0 (mapa vacío). La herramienta lanzará `no_tiles_to_compose`. Solución: dibuja al menos un tile en alguna capa.

## El WebP se ve correcto pero al subirlo el backend rechaza

El backend tiene una regex estricta para nombres de archivo (`/^[a-zA-Z0-9_ .-]+\.(png|webp)$/`). Si el basename del input contiene caracteres exóticos (acentos, comas, etc.) el WebP de salida también, y el backend lo rechazará. Solución: renombrar el `.tmj` original a algo simple (sin acentos) antes de optimizar.

## El mapa optimizado pesa **más** que el original

Posibles causas:
1. Tu PNG original ya estaba muy comprimido (paleta indexada con pocos colores).
2. WebP lossless de imágenes con bordes muy nítidos puede ser ligeramente mayor que un PNG-8.

Solución: prueba `--lossy --quality 90`. Para pixel-art compacto donde no quieres pérdida, mantén el PNG original — la herramienta no es siempre mejor en términos de bytes finales aunque sí lo sea en número de tiles.

## Quiero ver qué tiles está incluyendo

El reporte de stdout muestra un total. Para detalle:

```bash
pnpm tmj-optimize mapas/teimas.tmj --out-dir /tmp/inspect
cat /tmp/inspect/teimas.optimized.tmj | jq '.tilesets[0].tilecount'
```

Y el WebP puedes abrirlo en cualquier visor para verificar visualmente que aparecen los tiles esperados.

## Reserves diarias o fijos rotos tras optimizar

No deberían. Las reservas viven en SQLite ligadas a `desk.id`, no a coords. Al re-importar el TMJ con `mismos labels` (T1, T2, ...), el backend hace `UPDATE desks SET x=?, y=?` preservando ids. Si pierdes reservas, probablemente el TMJ optimizado tenía labels diferentes (no debería pasar — la herramienta no toca labels de los object layers).

## El layer `desks` no se ve tras optimizar

El optimizador NO toca object layers de rectángulos/points/text. Si no ves los marcadores en el mapa cargado, es problema del frontend (cámara, viewport) no del TMJ. Verifica abriendo el `.optimized.tmj` en Tiled — los marcadores deben aparecer en sus posiciones originales.
