from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_roles
from app.core.timeutils import ensure_utc
from app.db.database import get_db
from app.models.jadwal_ujian import JadwalUjian
from app.models.paket_soal import PaketSoal
from app.models.paket_ujian import PaketUjian
from app.models.bagian_paket import BagianPaket
from app.models.siswa import Siswa
from app.models.soal import Soal
from app.models.ujian_siswa import UjianSiswa
from app.services.pemberitahuan import sinkron_pemberitahuan_jadwal
from app.schemas.jadwal_ujian import JadwalDeleteRequest, JadwalPublishUpdate, JadwalReviewAction, JadwalReviewReject, JadwalUjianCreate, JadwalUjianOut

router = APIRouter(prefix="/jadwal-ujian", tags=["jadwal_ujian"])


def _require_jadwal_owner(jadwal: JadwalUjian, user) -> None:
    if user.role == "admin":
        return
    if jadwal.created_by != user.id:
        raise HTTPException(status_code=403, detail="Hanya pembuat jadwal yang dapat mengubah jadwal ini")
    if jadwal.status not in {"draft", "rejected"}:
        raise HTTPException(status_code=409, detail="Jadwal hanya dapat diedit saat draft atau perlu revisi")


def _durasi_efektif(db: Session, paket_id: int, override: Optional[int]) -> int:
    paket = db.query(PaketUjian).filter(PaketUjian.id == paket_id, PaketUjian.is_archived == False).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian tidak ditemukan atau telah diarsipkan")
    return paket.durasi_menit


def _ref_paket(db: Session, paket_id: int):
    """Ambil referensi paket; raise 404 bila tidak ditemukan."""
    paket = db.query(PaketUjian).filter(PaketUjian.id == paket_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    return paket


def _program_kelas_efektif(payload: JadwalUjianCreate, paket: PaketUjian):
    """Program/kelas efektif sebuah jadwal: nilai payload jika dikirim,
    jika tidak maka ikut paket ujian-nya."""
    return (
        payload.program_id if payload.program_id is not None else paket.program_id,
        payload.kelas_id if payload.kelas_id is not None else paket.kelas_id,
    )


def _validate_pilihan_mapel(db: Session, paket: PaketUjian) -> None:
    """Aturan mapel pilihan TKA harus bisa dipenuhi siswa; kalau tidak, siswa
    baru tertolak saat menekan Mulai di hari ujian."""
    sections = db.query(BagianPaket.pelajaran_id, BagianPaket.wajib).filter(
        BagianPaket.paket_ujian_id == paket.id, BagianPaket.pelajaran_id.isnot(None)
    ).all()
    wajib = {pelajaran_id for pelajaran_id, is_wajib in sections if is_wajib}
    pilihan = {pelajaran_id for pelajaran_id, is_wajib in sections if not is_wajib} - wajib
    if not pilihan:
        return
    minimal, maksimal = paket.min_mapel_pilihan or 0, paket.max_mapel_pilihan or 0
    if maksimal < 1:
        raise HTTPException(status_code=409, detail="Try Out belum siap dijadwalkan: paket punya mapel pilihan, atur minimal dan maksimal mapel pilihan pada pengaturan paket.")
    if len(pilihan) < minimal:
        raise HTTPException(status_code=409, detail=f"Try Out belum siap dijadwalkan: siswa wajib memilih minimal {minimal} mapel pilihan, tetapi paket hanya punya {len(pilihan)} mapel pilihan.")


def _validate_package_readiness(db: Session, paket: PaketUjian) -> None:
    sections_exist = db.query(BagianPaket.id).filter(BagianPaket.paket_ujian_id == paket.id).first()
    if sections_exist:
        readiness = (
            db.query(BagianPaket.id, BagianPaket.durasi_menit, BagianPaket.status, func.count(PaketSoal.id))
            .outerjoin(PaketSoal, PaketSoal.bagian_paket_id == BagianPaket.id)
            .filter(BagianPaket.paket_ujian_id == paket.id)
            .group_by(BagianPaket.id, BagianPaket.durasi_menit, BagianPaket.status)
            .all()
        )
        if any(duration is None or not 1 <= duration <= 1440 for _, duration, _, _ in readiness):
            raise HTTPException(status_code=409, detail="Try Out belum siap dijadwalkan: isi durasi valid pada setiap bagian terlebih dahulu.")
        if any(question_count == 0 for _, _, _, question_count in readiness) or sum(question_count for _, _, _, question_count in readiness) == 0:
            raise HTTPException(status_code=409, detail="Try Out belum siap dijadwalkan: isi soal pada setiap bagian/mata pelajaran terlebih dahulu.")
        if any(status != "approved" for _, _, status, _ in readiness):
            raise HTTPException(status_code=409, detail="Try Out belum siap dijadwalkan: semua bagian harus disetujui admin terlebih dahulu.")
        soal_ids = [row[0] for row in db.query(PaketSoal.soal_id).filter(PaketSoal.paket_ujian_id == paket.id).distinct().all()]
        if soal_ids and db.query(Soal.id).filter(Soal.id.in_(soal_ids), Soal.status != "approved").first():
            raise HTTPException(status_code=409, detail="Try Out belum siap dijadwalkan: terdapat soal yang belum approved.")
        _validate_pilihan_mapel(db, paket)
    elif paket.kategori_id is not None or paket.kategori is not None:
        raise HTTPException(status_code=409, detail="Try Out belum siap dijadwalkan: tambahkan minimal satu bagian/mata pelajaran terlebih dahulu.")


def validate_jadwal(db: Session, payload: JadwalUjianCreate, ignore_id: Optional[int] = None):
    if payload.mulai >= payload.selesai:
        raise HTTPException(status_code=400, detail="Waktu mulai harus sebelum waktu selesai")

    paket = _ref_paket(db, payload.paket_ujian_id)
    if paket.tipe != "ujian" or paket.is_archived:
        raise HTTPException(status_code=409, detail="Jadwal hanya untuk Try Out aktif. Latihan tidak memerlukan jadwal.")
    _validate_package_readiness(db, paket)
    program_efektif, kelas_efektif = _program_kelas_efektif(payload, paket)

    query = db.query(JadwalUjian).filter(JadwalUjian.is_deleted == False)
    # Abaikan jadwal yang paket ujiannya sudah tidak ada (orphan dari paket yang
    # pernah dihapus). Jadwal orphan tidak boleh memblokir slot waktu yang valid.
    existing_paket_ids = {row[0] for row in db.query(PaketUjian.id).all()}
    if existing_paket_ids:
        query = query.filter(JadwalUjian.paket_ujian_id.in_(existing_paket_ids))
    else:
        query = query.filter(False)
    # Overlap hanya dicek antar jadwal pada program yang SAMA. Dua ujian dari
    # program berbeda boleh berjalan bersamaan (siswa program A tidak mungkin
    # mengikuti ujian program B), sehingga tidak saling memblokir slot.
    if program_efektif is not None:
        query = query.filter(JadwalUjian.program_id == program_efektif)
    else:
        # Jadwal lama tanpa program: anggap hanya bentrok dengan sesama tanpa program.
        query = query.filter(JadwalUjian.program_id.is_(None))
    # Batas kelas: dua jadwal dianggap beririsan bila cakupan kelasnya bertemu.
    # Jadwal tanpa kelas (NULL) berlaku untuk semua kelas, jadi beririsan dengan kelas mana pun.
    if kelas_efektif is not None:
        query = query.filter(
            (JadwalUjian.kelas_id == kelas_efektif) | (JadwalUjian.kelas_id.is_(None))
        )
    if ignore_id is not None:
        query = query.filter(JadwalUjian.id != ignore_id)

    overlap = query.filter(
        JadwalUjian.mulai < payload.selesai,
        JadwalUjian.selesai > payload.mulai,
    ).first()
    if overlap:
        raise HTTPException(status_code=400, detail="Jadwal ujian overlap dengan jadwal lain pada program yang sama")


@router.post("/", response_model=JadwalUjianOut)
def create_jadwal_ujian(payload: JadwalUjianCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    paket = _ref_paket(db, payload.paket_ujian_id)
    if current_user.role == "guru" and paket.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Guru hanya dapat menjadwalkan paket miliknya")
    validate_jadwal(db, payload)
    durasi_efektif = _durasi_efektif(db, payload.paket_ujian_id, payload.durasi_menit_paket)
    program_efektif, kelas_efektif = _program_kelas_efektif(payload, paket)
    jadwal = JadwalUjian(
        paket_ujian_id=payload.paket_ujian_id,
        mulai=payload.mulai,
        selesai=payload.selesai,
        is_published=payload.is_published if current_user.role == "admin" else False,
        program_id=program_efektif,
        kelas_id=kelas_efektif,
        durasi_menit_paket=durasi_efektif,
        status="published" if current_user.role == "admin" and payload.is_published else "draft",
        created_by=current_user.id,
    )
    db.add(jadwal)
    db.flush()
    sinkron_pemberitahuan_jadwal(db, jadwal)
    db.commit()
    db.refresh(jadwal)
    return jadwal


@router.get("/", response_model=List[JadwalUjianOut])
def list_jadwal_ujian(
    paket_ujian_id: Optional[int] = None,
    program_id: Optional[int] = None,
    kelas_id: Optional[int] = None,
    is_published: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if current_user.role == "siswa":
        raise HTTPException(status_code=403, detail="Gunakan endpoint jadwal siswa")
    query = db.query(JadwalUjian).filter(JadwalUjian.is_deleted == False)
    if current_user.role == "guru":
        query = query.filter(JadwalUjian.created_by == current_user.id)
    if paket_ujian_id is not None:
        query = query.filter(JadwalUjian.paket_ujian_id == paket_ujian_id)
    if program_id is not None:
        query = query.filter(JadwalUjian.program_id == program_id)
    if kelas_id is not None:
        query = query.filter(JadwalUjian.kelas_id == kelas_id)
    if is_published is not None:
        query = query.filter(JadwalUjian.is_published == is_published)
    return query.order_by(JadwalUjian.id.desc()).all()


@router.get("/{jadwal_id}", response_model=JadwalUjianOut)
def get_jadwal_ujian(jadwal_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    if current_user.role == "siswa":
        raise HTTPException(status_code=403, detail="Gunakan endpoint jadwal siswa")
    jadwal = db.query(JadwalUjian).filter(JadwalUjian.id == jadwal_id, JadwalUjian.is_deleted == False).first()
    if not jadwal:
        raise HTTPException(status_code=404, detail="Jadwal Ujian not found")
    if current_user.role == "guru" and jadwal.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Jadwal bukan milik Anda")
    return jadwal


@router.put("/{jadwal_id}", response_model=JadwalUjianOut)
def update_jadwal_ujian(jadwal_id: int, payload: JadwalUjianCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    jadwal = db.query(JadwalUjian).filter(JadwalUjian.id == jadwal_id).first()
    if not jadwal:
        raise HTTPException(status_code=404, detail="Jadwal Ujian not found")
    _require_jadwal_owner(jadwal, current_user)
    sudah_dikerjakan = db.query(UjianSiswa.id).filter(UjianSiswa.jadwal_ujian_id == jadwal.id).first() is not None
    if sudah_dikerjakan:
        # Attempt siswa terikat ke paket & waktu mulai jadwal ini; yang aman
        # diubah hanya perpanjangan/pemendekan waktu selesai.
        if payload.paket_ujian_id != jadwal.paket_ujian_id:
            raise HTTPException(status_code=409, detail="Jadwal sudah dikerjakan siswa sehingga paketnya tidak dapat diganti. Buat jadwal baru.")
        # Form edit hanya presisi menit (datetime-local), jadi bandingkan per menit.
        per_menit = lambda waktu: ensure_utc(waktu).replace(second=0, microsecond=0)
        if per_menit(payload.mulai) != per_menit(jadwal.mulai):
            raise HTTPException(status_code=409, detail="Jadwal sudah dikerjakan siswa sehingga waktu mulai tidak dapat diubah. Ubah waktu selesai saja.")
    paket = _ref_paket(db, payload.paket_ujian_id)
    validate_jadwal(db, payload, ignore_id=jadwal_id)
    durasi_efektif = _durasi_efektif(db, payload.paket_ujian_id, payload.durasi_menit_paket)
    program_efektif, kelas_efektif = _program_kelas_efektif(payload, paket)
    jadwal.paket_ujian_id = payload.paket_ujian_id
    jadwal.mulai = payload.mulai
    jadwal.selesai = payload.selesai
    jadwal.is_published = payload.is_published if current_user.role == "admin" else False
    # Program & kelas mengikuti paket ujian agar siswa dari program lain tidak melihat/mengerjakan.
    jadwal.program_id = program_efektif
    jadwal.kelas_id = kelas_efektif
    jadwal.durasi_menit_paket = durasi_efektif
    if jadwal.status == "rejected":
        jadwal.status = "draft"
        jadwal.rejection_reason = None
        jadwal.reviewed_by = None
        jadwal.reviewed_at = None
    db.add(jadwal)
    sinkron_pemberitahuan_jadwal(db, jadwal)
    db.commit()
    db.refresh(jadwal)
    return jadwal


@router.patch("/{jadwal_id}/publish", response_model=JadwalUjianOut)
def publish_jadwal_ujian(jadwal_id: int, payload: JadwalPublishUpdate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    jadwal = db.query(JadwalUjian).filter(JadwalUjian.id == jadwal_id, JadwalUjian.is_deleted == False).first()
    if not jadwal:
        raise HTTPException(status_code=404, detail="Jadwal Ujian not found")
    if payload.is_published:
        _validate_package_readiness(db, _ref_paket(db, jadwal.paket_ujian_id))
    jadwal.is_published = payload.is_published
    jadwal.status = "published" if payload.is_published else "draft"
    jadwal.reviewed_by = current_user.id if payload.is_published else jadwal.reviewed_by
    jadwal.reviewed_at = datetime.now(timezone.utc) if payload.is_published else jadwal.reviewed_at
    db.add(jadwal)
    sinkron_pemberitahuan_jadwal(db, jadwal)
    db.commit()
    db.refresh(jadwal)
    return jadwal


@router.post("/{jadwal_id}/submit-review", response_model=JadwalUjianOut)
def submit_jadwal_review(jadwal_id: int, payload: JadwalReviewAction, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    jadwal = db.query(JadwalUjian).filter(JadwalUjian.id == jadwal_id, JadwalUjian.is_deleted == False).with_for_update().first()
    if not jadwal:
        raise HTTPException(status_code=404, detail="Jadwal Ujian not found")
    _require_jadwal_owner(jadwal, current_user)
    jadwal.status = "pending_review"
    jadwal.submitted_for_review_at = datetime.now(timezone.utc)
    jadwal.rejection_reason = None
    sinkron_pemberitahuan_jadwal(db, jadwal)
    db.commit()
    db.refresh(jadwal)
    return jadwal


@router.post("/{jadwal_id}/withdraw-review", response_model=JadwalUjianOut)
def withdraw_jadwal_review(jadwal_id: int, payload: JadwalReviewAction, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    jadwal = db.query(JadwalUjian).filter(JadwalUjian.id == jadwal_id, JadwalUjian.is_deleted == False).with_for_update().first()
    if not jadwal:
        raise HTTPException(status_code=404, detail="Jadwal Ujian not found")
    if jadwal.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Jadwal bukan milik Anda")
    if jadwal.status != "pending_review":
        raise HTTPException(status_code=409, detail="Hanya jadwal menunggu review yang dapat ditarik")
    jadwal.status = "draft"
    jadwal.submitted_for_review_at = None
    db.commit()
    db.refresh(jadwal)
    return jadwal


@router.post("/{jadwal_id}/approve", response_model=JadwalUjianOut)
def approve_jadwal(jadwal_id: int, payload: JadwalReviewAction, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    jadwal = db.query(JadwalUjian).filter(JadwalUjian.id == jadwal_id, JadwalUjian.is_deleted == False).with_for_update().first()
    if not jadwal:
        raise HTTPException(status_code=404, detail="Jadwal Ujian not found")
    if jadwal.status != "pending_review":
        raise HTTPException(status_code=409, detail="Hanya jadwal menunggu review yang dapat disetujui")
    paket = _ref_paket(db, jadwal.paket_ujian_id)
    _validate_package_readiness(db, paket)
    jadwal.status = "published"
    jadwal.is_published = True
    jadwal.reviewed_by = current_user.id
    jadwal.reviewed_at = datetime.now(timezone.utc)
    jadwal.rejection_reason = None
    sinkron_pemberitahuan_jadwal(db, jadwal)
    db.commit()
    db.refresh(jadwal)
    return jadwal


@router.post("/{jadwal_id}/reject", response_model=JadwalUjianOut)
def reject_jadwal(jadwal_id: int, payload: JadwalReviewReject, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    jadwal = db.query(JadwalUjian).filter(JadwalUjian.id == jadwal_id, JadwalUjian.is_deleted == False).with_for_update().first()
    if not jadwal:
        raise HTTPException(status_code=404, detail="Jadwal Ujian not found")
    if jadwal.status != "pending_review":
        raise HTTPException(status_code=409, detail="Hanya jadwal menunggu review yang dapat ditolak")
    jadwal.status = "rejected"
    jadwal.is_published = False
    jadwal.reviewed_by = current_user.id
    jadwal.reviewed_at = datetime.now(timezone.utc)
    jadwal.rejection_reason = payload.note
    sinkron_pemberitahuan_jadwal(db, jadwal)
    db.commit()
    db.refresh(jadwal)
    return jadwal


@router.delete("/{jadwal_id}")
def delete_jadwal_ujian(jadwal_id: int, payload: JadwalDeleteRequest, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    jadwal = db.query(JadwalUjian).filter(JadwalUjian.id == jadwal_id, JadwalUjian.is_deleted == False).first()
    if not jadwal:
        raise HTTPException(status_code=404, detail="Jadwal Ujian not found")
    jadwal.is_deleted = True
    jadwal.is_published = False
    jadwal.deletion_reason = payload.alasan.strip()
    db.add(jadwal)
    sinkron_pemberitahuan_jadwal(db, jadwal)
    db.commit()
    return {"message": "Jadwal Ujian soft deleted successfully"}


@router.get("/{jadwal_id}/siswa", response_model=List[dict])
def list_siswa_jadwal(jadwal_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    jadwal = db.query(JadwalUjian).filter(JadwalUjian.id == jadwal_id).first()
    if not jadwal:
        raise HTTPException(status_code=404, detail="Jadwal Ujian not found")

    query = db.query(Siswa)
    if jadwal.program_id is not None:
        query = query.filter(Siswa.program_id == jadwal.program_id)
    if jadwal.kelas_id is not None:
        query = query.filter(Siswa.kelas_id == jadwal.kelas_id)
    siswa_list = query.all()
    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "nama_lengkap": s.nama_lengkap,
            "no_induk": s.no_induk,
        }
        for s in siswa_list
    ]
