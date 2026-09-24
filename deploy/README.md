# Deploy ke VPS

Susunan di VPS (Ubuntu): Nginx (HTTPS) → `server.js` :3200 → Next.js :3201 dan FastAPI :8000 (gunicorn, 3 worker) → PostgreSQL.

| Lokasi | Isi |
|---|---|
| `/opt/quantumcbt` | kode aplikasi (user `quantumcbt`) |
| `/opt/quantumcbt/backend/.env` | kredensial DB dan `SECRET_KEY` (dibuat otomatis, jangan ditimpa) |
| `/opt/quantumcbt/backend/uploads` | gambar soal (tidak ikut terhapus saat rilis) |
| `/opt/quantumcbt/backups` | backup harian DB dan uploads, disimpan 14 hari |

## Pertama kali

1. Arahkan DNS A record domain ke IP VPS.
2. Dari Git Bash di root repo: `bash deploy/deploy.sh --setup DOMAIN` (email opsional)
3. Pindahkan data lama (opsional):
   ```bash
   scp -i ~/.ssh/quantumcbt_vps_key backend/dev-local.db root@VPS:/tmp/
   scp -i ~/.ssh/quantumcbt_vps_key -r backend/uploads/. root@VPS:/opt/quantumcbt/backend/uploads/
   ssh -i ~/.ssh/quantumcbt_vps_key root@VPS 'chown -R quantumcbt: /opt/quantumcbt/backend/uploads && cd /opt/quantumcbt/backend && sudo -u quantumcbt bash -c "set -a; . ./.env; venv/bin/python scripts/migrate_sqlite_to_postgres.py /tmp/dev-local.db \$DATABASE_URL"'
   ```

## Rilis berikutnya

Commit perubahan, lalu jalankan `bash deploy/deploy.sh`.

## Perintah berguna di VPS

```bash
systemctl status quantumcbt-backend quantumcbt-frontend
journalctl -u quantumcbt-backend -f
systemctl list-timers quantumcbt-autosubmit.timer   # auto-submit ujian yang waktunya habis, tiap menit
journalctl -u quantumcbt-autosubmit -n 50
```
