# Configuración de OpenSpec

Tres niveles de personalización:

| Nivel | Qué permite | Para quién |
|-------|-------------|------------|
| **Project Config** | Defaults, contexto del proyecto, reglas por artifact | La mayoría de equipos |
| **Custom Schemas** | Workflow propio con artifacts personalizados | Equipos con procesos únicos |
| **Global Overrides** | Compartir schemas entre proyectos | Power users |

---

## Project Config (`openspec/config.yaml`)

El archivo más importante para personalizar OpenSpec en un proyecto concreto.

### Estructura

```yaml
# openspec/config.yaml
schema: spec-driven

context: |
  Tech stack: Ruby 3.4.7, Rails 8.0.2.1, MySQL
  Multi-tenant: todos los datos están delimitados por Account
  Background jobs: DelayedJob (migrando a Hatchet)
  Testing: RSpec + Playwright para acceptance tests

  Convenciones clave:
  - Siempre delimitar queries por account: current_account.documents.find(id)
  - Soft delete: document.trash! (nunca .destroy)
  - Constantes globales en config/initializers/global_constants.rb
  - Comentarios en español

rules:
  proposal:
    - Identificar si el cambio afecta a integraciones E3L o documentos ambientales
    - Incluir estimación de impacto en rendimiento si hay queries nuevas
  specs:
    - Usar formato Given/When/Then para los scenarios
    - Incluir scenario de scope por account cuando aplique
  design:
    - Incluir diagrama de secuencia para flujos complejos
    - Especificar si se necesitan migraciones de BD
  tasks:
    - Incluir tarea de tests para cada funcionalidad nueva
    - Incluir tarea de rubocop si se añaden archivos nuevos
```

### Cómo funciona

**`schema`**: Schema por defecto para nuevos changes. Se puede sobrescribir con `--schema` en el CLI.

**`context`**: Se inyecta en TODOS los artifacts como `<context>...</context>`. Ayuda a la IA a entender las convenciones del proyecto. Límite: 50 KB.

**`rules`**: Se inyectan solo para el artifact correspondiente como `<rules>...</rules>`. Aparecen después del contexto, antes del template.

### Precedencia del schema

1. CLI flag: `--schema <nombre>`
2. Metadatos del change (`.openspec.yaml` en la carpeta del change)
3. Config del proyecto (`openspec/config.yaml`)
4. Default: `spec-driven`

---

## Custom Schemas

Cuando el config del proyecto no es suficiente. Los schemas personalizados viven en `openspec/schemas/` y se versionan con el código.

### Estructura de un schema

```
openspec/schemas/mi-workflow/
├── schema.yaml
└── templates/
    ├── proposal.md
    ├── spec.md
    ├── design.md
    └── tasks.md
```

### Crear un schema desde cero

```bash
# Interactivo
openspec schema init mi-workflow

# No interactivo
openspec schema init rapid \
  --description "Workflow rápido sin specs" \
  --artifacts "proposal,tasks" \
  --default
```

### Hacer fork de un schema existente

```bash
# La forma más rápida: partir del schema-driven y personalizar
openspec schema fork spec-driven teixo-workflow
```

Copia todo el schema a `openspec/schemas/teixo-workflow/` donde puedes editarlo libremente.

### Definición de schema (`schema.yaml`)

```yaml
name: teixo-workflow
version: 1
description: Workflow de Teixo para cambios con integración gubernamental

artifacts:
  - id: proposal
    generates: proposal.md
    description: Propuesta de cambio
    template: proposal.md
    instruction: |
      Crea una propuesta que explique POR QUÉ se necesita este cambio.
      Si afecta a integraciones E3L, especificarlo explícitamente.
      Si afecta a documentos ambientales, indicar qué comunidades autónomas impacta.
    requires: []

  - id: specs
    generates: specs/**/*.md
    description: Especificaciones de comportamiento
    template: spec.md
    instruction: |
      Crea delta specs con los requisitos que cambian.
      Usa formato Given/When/Then para los scenarios.
      Incluir scenario de validación por account siempre que aplique.
    requires:
      - proposal

  - id: design
    generates: design.md
    description: Diseño técnico
    template: design.md
    instruction: |
      Documenta las decisiones técnicas.
      Si hay queries nuevas, analizar impacto en rendimiento.
      Si hay migraciones de BD, especificarlas.
    requires:
      - proposal

  - id: tasks
    generates: tasks.md
    description: Checklist de implementación
    template: tasks.md
    instruction: |
      Crea la lista de tareas con checkboxes.
      Siempre incluir tareas de tests.
      Si hay archivos .jrxml, incluir tarea de compilar el .jasper correspondiente.
    requires:
      - specs
      - design

apply:
  requires: [tasks]
  tracks: tasks.md
```

### Templates

Los templates guían a la IA sobre qué generar. Son archivos Markdown con secciones y comentarios HTML:

```markdown
<!-- templates/proposal.md -->
# Propuesta: {nombre-del-change}

## Motivación

<!-- ¿Qué problema resuelve este cambio? ¿Por qué es necesario ahora? -->

## Alcance

**En scope:**
-

**Fuera de scope:**
-

## Enfoque técnico

<!-- Descripción de alto nivel de cómo se implementará -->

## Impacto

<!-- ¿Afecta a integraciones E3L? ¿A qué CCAA? -->
<!-- ¿Hay riesgo de regresión? -->

## Rollback

<!-- ¿Cómo se deshace si algo va mal? -->
```

### Validar y usar el schema

```bash
# Validar antes de usar
openspec schema validate teixo-workflow

# Verificar de dónde se resuelve
openspec schema which teixo-workflow

# Usar al crear un change
openspec new change mi-feature --schema teixo-workflow

# O establecer como default en config.yaml
# schema: teixo-workflow
```

---

## Ejemplo: Schema para integraciones E3L

```yaml
# openspec/schemas/e3l-integration/schema.yaml
name: e3l-integration
version: 1
description: Workflow para cambios en integraciones E3L (Comunidades Autónomas)

artifacts:
  - id: proposal
    generates: proposal.md
    requires: []
    instruction: |
      Especificar:
      - Comunidad autónoma afectada
      - Versión del protocolo E3L
      - Si requiere cambios en el parser o en el creator
      - Impacto en datos existentes

  - id: specs
    generates: specs/**/*.md
    requires: [proposal]
    instruction: |
      Incluir scenarios para:
      - Envío correcto al sistema gubernamental
      - Manejo de errores de respuesta
      - Reintento en caso de timeout
      - Validaciones de negocio previas al envío

  - id: design
    generates: design.md
    requires: [proposal]
    instruction: |
      Documentar:
      - Endpoint del servicio web gubernamental
      - Formato de request/response
      - Manejo de certificados si aplica
      - Estrategia de logs y auditoría

  - id: tasks
    generates: tasks.md
    requires: [specs, design]

apply:
  requires: [tasks]
  tracks: tasks.md
```

---

## Telemetría

OpenSpec recopila estadísticas anónimas (solo nombres de comandos y versión, sin contenido ni paths).

Para deshabilitar:
```bash
export OPENSPEC_TELEMETRY=0
# o
export DO_NOT_TRACK=1
```

Se deshabilita automáticamente en CI.
