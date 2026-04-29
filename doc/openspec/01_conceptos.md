# Conceptos Core de OpenSpec

## La idea central

OpenSpec organiza el trabajo en dos áreas:

```
openspec/
├── specs/      → Fuente de verdad: cómo funciona el sistema AHORA
└── changes/    → Modificaciones propuestas: una carpeta por cambio
```

Los **specs** describen comportamiento actual. Los **changes** son propuestas en proceso. Cuando archivas un change, sus deltas se fusionan en los specs principales.

---

## Specs

### Estructura

```
openspec/specs/
├── documentos/
│   └── spec.md
├── facturacion/
│   └── spec.md
├── trazabilidad/
│   └── spec.md
└── api/
    └── spec.md
```

Organiza por dominio: `documentos/`, `facturacion/`, `api/`, etc.

### Formato de un spec

```markdown
# Especificación: Documentos Ambientales

## Purpose
Gestión del ciclo de vida de documentos ambientales (tracking, notificación, aceptación).

## Requirements

### Requirement: Creación de Documento de Seguimiento
El sistema DEBE crear documentos de seguimiento asociados a una cuenta (account).

#### Scenario: Documento válido
- GIVEN una cuenta activa con tipo 'real'
- WHEN se crea un TrackingDocument con datos válidos
- THEN el documento queda en estado 'draft'
- AND queda asociado al account correcto

#### Scenario: Cuenta inactiva
- GIVEN una cuenta de tipo 'frozen'
- WHEN se intenta crear un documento
- THEN se lanza un error de validación
- AND no se crea ningún registro
```

### Palabras clave RFC 2119

| Keyword | Significado |
|---------|-------------|
| MUST / SHALL | Requisito absoluto |
| SHOULD | Recomendado, pero con excepciones válidas |
| MAY | Opcional |

### Qué va en un spec (y qué NO)

**Sí:**
- Comportamiento observable por usuarios o sistemas externos
- Inputs, outputs y condiciones de error
- Restricciones externas (seguridad, normativa)
- Escenarios testeables

**No:**
- Nombres de clases/métodos internos
- Elecciones de librerías o frameworks
- Planes de implementación paso a paso (eso va en `design.md` o `tasks.md`)

---

## Changes

Un change es una carpeta que contiene todo lo necesario para entender e implementar un cambio:

```
openspec/changes/migrar-delayed-job-a-hatchet/
├── proposal.md           ← por qué y qué
├── design.md             ← cómo (decisiones técnicas)
├── tasks.md              ← checklist de implementación
├── .openspec.yaml        ← metadatos (schema, fecha)
└── specs/                ← delta specs
    └── background-jobs/
        └── spec.md       ← qué cambia en los jobs
```

### Por qué los changes son carpetas

1. Todo junto — propuesta, diseño, tareas y specs en un sitio
2. Trabajo paralelo — varios changes activos simultáneamente sin conflictos
3. Historial limpio — al archivar, la carpeta se mueve a `changes/archive/` con todo el contexto
4. Fácil de revisar — abres la carpeta y ves la propuesta, el diseño y los delta specs

---

## Artifacts (artefactos)

Cada artifact dentro de un change sirve un propósito:

| Artifact | Archivo | Propósito |
|----------|---------|-----------|
| proposal | `proposal.md` | El **por qué** y el **qué** — intención, alcance, enfoque |
| specs | `specs/<dominio>/spec.md` | Delta specs — qué requisitos AÑADIR/MODIFICAR/ELIMINAR |
| design | `design.md` | El **cómo** — decisiones técnicas y arquitectura |
| tasks | `tasks.md` | Checklist de implementación con checkboxes |

Los artifacts tienen dependencias entre sí:

```
proposal
    │
    ├──► specs      (necesita proposal)
    └──► design     (necesita proposal)
               │
               └──► tasks   (necesita specs + design)
                       │
                       └──► APPLY (implementar código)
```

Las dependencias son **habilitadores**, no puertas obligatorias. Puedes saltarte `design` si no lo necesitas y crear `tasks` directamente desde `proposal` + `specs`.

---

## Delta Specs

Los delta specs son el concepto clave para proyectos brownfield (código existente). En lugar de reescribir el spec completo, solo describen qué cambia.

### Formato

```markdown
# Delta for Background Jobs

## ADDED Requirements

### Requirement: Retry con Hatchet
El sistema DEBE reintentar jobs fallidos usando la política de reintentos de Hatchet.

#### Scenario: Fallo recuperable
- GIVEN un job que lanza una excepción recuperable
- WHEN Hatchet detecta el fallo
- THEN el job se reintenta hasta N veces según configuración
- AND se registra el error en los logs de Hatchet

## MODIFIED Requirements

### Requirement: Cola de Prioridad
El sistema DEBE procesar jobs de alta prioridad antes que los normales.
(Anterior: procesamiento FIFO sin prioridades)

#### Scenario: Job urgente
- GIVEN un job marcado con prioridad :high
- WHEN hay cola de jobs normales pendientes
- THEN el job urgente se ejecuta primero

## REMOVED Requirements

### Requirement: Delayed Job Admin Panel
(Deprecado en favor del panel de admin nativo de Hatchet)
```

### Qué pasa al archivar

| Sección | Resultado |
|---------|-----------|
| `## ADDED Requirements` | Se añade al spec principal |
| `## MODIFIED Requirements` | Reemplaza el requisito existente |
| `## REMOVED Requirements` | Se elimina del spec principal |

---

## Archive

Archivar completa un change:

1. Las delta specs se fusionan en `openspec/specs/`
2. La carpeta del change se mueve a `openspec/changes/archive/YYYY-MM-DD-<nombre>/`
3. Todos los artifacts se conservan para auditoría

```
Antes del archive:
openspec/changes/migrar-hatchet/specs/jobs/spec.md ──► se fusiona en
openspec/specs/jobs/spec.md

Después del archive:
openspec/changes/archive/2025-03-06-migrar-hatchet/  ← preservado
openspec/specs/jobs/spec.md  ← actualizado con los deltas
```

---

## Schemas

Un schema define qué artifacts existen y sus dependencias. El schema por defecto es `spec-driven`:

```yaml
# Schema spec-driven (el default)
name: spec-driven
artifacts:
  - id: proposal
    generates: proposal.md
    requires: []

  - id: specs
    generates: specs/**/*.md
    requires: [proposal]

  - id: design
    generates: design.md
    requires: [proposal]

  - id: tasks
    generates: tasks.md
    requires: [specs, design]
```

Puedes crear schemas personalizados. Ver [05_configuracion.md](05_configuracion.md).

---

## Glosario

| Término | Definición |
|---------|------------|
| **Artifact** | Documento dentro de un change (proposal, design, tasks, delta specs) |
| **Archive** | Proceso de completar un change y fusionar sus deltas en los specs principales |
| **Change** | Modificación propuesta, empaquetada como carpeta con artifacts |
| **Delta spec** | Spec que describe cambios (ADDED/MODIFIED/REMOVED) respecto a los specs actuales |
| **Domain** | Agrupación lógica de specs (ej: `documentos/`, `facturacion/`) |
| **Requirement** | Comportamiento específico que el sistema debe tener |
| **Scenario** | Ejemplo concreto de un requisito (Given/When/Then) |
| **Schema** | Definición de tipos de artifacts y sus dependencias |
| **Spec** | Especificación que describe comportamiento del sistema |
| **Source of truth** | Directorio `openspec/specs/` con el comportamiento acordado actualmente |
