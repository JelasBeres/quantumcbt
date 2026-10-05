# Quantum Research CBT

Aplikasi Computer Based Test untuk Bimbel Quantum Research: bank soal, paket Try Out
dan Latihan, jadwal, ruang ujian siswa, penilaian (Nilai Biasa dengan KKM atau
Benchmark Kohort UTBK/TKA), rekap nilai, dan unduh soal ke PDF.

Status: Siap Produksi

## Stack

| Bagian | Teknologi |
|---|---|
| Backend | FastAPI 0.115, SQLAlchemy 2, Alembic, Pydantic 2 |
| Database | PostgreSQL (VPS), SQLite `backend/dev-local.db` (lokal) |
| Frontend | Next.js 14 (App Router), React 18, Tailwind 3, Tiptap 3 (editor soal), KaTeX |
| Server | Nginx → `server.js` :3200 → Next :3201, FastAPI (gunicorn) :8000 |

Role: **admin**, **guru** (terbatas pada mapel/program/kelas yang diampu), **siswa**.

## Struktur

```
backend/
  app/models, schemas, routers, services   # scoring ada di services/scoring.py
  alembic/versions                         # migrasi database
  scripts/init_db.py                       # buat skema SQLite lokal yang masih kosong
  scripts/create_admin.py                  # buat akun admin (mis. admin pertama)
  scripts/clear_vps_data.py                # kosongkan data uji coba, akun & master tetap
  scripts/migrate_sqlite_to_postgres.py    # salin data SQLite ke PostgreSQL
  tests/                                   # pytest, memakai SQLite terpisah
frontend/
  app/admin, app/guru, app/siswa           # halaman per role
  app/cetak/set-soal                       # halaman unduh soal (PDF)
  components/, lib/
deploy/                                    # skrip rilis ke VPS (lihat deploy/README.md)
docs/                                      # catatan revisi client & progres
```

## Menjalankan di lokal (Windows, Git Bash)

Backend:

```bash
cd backend
python -m venv venv
venv/Scripts/python.exe -m pip install -r requirements.txt
cp .env.example .env        # isi DATABASE_URL=sqlite:///./dev-local.db dan SECRET_KEY
venv/Scripts/python.exe scripts/init_db.py            # hanya untuk database baru
venv/Scripts/python.exe scripts/create_admin.py admin # password ditanyakan
venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=/api, BACKEND_URL=http://127.0.0.1:8000
npm run dev                 # http://localhost:3000
```

Browser selalu memanggil `/api/...`; Next meneruskannya ke backend lewat rewrite di
`frontend/next.config.mjs`. Setiap router FastAPI baru yang punya route `"/"` harus
ditambahkan ke daftar `collections` di file itu. Kalau tidak, di mode dev
permintaannya dialihkan ke `127.0.0.1:8000` dan gagal 401.

`init_db.py` dipakai karena migrasi Alembic lama memakai SQL khusus PostgreSQL dan
gagal pada file SQLite baru. Script membuat skema dari model lalu menandainya di
revisi terbaru, jadi untuk perubahan skema berikutnya cukup
`venv/Scripts/python.exe -m alembic upgrade head`. Di PostgreSQL langsung pakai
`alembic upgrade head`.

Sebelum migrasi atau eksperimen data, cadangkan database lokal:
`cp backend/dev-local.db backend/dev-local.before-<keterangan>-<tanggal>.db`.

## Tes

```bash
cd backend && venv/Scripts/python.exe -m pytest -q     # ±4 menit
cd frontend && npx tsc --noEmit && npm run build
```

`npm run test:proxy` adalah cek integrasi terhadap server yang sedang berjalan dan
butuh `PROXY_TEST_USERNAME` / `PROXY_TEST_PASSWORD`.

## Deploy

Lihat [deploy/README.md](deploy/README.md). Ringkasnya: backup database VPS, lalu
`bash deploy/deploy.sh` dari root repo. Rilis menjalankan `alembic upgrade head`,
build frontend, dan restart service.

Admin baru di VPS: lihat bagian "Perintah berguna" di deploy/README.md.

## Zip source code

```bash
python make_zip.py            # -> QUANTUMCBT_Clean.zip dari commit HEAD
```

Hanya file yang di-commit yang masuk (tanpa `.env`, database, log, `node_modules`,
`venv`, `uploads`). Commit dulu sebelum membuat zip.

## Dokumen

| File | Isi |
|---|---|
| [docs/PROGRESS_REVISI.md](docs/PROGRESS_REVISI.md) | Status revisi terbaru, format siap kirim ke client (WhatsApp) |
| `docs/CLIENT_REQUESTS_<tanggal>.md` | Catatan permintaan client per tahap dan cara penyelesaiannya |
| [docs/PRD_SISWA_BACKEND_DATABASE.md](docs/PRD_SISWA_BACKEND_DATABASE.md) | Spesifikasi awal alur siswa (acuan historis; aturan terbaru ada di catatan revisi) |
| [deploy/README.md](deploy/README.md) | Susunan server dan langkah deploy |
