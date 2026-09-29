from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_active_user, get_password_hash, require_roles
from app.core.timeutils import ensure_utc, utc_now
from app.db.database import get_db
from app.models.bagian_paket import BagianPaket
from app.models.hasil_ujian import HasilUjian
from app.models.jadwal_ujian import JadwalUjian
from app.models.kelas import Kelas
from app.models.paket_soal import PaketSoal
from app.models.paket_ujian import PaketUjian
from app.models.pelajaran import Pelajaran
from app.models.program import Program
from app.models.siswa import Siswa
from app.models.ujian_siswa import UjianSiswa
from app.models.user import User
from app.services import import_siswa
from app.schemas.siswa import (
    BagianTersediaOut,
    SiswaCreate,
    SiswaDashboardOut,
    SiswaDenganAkun,
    SiswaJadwalTersediaOut,
    SiswaJadwalUjianOut,
    SiswaOut,
    SiswaProfilUpdate,
    SiswaRiwayatLatihanOut,
    SiswaRiwayatUjianOut,
)

router = APIRouter(prefix="/siswa", tags=["siswa"])


@router.get("/latihan")
def list_latihan(db: Session = Depends(get_db), current_user=Depends(require_roles(["siswa"]))):
    siswa = get_current_siswa_profile(db, current_user)
    rows = db.query(PaketUjian).filter(PaketUjian.tipe == "latihan", PaketUjian.is_archived == False).order_by(PaketUjian.id.desc()).all()
    bagian_soal_count = dict(
        db.query(PaketSoal.bagian_paket_id, func.count(PaketSoal.id))
        .filter(PaketSoal.bagian_paket_id.isnot(None))
        .group_by(PaketSoal.bagian_paket_id)
        .all()
    )
    pelajaran_map = {pelajaran.id: pelajaran.nama for pelajaran in db.query(Pelajaran).all()}
    return [{"id": p.id, "nama": p.nama, "deskripsi": p.deskripsi, "durasi_menit": p.durasi_menit, "jumlah_soal": p.jumlah_soal, "kategori": p.kategori_ref.kode if p.kategori_ref else p.kategori, "kategori_nama": p.kategori_ref.nama if p.kategori_ref else None,
             "bagian": [{"bagian_id": b.id, "nama": b.nama, "pelajaran_id": b.pelajaran_id, "pelajaran_nama": pelajaran_map.get(b.pelajaran_id), "durasi_menit": b.durasi_menit, "jumlah_soal": bagian_soal_count.get(b.id, 0)} for b in db.query(BagianPaket).filter(BagianPaket.paket_ujian_id == p.id).order_by(BagianPaket.urutan, BagianPaket.id).all()]}
            for p in rows if (p.program_id is None or p.program_id == siswa.program_id) and (p.kelas_id is None or p.kelas_id == siswa.kelas_id)
            and db.query(PaketSoal.id).filter(PaketSoal.paket_ujian_id == p.id).first()]


def get_current_siswa_profile(db: Session, current_user) -> Siswa:
    siswa = db.query(Siswa).filter(Siswa.user_id == current_user.id).first()
    if not siswa:
        raise HTTPException(status_code=404, detail="Siswa profile not found")
    return siswa


def jadwal_matches_siswa(jadwal: JadwalUjian, siswa: Siswa, paket: Optional[PaketUjian] = None) -> bool:
    """Try out hanya untuk program/kelas siswa. Jadwal tanpa program/kelas
    mengikuti program/kelas paketnya (sama seperti tampilan admin)."""
    program_id = jadwal.program_id if jadwal.program_id is not None else (paket.program_id if paket else None)
    kelas_id = jadwal.kelas_id if jadwal.kelas_id is not None else (paket.kelas_id if paket else None)
    if program_id is not None and program_id != siswa.program_id:
        return False
    if kelas_id is not None and kelas_id != siswa.kelas_id:
        return False
    return True


@router.post("/", response_model=SiswaOut)
def create_siswa(payload: SiswaCreate, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    siswa = Siswa(
        user_id=payload.user_id,
        nama_lengkap=payload.nama_lengkap,
        sekolah=payload.sekolah,
        pilihan_jurusan=[item.model_dump() for item in payload.pilihan_jurusan],
        no_induk=payload.no_induk,
        program_id=payload.program_id,
        kelas_id=payload.kelas_id,
    )
    db.add(siswa)
    db.commit()
    db.refresh(siswa)
    return siswa


@router.post("/register", response_model=SiswaOut)
def create_siswa_dengan_akun(
    payload: SiswaDenganAkun,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    """Buat akun user (role siswa) dan profil siswa sekaligus dalam satu transaksi."""
    existing = db.query(User).filter(func.lower(User.username) == payload.username.strip().lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username sudah terdaftar")

    user = User(
        username=payload.username,
        password_hash=get_password_hash(payload.password),
        role="siswa",
    )
    db.add(user)
    db.flush()

    siswa = Siswa(
        user_id=user.id,
        nama_lengkap=payload.nama_lengkap,
        sekolah=payload.sekolah,
        pilihan_jurusan=[item.model_dump() for item in payload.pilihan_jurusan],
        no_induk=payload.no_induk,
        program_id=payload.program_id,
        kelas_id=payload.kelas_id,
    )
    db.add(siswa)
    db.commit()
    db.refresh(siswa)
    return siswa


def _baca_upload(file: UploadFile) -> bytes:
    if file.filename and not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File harus berformat .csv")
    return file.file.read(import_siswa.MAKS_UKURAN + 1)


@router.post("/import/preview")
def preview_import_siswa(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    """Cek file CSV tanpa menyimpan apa pun: tiap baris diberi status siap/dilewati/error."""
    try:
        hasil = import_siswa.periksa(db, _baca_upload(file))
    except import_siswa.ImportError_ as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "siap": sum(1 for row in hasil if row["status"] == "siap"),
        "dilewati": sum(1 for row in hasil if row["status"] == "dilewati"),
        "error": sum(1 for row in hasil if row["status"] == "error"),
        "baris": import_siswa.publik(hasil),
    }


@router.post("/import")
def import_siswa_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    """Simpan baris berstatus 'siap' setelah admin konfirmasi. Dicek ulang di sini,
    jadi data yang keburu terdaftar sejak preview tetap dilewati."""
    try:
        return import_siswa.simpan(db, _baca_upload(file))
    except import_siswa.ImportError_ as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/", response_model=List[SiswaOut])
def list_siswa(db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    # Username ikut dikirim agar admin bisa melihat akun login saat reset password siswa.
    rows = db.query(Siswa).options(joinedload(Siswa.user)).all()
    return [SiswaOut(**SiswaOut.model_validate(s).model_dump(exclude={"username"}), username=s.user.username if s.user else None) for s in rows]


def _siswa_out_with_akademik(db: Session, siswa: Siswa) -> SiswaOut:
    program = db.query(Program).filter(Program.id == siswa.program_id).first() if siswa.program_id else None
    kelas = db.query(Kelas).filter(Kelas.id == siswa.kelas_id).first() if siswa.kelas_id else None
    return SiswaOut(
        **SiswaOut.model_validate(siswa).model_dump(exclude={"program_nama", "kelas_nama"}),
        program_nama=program.nama if program else None,
        kelas_nama=kelas.nama if kelas else None,
    )


@router.get("/profil", response_model=SiswaOut)
def read_own_profile(db: Session = Depends(get_db), current_user=Depends(require_roles(["siswa"]))):
    siswa = get_current_siswa_profile(db, current_user)
    return _siswa_out_with_akademik(db, siswa)


@router.patch("/profil", response_model=SiswaOut)
def update_own_profile(payload: SiswaProfilUpdate, db: Session = Depends(get_db), current_user=Depends(require_roles(["siswa"]))):
    siswa = get_current_siswa_profile(db, current_user)
    siswa.nama_lengkap = payload.nama_lengkap
    if "sekolah" in payload.model_fields_set:
        siswa.sekolah = payload.sekolah
    if "pilihan_jurusan" in payload.model_fields_set:
        siswa.pilihan_jurusan = [item.model_dump() for item in payload.pilihan_jurusan]
    db.commit()
    db.refresh(siswa)
    return _siswa_out_with_akademik(db, siswa)


@router.get("/dashboard", response_model=SiswaDashboardOut)
def get_siswa_dashboard(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    siswa = get_current_siswa_profile(db, current_user)
    now = utc_now()
    jadwal_list = (
        db.query(JadwalUjian)
        .filter(JadwalUjian.is_deleted == False, JadwalUjian.is_published == True)
        .all()
    )
    paket_map = {paket.id: paket for paket in db.query(PaketUjian).all()}
    jadwal_mendatang = [
        jadwal
        for jadwal in jadwal_list
        if jadwal_matches_siswa(jadwal, siswa, paket_map.get(jadwal.paket_ujian_id)) and ensure_utc(jadwal.selesai) >= now
    ]
    ujian_list = db.query(UjianSiswa).filter(UjianSiswa.siswa_id == siswa.id).all()
    hasil_list = (
        db.query(HasilUjian)
        .join(UjianSiswa, HasilUjian.ujian_siswa_id == UjianSiswa.id)
        .join(PaketUjian, UjianSiswa.paket_ujian_id == PaketUjian.id)
        .filter(PaketUjian.tipe == "ujian")
        .filter(UjianSiswa.siswa_id == siswa.id)
        .order_by(HasilUjian.calculated_at.desc())
        .all()
)
    program = db.query(Program).filter(Program.id == siswa.program_id).first() if siswa.program_id else None
    kelas = db.query(Kelas).filter(Kelas.id == siswa.kelas_id).first() if siswa.kelas_id else None

    return SiswaDashboardOut(
        siswa=siswa,
        jadwal_mendatang=len(jadwal_mendatang),
        ujian_aktif=len([ujian for ujian in ujian_list if not ujian.is_submitted]),
        riwayat_ujian=sum(1 for row in get_siswa_riwayat_ujian(db, current_user) if row.is_submitted),
        hasil_terakhir=hasil_list[0].skor if hasil_list else None,
        program_name=program.nama if program else None,
        kelas_name=kelas.nama if kelas else None,
    )


@router.get("/jadwal-ujian", response_model=List[SiswaJadwalUjianOut])
def get_siswa_jadwal_ujian(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    siswa = get_current_siswa_profile(db, current_user)
    paket_map = {paket.id: paket for paket in db.query(PaketUjian).all()}
    pelajaran_map = {pelajaran.id: pelajaran.nama for pelajaran in db.query(Pelajaran).all()}
    soal_count = {
        paket_id: count for paket_id, count in
        db.query(PaketSoal.paket_ujian_id, func.count(PaketSoal.id)).group_by(PaketSoal.paket_ujian_id).all()
    }
    now = utc_now()
    rows: List[SiswaJadwalUjianOut] = []
    jadwal_list = (
        db.query(JadwalUjian)
        .filter(JadwalUjian.is_deleted == False, JadwalUjian.is_published == True)
        .order_by(JadwalUjian.mulai.asc())
        .all()
    )
    for jadwal in jadwal_list:
        paket = paket_map.get(jadwal.paket_ujian_id)
        if not jadwal_matches_siswa(jadwal, siswa, paket):
            continue
        if not paket or paket.tipe != "ujian" or paket.is_archived:
            continue
        if ensure_utc(jadwal.mulai) > now:
            status = "mendatang"
        elif ensure_utc(jadwal.selesai) < now:
            status = "berakhir"
        else:
            status = "berlangsung"
        rows.append(
            SiswaJadwalUjianOut(
                jadwal_ujian_id=jadwal.id,
                paket_ujian_id=paket.id,
                nama_paket=paket.nama,
                mulai=jadwal.mulai,
                selesai=jadwal.selesai,
                is_published=jadwal.is_published,
                status=status,
                durasi_menit=paket.durasi_menit,
                jumlah_soal=soal_count.get(paket.id, paket.jumlah_soal or 0),
                pelajaran=pelajaran_map.get(paket.pelajaran_id) if paket.pelajaran_id else None,
                tipe=paket.tipe or "ujian",
                kategori=paket.kategori_ref.kode if paket.kategori_ref else paket.kategori,
                kategori_nama=paket.kategori_ref.nama if paket.kategori_ref else None,
                deskripsi_paket=paket.deskripsi,
                izinkan_pilih_mapel=paket.izinkan_pilih_mapel if paket.izinkan_pilih_mapel is not None else True,
            )
        )
    return rows


@router.get("/jadwal-tersedia", response_model=List[SiswaJadwalTersediaOut])
def get_siswa_jadwal_tersedia(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    """Daftar set latihan/ujian yang tersedia untuk siswa: dilengkapi durasi, jumlah soal,
    dan daftar bagian (sub-paket) per paket untuk navigasi ala Bisa Dan Edu."""
    siswa = get_current_siswa_profile(db, current_user)
    paket_map = {paket.id: paket for paket in db.query(PaketUjian).all()}
    pelajaran_map = {pelajaran.id: pelajaran.nama for pelajaran in db.query(Pelajaran).all()}
    bagian_map: Dict[int, List[BagianPaket]] = {}
    for bagian in db.query(BagianPaket).all():
        bagian_map.setdefault(bagian.paket_ujian_id, []).append(bagian)
    soal_count = {}
    for paket_id, count in db.query(PaketSoal.paket_ujian_id, func.count(PaketSoal.id)).group_by(PaketSoal.paket_ujian_id).all():
        soal_count[paket_id] = count
    bagian_soal_count = {
        bagian_id: count
        for bagian_id, count in (
            db.query(PaketSoal.bagian_paket_id, func.count(PaketSoal.id))
            .filter(PaketSoal.bagian_paket_id.isnot(None))
            .group_by(PaketSoal.bagian_paket_id)
            .all()
        )
    }
    now = utc_now()
    rows: List[SiswaJadwalTersediaOut] = []
    jadwal_list = (
        db.query(JadwalUjian)
        .filter(JadwalUjian.is_deleted == False, JadwalUjian.is_published == True)
        .order_by(JadwalUjian.mulai.asc())
        .all()
    )
    for jadwal in jadwal_list:
        paket = paket_map.get(jadwal.paket_ujian_id)
        if not jadwal_matches_siswa(jadwal, siswa, paket):
            continue
        if not paket or paket.tipe != "ujian" or paket.is_archived:
            continue
        if ensure_utc(jadwal.mulai) > now:
            status = "mendatang"
        elif ensure_utc(jadwal.selesai) < now:
            status = "berakhir"
        else:
            status = "berlangsung"
        bagian_list = sorted(bagian_map.get(paket.id, []), key=lambda b: (b.urutan, b.id))
        bagian_pelajaran_ids = {b.pelajaran_id for b in bagian_list if b.pelajaran_id is not None}
        if len(bagian_pelajaran_ids) > 1:
            kategori_pelajaran = "Campuran"
        elif paket.pelajaran_id is not None:
            kategori_pelajaran = pelajaran_map.get(paket.pelajaran_id, "Umum")
        elif len(bagian_pelajaran_ids) == 1:
            kategori_pelajaran = pelajaran_map.get(next(iter(bagian_pelajaran_ids)), "Umum")
        elif len(bagian_list) > 1:
            kategori_pelajaran = "Campuran"
        else:
            kategori_pelajaran = "Umum"
        rows.append(
            SiswaJadwalTersediaOut(
                jadwal_ujian_id=jadwal.id,
                paket_ujian_id=paket.id,
                nama_paket=paket.nama,
                mulai=jadwal.mulai,
                selesai=jadwal.selesai,
                is_published=jadwal.is_published,
                status=status,
                durasi_menit=paket.durasi_menit or 0,
                jumlah_soal=soal_count.get(paket.id, 0),
                pelajaran=kategori_pelajaran,
                tipe=paket.tipe or "ujian",
                kategori=paket.kategori_ref.kode if paket.kategori_ref else paket.kategori,
                kategori_nama=paket.kategori_ref.nama if paket.kategori_ref else None,
                deskripsi_paket=paket.deskripsi,
                izinkan_pilih_mapel=paket.izinkan_pilih_mapel if paket.izinkan_pilih_mapel is not None else True,
                bagian=[
                    BagianTersediaOut(
                        bagian_id=b.id,
                        nama=b.nama,
                        urutan=b.urutan,
                        jumlah_soal=bagian_soal_count.get(b.id, 0),
                        pelajaran_id=b.pelajaran_id,
                        pelajaran_nama=pelajaran_map.get(b.pelajaran_id),
                    )
                    for b in bagian_list
                ],
            )
        )
    return rows


@router.get("/riwayat-ujian", response_model=List[SiswaRiwayatUjianOut])
def get_siswa_riwayat_ujian(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    siswa = get_current_siswa_profile(db, current_user)
    paket_map = {paket.id: paket for paket in db.query(PaketUjian).all()}
    hasil_map = {
        hasil.ujian_siswa_id: hasil
        for hasil in (
            db.query(HasilUjian)
            .join(UjianSiswa, HasilUjian.ujian_siswa_id == UjianSiswa.id)
            .filter(UjianSiswa.siswa_id == siswa.id)
            .all()
        )
    }
    rows: List[SiswaRiwayatUjianOut] = []
    ujian_list = (
        db.query(UjianSiswa)
        .filter(UjianSiswa.siswa_id == siswa.id)
        .order_by(UjianSiswa.started_at.desc())
        .all()
    )
    for ujian in ujian_list:
        paket = paket_map.get(ujian.paket_ujian_id)
        if not paket or paket.tipe != "ujian":
            continue
        hasil = hasil_map.get(ujian.id)
        rows.append(
            SiswaRiwayatUjianOut(
                ujian_siswa_id=ujian.id,
                paket_ujian_id=paket.id,
                nama_paket=paket.nama,
                kategori=paket.kategori_ref.kode if paket.kategori_ref else paket.kategori,
                kategori_nama=paket.kategori_ref.nama if paket.kategori_ref else None,
                jadwal_ujian_id=ujian.jadwal_ujian_id,
                started_at=ujian.started_at,
                finished_at=ujian.finished_at,
                is_submitted=ujian.is_submitted,
                skor=hasil.skor if hasil else None,
                metode_penilaian=(hasil.skor_per_pelajaran_json or {}).get("_meta", {}).get("metode_penilaian", paket.metode_penilaian or "biasa") if hasil else (paket.metode_penilaian or "biasa"),
                kohort_status=(hasil.skor_per_pelajaran_json or {}).get("_meta", {}).get("kohort_status") if hasil else None,
                skala=(hasil.skor_per_pelajaran_json or {}).get("_meta", {}).get("skala") if hasil else None,
                skor_mentah=(hasil.skor_per_pelajaran_json or {}).get("_meta", {}).get("skor_mentah") if hasil else None,
                metadata=(hasil.skor_per_pelajaran_json or {}).get("_meta") if hasil else None,
            )
        )
    return rows


@router.get("/riwayat-latihan", response_model=List[SiswaRiwayatLatihanOut])
def get_siswa_riwayat_latihan(db: Session = Depends(get_db), current_user=Depends(require_roles(["siswa"]))):
    siswa = get_current_siswa_profile(db, current_user)
    # Latihan = tanpa jadwal: semua sesi paket latihan, plus latihan per-mapel
    # dari paket tryout (latihan_bagian_id terisi). Tryout berjadwal ada di
    # /riwayat-ujian. Sesi mode drilling tidak masuk riwayat (revisi client
    # tahap 2): pembahasannya sudah tampil per soal saat dikerjakan.
    ujian_list = (
        db.query(UjianSiswa)
        .join(PaketUjian, PaketUjian.id == UjianSiswa.paket_ujian_id)
        .filter(
            UjianSiswa.siswa_id == siswa.id,
            UjianSiswa.is_submitted == True,
            UjianSiswa.jadwal_ujian_id.is_(None),
            or_(UjianSiswa.mode_latihan.is_(None), UjianSiswa.mode_latihan != "drill"),
            or_(PaketUjian.tipe == "latihan", UjianSiswa.latihan_bagian_id.isnot(None)),
        )
        .order_by(UjianSiswa.finished_at.desc(), UjianSiswa.id.desc())
        .all()
    )
    if not ujian_list:
        return []
    paket_ids = {ujian.paket_ujian_id for ujian in ujian_list}
    paket_map = {paket.id: paket for paket in db.query(PaketUjian).filter(PaketUjian.id.in_(paket_ids)).all()}
    bagian_ids = {ujian.latihan_bagian_id for ujian in ujian_list if ujian.latihan_bagian_id is not None}
    bagian_map = {
        bagian.id: bagian
        for bagian in db.query(BagianPaket).filter(BagianPaket.id.in_(bagian_ids)).all()
    } if bagian_ids else {}
    pelajaran_ids = {bagian.pelajaran_id for bagian in bagian_map.values() if bagian.pelajaran_id is not None}
    pelajaran_map = dict(
        db.query(Pelajaran.id, Pelajaran.nama).filter(Pelajaran.id.in_(pelajaran_ids)).all()
    ) if pelajaran_ids else {}
    skor_map = dict(
        db.query(HasilUjian.ujian_siswa_id, HasilUjian.skor)
        .filter(HasilUjian.ujian_siswa_id.in_([ujian.id for ujian in ujian_list]))
        .all()
    )
    rows: List[SiswaRiwayatLatihanOut] = []
    for ujian in ujian_list:
        paket = paket_map[ujian.paket_ujian_id]
        bagian = bagian_map.get(ujian.latihan_bagian_id)
        rows.append(
            SiswaRiwayatLatihanOut(
                ujian_siswa_id=ujian.id,
                paket_ujian_id=paket.id,
                nama_paket=paket.nama,
                sumber="latihan" if paket.tipe == "latihan" else "tryout",
                kategori=paket.kategori_ref.kode if paket.kategori_ref else paket.kategori,
                kategori_nama=paket.kategori_ref.nama if paket.kategori_ref else None,
                mode_latihan=ujian.mode_latihan or "latihan",
                bagian_id=ujian.latihan_bagian_id,
                bagian_nama=bagian.nama if bagian else None,
                pelajaran_id=bagian.pelajaran_id if bagian else None,
                pelajaran_nama=pelajaran_map.get(bagian.pelajaran_id) if bagian else None,
                started_at=ujian.started_at,
                finished_at=ujian.finished_at,
                skor=skor_map.get(ujian.id),
            )
        )
    return rows


@router.get("/{siswa_id}", response_model=SiswaOut)
def get_siswa(siswa_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    siswa = db.query(Siswa).filter(Siswa.id == siswa_id).first()
    if not siswa:
        raise HTTPException(status_code=404, detail="Siswa not found")
    if current_user.role != "admin" and siswa.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return siswa


@router.put("/{siswa_id}", response_model=SiswaOut)
def update_siswa(siswa_id: int, payload: SiswaCreate, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    siswa = db.query(Siswa).filter(Siswa.id == siswa_id).first()
    if not siswa:
        raise HTTPException(status_code=404, detail="Siswa not found")
    if current_user.role != "admin" and siswa.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if current_user.role != "admin":
        if payload.user_id != siswa.user_id:
            raise HTTPException(status_code=403, detail="user_id cannot be changed by non-admin")
        if payload.no_induk != siswa.no_induk or payload.program_id != siswa.program_id or payload.kelas_id != siswa.kelas_id:
            raise HTTPException(status_code=403, detail="Program, kelas, dan nomor induk hanya dapat diubah admin")
    if "pilihan_jurusan" in payload.model_fields_set:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Pilihan jurusan hanya dapat diubah admin")
        siswa.pilihan_jurusan = [item.model_dump() for item in payload.pilihan_jurusan]
    siswa.user_id = payload.user_id
    siswa.nama_lengkap = payload.nama_lengkap
    if "sekolah" in payload.model_fields_set:
        siswa.sekolah = payload.sekolah
    siswa.no_induk = payload.no_induk
    siswa.program_id = payload.program_id
    siswa.kelas_id = payload.kelas_id
    db.add(siswa)
    db.commit()
    db.refresh(siswa)
    return siswa


@router.delete("/{siswa_id}")
def delete_siswa(siswa_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    siswa = db.query(Siswa).filter(Siswa.id == siswa_id).first()
    if not siswa:
        raise HTTPException(status_code=404, detail="Siswa not found")
    db.delete(siswa)
    db.commit()
    return {"message": "Siswa deleted successfully"}
