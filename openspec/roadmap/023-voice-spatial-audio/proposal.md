# Propuesta: Audio espacial por distancia entre puestos

## Motivación

En una sala con 16 personas hablando todas a la vez, el modelo "Discord plano" se vuelve ruidoso. Implementando audio espacial estilo Gather (volumen ponderado por distancia entre puestos), las conversaciones cercanas suenan claras y las lejanas se atenúan, replicando la experiencia física de una oficina.

## Alcance

**En scope:**

### A. Cálculo cliente-side de distancia

- En cada tick (~10Hz), para cada participante de la sala, calcular distancia euclídea entre el puesto del usuario y el puesto del participante.
- Si están en distintas salas, volumen 0 (no debería pasar porque LiveKit los aísla, pero por seguridad).

### B. Curva de atenuación configurable

- Parámetros: `falloffStart` (px), `falloffEnd` (px). Volumen lineal entre 100% y 0%.
- Defaults: `falloffStart = 100`, `falloffEnd = 400`.
- Fuera de `falloffEnd`: volumen 0.

### C. Aplicación

- `participant.audioTrackPublication.track.setVolume(volume)` en cada cambio.
- Throttle a 200ms para evitar saturar.

### D. Toggle global

- Setting de usuario: `voice_spatial_enabled = true | false`. Default `true`.
- Si false, todos los participantes a 100%.

### E. Visualización opcional

- Burbuja de "alcance auditivo" alrededor del puesto del usuario (círculo tenue de radio `falloffEnd`).

**Fuera de scope**: HRTF/3D real, panning estéreo según ángulo.
