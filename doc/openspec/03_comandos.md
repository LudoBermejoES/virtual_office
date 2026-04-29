# Comandos Slash de OpenSpec (`/opsx:*`)

Estos comandos se invocan en el chat de Claude Code (u otro asistente de IA compatible).

> **Nota sobre sintaxis en Claude Code:** usar `/opsx:propose`, `/opsx:apply`, etc.
> En Cursor/Windsurf usar `/opsx-propose`, `/opsx-apply`, etc.

---

## Perfil Core (por defecto)

### `/opsx:propose`

Crea un change y genera todos los artifacts de planificación en un solo paso.

```
/opsx:propose [nombre-del-cambio-o-descripción]
```

**Qué hace:**
- Crea `openspec/changes/<nombre>/`
- Genera: `proposal.md`, `specs/`, `design.md`, `tasks.md`
- Se detiene cuando el change está listo para `/opsx:apply`

**Ejemplos:**
```
/opsx:propose migrar-delayed-job-a-hatchet
/opsx:propose add dark mode to the app
/opsx:propose fix-login-redirect-bug
```

---

### `/opsx:explore`

Piensa en ideas e investiga problemas antes de comprometerte con un change.

```
/opsx:explore [tema]
```

**Qué hace:**
- Abre una conversación exploratoria sin estructura forzada
- Puede leer archivos y buscar en el codebase
- Compara opciones y enfoques
- Puede transicionar a `/opsx:propose` cuando cristaliza la idea

**No crea artifacts** — es solo exploración.

**Cuándo usarlo:** cuando los requisitos son poco claros, necesitas investigar antes de proponer, o quieres comparar enfoques.

---

### `/opsx:apply`

Implementa las tareas del change. Trabaja el `tasks.md` uno a uno.

```
/opsx:apply [nombre-del-change]
```

**Qué hace:**
- Lee `tasks.md` e identifica tareas incompletas (`[ ]`)
- Implementa código, crea archivos, ejecuta tests según necesario
- Marca las tareas completadas con `[x]`
- Puede retomarse donde se quedó si se interrumpe

**Con varios changes activos:**
```
/opsx:apply migrar-export-job    ← especifica cuál
/opsx:apply                      ← infiere del contexto
```

---

### `/opsx:archive`

Archiva un change completado.

```
/opsx:archive [nombre-del-change]
```

**Qué hace:**
1. Verifica que los artifacts existen
2. Avisa si hay tareas incompletas (pero no bloquea)
3. Ofrece sincronizar delta specs si aún no se hizo
4. Mueve la carpeta a `openspec/changes/archive/YYYY-MM-DD-<nombre>/`

**Ejemplo:**
```
Tú: /opsx:archive

AI:  Archiving migrar-export-job...

     ✓ proposal.md exists
     ✓ specs/ exists
     ✓ design.md exists
     ✓ tasks.md exists (8/8 tasks complete)

     Delta specs: Not yet synced → Sync now?

Tú: Yes

AI:  ✓ Synced specs to openspec/specs/jobs/spec.md
     ✓ Moved to openspec/changes/archive/2025-03-06-migrar-export-job/
```

---

## Workflow Expandido

Para activar estos comandos:
```bash
openspec config profile   # seleccionar "custom" workflow
openspec update
```

### `/opsx:new`

Crea el scaffold del change (solo la carpeta y metadatos). Sin generar artifacts todavía.

```
/opsx:new [nombre] [--schema <schema>]
```

**Qué crea:**
```
openspec/changes/<nombre>/
└── .openspec.yaml    ← metadatos (schema, fecha creación)
```

**Uso típico:** seguido de `/opsx:continue` o `/opsx:ff`.

---

### `/opsx:continue`

Crea el siguiente artifact disponible según las dependencias.

```
/opsx:continue [nombre-del-change]
```

**Qué hace:**
- Consulta el grafo de dependencias
- Muestra qué artifacts están listos vs. bloqueados
- Crea el primero disponible
- Muestra qué se desbloquea después

**Ejemplo:**
```
Tú: /opsx:continue

AI:  Change: migrar-hatchet

     Artifact status:
     ✓ proposal    (done)
     ◆ specs       (ready)
     ◆ design      (ready)
     ○ tasks       (blocked - needs: specs)

     Creating specs...
     ✓ Created openspec/changes/migrar-hatchet/specs/jobs/spec.md

     Now available: tasks
     Run /opsx:continue to create the next artifact.
```

---

### `/opsx:ff`

Fast-forward: crea todos los artifacts de planificación de golpe.

```
/opsx:ff [nombre-del-change]
```

**Qué hace:**
- Crea todos los artifacts en orden de dependencias
- Hace tracking del progreso
- Para cuando todos los artifacts requeridos para `/opsx:apply` están completos

---

### `/opsx:verify`

Valida que la implementación coincide con los artifacts del change.

```
/opsx:verify [nombre-del-change]
```

**Tres dimensiones de verificación:**

| Dimensión | Qué valida |
|-----------|------------|
| **Completeness** | Todas las tareas hechas, todos los requisitos implementados, escenarios cubiertos |
| **Correctness** | La implementación coincide con el intent de los specs, edge cases manejados |
| **Coherence** | Las decisiones de diseño reflejadas en el código, patrones consistentes |

**Ejemplo de output:**
```
COMPLETENESS
✓ All 8 tasks in tasks.md are checked
✓ All requirements in specs have corresponding code
⚠ Scenario "Retry tras timeout" has no test coverage

CORRECTNESS
✓ Implementation matches spec intent
✓ Edge cases from scenarios are handled

COHERENCE
⚠ Design mentions "Hatchet SDK directly" but implementation uses DelayedJob wrapper

SUMMARY
─────────────────────────────
Critical issues: 0
Warnings: 2
Ready to archive: Yes (with warnings)
```

No bloquea el archive, pero advierte de problemas.

---

### `/opsx:sync`

Fusiona los delta specs del change en los specs principales (sin archivar el change).

```
/opsx:sync [nombre-del-change]
```

**Cuándo usarlo manualmente:**
- Change largo donde quieres los specs actualizados antes de terminar
- Varios changes paralelos que necesitan la base de specs actualizada

En la mayoría de casos, `/opsx:archive` lo hace automáticamente — no necesitas llamar a `sync` directamente.

---

### `/opsx:bulk-archive`

Archiva múltiples changes completados de una vez.

```
/opsx:bulk-archive [nombres...]
```

**Qué hace:**
- Lista todos los changes completados
- Detecta conflictos de specs entre changes
- Resuelve conflictos inspeccionando el codebase
- Archiva en orden cronológico

---

### `/opsx:onboard`

Tutorial guiado del workflow completo usando tu codebase real.

```
/opsx:onboard
```

10 fases: análisis del codebase → encontrar oportunidad → crear change → artifacts → implementar → verificar → archivar. Tarda 15-30 minutos.

---

## Comandos legacy (compatibles pero no recomendados)

| Comando | Equivalente moderno |
|---------|---------------------|
| `/openspec:proposal` | `/opsx:propose` |
| `/openspec:apply` | `/opsx:apply` |
| `/openspec:archive` | `/opsx:archive` |

Los changes creados con comandos legacy son compatibles con los comandos `/opsx:*`.

---

## Troubleshooting

### "Change not found"
- Especifica el nombre: `/opsx:apply migrar-hatchet`
- Verifica: `openspec list`

### Los comandos no se reconocen
- Verifica que OpenSpec está inicializado: `openspec init`
- Regenera skills: `openspec update`
- Verifica que existe `.claude/skills/` en el proyecto
- Reinicia Claude Code

### Los artifacts se generan incorrectos o incompletos
- Añade contexto del proyecto en `openspec/config.yaml`
- Usa `/opsx:continue` en vez de `/opsx:ff` para más control
- Da más detalle en la descripción del change
