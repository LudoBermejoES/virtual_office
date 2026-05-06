# UI Game

## ADDED Requirements

### Requirement: Selector de fecha tipo calendario al hacer clic en la etiqueta de fecha

El sistema MUST mostrar un overlay con calendario mensual cuando el usuario hace clic en la etiqueta de fecha del HUD, permitiendo elegir cualquier día dentro del horizonte de reservas mediante un único clic.

#### Scenario: Abrir el calendario

- **WHEN** un usuario en `OfficeScene` hace clic en la etiqueta de fecha del HUD
- **THEN** se monta un overlay HTML `#day-picker` posicionado bajo la etiqueta, mostrando el mes correspondiente a la fecha seleccionada con su grid de 6 semanas

#### Scenario: Toggle al volver a clicar la etiqueta

- **WHEN** el calendario está abierto y el usuario vuelve a clicar la etiqueta de fecha
- **THEN** el overlay se desmonta sin cambiar la fecha

#### Scenario: Atajo de teclado `c`

- **WHEN** el usuario pulsa la tecla `c` en `OfficeScene`
- **THEN** el calendario se abre o se cierra (toggle)

#### Scenario: Día seleccionado destacado

- **WHEN** el calendario se monta
- **THEN** la celda correspondiente a la fecha actualmente seleccionada del store aparece con fondo `--color-accent`

#### Scenario: Día de hoy destacado

- **WHEN** el calendario muestra el mes que contiene la fecha de hoy
- **THEN** la celda de hoy aparece con borde `--color-success`

#### Scenario: Días fuera del horizonte deshabilitados

- **WHEN** el grid contiene celdas con fecha anterior a `hoy - HISTORY_VISIBLE_DAYS` o posterior a `hoy + BOOKING_HORIZON_DAYS - 1`
- **THEN** dichas celdas aparecen atenuadas y no responden al clic

#### Scenario: Click en día válido

- **WHEN** el usuario hace clic en una celda de un día dentro del horizonte
- **THEN** se invoca `uiStore.setDate(iso)` con la fecha de esa celda y el overlay se desmonta

#### Scenario: Cierre por click fuera

- **WHEN** el usuario hace clic en cualquier punto fuera del overlay
- **THEN** el overlay se desmonta sin cambiar la fecha

#### Scenario: Cierre por Esc

- **WHEN** el usuario pulsa `Esc` con el overlay abierto
- **THEN** el overlay se desmonta sin cambiar la fecha

### Requirement: Navegación de meses dentro del calendario

El sistema MUST ofrecer flechas para retroceder y avanzar de mes dentro del calendario, deshabilitándolas cuando el mes destino está completamente fuera del horizonte.

#### Scenario: Avanzar mes

- **WHEN** el usuario pulsa la flecha `>` del header del calendario
- **THEN** el grid se vuelve a renderizar con el mes siguiente y la cabecera muestra su nombre y año

#### Scenario: Retroceder mes

- **WHEN** el usuario pulsa la flecha `<` del header
- **THEN** el grid muestra el mes anterior

#### Scenario: Flecha de mes anterior deshabilitada

- **WHEN** todo el mes anterior está fuera de horizonte (todas sus fechas < `hoy - HISTORY_VISIBLE_DAYS`)
- **THEN** la flecha `<` aparece atenuada y no responde al clic

#### Scenario: Flecha de mes siguiente deshabilitada

- **WHEN** todo el mes siguiente está fuera de horizonte
- **THEN** la flecha `>` aparece atenuada y no responde al clic

### Requirement: Estética arcade del calendario

El calendario MUST emplear las tipografías y paleta arcade del resto de la app: Press Start 2P para el header de mes/año, VT323 para días de la semana y números, paleta `--color-bg-2`, `--color-success`, `--color-accent`, `--color-muted`.

#### Scenario: Tipografía del header

- **WHEN** el calendario se monta
- **THEN** el header (mes y año) usa `font-family: "Press Start 2P"` en color `--color-success`

#### Scenario: Tipografía de las celdas

- **WHEN** el calendario se monta
- **THEN** los días de la semana y los números de los días usan `font-family: "VT323"`

#### Scenario: Borde de la caja

- **WHEN** el calendario se monta
- **THEN** la caja contenedora tiene un borde de 2px en `--color-success` y fondo `--color-bg-2`
