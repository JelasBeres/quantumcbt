#!/usr/bin/env bash
# Setup awal VPS Ubuntu 22.04/24.04 untuk QuantumCBT. Aman dijalankan ulang.
# Pemakaian (sebagai root): bash server-setup.sh DOMAIN [EMAIL_LETSENCRYPT]
set -euo pipefail

DOMAIN="${1:?domain wajib diisi}"
EMAIL="${2:-}"
APP_USER=quantumcbt
APP_DIR=/opt/quantumcbt
DB_NAME=quantumcbt
DB_USER=quantumcbt
HERE="$(cd "$(dirname "$0")" && pwd)"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg nginx postgresql postgresql-contrib \
  python3 python3-venv python3-dev build-essential libpq-dev certbot python3-certbot-nginx ufw rsync

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Next build butuh RAM cukup; tambahkan swap 2G kalau total swap < 1G.
if [ "$(free -m | awk '/^Swap:/{print $2}')" -lt 1024 ] && [ ! -f /swapfile-quantumcbt ]; then
  fallocate -l 2G /swapfile-quantumcbt && chmod 600 /swapfile-quantumcbt
  mkswap /swapfile-quantumcbt && swapon /swapfile-quantumcbt
  echo '/swapfile-quantumcbt none swap sw 0 0' >> /etc/fstab
fi

id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$APP_DIR" --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR/backend/uploads" "$APP_DIR/backups"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Database + password acak (disimpan sekali di backend/.env).
ENV_FILE="$APP_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  DB_PASS="$(openssl rand -hex 24)"
  SECRET="$(openssl rand -hex 32)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE $DB_USER PASSWORD '$DB_PASS';
  END IF;
END \$\$;
SQL
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
    || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
  cat > "$ENV_FILE" <<ENV
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME
SECRET_KEY=$SECRET
APP_ENV=production
ACCESS_TOKEN_EXPIRE_MINUTES=15
ALLOWED_HOSTS=$DOMAIN,127.0.0.1,localhost
CORS_ORIGINS=https://$DOMAIN
FRONTEND_URL=https://$DOMAIN
ENV
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

cat > "$APP_DIR/frontend.env" <<ENV
NODE_ENV=production
PORT=3200
NEXT_INTERNAL_PORT=3201
BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_APP_NAME=Quantum Research CBT
NEXT_PUBLIC_APP_URL=https://$DOMAIN
NEXT_PUBLIC_ENABLE_DEBUG=false
NEXT_PUBLIC_ENABLE_ANALYTICS=false
ENV
chown "$APP_USER:$APP_USER" "$APP_DIR/frontend.env"

install -m 644 "$HERE/quantumcbt-backend.service" /etc/systemd/system/
install -m 644 "$HERE/quantumcbt-frontend.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable quantumcbt-backend quantumcbt-frontend

sed "s/__DOMAIN__/$DOMAIN/g" "$HERE/nginx.conf" > /etc/nginx/sites-available/quantumcbt
ln -sf /etc/nginx/sites-available/quantumcbt /etc/nginx/sites-enabled/quantumcbt
nginx -t && systemctl reload nginx

ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

# Backup database harian, simpan 14 hari.
cat > /etc/cron.daily/quantumcbt-backup <<CRON
#!/bin/sh
sudo -u postgres pg_dump -Fc $DB_NAME > $APP_DIR/backups/db-\$(date +%F).dump
tar -czf $APP_DIR/backups/uploads-\$(date +%F).tar.gz -C $APP_DIR/backend uploads
find $APP_DIR/backups -type f -mtime +14 -delete
CRON
chmod 755 /etc/cron.daily/quantumcbt-backup

if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  if [ -n "$EMAIL" ]; then ACCOUNT=(-m "$EMAIL"); else ACCOUNT=(--register-unsafely-without-email); fi
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos "${ACCOUNT[@]}" --redirect \
    || echo "!! Certbot gagal. Pastikan DNS A record $DOMAIN sudah mengarah ke IP VPS, lalu jalankan ulang."
fi

echo "Setup server selesai."
