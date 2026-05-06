#!/usr/bin/env bash
# Bootstrap inicial del servidor para teimas.ludobermejo.es.
# Ejecuta una sola vez como root (sudo) en el servidor:
#   ssh -i ~/.ssh/www-data_deploy_oracle ubuntu@141.253.193.126
#   sudo bash /tmp/bootstrap-server.sh
#
# Tras esto:
#   - existe /var/www/teimas-space con permisos correctos
#   - nginx sirve teimas.ludobermejo.es:443 → :8123 con SSL gestionado por certbot
#   - PM2 (como www-data) tiene espacio para registrar el proceso
#
# Después, los deploys vienen del workflow .github/workflows/deploy.yml.

set -euo pipefail

DOMAIN="teimas.ludobermejo.es"
DEPLOY_PATH="/var/www/teimas-space"
APP_PORT=8123

if [ "$EUID" -ne 0 ]; then
  echo "Ejecuta este script con sudo." >&2
  exit 1
fi

echo "1. Creando estructura de directorios..."
mkdir -p "$DEPLOY_PATH/backend/data/maps"
mkdir -p "$DEPLOY_PATH/backend/data/backups"
mkdir -p "$DEPLOY_PATH/backend/logs"
chown -R www-data:www-data "$DEPLOY_PATH"
chmod 755 "$DEPLOY_PATH"
chmod 750 "$DEPLOY_PATH/backend/data" "$DEPLOY_PATH/backend/logs"

echo "2. Configurando nginx..."
cat > /etc/nginx/sites-available/$DOMAIN <<NGINX
server {
    server_name $DOMAIN;
    client_max_body_size 15M;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    listen 80;
    listen [::]:80;
}
NGINX

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
nginx -t
systemctl reload nginx

echo "3. Solicitando certificado SSL (certbot)..."
echo "    Si el DNS de $DOMAIN aún no apunta aquí, este paso fallará — comenta esta línea o ejecútala luego."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email ludo.bermejo@teimas.com || {
  echo "AVISO: certbot falló. Cuando el DNS esté listo, ejecuta:"
  echo "  sudo certbot --nginx -d $DOMAIN"
}

echo ""
echo "Bootstrap completado. Datos persistentes en $DEPLOY_PATH/backend/data y .env en $DEPLOY_PATH/.env"
echo "Ahora haz un push a main para disparar el primer deploy."
