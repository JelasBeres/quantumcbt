from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.routers import health
from app.db.database import engine
from app.models import base
from app.core.config import get_settings


def create_app() -> FastAPI:
    app = FastAPI(title="Quantum Research CBT API")

    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="127.0.0.1,::1")
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
    app.include_router(health.router)
    from app.routers import auth, users, siswa, paket_ujian, kategori_paket, soal, ujian_siswa, jawaban_siswa, hasil_ujian, log_kecurangan, pelajaran, kelas, program, login_activity, dashboard, pengaturan, topik, subbab, upload, laporan_soal, bagian_paket, paket_mapel, guru_scope
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(siswa.router)
    app.include_router(paket_ujian.router)
    app.include_router(kategori_paket.router)
    app.include_router(bagian_paket.router)
    app.include_router(paket_mapel.router)
    app.include_router(soal.router)
    app.include_router(ujian_siswa.router)
    app.include_router(jawaban_siswa.router)
    app.include_router(hasil_ujian.router)
    app.include_router(log_kecurangan.router)
    app.include_router(pelajaran.router)
    app.include_router(kelas.router)
    app.include_router(program.router)
    app.include_router(login_activity.router)
    app.include_router(dashboard.router)
    app.include_router(pengaturan.router)
    app.include_router(topik.router)
    app.include_router(subbab.router)
    app.include_router(upload.router)
    from app.routers import opsi_jawaban, jadwal_ujian
    app.include_router(opsi_jawaban.router)
    app.include_router(jadwal_ujian.router)
    app.include_router(laporan_soal.router)
    app.include_router(guru_scope.router)
    from app.routers import pemberitahuan
    app.include_router(pemberitahuan.router)
    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
