# Tareas: zonas y salas Tiled

## 1. Modelo y migración

- [ ] 1.1 Crear migración `0004_office_features.sql` con tabla `office_features` + índice.
- [ ] 1.2 (test integration) La migración aplica de forma idempotente sobre una DB existente.
- [ ] 1.3 Tipos compartidos en `packages/shared/src/features.ts`: `Zone`, `Room`, `Label`, `Geometry`.

## 2. Parser

- [ ] 2.1 Crear `backend/src/services/tiled-features.parser.ts` con `parseTiledFeatures(tmj)`.
- [ ] 2.2 Schema Zod estricto para name (regex), kind (enum), geometry (discriminated union).
- [ ] 2.3 Validar que cada feature cae dentro del rango del mapa.
- [ ] 2.4 Cota dura: máx 200 features por oficina; error si se excede.
- [ ] 2.5 (test unit) Parser extrae correctamente zonas rectangulares.
- [ ] 2.6 (test unit) Parser extrae correctamente polígonos con coordenadas relativas → absolutas.
- [ ] 2.7 (test unit) Parser extrae labels con `font` y `size` válidos.
- [ ] 2.8 (test unit) Parser rechaza features con `name` inválido (xss, control chars).
- [ ] 2.9 (test unit) Parser rechaza polígonos con < 3 puntos o > 64 puntos.

## 3. Integración con upload de mapa

- [ ] 3.1 Extender `office.service.ts` para invocar `parseTiledFeatures` tras parsear desks.
- [ ] 3.2 Persistir features en la misma transacción que el resto de los datos del mapa.
- [ ] 3.3 Re-subida del mapa elimina y reinserta features.
- [ ] 3.4 (test integration) Subir un .tmj con zonas + rooms + labels → leer `GET /api/offices/:id` y verificar que vienen.

## 4. Endpoint y payload

- [ ] 4.1 Extender el shape de `GET /api/offices/:id` con `features: { zones, rooms, labels }`.
- [ ] 4.2 (test integration) Si la oficina no tiene features, el campo viene como `{ zones: [], rooms: [], labels: [] }`.

## 5. Render frontend

- [ ] 5.1 Crear `frontend/src/render/zone-renderer.ts` con `drawZone`.
- [ ] 5.2 Mapeo `ZONE_COLORS` por kind, usando colores del `theme.ts`.
- [ ] 5.3 Renderizar zonas con depth -10 (por debajo de desks).
- [ ] 5.4 Renderizar labels usando `font-display` o `font-body` según `font`.
- [ ] 5.5 (test unit FE) `drawZone` con un rect produce el rectángulo esperado.
- [ ] 5.6 (test unit FE) `drawZone` con un polígono produce el polygon esperado.

## 6. Indicador "Estás en zona X"

- [ ] 6.1 Helper `findZoneAt(x, y, zones)` con `Geom.Rectangle.Contains` y `Geom.Polygon.Contains`.
- [ ] 6.2 Texto VT323 en HUD que se actualiza on pointermove cuando cambia la zona.
- [ ] 6.3 (test unit FE) `findZoneAt` con un punto en una zona rectangular devuelve esa zona.
- [ ] 6.4 (test unit FE) `findZoneAt` con un punto fuera devuelve `null`.

## 7. Documentación

- [ ] 7.1 Actualizar `doc/be/README.md` con el formato esperado de object layers.
- [ ] 7.2 Sección en `doc/fe/README.md` sobre el render de zonas.
- [ ] 7.3 Mapa de ejemplo `doc/be/img/tiled-feature-layers.png` (o mock) mostrando un `.tmj` correcto.

## 8. Verificación

- [ ] 8.1 `pnpm test` (backend + frontend) en verde.
- [ ] 8.2 `pnpm e2e:chromium` en verde, con un test que verifica que un mapa con zonas las muestra.
- [ ] 8.3 `openspec validate --all --strict` en verde.
- [ ] 8.4 Inspección manual: subir un mapa con cocina + sala-mar + label "Mar" y comprobar render.
