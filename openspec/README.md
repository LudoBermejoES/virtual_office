# OpenSpec — Teimas Space

Especificaciones y changes para la oficina virtual.

## Estructura

```
openspec/
├── config.yaml           ← contexto y reglas inyectadas en cada artifact
├── specs/                ← fuente de verdad: comportamiento ACTUAL del sistema
│   └── (vacío hasta que se archive el primer change)
└── changes/              ← propuestas en proceso
    ├── 001-project-foundation/
    ├── 002-testing-infrastructure/
    ├── 003-google-auth/
    ├── 004-external-invitations/
    ├── 005-office-map-upload/
    ├── 006-desk-zone-drawing/
    ├── 007-daily-desk-booking/
    ├── 008-fixed-desk-assignment/
    ├── 009-realtime-occupancy/
    ├── 010-day-navigation/
    ├── 011-user-avatars/
    └── 012-videogame-typography/
```

## Roadmap recomendado

El orden de los prefijos `001..012` es el orden de implementación recomendado, derivado de las dependencias entre changes.

```
001 ─► 002 ─┬─► 003 ─► 004 ──────────────────────────┐
            │                                         │
            └─► 005 ─► 006 ─► 007 ─► 008 ─► 009 ─► 010 ─► 011 ─► 012
```

| # | Change | Dependencias |
|---|--------|--------------|
| 001 | project-foundation | — |
| 002 | testing-infrastructure | 001 |
| 003 | google-auth | 001, 002 |
| 004 | external-invitations | 003 |
| 005 | office-map-upload | 001, 002, 003 |
| 006 | desk-zone-drawing | 005 |
| 007 | daily-desk-booking | 003, 006 |
| 008 | fixed-desk-assignment | 007 |
| 009 | realtime-occupancy | 007 |
| 010 | day-navigation | 007 |
| 011 | user-avatars | 007 |
| 012 | videogame-typography | 001 (pero se cierra al final) |

### Por qué este orden

1. **001-project-foundation** — sin scaffolding no hay nada que testear ni desplegar.
2. **002-testing-infrastructure** — TDD requiere tener Vitest/Playwright operativos antes de empezar a escribir features.
3. **003-google-auth** — todo el resto requiere usuarios autenticados.
4. **004-external-invitations** — extiende auth; va después porque solo aplica una vez auth funciona.
5. **005-office-map-upload** y **006-desk-zone-drawing** — antes de poder reservar un puesto hay que tener la oficina y los puestos definidos.
6. **007-daily-desk-booking** — el caso de uso central.
7. **008-fixed-desk-assignment** — variante de booking; se monta sobre el modelo de bookings.
8. **009-realtime-occupancy** — añade la capa WebSocket para que los demás vean los cambios. Se hace después de que el modelo de bookings esté validado.
9. **010-day-navigation** — UI de navegación, requiere que ya haya datos de bookings que mostrar.
10. **011-user-avatars** — capa de presentación encima de bookings existentes.
11. **012-videogame-typography** — pulido visual transversal, se cierra al final aunque la fuente se cargue desde 001.

## Ciclo por change

```
1. Leer proposal + specs del change
2. /opsx:apply <change>          (con TDD: test rojo → código → green → refactor)
3. /opsx:verify <change>          (validar que todo coincide)
4. /opsx:archive <change>         (fusiona delta specs en specs/)
```

Tras archivar, los specs vivos están en `openspec/specs/`. Cada nuevo change describe el delta sobre esa base.
