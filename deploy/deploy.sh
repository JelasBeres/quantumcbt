#!/usr/bin/env bash
# Kirim commit yang sedang aktif ke VPS lalu pasang. Jalankan dari Git Bash di root repo.
#   bash deploy/deploy.sh                 -> rilis kode
#   bash deploy/deploy.sh --setup DOMAIN [EMAIL] -> setup server pertama kali + rilis
set -euo pipefail

HOST="${QUANTUMCBT_HOST:-root@202.155.13.133}"
KEY="${QUANTUMCBT_KEY:-$HOME/.ssh/quantumcbt_vps_key}"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes "$HOST")
SCP=(scp -i "$KEY" -o IdentitiesOnly=yes)

cd "$(git rev-parse --show-toplevel)"
[ -z "$(git status --porcelain)" ] || echo "!! Ada perubahan belum di-commit; ikut terkirim apa adanya."

# Semua file yang dilacak git + file baru yang tidak di-ignore (tanpa .env, venv, node_modules, *.db).
TMP="$(mktemp -d)"
git ls-files -z --cached --others --exclude-standard | tar --null -czf "$TMP/release.tar.gz" -T -
"${SCP[@]}" "$TMP/release.tar.gz" "$HOST:/tmp/quantumcbt-release.tar.gz"
rm -rf "$TMP"

if [ "${1:-}" = "--setup" ]; then
  "${SSH[@]}" "rm -rf /tmp/qcbt-deploy && mkdir -p /tmp/qcbt-deploy && tar -xzf /tmp/quantumcbt-release.tar.gz -C /tmp/qcbt-deploy deploy && bash /tmp/qcbt-deploy/deploy/server-setup.sh '$2' '${3:-}'"
fi

"${SSH[@]}" "tar -xzf /tmp/quantumcbt-release.tar.gz -O deploy/release.sh > /tmp/quantumcbt-release.sh && bash /tmp/quantumcbt-release.sh /tmp/quantumcbt-release.tar.gz"
