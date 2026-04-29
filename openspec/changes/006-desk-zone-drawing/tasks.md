# Tareas: Desk Pin Placement

## 1. Constantes compartidas

- [ ] 1.1 Crear `packages/shared/src/desk.ts` con `DESK_SIZE_PX`, `DESK_HALF`, `DESK_MIN_SEPARATION`.
- [ ] 1.2 Crear `packages/shared/src/geometry.ts` con `chebyshevDistance` y `validateDeskPlacement`.
- [ ] 1.3 (test unit shared) `chebyshevDistance` con casos canónicos.
- [ ] 1.4 (test unit shared) `validateDeskPlacement` cubre los 4 casos de error y el ok.

## 2. Backend: validación

- [ ] 2.1 (test unit) `validateDeskPlacement` rechaza con `out_of_bounds` para coords negativas o > bounds.
- [ ] 2.2 (test unit) `validateDeskPlacement` rechaza con `too_close_to_existing` cuando Chebyshev < `DESK_MIN_SEPARATION`.
- [ ] 2.3 (test unit) `validateDeskPlacement` admite cuando Chebyshev = `DESK_MIN_SEPARATION` exacto.

## 3. Backend: repos y endpoints

- [ ] 3.1 `src/infra/repos/desks.ts` con `create`, `update`, `delete`, `listByOffice`, `findById`. `create` admite `source: "manual" | "tiled"` (default `"manual"`).
- [ ] 3.2 (test integration) `POST /api/offices/:id/desks` admin con `(label="A1", x=160, y=110)` → 201 con `source="manual"`.
- [ ] 3.3 (test integration) `POST` con label duplicado → 409 `label_taken`.
- [ ] 3.4 (test integration) `POST` con coords fuera del mapa → 422 `out_of_bounds`.
- [ ] 3.5 (test integration) `POST` con un pin a Chebyshev=10 de otro existente → 422 `too_close_to_existing`.
- [ ] 3.6 (test integration) `POST` cuando ya hay `MAX_DESKS_PER_OFFICE` desks → 422 `office_full`.
- [ ] 3.7 (test integration) `PATCH /api/desks/:id { x, y }` admin valida igual que POST.
- [ ] 3.8 (test integration) `PATCH` puede cambiar solo el `label`.
- [ ] 3.9 (test integration) `DELETE /api/desks/:id` admin → 204.
- [ ] 3.10 (test integration) Member intenta cualquiera → 403.
- [ ] 3.11 (test integration) `GET /api/offices/:id` incluye `desks: [{ id, label, x, y, source }]`.

## 3b. Backend: importación desde Tiled object layer "desks"

- [ ] 3b.1 (test unit) `parseDesksFromTiled(tmj)` extrae point objects con `(name, x, y)`.
- [ ] 3b.2 (test unit) `parseDesksFromTiled` toma el centro de objetos rectángulo como `(x, y)`.
- [ ] 3b.3 (test unit) `parseDesksFromTiled` ignora ellipses y polígonos con warning `unsupported_object_type`.
- [ ] 3b.4 (test unit) `parseDesksFromTiled` autogenera labels `T1`, `T2`, … cuando `name` está vacío.
- [ ] 3b.5 (test unit) `parseDesksFromTiled` retorna `[]` si no hay object layer "desks".
- [ ] 3b.6 (test integration) `POST /api/offices` con tmj que incluye object layer "desks" con 3 points → 201 y los 3 desks aparecen en `GET /api/offices/:id` con `source="tiled"`.
- [ ] 3b.7 (test integration) Si un point colisiona con otro o queda fuera de bounds, se reporta en `desksWarnings`; el resto se importa.
- [ ] 3b.8 (test integration) `PATCH /api/offices/:id` con un nuevo `.tmj` no toca los desks existentes (manual o tiled).
- [ ] 3b.9 (test integration) `POST /api/offices/:id/desks/import-from-tiled` admin importa solo los nuevos del layer; los ya existentes con mismo label se omiten.
- [ ] 3b.10 (test integration) Re-importación cuando un label coincide con uno `source="manual"` → warning `label_taken_by_manual`, no sobreescribe.
- [ ] 3b.11 (test integration) Member intenta `import-from-tiled` → 403.

## 4. Frontend: AdminMapScene

- [ ] 4.1 Crear `src/scenes/AdminMapScene.ts` activable solo para admin.
- [ ] 4.2 Renderizar mapa de fondo y puestos existentes como `Rectangle` `DESK_SIZE_PX`.
- [ ] 4.3 Estado "placing" con tecla N y botón HUD.
- [ ] 4.4 Click en placing → coloca pin, prompt HTML de label, POST.
- [ ] 4.5 Snap a grid `tile_width × tile_height` con Shift en placing y drag (usando los valores Tiled de la oficina actual).
- [ ] 4.6 Selección con click → resaltar borde animado.
- [ ] 4.7 Drag del seleccionado → mueve, PATCH al soltar (optimistic UI con rollback en error).
- [ ] 4.8 F2 sobre seleccionado → prompt label, PATCH.
- [ ] 4.9 Supr sobre seleccionado → confirm, DELETE.
- [ ] 4.10 Validación cliente con `validateDeskPlacement` antes de enviar; mostrar motivo legible.
- [ ] 4.11 Botón "Salir del modo admin" → vuelve a `OfficeScene`.

## 5. Frontend: render compartido

- [ ] 5.1 `render/desk-renderer.ts` exporta `drawDesk(scene, desk, state)` que pinta `Rectangle` con color según estado.
- [ ] 5.2 (test unit FE) `desk-renderer` calcula correctamente las esquinas dado `(x, y, DESK_SIZE_PX)`.

## 6. E2E

- [ ] 6.1 (e2e) Admin entra al modo admin, coloca un puesto en (200, 150) y le da label "A1"; al recargar persiste con `source="manual"`.
- [ ] 6.2 (e2e) Admin intenta colocar otro puesto a 20 px del primero → mensaje "demasiado cerca".
- [ ] 6.3 (e2e) Admin arrastra A1 a (300, 200) → al recargar la nueva posición persiste.
- [ ] 6.4 (e2e) Admin renombra A1 a "DIRECCION" con F2 → persiste.
- [ ] 6.5 (e2e) Admin borra A1 → desaparece del mapa y del listado.
- [ ] 6.6 (e2e) Admin sube un `.tmj` con object layer "desks" que contiene 3 points etiquetados → tras subir, los 3 puestos aparecen como `source="tiled"`.
- [ ] 6.7 (e2e) Admin coloca manualmente un puesto extra; vuelve a Tiled y añade un cuarto point; reimporta → solo se añade el nuevo (3 originales y el manual intactos).

## 7. Verificación

- [ ] 7.1 Coverage ≥ 80% en `geometry.ts`, `desks.ts`, `desk-renderer.ts`.
- [ ] 7.2 `pnpm test` y `pnpm e2e:chromium` en verde.
- [ ] 7.3 Backend y frontend importan `DESK_SIZE_PX` desde `packages/shared` (no hay duplicado).
