# Tareas: zonas y salas Tiled

El ciclo TDD por tarea: escribe el test (red) → implementa lo mínimo (green) → refactoriza → marca [x].

## 1. Modelo y migración

- [ ] 1.1 (test integration) La migración `0004_office_features.sql` aplica de forma idempotente sobre una DB existente — escribir el test primero.
- [ ] 1.2 Crear migración `0004_office_features.sql` con tabla `office_features` + índice.
- [ ] 1.3 Tipos compartidos en `packages/shared/src/features.ts`: `Zone`, `Room`, `Label`, `Geometry`.

## 2. Parser

- [ ] 2.1 (test unit) Parser extrae correctamente zonas rectangulares — escribir el test primero.
- [ ] 2.2 (test unit) Parser extrae correctamente polígonos con coordenadas relativas → absolutas — escribir el test primero.
- [ ] 2.3 (test unit) Parser extrae labels con `font` y `size` válidos — escribir el test primero.
- [ ] 2.4 (test unit) Parser rechaza features con `name` inválido (xss, control chars) — escribir el test primero.
- [ ] 2.5 (test unit) Parser rechaza polígonos con < 3 puntos o > 64 puntos — escribir el test primero.
- [ ] 2.6 (test unit) Parser rechaza features con `kind` inválido devolviendo error descriptivo — escribir el test primero.
- [ ] 2.7 (test unit) Parser rechaza features cuya geometría cae fuera del rango del mapa — escribir el test primero.
- [ ] 2.8 (test unit) Parser rechaza mapas con más de 200 features combinadas — escribir el test primero.
- [ ] 2.9 Crear `backend/src/services/tiled-features.parser.ts` con `parseTiledFeatures(tmj)`.
- [ ] 2.10 Schema Zod estricto para name (regex), kind (enum), geometry (discriminated union).
- [ ] 2.11 Validar que cada feature cae dentro del rango del mapa.
- [ ] 2.12 Cota dura: máx 200 features por oficina; error si se excede.

## 3. Integración con upload de mapa

- [ ] 3.1 (test integration) Subir un `.tmj` con zonas + rooms + labels → `GET /api/offices/:id` devuelve las features — escribir el test primero.
- [ ] 3.2 (test integration) Si la oficina no tiene features, el campo viene como `{ zones: [], rooms: [], labels: [] }` — escribir el test primero.
- [ ] 3.3 (test integration) Re-subida del mapa elimina features antiguas y reinserta las nuevas — escribir el test primero.
- [ ] 3.4 Extender `office.service.ts` para invocar `parseTiledFeatures` tras parsear desks.
- [ ] 3.5 Persistir features en la misma transacción que el resto de los datos del mapa.
- [ ] 3.6 Re-subida del mapa elimina y reinserta features.

## 4. Endpoint y payload

- [ ] 4.1 Extender el shape de `GET /api/offices/:id` con `features: { zones, rooms, labels }`.

## 5. Render frontend

- [ ] 5.1 (test unit FE) `drawZone` con un rect produce el rectángulo esperado — escribir el test primero.
- [ ] 5.2 (test unit FE) `drawZone` con un polígono produce el polygon esperado — escribir el test primero.
- [ ] 5.3 (test unit FE) Labels renderizan con `font-display` cuando `font="display"` y `font-body` cuando `font="body"` — escribir el test primero.
- [ ] 5.4 Crear `frontend/src/render/zone-renderer.ts` con `drawZone`.
- [ ] 5.5 Mapeo `ZONE_COLORS` por kind, usando colores del `theme.ts`.
- [ ] 5.6 Renderizar zonas con depth -10 (por debajo de desks).
- [ ] 5.7 Renderizar labels usando `font-display` o `font-body` según `font`.

## 6. Indicador "Estás en zona X"

- [ ] 6.1 (test unit FE) `findZoneAt` con un punto en una zona rectangular devuelve esa zona — escribir el test primero.
- [ ] 6.2 (test unit FE) `findZoneAt` con un punto fuera de cualquier zona devuelve `null` — escribir el test primero.
- [ ] 6.3 (test unit FE) `findZoneAt` con un punto en un polígono cóncavo funciona correctamente — escribir el test primero.
- [ ] 6.4 Helper `findZoneAt(x, y, zones)` con `Geom.Rectangle.Contains` y `Geom.Polygon.Contains`.
- [ ] 6.5 Texto VT323 en HUD que se actualiza on pointermove cuando cambia la zona.
- [ ] 6.6 El texto se borra (o muestra cadena vacía) al salir de todas las zonas.

## 7. Documentación

- [ ] 7.1 Actualizar `doc/be/README.md` con el formato esperado de object layers.
- [ ] 7.2 Sección en `doc/fe/README.md` sobre el render de zonas.
- [ ] 7.3 Mapa de ejemplo `doc/be/img/tiled-feature-layers.png` (o mock) mostrando un `.tmj` correcto.

## 8. Verificación

- [ ] 8.1 `pnpm test` (backend + frontend) en verde.
- [ ] 8.2 (test e2e) Mapa con zonas: verificar que `GET /api/offices/:id` devuelve las zonas — correr `pnpm e2e:chromium`.
- [ ] 8.3 `openspec validate --all --strict` en verde.
- [ ] 8.4 Inspección manual: subir un mapa con cocina + sala-mar + label "Mar" y comprobar render.
