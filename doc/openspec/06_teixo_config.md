# OpenSpec en Teixo: Configuración Específica

Guía de cómo usar OpenSpec adaptado a las convenciones y necesidades concretas de Teixo.

---

## Setup inicial

```bash
# Instalar OpenSpec (una sola vez, global)
npm install -g @fission-ai/openspec@latest

# Inicializar en Teixo
cd /Users/ludo/code/teixo
openspec init --tools claude

# Verificar
openspec list
```

Esto crea:
- `openspec/` con la estructura base
- `.claude/skills/` con los skills para Claude Code

---

## Configuración recomendada para Teixo

Crear o editar `openspec/config.yaml`:

```yaml
schema: spec-driven

context: |
  ## Proyecto: Teixo
  Aplicación web para empresas de gestión ambiental y de residuos.
  Stack: Ruby 3.4.7, Rails 8.0.2.1, MySQL.

  ## Arquitectura Multi-Tenant
  Todos los datos están delimitados por Account (raíz del tenant).
  SIEMPRE delimitar queries por account:
  - Correcto: current_account.documents.find(params[:id])
  - NUNCA: Document.find(params[:id])

  ## Convenciones clave
  - Soft delete: usar document.trash! (NUNCA .destroy)
  - Constantes globales en config/initializers/global_constants.rb (3000+ líneas)
  - Usar siempre constantes, no strings mágicos: DOCUMENT_STATES[:closed]
  - Comentarios y documentación en español
  - Tests con RSpec + Playwright para acceptance tests

  ## Tipos de documentos
  Ambientales: TrackingDocument, NotificationDocument, AcceptanceDocument,
               AdmissionRequestDocument, TransportDocument, SandachDocument
  Comerciales: EstimateDocument, OrderDocument, DeliveryDocument,
               InvoiceDocument, IncomingInvoiceDocument

  ## Integraciones gubernamentales (E3L)
  En lib/e3l_comms/ — cada CCAA tiene su conector:
  - Servicios web: esir_ws.rb, sira_ws.rb, valencia_ws.rb, navarra_ws.rb
  - Correo/subida: andalucia_mail.rb, madrid_upload.rb

  ## Background jobs
  Usa DelayedJob (migrando a Hatchet). Jobs en app/jobs/*.rb

rules:
  proposal:
    - Indicar si afecta a integraciones E3L y qué CCAA
    - Indicar si hay impacto en documentos ambientales o comerciales
    - Describir el impacto en rendimiento si hay queries nuevas o complejas
    - Incluir plan de rollback si el cambio es de riesgo alto
  specs:
    - Usar formato Given/When/Then para todos los scenarios
    - Incluir scenario de validación por account cuando el modelo tiene account_id
    - Incluir scenarios de error (datos inválidos, permisos insuficientes)
  design:
    - Especificar si se necesitan migraciones de BD (incluyendo CHARACTER SET)
    - Incluir diagrama de secuencia para flujos con integración externa
    - Si hay jobs en background, describir la estrategia de retry y errores
  tasks:
    - Siempre incluir tarea de tests (unit + acceptance si aplica)
    - Si se añaden archivos .jrxml, incluir tarea de compilar el .jasper
    - Incluir tarea de rubocop para archivos nuevos o modificados
    - Si afecta a E3L, incluir tarea de test en entorno pre-producción
```

---

## Dominios de specs sugeridos para Teixo

Al crear specs, usar esta organización de dominios:

```
openspec/specs/
├── documentos-ambientales/    ← TrackingDocument, NotificationDocument, etc.
├── documentos-comerciales/    ← InvoiceDocument, DeliveryDocument, etc.
├── facturacion/               ← ciclo de facturación, pagos
├── trazabilidad/              ← residuos, cadena de custodia
├── e3l/                       ← integraciones gubernamentales
│   ├── esir/
│   ├── sira/
│   └── ...
├── background-jobs/           ← DelayedJob / Hatchet
├── api/                       ← endpoints de API
├── autenticacion/             ← usuarios, accounts, permisos
└── configuracion/             ← MyCompanyConfiguration, feature flags
```

---

## Cómo usar OpenSpec con el flujo de trabajo de Teixo

### Para un ticket TC-XXXX

```
1. Leer el ticket y entender los requisitos
2. /opsx:explore (si los requisitos son poco claros)
3. /opsx:propose tc-4276-filtro-verifactu
4. Revisar los artifacts generados (propuesta, specs, design, tasks)
5. /opsx:apply
6. Seguir el proceso normal de commit de Teixo (C00)
7. /opsx:archive
```

### Para proyectos multi-commit (como la migración Hatchet)

OpenSpec encaja perfectamente con el flujo multi-commit de CLAUDE.md:

```
1. /opsx:propose migrar-hatchet (genera todos los artifacts)
2. Para cada commit del proyecto:
   - Implementar las tareas correspondientes con /opsx:apply
   - Seguir proceso de commit (C00)
   - Actualizar tasks.md marcando las tareas completadas
3. /opsx:archive cuando el proyecto completo esté terminado
```

El directorio `openspec/changes/migrar-hatchet/` hace el rol del `contexto.md` mencionado en CLAUDE.md, con la ventaja de que está estructurado y la IA lo entiende nativamente.

---

## Relación con el hatchet_plan existente

El directorio `doc/delayed_jobs/hatchet_plan/` ya tiene una estructura similar a la que genera OpenSpec:

```
hatchet_plan/
├── proposal.md      ← equivalente al artifact proposal
├── design.md        ← equivalente al artifact design
├── tasks.md         ← equivalente al artifact tasks
└── specs/           ← equivalente a los delta specs
```

Si quisiéramos migrar este plan a OpenSpec:

```bash
# Crear el change en OpenSpec
mkdir -p openspec/changes/migrar-hatchet

# Copiar los archivos existentes
cp doc/delayed_jobs/hatchet_plan/proposal.md openspec/changes/migrar-hatchet/
cp doc/delayed_jobs/hatchet_plan/design.md openspec/changes/migrar-hatchet/
cp doc/delayed_jobs/hatchet_plan/tasks.md openspec/changes/migrar-hatchet/
cp -r doc/delayed_jobs/hatchet_plan/specs/ openspec/changes/migrar-hatchet/specs/

# Crear metadata
echo "schema: spec-driven" > openspec/changes/migrar-hatchet/.openspec.yaml
```

A partir de ese momento se puede usar `/opsx:apply migrar-hatchet` y `/opsx:archive migrar-hatchet` normalmente.

---

## Tips para Teixo

### En el context de config.yaml

- Mencionar siempre la restricción de multi-tenant (account_id)
- Mencionar el soft delete para que las tasks no incluyan `.destroy`
- Mencionar las constantes globales para que los specs referencien `DOCUMENT_STATES[:x]`

### Al crear specs

Siempre incluir scenario de scope por account:

```markdown
#### Scenario: Acceso cross-account bloqueado
- GIVEN un documento perteneciente al account 123
- WHEN un usuario del account 456 intenta acceder
- THEN se lanza un error de autorización
- AND no se devuelve ningún dato del documento
```

### Al crear tasks

Para features que requieren migrations:

```markdown
## 3. Base de Datos
- [ ] 3.1 Crear migración para la nueva tabla/columna
- [ ] 3.2 Verificar CHARACTER SET utf8mb4 en la migración
- [ ] 3.3 Ejecutar bundle exec rake db:migrate en local
- [ ] 3.4 Verificar que db/schema.rb está actualizado
```

Para features con archivos Jasper (reportes):

```markdown
## 4. Reportes
- [ ] 4.1 Modificar el archivo .jrxml
- [ ] 4.2 Compilar el .jasper correspondiente
- [ ] 4.3 Verificar que ambos archivos están staged para el commit
```

---

## Comandos rápidos de referencia

```bash
# Setup
openspec init --tools claude

# Nuevo cambio
# En Claude Code: /opsx:propose nombre-del-cambio

# Ver estado
openspec list
openspec status --change nombre-del-cambio

# Validar
openspec validate --all

# Ver dashboard
openspec view
```
