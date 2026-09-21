# 🔍 Laporan Review Kode — CBT Quantum Research

Laporan ini disusun dari review menyeluruh backend (FastAPI) dan frontend (Next.js App Router) pada tanggal 2026-09-08. **Tidak ada perubahan kode yang dilakukan saat review** — dokumen ini hanya catatan temuan.

---

## Ringkasan Eksekutif

| Area | Kondisi | Poin Utama |
|---|---|---|
| Keamanan & Auth | 🟠 Sedang | Intern sudah bagus (bcrypt, JWT, RBAC), tapi rate-limit login nonaktif & token revocation in-memory |
| Config & Secret | 🔴 Perlu Perhatian | `SECRET_KEY` dev ada di `.env`; fallback SQLite diam-diam di production |
| Database & Model | 🟠 Sedang | Drift model vs DB (FK), N+1, JSON vs JSONB |
| Timer & Ujian | 🟢 Bagus | Timer otoritatif server, anti double-submit, autosave rapi |
| Frontend Security | 🟠 Sedang | Token di localStorage, sanitizer custom, guard guru vs admin tidak granular |
| UI/UX | 🟢 Bagus | Loading/empty/error state umumnya lengkap; beberapa bug minor |

---

## 🟥 KRITIS

| # | Temuan | Lokasi | Dampak |
|---|---|---|---|
| K1 | `SECRET_KEY=dev-secret` & password database plaintext tersimpan di `.env` | `backend/.env` | Jika file ini bocor/ter-commit, seluruh JWT & database bisa dikompromikan |
| K2 | Migration FK merujuk tabel `"user"` (singular) padahal tabel asli `"users"` | `backend/alembic/versions/f2g3h4i5j6k7_add_foreign_keys.py:65,152,174` | Migrasi akan gagal dengan `relation "user" does not exist` di Postgres fresh |
| K3 | Jika koneksi Postgres gagal, app **silent fallback ke SQLite** `./dev.db` | `backend/app/core/config.py:54-69` | Di production app bisa "jalan" di DB kosong tanpa error → data terlihat hilang |

---

## 🟧 TINGGI / MEDIUM — Backend

### Security & Auth

| # | Temuan | Lokasi | Severity |
|---|---|---|---|
| B1 | Rate-limit login dinonaktifkan (`MAX_LOGIN_ATTEMPTS = 1000`, body di-comment) | `backend/app/core/security.py:24,154-168` | Tinggi |
| B2 | Token logout di-invalidate hanya in-memory `Set` → hilang saat restart; refresh token tidak dirotasi & tidak ada `jti` | `backend/app/core/security.py:21-23`; `routers/auth.py` | Tinggi |
| B3 | JWT HS256 tanpa `issuer`/`audience` claim | `backend/app/core/security.py:43,80` | Rendah |
| B4 | `passlib[bcrypt]==1.7.4` + `bcrypt==3.2.0` di-pin; tidak boleh upgrade bcrypt tanpa uji | `backend/requirements.txt:17-18` | Catatan |

### Config & Environment

| # | Temuan | Lokasi | Severity |
|---|---|---|---|
| B5 | Deteksi produksi hanya lewat env string `APP_ENV`; tidak ada whitelist env default | `backend/app/core/config.py:13-15` | Rendah |
| B6 | Koneksi ke DB dibuat saat import (bukan lazy) | `backend/app/core/config.py:54-69` | Catatan |
| B7 | `Settings` pakai `__init__` + `lru_cache`, bukan `pydantic-settings` (sudah ada di requirements) | `backend/app/core/config.py:72-74` | Catatan |
| B8 | `.gitignore` meng-ignore `alembic/versions/*.py` tapi migration ter-track (inkonsisten) | `backend/.gitignore:72` | Catatan |

### Timezone

| # | Temuan | Lokasi | Severity |
|---|---|---|---|
| B9 | `ensure_utc()` menafsirkan datetime naive sebagai UTC. Input jadwal dari `<input type="datetime-local">` (lokal tanpa offset) bisa meleset 7 jam | `backend/app/core/timeutils.py:16-26` | Medium |
| B10 | Kolom waktu mayoritas `DateTime(timezone=True)` — sudah benar | — | Bagus |

### Models

| # | Temuan | Lokasi | Severity |
|---|---|---|---|
| B11 | Banyak FK hanya dibuat di migration, **tidak ada di model ORM** → drift model vs DB | `models/soal.py:9-12`, `paket_ujian.py:15-16`, `siswa.py:13-14`, `pelajaran.py:10`, `jadwal_ujian.py:16-17`, `bagian_paket.py:13`, `jawaban_siswa.py:18` | Medium |
| B12 | Tidak ada unique constraint DB untuk ujian aktif per (siswa, jadwal) → race condition | `models/ujian_siswa.py:8-10` | Medium |
| B13 | `hasil_ujian.ujian_siswa_id` FK tanpa `index=True` di model (index hanya ada di migration) | `models/hasil_ujian.py:10` | Rendah |
| B14 | Kolom `soal_urutan`, `opsi_urutan`, `bagian_urutan`, `skor_per_pelajaran_json` pakai `JSON`, seharusnya `JSONB`/ARRAY | `models/ujian_siswa.py:19-21`; `models/hasil_ujian.py:12` | Medium |
| B15 | Boolean tanpa `server_default` (hanya Python-side) → NULL saat insert raw/SQLite | `models/opsi_jawaban.py:11`, `program.py:11`, `soal.py:14`, `topik.py:11`, `paket_ujian.py:13-14` | Rendah |
| B16 | Tidak ada `updated_at` di model mana pun | — | Catatan |
| B17 | `soal.tipe` String(50) tanpa CHECK constraint/enum → typo diam-diam | `models/soal.py:14` | Catatan |
| B18 | `.gitignore` meng-ignore `alembic/versions/*.py` tapi migration ter-track (inkonsisten) | `backend/.gitignore:72` | Catatan |

### Performa (N+1)

| # | Temuan | Lokasi | Severity |
|---|---|---|---|
| B19 | N+1 di scoring: query `OpsiJawaban` per soal per jawaban | `backend/app/services/scoring.py:91-95,113-117` | Medium |
| B20 | N+1 di saat mulai ujian: query `OpsiJawaban` per soal | `backend/app/routers/ujian_siswa.py:269-276` | Rendah |
| B21 | N+1 di dashboard: loop seluruh `UjianSiswa` + query per item | `backend/app/routers/dashboard.py:97-107` | Rendah |

### Lain-lain

| # | Temuan | Lokasi | Severity |
|---|---|---|---|
| B22 | `/uploads` di-mount statis tanpa autentikasi → file bisa diakses publik bila URL diketahui | `backend/app/main.py:24-26` | Rendah |
| B23 | `uvicorn.run(... reload=True)` di `__main__` | `backend/app/main.py:58` | Rendah |
| B24 | Engine dibuat dari `settings.database_url` saat import; SQLite default relatif terhadap CWD | `backend/app/db/database.py:7` | Catatan |
| B25 | **Aturan overlap jadwal lintas program**: overlap dicek per `grup_tryout_id` tanpa membedakan program → jadwal panjang/latihan di satu program memblokir pembuatan ujian program lain. **SELESAI**: overlap kini hanya antar jadwal program yang sama (+ irisan kelas); program berbeda bisa berjalan bersamaan. | `backend/app/routers/jadwal_ujian.py` | Medium |

---

## 🟦 MEDIUM — Frontend

### Auth & Storage

| # | Temuan | Lokasi | Severity |
|---|---|---|---|
| F1 | Access **& refresh token disimpan di `localStorage`** → rentan XSS (dimitisi sanitasi, tapi bukan praktik terbaik) | `frontend/lib/auth.ts:16,21,36-38` | Medium |
| F2 | Refresh token **tidak pernah dirotasi** — saat refresh, refresh token lama dipakai lagi | `frontend/lib/api.ts:40-45` | Medium |
| F3 | **Logout tidak mengirim `refresh_token`** ke backend → refresh token tidak pernah di-revoke | `frontend/components/Header.tsx:102-105`; `lib/auth.ts:64-72` | Medium |
| F4 | `redirectToLogin` (dari interceptor) tidak memanggil `/auth/logout` | `frontend/lib/api.ts:79-81` | Rendah |

### Base URL & Proxy

| # | Temuan | Lokasi | Severity |
|---|---|---|---|
| F5 | `.env.local` memakai absolut `https://localhost:8000` → rewrite `/api` di `next.config.mjs` tidak terpakai di dev (dua sumber kebenaran) | `frontend/.env.local:1`; `next.config.mjs:7-9`; `lib/api.ts:4` | Medium |
| F6 | Gambar `/uploads` **tidak ter-rewrite**; bila `NEXT_PUBLIC_API_URL=/api`, src = `/api/uploads/...` salah / mixed-content di produksi | `components/RichEditor.tsx:80` | Medium |
| F7 | Tidak ada `middleware.ts`/`proxy.ts` — proteksi rute murni sisi klien + layout | — | Catatan |

### RoleGuard & Proteksi Halaman

| # | Temuan | Lokasi | Severity |
|---|---|---|---|
| F8 | **Guard guru vs admin tidak granular**: layout admin mengizinkan `["admin","guru"]`, semua menu (users, pengaturan) tampil ke guru → 403 dari backend, UX buruk | `frontend/app/admin/layout.tsx:7`; `components/Header.tsx:94` | Medium |
| F9 | `change-password` & `/login` tidak di-protect layout (guard manual dalam `useEffect`) | `frontend/app/change-password/page.tsx:20-24` | Rendah |
| F10 | Auth guard sisi klien hanya cek keberadaan token (`isAuthenticated`) | `frontend/lib/auth.ts:74-76` | Catatan |

### Error Handling & State

| # | Temuan | Lokasi | Severity |
|---|---|---|---|
| F11 | Halaman CRUD data master hanya `console.error` tanpa feedback user (kelas, pelajaran, program, users, soal, paket-ujian) | `app/admin/*/page.tsx` | Medium |
| F12 | `admin/jadwal-ujian` menelan detail error backend (mis. pesan overlap) | `app/admin/jadwal-ujian/page.tsx:44-71` | Catatan |
| F13 | `alert()`/`confirm()`/`prompt()` native dipakai di paket-ujian & jadwal | `app/admin/paket-ujian/page.tsx:328-371`; `jadwal-ujian` | Catatan |

### Halaman Ujian Siswa (Core)

| # | Temuan | Lokasi | Severity |
|---|---|---|---|
| F14 | **Autosave esai hilang saat tab ditutup** tanpa submit (tidak ada flush `beforeunload`) | `app/siswa/ujian/[ujianId]/page.tsx:228-241` | Medium |
| F15 | Klik opsi PG/BS/PLS simpan langsung per klik tanpa antrian/debounce → potensi race request | `app/siswa/ujian/[ujianId]/page.tsx:243-282` | Rendah |
| F16 | Keluar ruang ujian (LogOut) tanpa konfirmasi | `app/siswa/ujian/[ujianId]/page.tsx:371-379` | Catatan |

### Bug Fungsional

| # | Temuan | Lokasi | Severity |
|---|---|---|---|
| F17 | **Duplikat field "Pembahasan"** untuk tipe esai/isian di form soal (dua editor saling menimpa). **SELESAI**: satu blok "Pembahasan" untuk semua tipe, diletakkan setelah blok pilihan jawaban; diterapkan di `admin/soal` & `SoalFormModal`. | `app/admin/soal/page.tsx`; `components/SoalFormModal.tsx` | Medium |
| F18 | **`deleteJadwal` pakai `prompt()` untuk alasan tapi backend tidak menerima alasan** → alasan tidak tersimpan (fitur menipu) | `app/admin/jadwal-ujian/page.tsx:94-102` | Medium |
| F19 | **Side-effect fetch di dalam setState updater** (`loadBankSoal` dalam `setPickerFilter`) → double fetch di StrictMode | `app/admin/paket-ujian/page.tsx:218-225` | Medium |
| F20 | N+1 di riwayat siswa: `Promise.all` detail untuk tiap ujian selesai | `app/siswa/riwayat/page.tsx:42-62` | Medium |
| F21 | `siswa/paket/[jadwalId]` fetch `/siswa/jadwal-tersedia` lalu `find` di client, padahal ada endpoint detail | `app/siswa/paket/[jadwalId]/page.tsx` | Rendah |

### Sanitasi & XSS

| # | Temuan | Lokasi | Severity |
|---|---|---|---|
| F22 | Sanitizer custom (bukan DOMPurify): atribut `style` dipertahankan penuh; URL `data:` (selain svg) & `vbscript:` tidak difilter | `frontend/lib/sanitize.ts:33-41` | Medium |
| F23 | `<a href>` diizinkan tanpa pengaturan `target`/`rel` | `frontend/lib/sanitize.ts` | Rendah |
| F24 | Backend menyimpan `teks_soal` apa adanya — sanitasi hanya sisi klien (stored XSS terkontrol, tapi lapis tunggal) | `components/MathContent.tsx:159` | Catatan |

---

## 🟩 RENDAH / CATATAN

| # | Temuan | Lokasi |
|---|---|---|
| L1 | Tidak ada `updated_at` di model | seluruh `models/*.py` |
| L2 | `axios` 1.6.8 — ada CVE historis di ≤1.7.4 | `frontend/package.json:15` |
| L3 | Script lint `next lint` tanpa file `.eslintrc` | `frontend/package.json:8` |
| L4 | Header `overflow:hidden` bisa "macet" di edge case (drawer open lalu logout) | `frontend/components/Header.tsx:86-91` |
| L5 | Beberapa halaman tanpa flag `cancelled` → double-fetch di dev (StrictMode) | `app/admin/soal`, `users`, dll. |
| L6 | Mojibake `Â·` di salah satu line | `app/admin/laporan-soal/page.tsx:107` |
| L7 | Pesan error kadang memakai `text-green-700` | `app/siswa/hasil/[ujianId]/page.tsx:526` |
| L8 | `RichEditor` memakai `document.execCommand` (deprecated) | `components/RichEditor.tsx:42` |
| L9 | `SoalFormModal` duplikasi logika validasi dengan `admin/soal` | `components/SoalFormModal.tsx` |
| L10 | Validation password register hanya client-side (`minLength`); backend tidak ada minimum | `app/admin/siswa/page.tsx:211` |

---

## ✅ Yang SUDAH BAGUS (perlu dipertahankan)

1. **Keamanan backend solid**: bcrypt, JWT `exp`+`type` dicek, pesan login seragam (anti user enumeration), RBAC `require_roles` konsisten, `authorize_ujian` benar membatasi siswa ke ujian miliknya.
2. **`.env` ter-ignore** di 2 level `.gitignore`; produksi memaksa secret non-default; CORS whitelist ketat.
3. **Timer ujian otoritatif dari server** + guard anti double-submit + autosave esai debounce + flush saat pindah soal — desain ruang ujian matang.
4. **`Promise.allSettled` di dashboard admin** — satu endpoint gagal tidak mengosongkan semua.
5. **Sanitasi + tanpa `dangerouslySetInnerHTML`**; upload gambar role-protected + validasi ukuran/ekstensi.
6. **Indexing lengkap** (migration scalability), `ondelete` cascade benar, helper timezone terpusat `timeutils`.
7. **Interceptor refresh-token anti-race** (`refreshing` singleton) + retry 1x + redirect login dengan param ter-encode.
8. **Loading/empty/error state** hampir merata di semua halaman; `getErrorMessage` sinkron dengan format FastAPI.
9. **Endpoint frontend ↔ backend sinkron** (diverifikasi silang di hampir semua halaman, tidak ada path yang hilang).

---

## 🎯 Prioritas Perbaikan (tanpa mengubah apa pun saat ini)

1. **Hapus/replace kredensial** `.env` (`SECRET_KEY` dev & password DB) untuk produksi; perbaiki migration FK `"user"` → `"users"` sebelum dipakai di Postgres fresh.
2. **Enforce rate-limit login** (brute force) & **rotasi/persistensi refresh token** (revocation Redis/DB).
3. **Satukan sumber base URL**: `NEXT_PUBLIC_API_URL=/api` + tambahkan rewrite untuk `/uploads`.
4. **Tutup gap FK model vs DB** (`soal`, `paket_ujian`, `pelajaran`, `siswa`, `jadwal_ujian`, `bagian_paket`), tambah unique constraint ujian aktif, `JSON` → `JSONB`.
5. **Perbaiki bug UX nyata**: duplikat "Pembahasan", `prompt()` alasan hapus jadwal, autosave esai saat tab ditutup.
6. **Ganti sanitizer** dengan DOMPurify (atau tambah filter `style` & skema URL `data:`/lainnya).
7. **Pisahkan guard guru vs admin** di UI (sembunyikan menu sensitif untuk guru).
8. **Perbaiki validasi overlap jadwal** (B25) — filter per program/kelas/waktu yang benar agar pembuatan jadwal tidak terblokir slot bebas.

---

## ✅ Progres Perbaikan (ditandai saat selesai)

- **Isolasi program per paket ujian — SELESAI (2026-09-09).** `program_id` ditambahkan di model/schema/router `paket_ujian` (+ kolom & index di Postgres via ALTER TABLE). Form "Buat Ujian" kini wajib pilih Program; jadwal otomatis mewarisi program & kelas dari paket (`jadwal_ujian.py`). Siswa lintas program tidak melihat/mengerjakan ujian program lain.
- **B25: Overlap jadwal per program — SELESAI (2026-09-09).** `validate_jadwal` kini memakai program & kelas efektif (payload → fallback paket), overlap hanya dicek antar jadwal program yang sama dengan cakupan kelas beririsan; program berbeda tidak saling memblokir. `delete_paket_ujian` ikut soft-delete jadwal terkait agar tak jadi orphan.
- **F17: Duplikat field "Pembahasan" — SELESAI (2026-09-09).** Satu blok pembahasan per tipe di form soal (`admin/soal/page.tsx` & `components/SoalFormModal.tsx`), dipindah ke bawah blok pilihan jawaban agar alur menulis alami.

---

*Dokumen ini murni catatan review. Perubahan kode baru dilakukan setelah persetujuan eksplisit.*