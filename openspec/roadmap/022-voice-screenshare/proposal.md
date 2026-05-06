# Propuesta: Compartir pantalla en salas de voz

## Motivación

Reuniones de trabajo requieren mostrar pantalla. Al estar ya en una room LiveKit, añadir un track de screenshare es trivial; lo que requiere diseño es la UI.

## Alcance

**En scope:**

### A. Toggle de compartir pantalla

- Botón en HUD junto a cámara, atajo `S`.
- `room.localParticipant.setScreenShareEnabled(true, { audio: true })` con audio del sistema cuando el navegador lo permita.

### B. Visualización

- Cuando alguien comparte, panel principal central muestra el stream a tamaño grande (similar a Discord).
- Panel lateral muestra "📺 Pedro está compartiendo pantalla" con botón "Ver".
- Solo un compartir simultáneo por sala (LiveKit lo permite múltiple, pero la UI MVP lo limita a uno).

### C. Detener compartir

- El que comparte ve un banner "Estás compartiendo. [Detener]".

**Fuera de scope**: control remoto, anotaciones, grabación.
