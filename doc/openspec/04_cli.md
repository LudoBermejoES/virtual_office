# CLI de OpenSpec (Terminal)

El CLI `openspec` se usa en terminal para setup, validación e inspección. Complementa los comandos slash del chat.

## Instalación

```bash
# Node.js 20.19.0+ requerido
npm install -g @fission-ai/openspec@latest

# Verificar
openspec --version
```

## Inicialización y Setup

### `openspec init`

Inicializa OpenSpec en el proyecto. Crea la estructura de carpetas y configura las integraciones con herramientas de IA.

```bash
# Interactivo
openspec init

# No interactivo: configurar solo para Claude Code
openspec init --tools claude

# Configurar para todas las herramientas soportadas
openspec init --tools all

# Forzar limpieza de archivos legacy
openspec init --force
```

**Herramientas soportadas:** `claude`, `cursor`, `windsurf`, `github-copilot`, `amazon-q`, `cline`, `gemini`, `codex`, y más.

**Qué crea:**
```
openspec/
├── specs/
├── changes/
└── config.yaml

.claude/skills/    ← Skills de Claude Code (si se seleccionó claude)
```

---

### `openspec update`

Actualiza los archivos de instrucciones después de hacer upgrade del CLI o cambiar la configuración de perfil.

```bash
# Actualizar después de upgrade del paquete
npm install -g @fission-ai/openspec@latest
openspec update

# Forzar actualización aunque los archivos estén al día
openspec update --force
```

Ejecutar en cada proyecto después de `openspec config profile`.

---

## Explorar changes y specs

### `openspec list`

Lista los changes activos o los specs del proyecto.

```bash
openspec list                  # lista changes activos
openspec list --specs          # lista specs
openspec list --sort name      # ordenar por nombre
openspec list --json           # output JSON
```

**Output:**
```
Active changes:
  migrar-hatchet        Migración de DelayedJob a Hatchet
  fix-login-redirect    Redirección tras login
```

---

### `openspec show`

Muestra detalles de un change o spec.

```bash
openspec show                              # selección interactiva
openspec show migrar-hatchet               # change específico
openspec show documentos --type spec       # spec específico
openspec show migrar-hatchet --json        # output JSON
```

---

### `openspec view`

Dashboard interactivo en terminal para navegar specs y changes.

```bash
openspec view
```

---

## Validación

### `openspec validate`

Valida la estructura y formato de changes y specs.

```bash
openspec validate                          # selección interactiva
openspec validate migrar-hatchet           # change específico
openspec validate --changes                # todos los changes
openspec validate --specs                  # todos los specs
openspec validate --all --json             # todo, output JSON (para CI)
openspec validate --all --strict           # modo estricto
```

**Output:**
```
Validating migrar-hatchet...
  ✓ proposal.md valid
  ✓ specs/jobs/spec.md valid
  ⚠ design.md: missing "Technical Approach" section

1 warning found
```

---

## Lifecycle

### `openspec archive`

Archiva un change desde terminal (alternativa al comando slash).

```bash
openspec archive                           # interactivo
openspec archive migrar-hatchet            # change específico
openspec archive migrar-hatchet --yes      # sin confirmaciones (CI)
openspec archive update-ci-config --skip-specs  # sin actualizar specs
```

---

## Workflow (para agentes)

Estos comandos dan información estructurada que los agentes de IA usan internamente.

### `openspec status`

Estado de los artifacts de un change.

```bash
openspec status --change migrar-hatchet
openspec status --change migrar-hatchet --json
```

**Output:**
```
Change: migrar-hatchet
Schema: spec-driven
Progress: 2/4 artifacts complete

[x] proposal
[ ] design
[x] specs
[-] tasks (blocked by: design)
```

---

### `openspec instructions`

Instrucciones enriquecidas para crear un artifact (lo que usa el agente internamente).

```bash
openspec instructions --change migrar-hatchet
openspec instructions design --change migrar-hatchet
openspec instructions apply --change migrar-hatchet   # instrucciones de implementación
openspec instructions design --change migrar-hatchet --json
```

---

### `openspec schemas`

Lista los schemas disponibles.

```bash
openspec schemas
openspec schemas --json
```

**Output:**
```
Available schemas:

  spec-driven (package)
    The default spec-driven development workflow
    Flow: proposal → specs → design → tasks

  teixo-workflow (project)
    Workflow personalizado de Teixo
    Flow: proposal → specs → design → tasks
```

---

## Schema Commands

### `openspec schema init`

Crea un schema personalizado desde cero.

```bash
openspec schema init mi-workflow
openspec schema init rapid --artifacts "proposal,tasks" --default
```

---

### `openspec schema fork`

Copia un schema existente para personalizarlo.

```bash
openspec schema fork spec-driven teixo-workflow
```

---

### `openspec schema validate`

Valida la estructura de un schema.

```bash
openspec schema validate mi-workflow
openspec schema validate    # valida todos
```

---

### `openspec schema which`

Muestra de dónde se resuelve un schema (útil para debug).

```bash
openspec schema which spec-driven
openspec schema which --all
```

**Precedencia:**
1. Proyecto: `openspec/schemas/<nombre>/`
2. Usuario: `~/.local/share/openspec/schemas/<nombre>/`
3. Paquete: schemas built-in

---

## Configuración

### `openspec config`

```bash
openspec config list                    # mostrar toda la configuración
openspec config get telemetry.enabled
openspec config set telemetry.enabled false
openspec config path                    # dónde está el archivo de config global
openspec config edit                    # abrir en $EDITOR
openspec config profile                 # configurar el perfil de workflow
openspec config profile core            # cambiar al perfil core rápidamente
openspec config reset --all --yes       # resetear a defaults
```

**`openspec config profile`** permite:
- Cambiar modo de entrega + workflows
- Cambiar solo el modo de entrega
- Cambiar solo los workflows

Después de cambiar el perfil, ejecutar `openspec update` en cada proyecto.

---

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `OPENSPEC_CONCURRENCY` | Concurrencia para validación en bulk (default: 6) |
| `EDITOR` o `VISUAL` | Editor para `openspec config edit` |
| `NO_COLOR` | Deshabilitar colores |
| `OPENSPEC_TELEMETRY=0` | Deshabilitar telemetría |
| `DO_NOT_TRACK=1` | Deshabilitar telemetría (alternativa) |

---

## Exit codes

| Código | Significado |
|--------|-------------|
| `0` | Éxito |
| `1` | Error (validación fallida, archivos faltantes, etc.) |
