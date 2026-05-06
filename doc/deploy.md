# Despliegue: teimas.ludobermejo.es

CI/CD por push a `main` → tests + build + scp + ssh + PM2.

## Arquitectura

- **Servidor**: foundry-max-server (Oracle aarch64, Ubuntu 24.04)
- **Host SSH**: `141.253.193.126` (usuario `ubuntu`)
- **Owner del deploy**: `www-data:www-data`
- **Node**: 24+ vía NVM en `/var/www/.nvm`
- **PM2**: ya instalado, gestiona varios apps (aleph, foundryvtt, jam-backend, ligeia-relay, virtual-office)
- **Nginx**: termina TLS, proxy a `localhost:8123`
- **Frontend**: servido por Fastify (estático) desde `frontend/dist/` — no hay build separado en nginx
- **DB**: SQLite con `node:sqlite` nativo (no requiere rebuild de binarios)

## Estructura en servidor

```
/var/www/teimas-space/
├── .env                      ← persistente, gestionado por el deploy
├── package.json              ← root workspace
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── backend/
│   ├── .env -> ../.env       ← symlink para que node --env-file lo lea
│   ├── dist/                 ← compilado en CI (tsc)
│   ├── ecosystem.config.cjs
│   ├── package.json
│   ├── data/                 ← persistente (SQLite, maps, backups)
│   │   ├── virtual-office.db
│   │   ├── maps/
│   │   └── backups/
│   └── logs/                 ← persistente (PM2 + Winston)
├── frontend/
│   ├── dist/                 ← build de Vite, servido por Fastify
│   └── package.json
└── packages/shared/
    ├── dist/
    └── package.json
```

## Bootstrap (primera vez)

1. Subir el script al servidor:
   ```bash
   scp -i ~/.ssh/www-data_deploy_oracle scripts/bootstrap-server.sh ubuntu@141.253.193.126:/tmp/
   ssh -i ~/.ssh/www-data_deploy_oracle ubuntu@141.253.193.126 'sudo bash /tmp/bootstrap-server.sh'
   ```

2. Apuntar el DNS de `teimas.ludobermejo.es` al servidor (ya debería estarlo).

3. Si el bootstrap saltó certbot por DNS no propagado:
   ```bash
   ssh -i ~/.ssh/www-data_deploy_oracle ubuntu@141.253.193.126 'sudo certbot --nginx -d teimas.ludobermejo.es'
   ```

4. Configurar los **secrets** en GitHub (Settings → Secrets and variables → Actions):

   | Secret | Valor |
   |---|---|
   | `SSH_HOST` | `141.253.193.126` |
   | `SSH_USERNAME` | `ubuntu` |
   | `SSH_PORT` | `22` |
   | `SSH_KEY` | contenido completo de `~/.ssh/www-data_deploy_oracle` (clave privada) |
   | `SESSION_SECRET` | generar con `openssl rand -hex 32` |
   | `SESSION_SECRET_PREVIOUS` | vacío al inicio (rotación futura) |
   | `GOOGLE_CLIENT_ID` | desde Google Cloud Console |
   | `GOOGLE_CLIENT_SECRET` | desde Google Cloud Console |
   | `TEIMAS_DOMAINS` | `teimas.com,teimas.es,teimassolutions.com` |
   | `ADMIN_EMAILS` | `ludo.bermejo@teimas.com` (CSV) |
   | `PUBLIC_BASE_URL` | `https://teimas.ludobermejo.es` |
   | `SENTRY_DSN` | (opcional) |

5. Push a `main` → el workflow se ejecuta y deploya.

## Flujo del workflow

```
push main
  └─► test job: typecheck, lint, format:check, vitest backend+frontend
  └─► build-and-deploy job:
       ├─ pnpm install
       ├─ pnpm build (shared → backend → frontend con VITE_GOOGLE_CLIENT_ID inyectado)
       ├─ tar.gz con backend/dist + frontend/dist + packages/shared/dist + workspace files
       ├─ scp a /tmp/vo.tar.gz del servidor
       └─ ssh sudo -u www-data:
            ├─ backup data/ logs/ .env en /var/www/teimas-space-backup-<timestamp>/
            ├─ pm2 stop virtual-office
            ├─ limpiar antiguos preservando .env, backend/data, backend/logs
            ├─ extraer tarball
            ├─ pnpm install --prod
            ├─ regenerar .env con secrets de GitHub
            ├─ pm2 restart virtual-office (o start si no existe)
            └─ rotar backups (mantener 3)
```

## Operaciones manuales útiles

Conectar y ver el estado:
```bash
ssh -i ~/.ssh/www-data_deploy_oracle ubuntu@141.253.193.126
sudo -u www-data bash -c 'export NVM_DIR=/var/www/.nvm; . $NVM_DIR/nvm.sh; pm2 list'
```

Ver logs:
```bash
sudo tail -f /var/www/teimas-space/backend/logs/pm2-out.log
sudo tail -f /var/www/teimas-space/backend/logs/pm2-err.log
sudo ls /var/www/teimas-space/backend/logs/combined-*.log | tail -5
```

Restart manual:
```bash
sudo -u www-data bash -c 'export NVM_DIR=/var/www/.nvm; . $NVM_DIR/nvm.sh; pm2 restart virtual-office'
```

Backup manual de la DB:
```bash
sudo cp /var/www/teimas-space/backend/data/virtual-office.db /tmp/vo-$(date +%F).db
sudo -u www-data sqlite3 /var/www/teimas-space/backend/data/virtual-office.db ".backup /tmp/vo-online-$(date +%F).db"
```

Rollback (último backup):
```bash
ls /var/www/ | grep teimas-space-backup
# elegir uno, copiar manualmente data/ y .env
```
