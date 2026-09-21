# 🚀 Getting Started — CBT Quantum Research

Panduan lengkap untuk memulai development project ini.

---

## 📋 Prerequisites

Sebelum mulai, pastikan Anda sudah install:

- **Git** ([download](https://git-scm.com/))
- **Python 3.10+** ([download](https://www.python.org/downloads/))
- **PostgreSQL 13+** ([download](https://www.postgresql.org/download/))
- **Node.js 18+ & npm** ([download](https://nodejs.org/))
- **VS Code** (recommended IDE) ([download](https://code.visualstudio.com/))

**Verify instalasi:**
```bash
git --version
python --version
psql --version
node --version
npm --version
```

---

## 📁 Project Structure

```
CBT/
├── backend/              # FastAPI backend
├── frontend/             # React/Next.js frontend
└── docs/                 # Documentation
    ├── README.md         # Project overview
    ├── ROADMAP.md        # Lengkap 10 phases
    ├── PHASE_0_CHECKLIST.md
    ├── DATABASE.md       # Schema & design
    ├── ARCHITECTURE.md   # System architecture
    └── PROGRESS_TRACKER.md
```

---

## 🔧 Step-by-Step Setup

### Step 1: Clone Repository (Nanti)

```bash
cd Desktop
git clone <backend-repo-url>
cd CBT
```

### Step 2: Setup Backend Environment

```bash
# Enter backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

### Step 3: Setup PostgreSQL Database

```bash
# Connect ke PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE cbt_quantum_research_dev;

# Create user (opsional but recommended)
CREATE USER cbt_user WITH PASSWORD 'dev_password_123';
ALTER ROLE cbt_user SET client_encoding TO 'utf8';
ALTER ROLE cbt_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE cbt_user SET default_transaction_deferrable TO on;
GRANT ALL PRIVILEGES ON DATABASE cbt_quantum_research_dev TO cbt_user;

# Exit psql
\q
```

### Step 4: Setup Backend Environment Variables

```bash
# Copy template
cp .env.example .env

# Edit .env sesuai setting lokal
# Windows:
notepad .env
# macOS/Linux:
nano .env
```

**Minimal .env:**
```
DATABASE_URL=postgresql://cbt_user:dev_password_123@localhost:5432/cbt_quantum_research_dev
SECRET_KEY=your-super-secret-key-min-32-chars
DEBUG=true
```

### Step 5: Setup Database Schema (Phase 1+)

```bash
# Nanti saat Phase 1, jalankan migration:
alembic upgrade head
```

### Step 6: Run Backend Server

```bash
# Masih di folder backend, venv sudah activate
uvicorn app.main:app --reload

# Server akan jalan di: http://localhost:8000
# Docs API: http://localhost:8000/docs (Swagger UI)
```

### Step 7: Setup Frontend (Phase 8+)

```bash
# Dari root CBT folder
cd frontend

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local

# Run development server
npm run dev

# Frontend akan jalan di: http://localhost:3000
```

---

## 🧪 Testing Koneksi

### Test Backend API

```bash
# Gunakan Thunder Client atau Postman
# atau dari terminal:
curl -X GET http://localhost:8000/docs

# Jika berhasil, akan melihat Swagger UI
```

### Test Database

```bash
# Dari backend folder (dengan venv aktif)
python -c "from app.db.database import engine; print('Database connected!')"

# Atau:
psql -h localhost -U cbt_user -d cbt_quantum_research_dev -c "SELECT 1"
```

---

## 📝 Development Workflow

### Regular Development

```bash
# 1. Update ke latest code
git pull origin develop

# 2. Create feature branch
git checkout -b feature/my-feature

# 3. Make changes
# ... edit files ...

# 4. Test changes
# ... run tests ...

# 5. Commit
git add .
git commit -m "feat: description of changes"

# 6. Push
git push origin feature/my-feature

# 7. Create Pull Request di GitHub
```

### Running Tests

```bash
# Backend tests (Phase 9+)
cd backend
pytest

# With coverage:
pytest --cov=app

# Frontend tests (Phase 8+)
cd frontend
npm run test
```

---

## 🐛 Troubleshooting

### Python venv tidak activate

**Error:** `command not found: python` atau `'python' is not recognized`

**Solution:**
```bash
# Windows: gunakan full path
C:\Python310\python.exe -m venv venv
C:\Python310\python.exe -m pip install -r requirements.txt

# Atau pastikan Python sudah di PATH:
python --version
```

### PostgreSQL tidak connect

**Error:** `psycopg2.OperationalError: could not connect to server`

**Solution:**
```bash
# 1. Check PostgreSQL running
# Windows: Services → PostgreSQL
# macOS: brew services list
# Linux: systemctl status postgresql

# 2. Check connection string di .env
DATABASE_URL=postgresql://user:password@localhost:5432/database_name

# 3. Test connection
psql -h localhost -U postgres
```

### Port 8000 atau 3000 sudah terpakai

**Error:** `OSError: [WinError 10048] Address already in use`

**Solution:**
```bash
# Find process using port
# Windows:
netstat -ano | findstr :8000

# Kill process
taskkill /PID <PID> /F

# Or use different port:
uvicorn app.main:app --reload --port 8001
```

### Module not found error

**Error:** `ModuleNotFoundError: No module named 'fastapi'`

**Solution:**
```bash
# Make sure venv is activated
venv\Scripts\activate  # Windows
source venv/bin/activate  # macOS/Linux

# Install requirements
pip install -r requirements.txt
```

---

## 📚 Useful Commands

### Backend (Python/FastAPI)

```bash
# Activate venv
venv\Scripts\activate

# Install new package
pip install package_name

# Update requirements.txt
pip freeze > requirements.txt

# Run server with auto-reload
uvicorn app.main:app --reload

# Run with custom settings
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Run tests
pytest
pytest -v  # verbose
pytest --cov  # with coverage
```

### Frontend (Node.js/Next.js)

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run tests
npm run test

# Format code
npm run format

# Lint code
npm run lint
```

### Git

```bash
# Check status
git status

# View logs
git log --oneline

# Create branch
git checkout -b branch_name

# Switch branch
git checkout branch_name

# Merge branch (ke main/develop)
git merge branch_name

# Delete branch
git branch -d branch_name
```

---

## 🎯 Next Steps After Setup

1. **Read Documentation:**
   - Baca `AI_HANDOFF.md` (root) — **wajib untuk AI berikutnya**: status terkini & prioritas
   - Baca `README.md` untuk project overview
   - Baca `docs/ROADMAP.md` untuk timeline
   - Baca `docs/ARCHITECTURE.md` untuk system design
   - Baca `docs/PROGRESS_TRACKER.md` untuk status terkini

2. **Setup Complete:**
   - Verify backend & database berjalan
   - Verify frontend setup (Phase 8+)

3. **Start Development:**
   - Follow PHASE_0_CHECKLIST.md
   - Update PROGRESS_TRACKER.md weekly

4. **Contribute:**
   - Create feature branches (`feature/nama-fitur`)
   - Commit reguler dengan message yang jelas
   - Push ke remote repository
   - Create Pull Request untuk review

---

## 💡 Development Tips

- **Use VS Code Extensions:**
  - Python (Microsoft)
  - Pylance (Microsoft)
  - FastAPI (Starlite)
  - ES7+ React/Redux/React-Native snippets
  - Thunder Client (untuk API testing)

- **Database Management:**
  - Install DBeaver atau pgAdmin untuk manage database visually
  - Always backup database sebelum major changes

- **Git Best Practices:**
  - Commit frequently dengan message yang clear
  - Push regularly untuk backup
  - Review PR sebelum merge
  - Keep main/develop branches stable

- **Code Quality:**
  - Follow PEP 8 untuk Python
  - Use formatter: `black`
  - Use linter: `flake8`
  - Write tests untuk critical logic

---

## 📞 Need Help?

- Check documentation di `docs/` folder
- Create issue di GitHub repository
- Ask team members atau PM

---

## 🚀 Ready to Start?

```bash
# Verify everything is set up
python --version  # should be 3.10+
pip list | grep fastapi  # should exist
psql -U postgres -c "SELECT 1"  # should return 1

# Go to backend folder and start coding!
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload

# Go to frontend folder (Phase 8+)
cd frontend
npm run dev
```

**Happy coding! 🎉**

> **KILO / AI yang lanjut kerja?** Baca **[AI_HANDOFF.md](./AI_HANDOFF.md)** di root untuk status pengerjaan paling akurat dan prioritas selanjutnya.

---

Last Updated: 2026-08-18
