# 🚀 QUICK START - Deploy Critical Fixes

## Langkah Cepat (5 menit)

### 1️⃣ Run Database Migrations
```powershell
cd "C:\Users\Rayhan Tama\Desktop\CBT\backend"
.\venv\Scripts\Activate.ps1
alembic upgrade head
```

### 2️⃣ Restart Backend
```powershell
# CTRL+C di terminal backend yang running
# Lalu restart:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3️⃣ Start Auto-Submit Scheduler
```powershell
# Di terminal baru:
cd "C:\Users\Rayhan Tama\Desktop\CBT\backend"
.\venv\Scripts\Activate.ps1
python app\scripts\scheduler.py
```

## ✅ Verification

Test auto-submit:
```powershell
python -m app.scripts.auto_submit_expired
```

Test race condition:
- Buka 2 browser tabs
- Login siswa yang sama
- Klik "Mulai Ujian" di kedua tab bersamaan
- Verifikasi: hanya 1 ujian dibuat ✅

## 📚 Full Documentation

- `CRITICAL_FIXES_GUIDE.md` - Detailed implementation guide
- `FIXES_SUMMARY.md` - Complete summary of all fixes

## 🎉 Done!

Semua critical bugs sudah fixed dan ready to deploy!
