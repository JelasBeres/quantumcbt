from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

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
from app.schemas.siswa import (
    BagianTersediaOut,
    SiswaCreate,
    SiswaDashboardOut,
    SiswaDenganAkun,
    SiswaJadwalTersediaOut,
    SiswaJadwalUjianOut,
    SiswaOut,
    SiswaProfilUpdate,
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


def jadwal_matches_siswa(jadwal: JadwalUjian, siswa: Siswa) -> bool:
    if jadwal.program_id is not None and jadwal.program_id != siswa.program_id:
        return False
    if jadwal.kelas_id is not None and jadwal.kelas_id != siswa.kelas_id:
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
    existing = db.query(User).filter(User.username == payload.username).first()
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


@router.get("/", response_model=List[SiswaOut])
def list_siswa(db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    return db.query(Siswa).all()


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
    jadwal_mendatang = [
        jadwal
        for jadwal in jadwal_list
        if jadwal_matches_siswa(jadwal, siswa) and ensure_utc(jadwal.selesai) >= now
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
        if not jadwal_matches_siswa(jadwal, siswa):
            continue
        paket = paket_map.get(jadwal.paket_ujian_id)
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
        if not jadwal_matches_siswa(jadwal, siswa):
            continue
        paket = paket_map.get(jadwal.paket_ujian_id)
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
