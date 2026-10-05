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

1. Jalankan tes (`pytest` backend, `npx tsc --noEmit` frontend) lalu commit. `deploy.sh`
   mengirim isi working tree, jadi perubahan yang belum di-commit ikut terkirim.
2. Backup database sebelum rilis (`deploy.sh` tidak membuat backup sendiri):
   ```bash
   ssh -i ~/.ssh/quantumcbt_vps_key root@202.155.13.133 'D=/opt/quantumcbt/backups/pre-deploy-$(date +%Y%m%d-%H%M%S); mkdir -p $D && sudo -u postgres pg_dump -Fc quantumcbt > $D/quantumcbt.dump'
   ```
3. `bash deploy/deploy.sh`, lalu tunggu `backend OK` dan `frontend OK` di akhir.
   Migrasi Alembic ikut berjalan otomatis.

Jika SSH terputus saat `next build`, tarball rilis masih ada di server. Lanjutkan di sana:

```bash
nohup bash /tmp/quantumcbt-release.sh /tmp/quantumcbt-release.tar.gz > /tmp/qcbt-release.log 2>&1 &
tail -f /tmp/qcbt-release.log     # tunggu "backend OK / frontend OK"
```

Rollback database: `pg_restore --clean -d quantumcbt <folder backup>/quantumcbt.dump`
(sebagai user `postgres`). Rollback kode: deploy ulang commit sebelumnya.

Server ini juga menjalankan aplikasi lain (`jb-porto` di :3100). Jangan ubah service
atau site Nginx di luar QuantumCBT.

## Perintah berguna di VPS

```bash
systemctl status quantumcbt-backend quantumcbt-frontend
journalctl -u quantumcbt-backend -f
systemctl list-timers quantumcbt-autosubmit.timer   # auto-submit ujian yang waktunya habis, tiap menit
journalctl -u quantumcbt-autosubmit -n 50

# membuat akun admin (password ditanyakan)
cd /opt/quantumcbt/backend && sudo -u quantumcbt bash -c 'set -a; . ./.env; venv/bin/python scripts/create_admin.py NAMA_ADMIN'
```

Mengosongkan data uji coba (akun dan data master tetap): backup dulu, lalu jalankan
`scripts/clear_vps_data.py`. Langkah lengkap dan daftar yang dihapus ada di
[docs/CLIENT_REQUESTS_2026-10-04.md](../docs/CLIENT_REQUESTS_2026-10-04.md).
