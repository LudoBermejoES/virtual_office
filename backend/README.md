# Backend — Virtual Office

## Desarrollo

```bash
pnpm dev          # tsx watch
```

## Producción con PM2

```bash
# Primer arranque
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd   # seguir las instrucciones que imprime

# Operación habitual
pm2 status
pm2 logs virtual-office --json
pm2 reload virtual-office   # zero-downtime reload
pm2 stop virtual-office
```

## Variables de entorno

Ver `src/config/env.ts` para el schema completo. Las obligatorias son:

- `SESSION_SECRET` — al menos 32 chars, 256 bits hex recomendado
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

El proceso muere con código 1 al arrancar si falta alguna obligatoria.
