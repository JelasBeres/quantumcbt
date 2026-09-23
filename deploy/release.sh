#!/usr/bin/env bash
# Pasang rilis baru dari tarball kode (hasil `git archive`). Dijalankan sebagai root di VPS.
# Pemakaian: bash release.sh /tmp/quantumcbt-release.tar.gz
set -euo pipefail

TARBALL="${1:?path tarball wajib diisi}"
APP_USER=quantumcbt
APP_DIR=/opt/quantumcbt
STAGE="$(mktemp -d)"

tar -xzf "$TARBALL" -C "$STAGE"

# Ganti kode, tapi pertahankan .env, venv, uploads, node_modules, dan backup.
rsync -a --delete \
  --exclude '/backend/.env' --exclude '/backend/venv/' --exclude '/backend/uploads/' \
  --exclude '/frontend/node_modules/' --exclude '/frontend/.next/' \
  --exclude '/frontend.env' --exclude '/backups/' --exclude '/.bash_history' --exclude '/.cache/' \
  --exclude '/.npm/' --exclude '/.ssh/' \
  "$STAGE/" "$APP_DIR/"
rm -rf "$STAGE"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

sudo -u "$APP_USER" -H bash -eu <<'EOF'
cd /opt/quantumcbt/backend
[ -d venv ] || python3 -m venv venv
venv/bin/pip install --quiet --upgrade pip
venv/bin/pip install --quiet -r requirements.txt gunicorn
venv/bin/alembic upgrade head

cd /opt/quantumcbt/frontend
cp ../frontend.env .env.production.local
npm ci --no-audit --no-fund
npm run build
EOF

systemctl restart quantumcbt-backend
systemctl restart quantumcbt-frontend
sleep 5
curl -fsS http://127.0.0.1:8000/health >/dev/null && echo "backend OK" || echo "!! backend belum merespons"
curl -fsS -o /dev/null http://127.0.0.1:3200/ && echo "frontend OK" || echo "!! frontend belum merespons (Next butuh beberapa detik)"
