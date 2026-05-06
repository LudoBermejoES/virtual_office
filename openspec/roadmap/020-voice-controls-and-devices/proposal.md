# Propuesta: Controles avanzados de voz y dispositivos

## Motivación

Tras el MVP (change 019), los usuarios pueden hablar pero solo con voice activation y sin elegir dispositivo. Para un uso real (oficinas con varios micros, usuarios que prefieren push-to-talk en entornos ruidosos) se necesitan controles habituales en cualquier app de voz.

## Alcance

**En scope:**

### A. Push-to-talk configurable

- Toggle en preferencias del usuario: `voice_input_mode = "vad" | "ptt"`.
- Si PTT, tecla configurable (default: `Space`). Mientras se mantiene pulsada, micro abierto; al soltar, cerrado.
- Persistencia en `localStorage` (no en backend para MVP).

### B. Selector de dispositivos

- Dropdown de micrófono (entrada): lista `navigator.mediaDevices.enumerateDevices()` filtrando audioinput.
- Dropdown de altavoz (salida): audiooutput; `setSinkId` en cada elemento `<audio>` de LiveKit.
- Persistencia por dispositivo (deviceId) en `localStorage`.

### C. Ajuste de volumen por participante

- Slider 0-200% en cada fila del panel lateral (admin o propietario).
- Aplica `participant.audioTrackPublication.track.setVolume(...)` en el cliente.

### D. Indicador de calidad de conexión

- Cada fila del panel muestra un icono de barras según `participant.connectionQuality`.

### E. Niveles de audio

- Barra horizontal animada mostrando el nivel de mi propio mic (debug y para verificar que funciona).

**Fuera de scope**: vídeo, screenshare, spatial.
