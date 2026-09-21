# Phase 1 — Backend & Database Setup — Completion Report

This document summarizes Phase 1 execution and provides links and commands to run the project and tests locally.

## Summary
- Phase 1 implemented the backend core for the CBT application using FastAPI, SQLAlchemy and PostgreSQL.
- Implemented models (13 tables), routers for key domains, Alembic migrations, an auto-grading flow, and integration tests.
- Alembic head revision applied: `d3a7cb98d79d`.

## What's included
- Authentication: `POST /auth/register`, `POST /auth/login`
- User & Siswa CRUD: `POST /siswa/`, `GET /siswa/{id}`
- Master data: `program`, `pelajaran`, `kelas` endpoints
- Exam domains: `paket-ujian`, `soal`, `ujian-siswa`, `jawaban-siswa`, `hasil-ujian`, `log-kecurangan`
- Auto-grading: `PATCH /ujian-siswa/{id}/submit` calculates and stores `hasil_ujian`.

## Tests
- Integration test covering registration, paket/soal creation, opsi insertion (via DB), ujian flow, submission and grading: `tests/test_phase1.py`.
- Run tests locally (from `backend/`):

```bash
venv\Scripts\activate.bat
python -m pytest -q
```

## How to run the app locally
1. Create and activate a Python virtualenv.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Ensure PostgreSQL is running and `.env` in `backend/` has correct `DATABASE_URL`.
4. Run Alembic (if needed):

```bash
python -m alembic upgrade head
```

5. Start the app:

```bash
uvicorn app.main:app --reload --port 8000
```

## Notes & Next Steps
- Phase 1 is complete; next immediate actions:
  - Add more tests (edge cases, permission checks).
  - Harden auth / role checks and implement `GET /auth/me` if desired.
  - Begin Phase 2+ (detailed exam engine features, frontend integration).


**Generated:** 2026-06-25
