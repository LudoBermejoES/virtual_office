# Delta — Oficinas

## MODIFIED Requirements

### Requirement: Listado y consulta de oficinas
El sistema MUST permitir a cualquier usuario autenticado listar oficinas y consultar el detalle, incluyendo los puestos definidos sobre el mapa con sus coordenadas y origen.

#### Scenario: Detalle con desks de ambos orígenes
- GIVEN una oficina con dos puestos: uno importado desde Tiled, otro creado manualmente
- WHEN un usuario autenticado solicita `GET /api/offices/:id`
- THEN la respuesta incluye `office` y `desks: [{ id, label, x, y, source }]` con dos elementos
- AND los valores de `source` incluyen `"tiled"` y `"manual"` respectivamente
