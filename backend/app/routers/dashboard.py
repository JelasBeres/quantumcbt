from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.core.timeutils import ensure_utc, utc_now
from app.db.database import get_db
from app.models.hasil_ujian import HasilUjian
from app.models.jadwal_ujian import JadwalUjian
from app.models.jawaban_siswa import JawabanSiswa
from app.models.log_kecurangan import LogKecurangan
from app.models.paket_ujian import PaketUjian
from app.models.siswa import Siswa
from app.models.ujian_siswa import UjianSiswa
from app.schemas.dashboard import (
    DashboardAdminOut,
    DashboardHasilSiswaOut,
    DashboardLogKecuranganOut,
    DashboardStatistikOut,
    HasilAnalyticsOut,
    MonitoringUjianOut,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/admin", response_model=DashboardAdminOut)
def get_dashboard_admin(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    total_ujian_selesai = db.query(UjianSiswa).filter(UjianSiswa.is_submitted == True).count()
    total_ujian_aktif = db.query(UjianSiswa).filter(UjianSiswa.is_submitted == False).count()
    return DashboardAdminOut(
        total_siswa=db.query(Siswa).count(),
        total_paket=db.query(PaketUjian).count(),
        total_jadwal=db.query(JadwalUjian).filter(JadwalUjian.is_deleted == False).count(),
        total_ujian_aktif=total_ujian_aktif,
        total_ujian_selesai=total_ujian_selesai,
    )


def _sisa_waktu_detik(ujian: UjianSiswa, paket: PaketUjian) -> int:
    started_at = ensure_utc(ujian.started_at)
    if started_at is None:
        return 0
    selesai = started_at + timedelta(minutes=paket.durasi_menit)
    return max(0, int((selesai - utc_now()).total_seconds()))


def _status_ujian(ujian: UjianSiswa, paket: PaketUjian) -> str:
    if ujian.is_submitted:
        return "selesai"
    if _sisa_waktu_detik(ujian, paket) <= 0:
        return "timeout"
    return "sedang"


@router.get("/statistik", response_model=DashboardStatistikOut)
def get_dashboard_statistik(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    paket_map = {paket.id: paket for paket in db.query(PaketUjian).all()}
    ujian_berjalan = 0
    for ujian in db.query(UjianSiswa).filter(UjianSiswa.is_submitted == False).all():
        paket = paket_map.get(ujian.paket_ujian_id)
        if paket and _status_ujian(ujian, paket) == "sedang":
            ujian_berjalan += 1

    rata_rata_nilai = db.query(func.avg(HasilUjian.skor)).scalar()
    return DashboardStatistikOut(
        total_siswa=db.query(Siswa).count(),
        total_paket_ujian=db.query(PaketUjian).count(),
        total_jadwal_published=(
            db.query(JadwalUjian)
            .filter(JadwalUjian.is_published == True, JadwalUjian.is_deleted == False)
            .count()
        ),
        ujian_berjalan=ujian_berjalan,
        rata_rata_nilai=float(rata_rata_nilai) if rata_rata_nilai is not None else None,
    )


@router.get("/monitoring-ujian", response_model=List[MonitoringUjianOut])
def get_monitoring_ujian(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    siswa_map = {siswa.id: siswa for siswa in db.query(Siswa).all()}
    paket_map = {paket.id: paket for paket in db.query(PaketUjian).all()}
    jawaban_count = {}
    ragu_count = {}
    for ujian in db.query(UjianSiswa).all():
        jawaban_count[ujian.id] = 0
        ragu_count[ujian.id] = 0
    for jawaban, ujian_id in db.query(JawabanSiswa.jawaban, JawabanSiswa.ujian_siswa_id).all():
        if jawaban and str(jawaban).strip():
            jawaban_count[ujian_id] = jawaban_count.get(ujian_id, 0) + 1
    for is_ragu, ujian_id in db.query(JawabanSiswa.is_ragu, JawabanSiswa.ujian_siswa_id).filter(JawabanSiswa.is_ragu == True).all():
        ragu_count[ujian_id] = ragu_count.get(ujian_id, 0) + 1
    rows: List[MonitoringUjianOut] = []

    for ujian in db.query(UjianSiswa).all():
        siswa = siswa_map.get(ujian.siswa_id)
        paket = paket_map.get(ujian.paket_ujian_id)
        if siswa is None or paket is None:
            continue
        sisa_waktu = _sisa_waktu_detik(ujian, paket)
        status = _status_ujian(ujian, paket)
        rows.append(
            MonitoringUjianOut(
                ujian_siswa_id=ujian.id,
                siswa_id=siswa.id,
                nama_siswa=siswa.nama_lengkap,
                paket_ujian_id=paket.id,
                nama_paket=paket.nama,
                jadwal_ujian_id=ujian.jadwal_ujian_id,
                started_at=ujian.started_at,
                finished_at=ujian.finished_at,
                status=status,
                sisa_waktu_detik=sisa_waktu,
                jumlah_soal=len(ujian.soal_urutan or []),
                terjawab=jawaban_count.get(ujian.id, 0),
                jumlah_ragu=ragu_count.get(ujian.id, 0),
            )
        )
    return rows


@router.get("/log-kecurangan", response_model=List[DashboardLogKecuranganOut])
def get_dashboard_log_kecurangan(
    ujian_siswa_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    query = db.query(LogKecurangan)
    if ujian_siswa_id is not None:
        query = query.filter(LogKecurangan.ujian_siswa_id == ujian_siswa_id)

    ujian_map = {ujian.id: ujian for ujian in db.query(UjianSiswa).all()}
    siswa_map = {siswa.id: siswa for siswa in db.query(Siswa).all()}
    rows: List[DashboardLogKecuranganOut] = []
    for log in query.order_by(LogKecurangan.created_at.desc()).all():
        ujian = ujian_map.get(log.ujian_siswa_id)
        siswa = siswa_map.get(ujian.siswa_id) if ujian else None
        rows.append(
            DashboardLogKecuranganOut(
                id=log.id,
                ujian_siswa_id=log.ujian_siswa_id,
                siswa_id=siswa.id if siswa else None,
                nama_siswa=siswa.nama_lengkap if siswa else None,
                tipe_kecurangan=log.tipe_kecurangan,
                deskripsi=log.deskripsi,
                created_at=log.created_at,
            )
        )
    return rows


@router.get("/hasil-siswa", response_model=List[DashboardHasilSiswaOut])
def get_dashboard_hasil_siswa(
    siswa_id: Optional[int] = None,
    paket_ujian_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    query = (
        db.query(HasilUjian, UjianSiswa, Siswa, PaketUjian)
        .join(UjianSiswa, HasilUjian.ujian_siswa_id == UjianSiswa.id)
        .join(Siswa, UjianSiswa.siswa_id == Siswa.id)
        .join(PaketUjian, UjianSiswa.paket_ujian_id == PaketUjian.id)
    )
    if siswa_id is not None:
        query = query.filter(Siswa.id == siswa_id)
    if paket_ujian_id is not None:
        query = query.filter(PaketUjian.id == paket_ujian_id)

    rows: List[DashboardHasilSiswaOut] = []
    for hasil, ujian, siswa, paket in query.order_by(HasilUjian.calculated_at.desc()).all():
        rows.append(
            DashboardHasilSiswaOut(
                hasil_ujian_id=hasil.id,
                ujian_siswa_id=ujian.id,
                siswa_id=siswa.id,
                nama_siswa=siswa.nama_lengkap,
                no_induk=siswa.no_induk,
                paket_ujian_id=paket.id,
                nama_paket=paket.nama,
                jadwal_ujian_id=ujian.jadwal_ujian_id,
                skor=hasil.skor,
                metode_penilaian=(hasil.skor_per_pelajaran_json or {}).get("_meta", {}).get("metode_penilaian", paket.metode_penilaian or "biasa"),
                kohort_status=(hasil.skor_per_pelajaran_json or {}).get("_meta", {}).get("kohort_status"),
                skala=(hasil.skor_per_pelajaran_json or {}).get("_meta", {}).get("skala"),
                skor_mentah=(hasil.skor_per_pelajaran_json or {}).get("_meta", {}).get("skor_mentah"),
                metadata=(hasil.skor_per_pelajaran_json or {}).get("_meta"),
                calculated_at=hasil.calculated_at,
            )
        )
    return rows


@router.get("/hasil-analytics", response_model=HasilAnalyticsOut)
def get_hasil_analytics(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    jumlah_hasil = db.query(HasilUjian).count()
    rata_rata_nilai = db.query(func.avg(HasilUjian.skor)).scalar()
    nilai_tertinggi = db.query(func.max(HasilUjian.skor)).scalar()
    nilai_terendah = db.query(func.min(HasilUjian.skor)).scalar()
    jumlah_lulus_75 = db.query(HasilUjian).filter(HasilUjian.skor >= 75).count()
    return HasilAnalyticsOut(
        jumlah_hasil=jumlah_hasil,
        rata_rata_nilai=float(rata_rata_nilai) if rata_rata_nilai is not None else None,
        nilai_tertinggi=float(nilai_tertinggi) if nilai_tertinggi is not None else None,
        nilai_terendah=float(nilai_terendah) if nilai_terendah is not None else None,
        jumlah_lulus_75=jumlah_lulus_75,
    )
