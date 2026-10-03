from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.security import guru_accessible_package_ids, require_roles
from app.core.timeutils import ensure_utc, utc_now
from app.db.database import get_db
from app.models.hasil_ujian import HasilUjian
from app.models.jadwal_ujian import JadwalUjian
from app.models.jawaban_siswa import JawabanSiswa
from app.models.kategori_paket import KategoriPaket
from app.models.bagian_paket import BagianPaket
from app.models.log_kecurangan import LogKecurangan
from app.models.paket_ujian import PaketUjian
from app.models.pelajaran import Pelajaran
from app.models.soal import Soal
from app.models.siswa import Siswa
from app.models.ujian_siswa import UjianSiswa
from app.schemas.dashboard import (
    DashboardAdminOut,
    RataRataSkalaOut,
    DashboardHasilSiswaOut,
    DashboardLogKecuranganOut,
    DashboardStatistikOut,
    HasilAnalyticsOut,
    MonitoringUjianOut,
    PerluTindakanItem,
    PerluTindakanOut,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _is_latihan(ujian: UjianSiswa, paket: PaketUjian) -> bool:
    # Latihan mandiri (paket latihan atau latihan per-mapel dari paket tryout)
    # tidak diawasi, jadi tidak ikut monitoring ujian.
    return paket.tipe == "latihan" or ujian.latihan_bagian_id is not None


def _kategori_label(paket: PaketUjian, kategori_map: dict) -> tuple[Optional[int], Optional[str]]:
    kategori = kategori_map.get(paket.kategori_id)
    if kategori:
        return kategori.id, kategori.nama
    return paket.kategori_id, paket.kategori


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


@router.get("/perlu-tindakan", response_model=PerluTindakanOut)
def get_perlu_tindakan(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    """Pengajuan yang menunggu keputusan admin: soal, set soal paket, jadwal.
    Setiap item membawa tautan langsung ke halaman untuk memprosesnya."""
    items: List[PerluTindakanItem] = []
    pelajaran_map = dict(db.query(Pelajaran.id, Pelajaran.nama).all())

    soal_rows = (
        db.query(Soal.pelajaran_id, func.count(Soal.id), func.min(Soal.submitted_for_review_at))
        .filter(Soal.status == "pending_review")
        .group_by(Soal.pelajaran_id)
        .all()
    )
    soal_pending = 0
    for pelajaran_id, jumlah, diajukan_at in sorted(soal_rows, key=lambda row: -row[1]):
        soal_pending += jumlah
        mapel = pelajaran_map.get(pelajaran_id, "Tanpa mapel")
        items.append(PerluTindakanItem(
            jenis="soal",
            id=pelajaran_id or 0,
            judul=f"{jumlah} soal {mapel} menunggu review",
            keterangan="Pengajuan soal dari guru",
            diajukan_at=diajukan_at,
            href="/admin/review-soal",
        ))

    bagian_rows = (
        db.query(BagianPaket, PaketUjian)
        .join(PaketUjian, PaketUjian.id == BagianPaket.paket_ujian_id)
        .filter(BagianPaket.status == "pending_review", PaketUjian.is_archived == False)
        .order_by(BagianPaket.submitted_for_review_at.asc(), BagianPaket.id.asc())
        .all()
    )
    for bagian, paket in bagian_rows:
        if paket.tipe == "latihan" and bagian.pelajaran_id:
            href = f"/admin/paket-ujian/set-soal?id={paket.id}&pelajaran_id={bagian.pelajaran_id}"
        else:
            kategori = paket.kategori_id if paket.kategori_id is not None else "belum"
            href = f"/admin/paket-ujian?tipe={paket.tipe}&kategori_id={kategori}&paket_id={paket.id}"
        items.append(PerluTindakanItem(
            jenis="set_soal",
            id=bagian.id,
            judul=f"Set soal {bagian.nama} menunggu persetujuan",
            keterangan=f"Paket {paket.nama}",
            diajukan_at=bagian.submitted_for_review_at,
            href=href,
        ))

    jadwal_rows = (
        db.query(JadwalUjian, PaketUjian)
        .join(PaketUjian, PaketUjian.id == JadwalUjian.paket_ujian_id)
        .filter(JadwalUjian.status == "pending_review", JadwalUjian.is_deleted.isnot(True))
        .order_by(JadwalUjian.submitted_for_review_at.asc(), JadwalUjian.id.asc())
        .all()
    )
    for jadwal, paket in jadwal_rows:
        items.append(PerluTindakanItem(
            jenis="jadwal",
            id=jadwal.id,
            judul=f"Jadwal {paket.nama} menunggu persetujuan",
            keterangan="Pengajuan jadwal try out",
            diajukan_at=jadwal.submitted_for_review_at,
            href="/admin/review-jadwal",
        ))

    return PerluTindakanOut(
        soal_pending=soal_pending,
        set_soal_pending=len(bagian_rows),
        jadwal_pending=len(jadwal_rows),
        items=items,
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


def _ringkasan_nilai_per_skala(db: Session) -> List[RataRataSkalaOut]:
    """Nilai biasa (0-100) dan kohort (TKA 200-800 / UTBK 0-1000) dirata-rata
    terpisah. Sama seperti rekap: latihan per mapel dari try out dan drilling
    tidak ikut."""
    rows = (
        db.query(HasilUjian.skor, HasilUjian.skor_per_pelajaran_json)
        .join(UjianSiswa, HasilUjian.ujian_siswa_id == UjianSiswa.id)
        .join(PaketUjian, UjianSiswa.paket_ujian_id == PaketUjian.id)
        .filter(
            HasilUjian.skor.isnot(None),
            or_(PaketUjian.tipe != "ujian", UjianSiswa.latihan_bagian_id.is_(None)),
            or_(UjianSiswa.mode_latihan.is_(None), UjianSiswa.mode_latihan != "drill"),
        )
        .all()
    )
    grup: dict[str, list[float]] = {}
    for skor, payload in rows:
        meta = (payload or {}).get("_meta", {})
        skala = "biasa" if meta.get("metode_penilaian") != "kohort" else ("tka" if meta.get("skala") == "tka" else "utbk")
        grup.setdefault(skala, []).append(float(skor))
    return [
        RataRataSkalaOut(skala=skala, jumlah=len(nilai), rata_rata=sum(nilai) / len(nilai), tertinggi=max(nilai), terendah=min(nilai))
        for skala in ("biasa", "tka", "utbk")
        if (nilai := grup.get(skala))
    ]


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

    biasa = next((item for item in _ringkasan_nilai_per_skala(db) if item.skala == "biasa"), None)
    rata_rata_nilai = biasa.rata_rata if biasa else None
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
    current_user=Depends(require_roles(["admin"])),
):
    siswa_map = {siswa.id: siswa for siswa in db.query(Siswa).all()}
    paket_map = {paket.id: paket for paket in db.query(PaketUjian).all()}
    kategori_map = {kategori.id: kategori for kategori in db.query(KategoriPaket).all()}
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
        if siswa is None or paket is None or _is_latihan(ujian, paket):
            continue
        kategori_id, kategori_nama = _kategori_label(paket, kategori_map)
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
                kategori_id=kategori_id,
                kategori_nama=kategori_nama,
            )
        )
    return rows


@router.get("/log-kecurangan", response_model=List[DashboardLogKecuranganOut])
def get_dashboard_log_kecurangan(
    ujian_siswa_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    query = db.query(LogKecurangan)
    if ujian_siswa_id is not None:
        query = query.filter(LogKecurangan.ujian_siswa_id == ujian_siswa_id)

    ujian_map = {ujian.id: ujian for ujian in db.query(UjianSiswa).all()}
    siswa_map = {siswa.id: siswa for siswa in db.query(Siswa).all()}
    paket_map = {paket.id: paket for paket in db.query(PaketUjian).all()}
    kategori_map = {kategori.id: kategori for kategori in db.query(KategoriPaket).all()}
    rows: List[DashboardLogKecuranganOut] = []
    for log in query.order_by(LogKecurangan.created_at.desc()).all():
        ujian = ujian_map.get(log.ujian_siswa_id)
        siswa = siswa_map.get(ujian.siswa_id) if ujian else None
        paket = paket_map.get(ujian.paket_ujian_id) if ujian else None
        if ujian and paket and _is_latihan(ujian, paket):
            continue
        kategori_id, kategori_nama = _kategori_label(paket, kategori_map) if paket else (None, None)
        rows.append(
            DashboardLogKecuranganOut(
                id=log.id,
                ujian_siswa_id=log.ujian_siswa_id,
                siswa_id=siswa.id if siswa else None,
                nama_siswa=siswa.nama_lengkap if siswa else None,
                tipe_kecurangan=log.tipe_kecurangan,
                deskripsi=log.deskripsi,
                created_at=log.created_at,
                paket_ujian_id=paket.id if paket else None,
                nama_paket=paket.nama if paket else None,
                kategori_id=kategori_id,
                kategori_nama=kategori_nama,
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
    # Rekap hanya pengerjaan resmi: latihan per mapel dari paket try out dan sesi
    # drilling (tidak masuk riwayat) tidak boleh menggandakan siswa di rekap.
    query = query.filter(
        or_(PaketUjian.tipe != "ujian", UjianSiswa.latihan_bagian_id.is_(None)),
        or_(UjianSiswa.mode_latihan.is_(None), UjianSiswa.mode_latihan != "drill"),
    )
    if current_user.role == "guru":
        paket_ids = guru_accessible_package_ids(db, current_user, [row.id for row in db.query(PaketUjian.id).all()])
        query = query.filter(PaketUjian.id.in_(paket_ids or [-1]))
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
                kkm=paket.kkm if paket.kkm is not None else 75,
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
    per_skala = _ringkasan_nilai_per_skala(db)
    biasa = next((item for item in per_skala if item.skala == "biasa"), None)
    rata_rata_nilai = biasa.rata_rata if biasa else None
    nilai_tertinggi = biasa.tertinggi if biasa else None
    nilai_terendah = biasa.terendah if biasa else None
    # Lulus = skor >= KKM paket masing-masing; paket kohort (skala 0-1000) tidak dihitung.
    jumlah_lulus_75 = (
        db.query(HasilUjian)
        .join(UjianSiswa, HasilUjian.ujian_siswa_id == UjianSiswa.id)
        .join(PaketUjian, UjianSiswa.paket_ujian_id == PaketUjian.id)
        .filter(PaketUjian.metode_penilaian != "kohort", HasilUjian.skor >= func.coalesce(PaketUjian.kkm, 75))
        .count()
    )
    return HasilAnalyticsOut(
        jumlah_hasil=jumlah_hasil,
        rata_rata_nilai=float(rata_rata_nilai) if rata_rata_nilai is not None else None,
        nilai_tertinggi=float(nilai_tertinggi) if nilai_tertinggi is not None else None,
        nilai_terendah=float(nilai_terendah) if nilai_terendah is not None else None,
        jumlah_lulus_75=jumlah_lulus_75,
        rata_rata_per_skala=per_skala,
    )
