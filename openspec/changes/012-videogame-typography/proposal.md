# Propuesta: Videogame Typography

## Motivación

El usuario quiere que toda la UI tenga estética de videojuego, "una tipografía de videojuego". Las fuentes pixel se cargan desde el primer change (foundation) para evitar FOUT, pero la pasada final de pulido visual y de aplicación coherente del tema arcade a todos los componentes vive en este change. Se cierra al final del roadmap porque tira sobre la versión completa de la app.

## Alcance

**En scope:**
- Aplicación coherente de Press Start 2P (titulares, botones, etiquetas de día) y VT323 (cuerpo, mensajes, tooltips) en todos los textos visibles.
- Paleta arcade (`--color-bg`, `--color-fg`, `--color-accent`, `--color-success`, `--color-danger`, `--color-fixed`) consolidada en `style.css`.
- Botones con look 9-slice (frame-9slice.png) en `LoginScene`, modales y HUD.
- Sonidos retro opcionales en click/booking (asset placeholder, mute por defecto, toggle en HUD).
- `image-rendering: pixelated` global y `Phaser.Scale.NEAREST` confirmado.
- Visual regression con Playwright + screenshots para detectar regresiones de fuente o paleta.
- Documentación rápida: `doc/fe/THEME.md` con paleta, ejemplos de uso y dos screenshots de referencia.

**Fuera de scope:**
- Animaciones de "boot CRT" o efectos shader (futuro).
- Soporte de fuentes alternativas configurables por usuario.
- Gamepad / mando físico.

## Dominios afectados

`ui-game`.

## Orden y dependencias

Change `012`. Depende formalmente solo de `001-project-foundation` (las fuentes ya cargan desde ahí), pero se cierra **al final** del roadmap porque la pasada visual cubre todas las pantallas creadas en `003`–`011`.

## Impacto de seguridad

Ninguno.

## Rollback

Trivial: revertir CSS y reglas de tema. Las funcionalidades subyacentes no se ven afectadas.
