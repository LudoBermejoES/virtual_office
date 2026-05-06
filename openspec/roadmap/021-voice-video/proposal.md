# Propuesta: Cámara y vídeo en salas de voz

## Motivación

Algunas reuniones requieren ver caras. Tras los changes 019 (audio MVP) y 020 (controles), añadimos vídeo opcional reutilizando la misma room LiveKit.

## Alcance

**En scope:**

### A. Toggle de cámara

- Botón cámara on/off en HUD junto al micro, atajo `V`.
- `room.localParticipant.setCameraEnabled(bool)`.

### B. Selector de cámara

- Dropdown de webcams desde `enumerateDevices()`.

### C. Layout de tiles de vídeo

- Panel separado del panel lateral existente, en el lado derecho debajo del de participantes.
- Tile por participante con vídeo activo: 16:9, max 6 tiles (resto en overflow).
- Si nadie tiene vídeo, panel oculto.

### D. Vídeo en avatar (alternativo)

- Opción de configuración: si el participante está hablando y tiene cámara, su tile aparece flotando sobre su puesto en el mapa, no en el panel lateral.

### E. Calidad adaptativa

- Confiar en simulcast nativo de LiveKit. Subscriptor recibe baja calidad por defecto, alta solo en participante "activo".

**Fuera de scope**: screenshare, spatial.

## Riesgos

- Ancho de banda: 6 tiles HD = ~3 Mbps por usuario. Documentar en operación.
- Permisos de cámara denegados: degradar a solo audio sin error fatal.
