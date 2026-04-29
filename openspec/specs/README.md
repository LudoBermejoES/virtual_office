# Specs — fuente de verdad

Aquí viven los specs que reflejan el comportamiento **actual** acordado del sistema.

A medida que cada change de `openspec/changes/` se archiva, sus delta specs (`ADDED`/`MODIFIED`/`REMOVED Requirements`) se fusionan en este directorio.

Dominios previstos (se crean al archivar el primer change que los toca):

```
specs/
├── autenticacion/   ← login Google, sesiones, dominios permitidos
├── invitaciones/    ← invitaciones a externos
├── oficinas/        ← upload de mapa, dimensiones, formatos
├── puestos/         ← desks, zonas poligonales
├── reservas/        ← bookings diarios y fijos
├── realtime/        ← protocolo WebSocket
└── ui-game/         ← convenciones de tipografía y estética
```

Hasta que se archive el primer change, este directorio está intencionalmente vacío.
