# Graph Report - QUANTUMCBT  (2026-09-22)

## Corpus Check
- 236 files · ~131,104 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2177 nodes · 4982 edges · 120 communities (111 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- routers/soal.py
- Session
- routers/program.py
- routers/auth.py
- PaketQuestionAssignment.tsx
- routers/paket_ujian.py
- dependencies
- Quick Reference - CBT API Endpoints
- Phase 3 Frontend Implementation - Summary
- Implementasi Grouping Tryout - Ringkasan Final
- Session
- routers/kelas.py
- routers/guru_scope.py
- routers/jadwal_ujian.py
- _sisa_waktu_detik
- api.ts
- scoring.py
- Phase 3 Frontend - Master Data CRUD
- admin/jadwal-ujian/page.tsx
- Pelajaran
- 📋 Quick Reference — CBT Quantum Research
- 🚀 Getting Started — CBT Quantum Research
- CRITICAL BUG FIXES - IMPLEMENTATION GUIDE
- compilerOptions
- MathContent.tsx
- routers/bagian_paket.py
- routers/kategori_paket.py
- routers/topik.py
- 🔍 Laporan Review Kode — CBT Quantum Research
- hasil/[ujianId]/page.tsx
- 🎉 CRITICAL BUG FIXES - COMPLETED!
- 👋 START HERE — CBT Quantum Research
- Panduan Penggunaan Grouping Tryout
- review-jadwal/page.tsx
- routers/grup_tryout.py
- 5. Definisi Entitas
- test_package_hierarchy.py
- get_hasil_detail
- routers/pengaturan.py
- 🗄️ Database Schema — CBT Quantum Research
- 8. Alur Siswa End-to-End
- buat_laporan
- ✅ FASE 0 — Persiapan (Checklist Konkret)
- VERIFIKASI IMPLEMENTASI GRUP TRYOUT
- routers/opsi_jawaban.py
- OpsiJawaban
- server.js
- routers/pelajaran.py
- utc_now
- 🔧 Step-by-Step Setup
- nilai_jawaban_esai
- routers/subbab.py
- PRD Siswa: Backend, Database, dan Alur Produk
- Progress Tracker — CBT Quantum Research
- 🗺️ Roadmap Lengkap CBT Quantum Research
- update_user_status
- 🎯 Sistem CBT Quantum Research
- ARCHITECTURE.md
- 📅 Phase Status
- Audit dan QA lokal — 16 September 2026
- Checklist:
- Subtasks:
- ujian/[ujianId]/page.tsx
- seed_local_demo.py
- 🚀 QUICK START - Deploy Critical Fixes
- Subtasks:
- 📅 FASE 8 — Frontend Lengkap (Paralel dengan Fase 3-7, atau setelahnya) (3–4 minggu)
- index.ts
- 🔄 Request Flow: Sistem Ujian (Core)
- siswa/jadwal-ujian/page.tsx
- Settings
- Phase 1 — Backend & Database Setup — Completion Report
- 11. Acceptance Criteria Frontend Siswa
- 📅 FASE 9 — Testing & QA (2 minggu)
- routers/ujian_siswa.py
- getErrorMessage
- Perubahan kebutuhan client — 17 September 2026
- Data dummy lokal
- 12. Kebutuhan Nonfungsional
- 🐛 Known Issues & Notes
- 📅 FASE 7 — Dashboard & Monitoring (1–2 minggu)
- 📅 FASE 6 — Scoring & Hasil Ujian (1 minggu)
- Badge.tsx
- admin/monitoring-ujian/page.tsx
- 10. State yang Wajib Ditangani Frontend
- 3. Persona dan Otorisasi
- 📅 FASE 2 — Authentication & Otorisasi (1 minggu)
- 📅 FASE 4 — Jadwal Ujian (3–5 hari)
- app/page.tsx
- next.config.mjs
- check-api-proxy.mjs
- conftest.py
- _authorize_ujian_log
- apply_local_client_update.py
- 📝 Completed Deliverables
- ✅ PHASE 2 — Authentication & Otorisasi (Target: 1 minggu)
- ✅ PHASE 4 — Jadwal Ujian (Target: 3-5 hari)
- ✅ PHASE 5 — Mesin Ujian (Core Engine) ⭐⭐⭐ (Target: 2-3 minggu)
- ✅ PHASE 6 — Scoring & Hasil Ujian (Target: 1 minggu)
- ✅ PHASE 7 — Dashboard & Monitoring (Target: 1-2 minggu)
- ✅ PHASE 1 — Backend & Database Setup (Target: 1-2 minggu)
- 📅 FASE 1 — Setup Backend & Database (1–2 minggu)
- app/layout.tsx
- app/__init__.py
- next-env.d.ts
- tailwind.config.ts
- User
- Revisi client — 16 September 2026
- api
- Soal
- Kebutuhan client dan implementasi — 18 September 2026
- _enable_sqlite_fk
- LoginActivityOut

## God Nodes (most connected - your core abstractions)
1. `User` - 70 edges
2. `get_password_hash()` - 68 edges
3. `UjianSiswa` - 44 edges
4. `getErrorMessage()` - 40 edges
5. `api` - 39 edges
6. `Pelajaran` - 36 edges
7. `utc_now()` - 34 edges
8. `Soal` - 34 edges
9. `PaketUjian` - 32 edges
10. `Button()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `CohortScoreResult` --uses--> `HasilUjian`  [INFERRED]
  backend/app/services/scoring.py → backend/app/models/hasil_ujian.py
- `CohortScoreResult` --uses--> `JawabanSiswa`  [INFERRED]
  backend/app/services/scoring.py → backend/app/models/jawaban_siswa.py
- `CohortScoreResult` --uses--> `OpsiJawaban`  [INFERRED]
  backend/app/services/scoring.py → backend/app/models/opsi_jawaban.py
- `CohortScoreResult` --uses--> `Pelajaran`  [INFERRED]
  backend/app/services/scoring.py → backend/app/models/pelajaran.py
- `CohortScoreResult` --uses--> `PernyataanBenarSalah`  [INFERRED]
  backend/app/services/scoring.py → backend/app/models/pernyataan_benar_salah.py

## Import Cycles
- None detected.

## Communities (120 total, 9 thin omitted)

### Community 0 - "routers/soal.py"
Cohesion: 0.07
Nodes (74): require_guru_scope(), approve_soal(), archive_soal(), _can_read_soal(), create_opsi_by_soal(), create_soal(), create_soal_revision(), _creator_names() (+66 more)

### Community 1 - "Session"
Cohesion: 0.11
Nodes (45): active_question_ids(), advance_section(), authorize_ujian(), calculate_time_info(), confirm_drill(), create_ujian_siswa(), ensure_ujian_active(), get_siswa_for_current_user() (+37 more)

### Community 2 - "routers/program.py"
Cohesion: 0.22
Nodes (13): create_program(), delete_program(), get_program(), list_program(), delete, get, post, put (+5 more)

### Community 3 - "routers/auth.py"
Cohesion: 0.08
Nodes (48): client_ip(), create_access_token(), create_refresh_token(), create_token(), decode_access_token(), decode_refresh_token(), decode_token(), decode_token_payload() (+40 more)

### Community 4 - "PaketQuestionAssignment.tsx"
Cohesion: 0.10
Nodes (29): Group, Level, SoalPage(), teksPolos(), getNama(), Group, groupBy(), GuruSoalPage() (+21 more)

### Community 5 - "routers/paket_ujian.py"
Cohesion: 0.14
Nodes (43): archive_paket_ujian(), assign_package(), _category_values(), clone_paket_ujian(), create_paket_ujian(), delete_paket_ujian(), _derive_skala_kohort(), _ensure_paket_mutable() (+35 more)

### Community 6 - "dependencies"
Cohesion: 0.04
Nodes (47): autoprefixer, axios, eslint, eslint-config-next, exceljs, dependencies, autoprefixer, axios (+39 more)

### Community 7 - "Quick Reference - CBT API Endpoints"
Cohesion: 0.04
Nodes (46): Admin, Admin Dashboard, 🔐 Authentication, Create Jadwal with Grup, Create Paket Example, CRUD Grup Tryout, 📈 Dashboard & Monitoring, 📚 Documentation Links (+38 more)

### Community 8 - "Phase 3 Frontend Implementation - Summary"
Cohesion: 0.04
Nodes (45): 1. Design System, 2. Reusable Components (7), 3. Admin Pages (6 + 1 Dashboard), 4. Features, API Integration, Build, Color Palette, Colors (+37 more)

### Community 9 - "Implementasi Grouping Tryout - Ringkasan Final"
Cohesion: 0.05
Nodes (40): 1. Isolasi Per Grup, 2. Validasi Ketat, 3. Backward Compatible, API Documentation, API Response Time, Authorization, Backend ✅, Database (+32 more)

### Community 10 - "Session"
Cohesion: 0.10
Nodes (38): create_siswa(), create_siswa_dengan_akun(), delete_siswa(), get_current_siswa_profile(), get_siswa(), get_siswa_dashboard(), get_siswa_jadwal_tersedia(), get_siswa_jadwal_ujian() (+30 more)

### Community 11 - "routers/kelas.py"
Cohesion: 0.22
Nodes (13): create_kelas(), delete_kelas(), get_kelas(), list_kelas(), delete, get, post, put (+5 more)

### Community 12 - "routers/guru_scope.py"
Cohesion: 0.15
Nodes (33): Guru, Base, create_guru_profile(), create_user_scope(), delete_scope(), _detail(), _ensure_unique_profile(), _get_guru() (+25 more)

### Community 13 - "routers/jadwal_ujian.py"
Cohesion: 0.13
Nodes (36): approve_jadwal(), create_jadwal_ujian(), delete_jadwal_ujian(), _durasi_efektif(), get_jadwal_ujian(), list_jadwal_ujian(), list_siswa_jadwal(), _program_kelas_efektif() (+28 more)

### Community 14 - "_sisa_waktu_detik"
Cohesion: 0.21
Nodes (18): get_dashboard_admin(), get_dashboard_hasil_siswa(), get_dashboard_log_kecurangan(), get_dashboard_statistik(), get_hasil_analytics(), get_monitoring_ujian(), get, PaketUjian (+10 more)

### Community 15 - "api.ts"
Cohesion: 0.10
Nodes (25): ChangePasswordPage(), LoginPage(), ADMIN_NAV, AdminGroup, GURU_NAV, Header(), NavItem, SISWA_NAV (+17 more)

### Community 16 - "scoring.py"
Cohesion: 0.09
Nodes (49): HasilUjian, Base, Base, UjianSiswa, compute_hasil_ujian(), create_hasil_ujian(), post, submit_ujian_siswa() (+41 more)

### Community 17 - "Phase 3 Frontend - Master Data CRUD"
Cohesion: 0.06
Nodes (32): 1. Dashboard, 1. Professional & Clean, 2. Program, 2. Quantum Branding, 3. Pelajaran, 3. User Experience, 4. Accessibility, 4. Siswa (+24 more)

### Community 18 - "admin/jadwal-ujian/page.tsx"
Cohesion: 0.15
Nodes (13): getTimeStatus(), GroupItem, GrupTryout, initialForm, initialPackageFilters, initialScheduleFilters, JadwalUjianPage(), PackageFilters (+5 more)

### Community 19 - "Pelajaran"
Cohesion: 0.13
Nodes (29): Kelas, Base, Pelajaran, Base, Program, Base, Base, Topik (+21 more)

### Community 20 - "📋 Quick Reference — CBT Quantum Research"
Cohesion: 0.06
Nodes (31): 📊 10 Phases At A Glance, 🌐 API Endpoints Quick Map, Authentication, Backend, 🏗️ Backend Architecture, 📞 Contact, Core Ujian Engine (CRITICAL), ⚠️ Critical DO's & DON'Ts (+23 more)

### Community 21 - "🚀 Getting Started — CBT Quantum Research"
Cohesion: 0.09
Nodes (22): Backend (Python/FastAPI), 💡 Development Tips, 📝 Development Workflow, Frontend (Node.js/Next.js), 🚀 Getting Started — CBT Quantum Research, Git, Module not found error, 📞 Need Help? (+14 more)

### Community 22 - "CRITICAL BUG FIXES - IMPLEMENTATION GUIDE"
Cohesion: 0.07
Nodes (27): **After Fixes:**, **Before Fixes:**, **Check Auto-Submit Log**, **Check Scheduler Status**, CRITICAL BUG FIXES - IMPLEMENTATION GUIDE, 🔧 IMPLEMENTASI, Linux/Mac:, 🔍 MONITORING (+19 more)

### Community 23 - "compilerOptions"
Cohesion: 0.07
Nodes (27): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+19 more)

### Community 24 - "MathContent.tsx"
Cohesion: 0.16
Nodes (20): EquationEditorDialog(), buildFragment(), findMatches(), hasCompleteMatchInDirectText(), hasDelimiter(), INLINE_TAGS, isSimpleInlineContainer(), Match (+12 more)

### Community 25 - "routers/bagian_paket.py"
Cohesion: 0.20
Nodes (28): _bagian_detail(), create_bagian(), delete_bagian(), _get_bagian(), _get_paket(), list_bagian(), _next_urutan(), delete (+20 more)

### Community 26 - "routers/kategori_paket.py"
Cohesion: 0.14
Nodes (26): KategoriPaket, Base, create_kategori_paket(), delete_kategori_paket(), list_kategori_paket(), _out(), delete, get (+18 more)

### Community 27 - "routers/topik.py"
Cohesion: 0.20
Nodes (16): _commit(), create_topik(), delete_topik(), list_topik(), delete, get, post, put (+8 more)

### Community 28 - "🔍 Laporan Review Kode — CBT Quantum Research"
Cohesion: 0.09
Nodes (22): Auth & Storage, Base URL & Proxy, Bug Fungsional, Config & Environment, Error Handling & State, Halaman Ujian Siswa (Core), 🟥 KRITIS, Lain-lain (+14 more)

### Community 29 - "hasil/[ujianId]/page.tsx"
Cohesion: 0.18
Nodes (15): formatTanggal(), Hasil, HasilDetail, HasilDetailPage(), HasilMeta, HasilOpsi, HasilPernyataan, HasilSoalDetailItem (+7 more)

### Community 30 - "🎉 CRITICAL BUG FIXES - COMPLETED!"
Cohesion: 0.09
Nodes (21): 1. ✅ Race Condition pada Mulai Ujian, 2. ✅ Foreign Key Constraints Missing, 3. ✅ Auto-Submit Expired Ujian, **After Deployment:**, **After Fixes:**, **Before Deployment:**, **Before Fixes:**, 📋 BUGS YANG SUDAH DIPERBAIKI (+13 more)

### Community 31 - "👋 START HERE — CBT Quantum Research"
Cohesion: 0.09
Nodes (22): 1. Random Urutan Soal & Opsi, 2. Timer dari Backend (Bukan Client), 3. Autosave Jawaban, 4. Resume Ujian, Apa Itu Project Ini?, 🤔 Common Questions, ✅ Current Focus — Phase 8 Frontend (Student Pages), Fase Pengerjaan (10 Fase) (+14 more)

### Community 32 - "Panduan Penggunaan Grouping Tryout"
Cohesion: 0.10
Nodes (20): 1. Melihat Jadwal Tryout, 1. Membuat Grup Tryout, 2. Filter Jadwal Per Grup, 2. Membuat Jadwal dengan Grup, 3. Melihat Jadwal Per Grup, 3. Mengikuti Ujian, 4. Menghapus Grup, API Endpoints (+12 more)

### Community 33 - "review-jadwal/page.tsx"
Cohesion: 0.12
Nodes (17): Analytics, DashboardData, Statistik, ReviewJadwalPage(), SoalPaket, ReviewSoalPage(), StatusCount, EmptyState() (+9 more)

### Community 34 - "routers/grup_tryout.py"
Cohesion: 0.19
Nodes (17): create_grup_tryout(), delete_grup_tryout(), ensure_unique_nama(), get_grup_or_404(), get_grup_tryout(), list_grup_tryout(), delete, get (+9 more)

### Community 35 - "5. Definisi Entitas"
Cohesion: 0.10
Nodes (20): 5.10 `paket_soal`, 5.11 `soal`, 5.12 `opsi_jawaban`, 5.13 `grup_tryout`, 5.14 `jadwal_ujian`, 5.15 `ujian_siswa`, 5.16 `jawaban_siswa`, 5.17 `hasil_ujian` (+12 more)

### Community 36 - "test_package_hierarchy.py"
Cohesion: 0.24
Nodes (16): GuruScope, Base, _headers(), _payload(), _setup(), test_categorized_section_duration_required_and_teacher_security(), test_category_create_update_backward_compatibility_and_clone(), test_section_question_assignment_is_guru_only_and_scoped() (+8 more)

### Community 37 - "get_hasil_detail"
Cohesion: 0.24
Nodes (15): authorize_hasil_access(), get_hasil_by_ujian_siswa(), get_hasil_detail(), get_hasil_ujian(), list_hasil_ujian(), get, Session, Detail jawaban per soal: jawaban siswa vs kunci jawaban. (+7 more)

### Community 38 - "routers/pengaturan.py"
Cohesion: 0.23
Nodes (17): create_pengaturan(), decode_value(), encode_value(), get_pengaturan(), list_pengaturan(), Any, get, post (+9 more)

### Community 39 - "🗄️ Database Schema — CBT Quantum Research"
Cohesion: 0.09
Nodes (23): 🗄️ Database Schema — CBT Quantum Research, Design Rationale, Mengapa `is_random_soal` & `is_random_opsi` di `paket_ujian`?, Mengapa JSON untuk urutan random?, Mengapa `skor_per_pelajaran_json`?, Migration Script (Alembic), Performance Considerations, Relasi Summary (+15 more)

### Community 40 - "8. Alur Siswa End-to-End"
Cohesion: 0.11
Nodes (19): 8.10 Ragu-ragu, 8.11 Timer, 8.12 Log kecurangan, 8.13 Submit, 8.14 Scoring, 8.15 Hasil dan riwayat, 8.16 Laporan soal, 8.17 Ganti password (+11 more)

### Community 41 - "buat_laporan"
Cohesion: 0.18
Nodes (14): buat_laporan(), list_laporan(), get, patch, post, Session, User, Siswa/guru/admin melaporkan soal bermasalah. (+6 more)

### Community 42 - "✅ FASE 0 — Persiapan (Checklist Konkret)"
Cohesion: 0.11
Nodes (18): 1️⃣ Branding & Dokumentasi Bisnis, 2️⃣ Repository & Version Control, 3.1 Python Backend Environment, 3.2 PostgreSQL Database, 3.3 Node.js & Frontend Environment, 3️⃣ Local Environment Setup, 4️⃣ Development Tools & IDE, 5.1 Entity Relationship Diagram (ERD) (+10 more)

### Community 43 - "VERIFIKASI IMPLEMENTASI GRUP TRYOUT"
Cohesion: 0.11
Nodes (17): Backend, ✅ Backend - Fitur yang Berhasil, Backward Compatibility, File yang Diubah/Dibuat, Frontend, ✅ Frontend - Halaman yang Dibuat, Kesimpulan, Rangkuman (+9 more)

### Community 44 - "routers/opsi_jawaban.py"
Cohesion: 0.30
Nodes (16): create_opsi_jawaban(), delete_opsi_jawaban(), get_opsi_jawaban(), _get_soal(), list_opsi_jawaban(), delete, get, post (+8 more)

### Community 45 - "OpsiJawaban"
Cohesion: 0.17
Nodes (17): OpsiJawaban, Base, make_user(), setup_questions(), test_option_cannot_move_between_questions_and_draft_key_hidden(), test_option_write_requires_owner_and_editable_status(), ensure_user(), get_token() (+9 more)

### Community 46 - "server.js"
Cohesion: 0.16
Nodes (14): backend, BACKEND_URL, EXTERNAL_PORT, fail(), http, next, NEXT_INTERNAL_PORT, nextTarget (+6 more)

### Community 47 - "routers/pelajaran.py"
Cohesion: 0.22
Nodes (13): create_pelajaran(), delete_pelajaran(), get_pelajaran(), list_pelajaran(), delete, get, post, put (+5 more)

### Community 48 - "utc_now"
Cohesion: 0.07
Nodes (59): ensure_utc(), datetime, Helpers to keep datetime handling consistent and timezone-aware. Semua waktu…, Waktu sekarang sebagai datetime timezone-aware (UTC)., Ubah datetime apa pun menjadi timezone-aware UTC. Datetime naive dianggap sudah…, utc_now(), default_program_id(), Reference data for API tests that do not exercise program selection. (+51 more)

### Community 49 - "🔧 Step-by-Step Setup"
Cohesion: 0.25
Nodes (8): Step 1: Clone Repository (Nanti), Step 2: Setup Backend Environment, Step 3: Setup PostgreSQL Database, Step 4: Setup Backend Environment Variables, Step 5: Setup Database Schema (Phase 1+), Step 6: Run Backend Server, Step 7: Setup Frontend (Phase 8+), 🔧 Step-by-Step Setup

### Community 50 - "nilai_jawaban_esai"
Cohesion: 0.18
Nodes (16): get_jawaban_siswa(), list_jawaban_esai_koreksi(), list_jawaban_siswa(), nilai_jawaban_esai(), get, patch, put, Session (+8 more)

### Community 51 - "routers/subbab.py"
Cohesion: 0.18
Nodes (19): _commit(), create_subbab(), delete_subbab(), list_subbab(), _out(), delete, get, post (+11 more)

### Community 52 - "PRD Siswa: Backend, Database, dan Alur Produk"
Cohesion: 0.14
Nodes (13): 13. Anti-Halusinasi: Fitur yang Tidak Ada, 14. Known Limitations dan Pertanyaan Terbuka, 15. Instruksi untuk AI Pembuat PRD/UI Frontend, 1. Ringkasan Produk, 2.1 Tujuan utama, 2.2 Non-goals frontend siswa, 2. Tujuan dan Non-Goals, 4. Diagram Relasi Database (+5 more)

### Community 53 - "Progress Tracker — CBT Quantum Research"
Cohesion: 0.14
Nodes (14): Arsip progres lama, Checklist penyelesaian berikutnya, 📞 Contact & Support, 📊 Metrics & KPIs, NEXT:, 🎯 Next Immediate Actions (Priority Order), 📈 Overall Progress, Pembaruan 18 September 2026 (+6 more)

### Community 54 - "🗺️ Roadmap Lengkap CBT Quantum Research"
Cohesion: 0.14
Nodes (14): Acuan client terbaru — 18 September 2026, 📝 Catatan Penting, Catatan sebelumnya — 17 September, Checklist:, Do's:, Don'ts:, 📅 FASE 0 — Persiapan (1 minggu), 🚀 Next Step: Fase 0 Checklist (+6 more)

### Community 55 - "update_user_status"
Cohesion: 0.22
Nodes (12): get_user(), list_users(), get, patch, Session, User, update_user_status(), BaseModel (+4 more)

### Community 56 - "🎯 Sistem CBT Quantum Research"
Cohesion: 0.15
Nodes (13): 📝 Catatan Penting, 📚 Dokumentasi Utama, 📊 Estimasi Timeline, 🤝 Kontribusi, ✅ **Langkah 1: Baca Roadmap & Dokumentasi**, ✅ **Langkah 2: Siapkan Environment (Fase 0)**, ✅ **Langkah 3: Fase 1 - Backend Setup**, 🚀 Mulai dari Mana? (+5 more)

### Community 57 - "ARCHITECTURE.md"
Cohesion: 0.29
Nodes (6): Backend, Backend service, Endpoint, Endpoint hanya admin bisa akses:, Frontend, UPSERT pattern - sangat penting untuk idempotency

### Community 58 - "📅 Phase Status"
Cohesion: 0.17
Nodes (12): Deliverables:, Deliverables:, Deliverables:, Deliverables:, Key Endpoints:, ✅ PHASE 0 — Persiapan (Target: 1 minggu), 🔴 PHASE 10 — Deployment & Go-Live (Target: 3-5 hari), ✅ PHASE 3 — CRUD Master Data (Target: 1-2 minggu) (+4 more)

### Community 59 - "Audit dan QA lokal — 16 September 2026"
Cohesion: 0.17
Nodes (12): Audit dan QA lokal — 16 September 2026, Hasil, Menjalankan pemeriksaan, Pekerjaan tersisa, Pembaruan 18 September 2026, Pembaruan sebelumnya — 17 September 2026, Perbaikan aplikasi, Perbaikan pengujian (+4 more)

### Community 60 - "Checklist:"
Cohesion: 0.18
Nodes (11): 10.1 Infrastruktur, 10.2 Backend Deployment, 10.3 Frontend Deployment, 10.4 HTTPS & Security, 10.5 Monitoring & Logging, 10.6 Database Backup, 10.7 Go-Live Preparation, 10.8 Soft Launch (+3 more)

### Community 61 - "Subtasks:"
Cohesion: 0.18
Nodes (11): 5.1 Mulai Ujian, 5.2 Fetch Soal (dengan opsi yang sudah diacak), 5.3 Timer dari Backend, 5.4 Autosave Jawaban, 5.5 Resume Ujian (Setelah Refresh/Disconnect), 5.6 Submit / Selesai Ujian, 5.7 Anti-Kecurangan Dasar, 📅 FASE 5 — Mesin Ujian (Core Engine) ⭐⭐⭐ (2–3 minggu) (+3 more)

### Community 62 - "ujian/[ujianId]/page.tsx"
Cohesion: 0.19
Nodes (13): BagianUjian, ExamRoomPage(), ExamState, isEssayType(), isIsianType(), isMultiSelectType(), isOpsiType(), Option (+5 more)

### Community 64 - "seed_local_demo.py"
Cohesion: 0.10
Nodes (20): Run migrations in 'offline' mode., Run migrations in 'online' mode., run_migrations_offline(), run_migrations_online(), BagianPaket, Base, GrupTryout, Base (+12 more)

### Community 65 - "🚀 QUICK START - Deploy Critical Fixes"
Cohesion: 0.22
Nodes (8): 1️⃣ Run Database Migrations, 2️⃣ Restart Backend, 3️⃣ Start Auto-Submit Scheduler, 🎉 Done!, 📚 Full Documentation, Langkah Cepat (5 menit), 🚀 QUICK START - Deploy Critical Fixes, ✅ Verification

### Community 66 - "Subtasks:"
Cohesion: 0.22
Nodes (9): 3.1 CRUD Program, 3.2 CRUD Pelajaran, 3.3 CRUD Siswa, 3.4 CRUD Soal (PENTING!), 3.5 CRUD Opsi Jawaban, 3.6 CRUD Paket Ujian, 📅 FASE 3 — CRUD Master Data (1–2 minggu), Output Fase 3: (+1 more)

### Community 67 - "📅 FASE 8 — Frontend Lengkap (Paralel dengan Fase 3-7, atau setelahnya) (3–4 minggu)"
Cohesion: 0.22
Nodes (9): 8.1 Setup & Auth (1 minggu), 8.2 Panel Admin/Guru (2 minggu), 8.3 Panel Siswa (1.5 minggu), 8.4 Responsive & Polish (0.5-1 minggu), 📅 FASE 8 — Frontend Lengkap (Paralel dengan Fase 3-7, atau setelahnya) (3–4 minggu), Output Fase 8:, Prioritas Komponen:, Struktur: (+1 more)

### Community 68 - "index.ts"
Cohesion: 0.16
Nodes (20): emptyForm, FormState, GuruScope, LocalOpsi, LocalPernyataan, OPSI_LABEL, opsiBenarSalah(), opsiDefault() (+12 more)

### Community 69 - "🔄 Request Flow: Sistem Ujian (Core)"
Cohesion: 0.15
Nodes (13): 1. Siswa Lihat Jadwal Ujian, 2. Siswa Klik "Mulai Ujian", 3. Siswa Lihat Soal, 4. Siswa Pilih Jawaban (Autosave), 5. Siswa Refresh / Disconnect → Resume, 6. Siswa Selesai / Waktu Habis → Submit, 7. Scoring (Phase 6, automated), 🔐 Authentication & Authorization Flow (+5 more)

### Community 70 - "siswa/jadwal-ujian/page.tsx"
Cohesion: 0.24
Nodes (8): BagianTersedia, ctaConfig(), formatDurasi(), formatTanggalRingkas(), Jadwal, JadwalSiswaPage(), tipeIcon(), tipeLabel()

### Community 72 - "Phase 1 — Backend & Database Setup — Completion Report"
Cohesion: 0.29
Nodes (6): How to run the app locally, Notes & Next Steps, Phase 1 — Backend & Database Setup — Completion Report, Summary, Tests, What's included

### Community 73 - "11. Acceptance Criteria Frontend Siswa"
Cohesion: 0.29
Nodes (7): 11.1 Login, 11.2 Dashboard dan jadwal, 11.3 Mulai dan resume, 11.4 Ruang ujian, 11.5 Submit dan hasil, 11.6 Mobile, 11. Acceptance Criteria Frontend Siswa

### Community 74 - "📅 FASE 9 — Testing & QA (2 minggu)"
Cohesion: 0.29
Nodes (7): 📅 FASE 9 — Testing & QA (2 minggu), Integration Testing:, Load Testing:, Manual Testing — Skenario Gangguan:, Output Fase 9:, Unit Testing (Backend):, User Acceptance Test (UAT):

### Community 75 - "routers/ujian_siswa.py"
Cohesion: 0.12
Nodes (28): get_settings(), get_current_active_user(), require_role(), require_roles(), get_db(), create_app(), JawabanSiswa, Base (+20 more)

### Community 76 - "getErrorMessage"
Cohesion: 0.10
Nodes (20): Laporan, LaporanSoalPage(), GuruTambahSoalPage(), formatDurasi(), formatTanggal(), Jadwal, Riwayat, SiswaDashboard (+12 more)

### Community 77 - "Perubahan kebutuhan client — 17 September 2026"
Cohesion: 0.40
Nodes (5): Konfirmasi pengguna, Pekerjaan yang masih perlu diselesaikan, Pemeriksaan browser, Perubahan kebutuhan client — 17 September 2026, Sudah tersedia dalam perubahan ini

### Community 79 - "Data dummy lokal"
Cohesion: 0.40
Nodes (4): Data dummy lokal, Isi, Mulai mencoba, Verifikasi

### Community 80 - "12. Kebutuhan Nonfungsional"
Cohesion: 0.40
Nodes (5): 12.1 Keamanan, 12.2 Reliabilitas, 12.3 Performa, 12.4 Aksesibilitas, 12. Kebutuhan Nonfungsional

### Community 81 - "🐛 Known Issues & Notes"
Cohesion: 0.40
Nodes (5): Environment / Repo Notes:, Grouping Tryout (2026-08-12):, 🐛 Known Issues & Notes, Phase 7 (Ujian Engine) — Key Points:, Phase 8 (Frontend) — Key Points (update 2026-08-19):

### Community 82 - "📅 FASE 7 — Dashboard & Monitoring (1–2 minggu)"
Cohesion: 0.40
Nodes (5): Dashboard Admin/Guru:, Dashboard Siswa:, 📅 FASE 7 — Dashboard & Monitoring (1–2 minggu), Output Fase 7:, Pengaturan Sistem:

### Community 83 - "📅 FASE 6 — Scoring & Hasil Ujian (1 minggu)"
Cohesion: 0.40
Nodes (5): Endpoints:, 📅 FASE 6 — Scoring & Hasil Ujian (1 minggu), Output Fase 6:, Scoring Logic:, Subtasks:

### Community 84 - "Badge.tsx"
Cohesion: 0.40
Nodes (3): BadgeProps, BadgeTone, TONES

### Community 85 - "admin/monitoring-ujian/page.tsx"
Cohesion: 0.33
Nodes (4): formatSisa(), LogKecurangan, Monitoring, MonitoringUjianPage()

### Community 88 - "10. State yang Wajib Ditangani Frontend"
Cohesion: 0.50
Nodes (4): 10.1 Global, 10.2 Jadwal, 10.3 Attempt, 10. State yang Wajib Ditangani Frontend

### Community 89 - "3. Persona dan Otorisasi"
Cohesion: 0.50
Nodes (4): 3.1 Identitas siswa, 3.2 Siswa boleh, 3.3 Siswa tidak boleh, 3. Persona dan Otorisasi

### Community 90 - "📅 FASE 2 — Authentication & Otorisasi (1 minggu)"
Cohesion: 0.50
Nodes (4): Endpoints:, 📅 FASE 2 — Authentication & Otorisasi (1 minggu), Output Fase 2:, Subtasks:

### Community 91 - "📅 FASE 4 — Jadwal Ujian (3–5 hari)"
Cohesion: 0.50
Nodes (4): Endpoints:, 📅 FASE 4 — Jadwal Ujian (3–5 hari), Output Fase 4:, Subtasks:

### Community 93 - "next.config.mjs"
Cohesion: 0.50
Nodes (3): base, collections, nextConfig

### Community 95 - "conftest.py"
Cohesion: 0.40
Nodes (3): isolated_database(), fixture, Run API tests against a disposable database, never the local app database.

### Community 96 - "_authorize_ujian_log"
Cohesion: 0.27
Nodes (10): _authorize_ujian_log(), create_log_kecurangan(), get_log_kecurangan(), list_log_kecurangan(), get, post, Session, LogKecuranganCreate (+2 more)

### Community 99 - "📝 Completed Deliverables"
Cohesion: 0.67
Nodes (3): 📝 Completed Deliverables, Phase 0:, Phase 1+:

### Community 100 - "✅ PHASE 2 — Authentication & Otorisasi (Target: 1 minggu)"
Cohesion: 0.67
Nodes (3): Deliverables:, Key Endpoints:, ✅ PHASE 2 — Authentication & Otorisasi (Target: 1 minggu)

### Community 101 - "✅ PHASE 4 — Jadwal Ujian (Target: 3-5 hari)"
Cohesion: 0.67
Nodes (3): Deliverables:, Key Endpoints:, ✅ PHASE 4 — Jadwal Ujian (Target: 3-5 hari)

### Community 102 - "✅ PHASE 5 — Mesin Ujian (Core Engine) ⭐⭐⭐ (Target: 2-3 minggu)"
Cohesion: 0.67
Nodes (3): Deliverables:, Key Endpoints:, ✅ PHASE 5 — Mesin Ujian (Core Engine) ⭐⭐⭐ (Target: 2-3 minggu)

### Community 103 - "✅ PHASE 6 — Scoring & Hasil Ujian (Target: 1 minggu)"
Cohesion: 0.67
Nodes (3): Deliverables:, Key Endpoints:, ✅ PHASE 6 — Scoring & Hasil Ujian (Target: 1 minggu)

### Community 104 - "✅ PHASE 7 — Dashboard & Monitoring (Target: 1-2 minggu)"
Cohesion: 0.67
Nodes (3): Deliverables:, Key Endpoints:, ✅ PHASE 7 — Dashboard & Monitoring (Target: 1-2 minggu)

### Community 105 - "✅ PHASE 1 — Backend & Database Setup (Target: 1-2 minggu)"
Cohesion: 0.67
Nodes (3): Deliverables (completed):, Key Files:, ✅ PHASE 1 — Backend & Database Setup (Target: 1-2 minggu)

### Community 106 - "📅 FASE 1 — Setup Backend & Database (1–2 minggu)"
Cohesion: 0.67
Nodes (3): 📅 FASE 1 — Setup Backend & Database (1–2 minggu), Output Fase 1:, Subtasks:

### Community 115 - "User"
Cohesion: 0.10
Nodes (35): get_password_hash(), Base, User, ensure_user(), create_user(), test_failed_login_can_be_retried_and_is_rate_limited(), test_refresh_rotation_and_reuse_revokes_token_family(), setup_users_and_subjects() (+27 more)

### Community 117 - "Revisi client — 16 September 2026"
Cohesion: 0.40
Nodes (5): Kebutuhan jelas yang belum dikerjakan pada tahap ini, Menunggu jawaban client, Revisi client — 16 September 2026, Sudah diimplementasikan: bank soal guru dan subbab, Sudah diimplementasikan: profil siswa

### Community 118 - "api"
Cohesion: 0.06
Nodes (58): BabSubbabPage(), emptyForm, KategoriUjianPage(), Kelas, KelasPage(), JawabanEsai, GrupTryout, GuruScope (+50 more)

### Community 119 - "Soal"
Cohesion: 0.17
Nodes (19): JadwalUjian, Base, PaketSoal, Base, PaketUjian, Base, Base, Soal (+11 more)

### Community 120 - "Kebutuhan client dan implementasi — 18 September 2026"
Cohesion: 0.50
Nodes (4): Implementasi, Kebutuhan client dan implementasi — 18 September 2026, Migrasi lokal, Uji browser

### Community 121 - "_enable_sqlite_fk"
Cohesion: 0.67
Nodes (3): _enable_sqlite_fk(), Aktifkan enforcement foreign key pada SQLite (default-nya off)., listens_for

## Knowledge Gaps
- **709 isolated node(s):** `FormState`, `emptyForm`, `DashboardData`, `Statistik`, `Analytics` (+704 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `User` to `routers/soal.py`, `seed_local_demo.py`, `routers/auth.py`, `test_package_hierarchy.py`, `routers/paket_ujian.py`, `Session`, `routers/ujian_siswa.py`, `routers/guru_scope.py`, `OpsiJawaban`, `utc_now`, `Pelajaran`, `Soal`, `routers/kategori_paket.py`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `get_db()` connect `routers/ujian_siswa.py` to `routers/soal.py`, `routers/grup_tryout.py`, `routers/auth.py`, `routers/program.py`, `routers/paket_ujian.py`, `routers/pengaturan.py`, `routers/kelas.py`, `routers/guru_scope.py`, `routers/jadwal_ujian.py`, `routers/opsi_jawaban.py`, `routers/pelajaran.py`, `routers/subbab.py`, `routers/bagian_paket.py`, `routers/kategori_paket.py`, `routers/topik.py`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `Pelajaran` connect `Pelajaran` to `routers/soal.py`, `seed_local_demo.py`, `test_package_hierarchy.py`, `routers/paket_ujian.py`, `routers/ujian_siswa.py`, `routers/guru_scope.py`, `OpsiJawaban`, `routers/pelajaran.py`, `scoring.py`, `routers/subbab.py`, `User`, `Soal`, `routers/bagian_paket.py`, `routers/topik.py`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `FormState`, `emptyForm`, `DashboardData` to the rest of the system?**
  _709 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `routers/soal.py` be split into smaller, more focused modules?**
  _Cohesion score 0.07199529826623567 - nodes in this community are weakly interconnected._
- **Should `Session` be split into smaller, more focused modules?**
  _Cohesion score 0.11193339500462535 - nodes in this community are weakly interconnected._
- **Should `routers/auth.py` be split into smaller, more focused modules?**
  _Cohesion score 0.08020050125313283 - nodes in this community are weakly interconnected._