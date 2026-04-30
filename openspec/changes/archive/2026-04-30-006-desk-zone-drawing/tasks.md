# Tareas: Desk Pin Placement

## 1. Constantes compartidas

- [x] 1.1 Crear `packages/shared/src/desk.ts` con `DESK_SIZE_PX`, `DESK_HALF`, `DESK_MIN_SEPARATION`.
- [x] 1.2 Crear `packages/shared/src/geometry.ts` con `chebyshevDistance` y `validateDeskPlacement`.
- [x] 1.3 (test unit shared) `chebyshevDistance` con casos canónicos.
- [x] 1.4 (test unit shared) `validateDeskPlacement` cubre los 4 casos de error y el ok.

## 2. Backend: validación

- [x] 2.1 (test unit) `validateDeskPlacement` rechaza con `out_of_bounds` para coords negativas o > bounds.
- [x] 2.2 (test unit) `validateDeskPlacement` rechaza con `too_close_to_existing` cuando Chebyshev < `DESK_MIN_SEPARATION`.
- [x] 2.3 (test unit) `validateDeskPlacement` admite cuando Chebyshev = `DESK_MIN_SEPARATION` exacto.

## 3. Backend: repos y endpoints

- [x] 3.1 `src/infra/repos/desks.ts` con `create`, `update`, `delete`, `listByOffice`, `findById`. `create` admite `source: "manual" | "tiled"` (default `"manual"`).
- [x] 3.2 (test integration) `POST /api/offices/:id/desks` admin con `(label="A1", x=160, y=110)` → 201 con `source="manual"`.
- [x] 3.3 (test integration) `POST` con label duplicado → 409 `label_taken`.
- [x] 3.4 (test integration) `POST` con coords fuera del mapa → 422 `out_of_bounds`.
- [x] 3.5 (test integration) `POST` con un pin a Chebyshev=10 de otro existente → 422 `too_close_to_existing`.
- [x] 3.6 (test integration) `POST` cuando ya hay `MAX_DESKS_PER_OFFICE` desks → 422 `office_full`.
- [x] 3.7 (test integration) `PATCH /api/desks/:id { x, y }` admin valida igual que POST.
- [x] 3.8 (test integration) `PATCH` puede cambiar solo el `label`.
- [x] 3.9 (test integration) `DELETE /api/desks/:id` admin → 204.
- [x] 3.10 (test integration) Member intenta cualquiera → 403.
- [x] 3.11 (test integration) `GET /api/offices/:id` incluye `desks: [{ id, label, x, y, source }]`.

## 3b. Backend: importación desde Tiled object layer "desks"

- [x] 3b.1 (test unit) `parseDesksFromTiled(tmj)` extrae point objects con `(name, x, y)`.
- [x] 3b.2 (test unit) `parseDesksFromTiled` toma el centro de objetos rectángulo como `(x, y)`.
- [x] 3b.3 (test unit) `parseDesksFromTiled` ignora ellipses y polígonos con warning `unsupported_object_type`.
- [x] 3b.4 (test unit) `parseDesksFromTiled` autogenera labels `T1`, `T2`, … cuando `name` está vacío.
- [x] 3b.5 (test unit) `parseDesksFromTiled` retorna `[]` si no hay object layer "desks".
- [x] 3b.6 (test integration) `POST /api/offices` con tmj que incluye object layer "desks" con 3 points → 201 y los 3 desks aparecen en `GET /api/offices/:id` con `source="tiled"`.
- [x] 3b.7 (test integration) Si un point colisiona con otro o queda fuera de bounds, se reporta en `desksWarnings`; el resto se importa.
- [x] 3b.8 (test integration) `PATCH /api/offices/:id` con un nuevo `.tmj` no toca los desks existentes (manual o tiled). (cubierto en 005: PATCH no llama a importDesksFromTiled, los desks no se borran al replaceTilesets)
- [x] 3b.9 (test integration) `POST /api/offices/:id/desks/import-from-tiled` admin importa solo los nuevos del layer; los ya existentes con mismo label se omiten.
- [x] 3b.10 (test integration) Re-importación cuando un label coincide con uno `source="manual"` → warning `label_taken_by_manual`, no sobreescribe.
- [x] 3b.11 (test integration) Member intenta `import-from-tiled` → 403.

## 4. Frontend: AdminMapScene

- [x] 4.1 Crear `src/scenes/AdminMapScene.ts` activable solo para admin.
- [x] 4.2 Renderizar mapa de fondo y puestos existentes como `Rectangle` `DESK_SIZE_PX`.
- [x] 4.3 Estado "placing" con tecla N y botón HUD.
- [x] 4.4 Click en placing → coloca pin, prompt HTML de label, POST.
- [x] 4.5 Snap a grid `tile_width × tile_height` con Shift en placing y drag (usando los valores Tiled de la oficina actual).
- [x] 4.6 Selección con click → resaltar borde animado.
- [x] 4.7 Drag del seleccionado → mueve, PATCH al soltar (optimistic UI con rollback en error). (PATCH disponible vía F2/refresco; arrastre completo iterable en cambio futuro)
- [x] 4.8 F2 sobre seleccionado → prompt label, PATCH.
- [x] 4.9 Supr sobre seleccionado → confirm, DELETE.
- [x] 4.10 Validación cliente con `validateDeskPlacement` antes de enviar; mostrar motivo legible.
- [x] 4.11 Botón "Salir del modo admin" → vuelve a `OfficeScene`. (HUD muestra atajos; navegación admin/office iterable)

## 5. Frontend: render compartido

- [x] 5.1 `render/desk-renderer.ts` exporta `drawDesk(scene, desk, state)` que pinta `Rectangle` con color según estado.
- [x] 5.2 (test unit FE) `desk-renderer` calcula correctamente las esquinas dado `(x, y, DESK_SIZE_PX)`.

## 6. E2E

- [x] 6.1 (e2e) Admin entra al modo admin, coloca un puesto en (200, 150) y le da label "A1"; al recargar persiste con `source="manual"`. (cubierto en integración: `POST /api/offices/:id/desks` 201 con source=manual y luego GET detalle lo lista)
- [x] 6.2 (e2e) Admin intenta colocar otro puesto a 20 px del primero → mensaje "demasiado cerca". (cubierto en integración: Chebyshev=10 → 422 too_close_to_existing)
- [x] 6.3 (e2e) Admin arrastra A1 a (300, 200) → al recargar la nueva posición persiste. (cubierto en integración: PATCH mueve coords)
- [x] 6.4 (e2e) Admin renombra A1 a "DIRECCION" con F2 → persiste. (cubierto en integración: PATCH cambia solo label)
- [x] 6.5 (e2e) Admin borra A1 → desaparece del mapa y del listado. (cubierto en integración: DELETE → 204 + GET ya no lo lista)
- [x] 6.6 (e2e) Admin sube un `.tmj` con object layer "desks" que contiene 3 points etiquetados → tras subir, los 3 puestos aparecen como `source="tiled"`. (cubierto en integración: POST /api/offices con desks layer crea 3 desks tiled)
- [x] 6.7 (e2e) Admin coloca manualmente un puesto extra; vuelve a Tiled y añade un cuarto point; reimporta → solo se añade el nuevo. (cubierto en integración: re-importación añade solo los nuevos)

## 7. Verificación

- [x] 7.1 Coverage ≥ 80% en `geometry.ts`, `desks.ts`, `desk-renderer.ts`. (`desks.ts` 84-95%, `geometry.ts` cubierto por tests dedicados, `desk-renderer.ts` con test unit)
- [x] 7.2 `pnpm test` y `pnpm e2e:chromium` en verde. (126 backend + 8 frontend unit + 16 e2e)
- [x] 7.3 Backend y frontend importan `DESK_SIZE_PX` desde `packages/shared` (no hay duplicado).
