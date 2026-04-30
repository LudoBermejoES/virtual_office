# Delta — UI Game

## ADDED Requirements

### Requirement: Avatar circular en puestos ocupados
El sistema MUST renderizar la fotografía de Google del usuario que ocupa un puesto, recortada con una máscara circular, centrada sobre el cuadrado del puesto en `OfficeScene`. La fuente del avatar es siempre `users.avatar_url`, persistido durante el login con Google a partir del claim `picture` del ID token; este change NO MUST emitir requests a un endpoint propio de avatares.

#### Scenario: Avatar de Google visible en el puesto
- GIVEN Alice tiene `avatar_url="https://lh3.googleusercontent.com/...alice"` persistido en `users`
- AND Alice reserva A1 para hoy
- WHEN Bob carga la `OfficeScene`
- THEN A1 se renderiza con la imagen de Alice recortada en círculo, centrada en el cuadrado del puesto
- AND el cliente carga la imagen directamente desde la URL de `googleusercontent.com`

#### Scenario: Tooltip con nombre completo
- GIVEN A1 ocupado por Alice
- WHEN Bob pasa el ratón sobre A1
- THEN aparece un tooltip HTML mostrando el nombre completo de Alice 8 px por encima del cuadrado
- AND el tooltip desaparece al alejar el ratón o pulsar Escape

### Requirement: Fallback con iniciales cuando el avatar no carga
El sistema MUST mostrar un fallback compuesto por un círculo de color determinístico (basado en el `userId`) y las iniciales del nombre cuando el avatar no esté disponible o falle la carga. El fallback NUNCA MUST hacer reintentos infinitos contra Google.

#### Scenario: URL del avatar devuelve 403
- GIVEN Alice tiene una `avatar_url` cuya carga falla con 403
- WHEN Bob ve A1 ocupado por Alice
- THEN A1 muestra un círculo lleno con las iniciales `"A"` (primera letra del nombre) en blanco con tipografía pixel
- AND el color del círculo es determinístico para `Alice.id` (mismo color en sucesivas cargas)
- AND el cliente NO MUST reintentar la carga de la imagen

#### Scenario: Sin avatar persistido
- GIVEN un usuario invitado externo cuyo `avatar_url` es null
- WHEN ocupa un puesto y otro usuario lo ve
- THEN se renderiza el fallback con sus iniciales

### Requirement: Diferenciación visual por estado
El sistema MUST distinguir visualmente los estados del puesto incluso cuando hay avatar: borde cian pulsante para `mine`, borde rojo para `occupied`, borde violeta + icono 📌 para `fixed`, y sin avatar para `free`.

#### Scenario: Mi puesto reservado
- GIVEN Alice está logueada y reservó A1
- WHEN ve `OfficeScene`
- THEN A1 muestra su avatar circular sobre fondo cian semitransparente con borde cian pulsante

#### Scenario: Puesto fijo de otro usuario
- GIVEN Bob es fijo de A1
- WHEN Alice mira A1
- THEN aparece el avatar de Bob con icono 📌 en una esquina y borde violeta

### Requirement: Carga progresiva sin flash
El sistema MUST mostrar el fallback con iniciales mientras la textura del avatar se descarga, reemplazándolo por la imagen real cuando esté lista, sin descartar el booking del snapshot.

#### Scenario: Snapshot inicial con varios avatares no cacheados
- GIVEN Alice carga la oficina con 5 puestos ocupados por usuarios cuyos avatares no están cacheados
- WHEN se renderiza la `OfficeScene`
- THEN cada puesto muestra inmediatamente el fallback con iniciales
- AND a medida que llegan los `filecomplete-image-*`, los fallbacks se reemplazan por las fotografías circulares
- AND no hay parpadeos o cuadrados vacíos en ningún momento
