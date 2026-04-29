---
name: verify-all
description: Pasada de verificación completa antes de cerrar un change. Corre openspec validate --strict, typecheck, lint, tests unit+integration y e2e si existe. Úsala cuando el usuario diga "verifica" o "chequea todo" o antes de archivar un change.
---

# Verificación completa

Sirve como check antes de archivar un change o de hacer un commit grande.

## Pasos

### 1. OpenSpec strict

```bash
openspec validate --all --strict
```

Si algo falla, **para aquí** y reporta. No tiene sentido seguir si los specs no son coherentes.

### 2. Detectar si hay código de aplicación

Mira si existe `backend/package.json` o `frontend/package.json`. Si no existen, todavía estamos en fase de specs y los pasos 3–6 no aplican: reporta `verification: docs-only mode` y termina.

### 3. Typecheck

```bash
pnpm typecheck
```

Si falla, reporta y termina.

### 4. Lint

```bash
pnpm lint
```

Si falla y son fixes triviales, ofrece `pnpm lint --fix` (no lo apliques sin confirmar). Si son errores reales, reporta.

### 5. Tests unit + integration

```bash
pnpm test
```

Reporta:
- nº tests pasados / fallidos / saltados
- coverage global
- archivos por debajo del 80% en líneas

### 6. E2E (solo si Playwright está configurado)

```bash
pnpm --filter frontend e2e:chromium
```

Ojo: tarda. Solo invocar si estamos cerrando un change que toca UI o si el usuario lo pide explícitamente.

### 7. Resumen

Reporta en una tabla compacta:

| Check | Resultado |
|-------|-----------|
| openspec validate --strict | ✓ 12/12 |
| typecheck | ✓ |
| lint | ✓ |
| unit + integration | ✓ 234 tests, 84% coverage |
| e2e chromium | ✓ 18 tests |

Si algo está rojo, indica el primer fallo concreto y deja al usuario decidir si arreglar o aplazar.

## Reglas

- **No archives** un change si verify-all falla. Pídele al usuario que lo arregle primero.
- **No uses `--no-verify`** ni saltes hooks para forzar el verde.
- **No commits silenciosos**: si un check falla, no apliques fixes sin reportar primero.
