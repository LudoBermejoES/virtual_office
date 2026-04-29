# Flujo de Trabajo con OpenSpec

## Dos perfiles

### Core (por defecto)

El perfil que viene instalado por defecto. Comandos disponibles:

```
/opsx:propose ──► /opsx:apply ──► /opsx:archive
```

### Custom (workflow expandido)

Para activar los comandos expandidos:

```bash
openspec config profile   # seleccionar workflow expandido
openspec update           # regenerar los skills de Claude
```

Flujo completo con workflow expandido:

```
/opsx:new ──► /opsx:ff ──► /opsx:apply ──► /opsx:verify ──► /opsx:archive
```

O paso a paso:
```
/opsx:new ──► /opsx:continue ──► /opsx:continue ──► /opsx:apply ──► /opsx:archive
```

---

## Patrones de workflow

### Feature pequeña o bug fix (más común)

Cuando sabes lo que quieres hacer:

```
/opsx:propose migrar-export-job
         ↓
   crea la carpeta con proposal.md, specs/, design.md, tasks.md
         ↓
/opsx:apply
         ↓
   implementa las tareas del tasks.md
         ↓
/opsx:archive
```

**Ejemplo de conversación:**
```
Tú: /opsx:propose migrar-export-invoices-job-a-hatchet

AI:  Created openspec/changes/migrar-export-invoices-job-a-hatchet/
     ✓ proposal.md
     ✓ specs/jobs/spec.md
     ✓ design.md
     ✓ tasks.md
     Ready for implementation. Run /opsx:apply.

Tú: /opsx:apply

AI:  Implementing tasks...
     ✓ 1.1 Crear ExportInvoicesHatchetJob
     ✓ 1.2 Registrar workflow en hatchet.rb
     ✓ 2.1 Eliminar ExportInvoicesJob de DelayedJob
     All tasks complete!

Tú: /opsx:archive

AI:  ✓ Specs merged
     ✓ Archived
```

### Requisitos poco claros (exploratorio)

Cuando no tienes claro cómo atacar el problema:

```
/opsx:explore
         ↓
   investiga el codebase, compara opciones, clarifica
         ↓
/opsx:propose <nombre>   (cuando ya tienes claridad)
         ↓
/opsx:apply
```

**Ejemplo:**
```
Tú: /opsx:explore

AI:  ¿Qué quieres explorar?

Tú: Cómo deberíamos gestionar los cron jobs al migrar de DelayedJob a Hatchet.

AI:  Déjame revisar el código actual...
     [Analiza app/jobs/*_job.rb, config/schedule.rb]

     Encontré 3 tipos de cron jobs:
     1. PingHealthchecks (cada minuto)
     2. ArchiveOldDocuments (cada día a las 2am)
     3. GenerateMonthlyReport (primer día del mes)

     Para Hatchet tenemos dos opciones:
     - Hatchet crons nativos (recomendado, usa cron expressions)
     - Scheduled workflows con sleep steps

     ¿Cuál prefieres explorar?
```

### Trabajo en paralelo (varios changes activos)

Puedes tener varios changes activos sin conflictos:

```
Change A: /opsx:propose feature-a
Change B: /opsx:propose feature-b     ← sin problema, son carpetas distintas

# Trabajar en A
/opsx:apply feature-a

# Cambiar a B por urgencia
/opsx:apply feature-b
/opsx:archive feature-b

# Volver a A
/opsx:apply feature-a    ← retoma donde lo dejaste (checkboxes en tasks.md)
/opsx:archive feature-a
```

Cuando hay varios changes completados:
```
/opsx:bulk-archive
# detecta y resuelve conflictos de specs entre changes
```

---

## Cuándo usar `/opsx:ff` vs `/opsx:continue`

| Situación | Usar |
|-----------|------|
| Scope claro, quieres ir rápido | `/opsx:ff` |
| Quieres revisar cada artifact antes de continuar | `/opsx:continue` |
| Cambio complejo, quieres control granular | `/opsx:continue` |
| Presión de tiempo | `/opsx:ff` |

**Regla:** Si puedes describir el scope completo desde el principio, usa `/opsx:ff`. Si lo estás definiendo mientras avanzas, usa `/opsx:continue`.

---

## Cuándo actualizar el change vs empezar uno nuevo

### Actualizar el change existente cuando:

- **Mismo objetivo, ejecución refinada** — descubres edge cases, el enfoque cambia pero el goal es el mismo
- **Scope se reduce** — quieres hacer primero un MVP
- **Correcciones por lo aprendido** — el código no era como pensabas

### Nuevo change cuando:

- **El objetivo cambió fundamentalmente**
- **El scope explotó** — es esencialmente trabajo distinto
- **El original puede completarse** — cierra el original, abre uno nuevo para la siguiente fase

```
Ejemplo:
- "Migrar export jobs a Hatchet" → cambio de enfoque técnico = actualizar
- "Migrar export jobs a Hatchet" → decidir reescribir toda la API de jobs = NUEVO change
```

---

## Flujo completo de verificación (pre-archive)

Flujo recomendado antes de cerrar un change importante:

```
/opsx:apply      ← implementa todas las tareas
      ↓
/opsx:verify     ← valida que la implementación coincide con los specs
      ↓
  Revisa warnings (no bloquea el archive, pero avisa)
      ↓
/opsx:archive    ← fusiona specs y mueve a archive
```

La verificación comprueba tres dimensiones:

| Dimensión | Qué valida |
|-----------|------------|
| **Completeness** | Todas las tareas marcadas, todos los requisitos implementados |
| **Correctness** | La implementación coincide con el intent de los specs |
| **Coherence** | Las decisiones de diseño se reflejan en el código |

---

## Tabla de referencia rápida

| Comando | Propósito | Cuándo usarlo |
|---------|-----------|---------------|
| `/opsx:propose` | Crear change + todos los artifacts de planificación | Camino rápido (perfil core) |
| `/opsx:explore` | Pensar en ideas antes de proponer | Requisitos poco claros |
| `/opsx:new` | Scaffold del change (sin artifacts) | Workflow expandido, control granular |
| `/opsx:continue` | Crear el siguiente artifact según dependencias | Workflow expandido, paso a paso |
| `/opsx:ff` | Crear todos los artifacts de planificación de golpe | Workflow expandido, scope claro |
| `/opsx:apply` | Implementar las tareas del tasks.md | Listo para escribir código |
| `/opsx:verify` | Validar que la implementación coincide con specs | Antes de archivar |
| `/opsx:sync` | Fusionar delta specs en specs principales | Opcional, archivo lo hace automáticamente |
| `/opsx:archive` | Completar el change | Todo el trabajo terminado |
| `/opsx:bulk-archive` | Archivar varios changes a la vez | Trabajo paralelo |
