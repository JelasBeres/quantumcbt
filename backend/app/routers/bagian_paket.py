from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, guru_can_access_package, guru_can_access_section, require_roles, require_guru_scope
from app.db.database import get_db
from app.models.bagian_paket import BagianPaket
from app.models.guru import Guru
from app.models.guru_scope import GuruScope
from app.models.paket_soal import PaketSoal
from app.models.paket_ujian import PaketUjian
from app.models.pelajaran import Pelajaran
from app.models.soal import Soal
from app.models.user import User
from app.schemas.bagian_paket import (
    BAGIAN_STATUS,
    BagianDurasiUpdate,
    BagianPaketCreate,
    BagianPaketDetailOut,
    BagianPaketOut,
    BagianPaketUpdate,
    BagianReviewAction,
    BagianReviewReject,
    BagianSoalUpdateRequest,
)

router = APIRouter(prefix="/paket-ujian/{paket_id}/bagian", tags=["bagian_paket"])


def _get_paket(paket_id: int, db: Session, current_user=None, mutable: bool = False) -> PaketUjian:
    paket = db.query(PaketUjian).filter(PaketUjian.id == paket_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    if current_user is not None:
        if current_user.role == "guru" and not guru_can_access_package(db, current_user, paket):
            raise HTTPException(status_code=403, detail="Paket berada di luar mapel yang diampu")
        if current_user.role not in ("admin", "guru"):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    if mutable:
        if paket.is_archived:
            raise HTTPException(status_code=409, detail="Paket telah diarsipkan")
        from app.routers.paket_ujian import _has_locking_attempt
        if _has_locking_attempt(paket.id, db):
            raise HTTPException(status_code=409, detail="Paket sudah memiliki attempt siswa. Clone paket untuk melakukan perubahan")
    return paket


def _get_bagian(bagian_id: int, paket_id: int, db: Session) -> BagianPaket:
    bagian = db.query(BagianPaket).filter(BagianPaket.id == bagian_id).first()
    if not bagian or bagian.paket_ujian_id != paket_id:
        raise HTTPException(status_code=404, detail="Bagian Paket not found")
    return bagian


def _guru_pengampu_name(db: Session, bagian: BagianPaket, paket: PaketUjian) -> Optional[str]:
    if bagian.pelajaran_id is None:
        return None
    scope = (
        db.query(GuruScope)
        .filter(
            GuruScope.pelajaran_id == bagian.pelajaran_id,
            or_(GuruScope.program_id.is_(None), GuruScope.program_id == paket.program_id),
            or_(GuruScope.kelas_id.is_(None), GuruScope.kelas_id == paket.kelas_id),
        )
        .first()
    )
    if not scope:
        return None
    return _user_display_name(db, scope.user_id)


def _user_display_name(db: Session, user_id: Optional[int]) -> Optional[str]:
    if user_id is None:
        return None
    guru_profile = db.query(Guru).filter(Guru.user_id == user_id).first()
    if guru_profile:
        return guru_profile.nama_lengkap
    user = db.query(User).filter(User.id == user_id).first()
    return user.username if user else None


def _bagian_detail(bagian: BagianPaket, db: Session, paket: PaketUjian | None = None) -> BagianPaketDetailOut:
    soal_rows = (
        db.query(PaketSoal)
        .filter(PaketSoal.bagian_paket_id == bagian.id)
        .order_by(PaketSoal.urutan, PaketSoal.id)
        .all()
    )
    paket = paket or db.query(PaketUjian).filter(PaketUjian.id == bagian.paket_ujian_id).first()
    return BagianPaketDetailOut(
        id=bagian.id,
        paket_ujian_id=bagian.paket_ujian_id,
        nama=bagian.nama,
        urutan=bagian.urutan,
        durasi_menit=bagian.durasi_menit,
        pelajaran_id=bagian.pelajaran_id,
        is_random_soal=bagian.is_random_soal,
        is_random_opsi=bagian.is_random_opsi,
        deskripsi=bagian.deskripsi,
        status=bagian.status or "draft",
        review_note=bagian.review_note,
        submitted_for_review_at=bagian.submitted_for_review_at,
        reviewed_at=bagian.reviewed_at,
        reviewed_by=bagian.reviewed_by,
        revision_number=bagian.revision_number or 0,
        jumlah_soal=len(soal_rows),
        soal_ids=[row.soal_id for row in soal_rows],
        guru_pengampu=_guru_pengampu_name(db, bagian, paket) if paket else None,
        reviewer_nama=_user_display_name(db, bagian.reviewed_by),
    )


def _ensure_bagian_editable(bagian: BagianPaket) -> None:
    if bagian.status == "pending_review":
        raise HTTPException(status_code=409, detail="Bagian sedang menunggu review admin dan tidak dapat diubah")


def _revert_approval_if_needed(bagian: BagianPaket) -> None:
    if bagian.status == "approved":
        bagian.status = "draft"
        bagian.review_note = None
        bagian.reviewed_at = None
        bagian.reviewed_by = None


def _sync_paket_totals(paket_id: int, db: Session) -> None:
    db.flush()
    paket = db.query(PaketUjian).filter(PaketUjian.id == paket_id).first()
    if paket:
        paket.jumlah_soal = db.query(PaketSoal).filter(PaketSoal.paket_ujian_id == paket_id).count()
        paket.durasi_menit = sum(
            duration or 0
            for duration, in db.query(BagianPaket.durasi_menit).filter(BagianPaket.paket_ujian_id == paket_id).all()
        )
        db.add(paket)


def _validate_pelajaran_bagian(
    db: Session,
    paket: PaketUjian,
    pelajaran_id: int | None,
    bagian_id: int | None = None,
) -> Pelajaran:
    if pelajaran_id is None:
        raise HTTPException(status_code=400, detail="Mata pelajaran wajib dipilih untuk setiap bagian")
    pelajaran = db.query(Pelajaran).filter(Pelajaran.id == pelajaran_id).first()
    if not pelajaran:
        raise HTTPException(status_code=404, detail="Pelajaran not found")
    if not pelajaran.is_active:
        raise HTTPException(status_code=400, detail="Mata pelajaran tidak aktif")
    duplicate = db.query(BagianPaket.id).filter(
        BagianPaket.paket_ujian_id == paket.id,
        BagianPaket.pelajaran_id == pelajaran_id,
    )
    if bagian_id is not None:
        duplicate = duplicate.filter(BagianPaket.id != bagian_id)
    if duplicate.first():
        raise HTTPException(status_code=409, detail="Mata pelajaran sudah digunakan oleh bagian lain dalam paket ini")
    return pelajaran


def _next_urutan(paket_id: int, db: Session) -> int:
    current = (
        db.query(BagianPaket.urutan)
        .filter(BagianPaket.paket_ujian_id == paket_id)
        .order_by(BagianPaket.urutan.desc(), BagianPaket.id.desc())
        .first()
    )
    return (current[0] if current else 0) + 1


@router.get("/", response_model=List[BagianPaketDetailOut])
def list_bagian(paket_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    paket = _get_paket(paket_id, db, current_user)
    bagian_list = (
        db.query(BagianPaket)
        .filter(BagianPaket.paket_ujian_id == paket_id)
        .order_by(BagianPaket.urutan, BagianPaket.id)
        .all()
    )
    if current_user.role == "guru":
        bagian_list = [b for b in bagian_list if guru_can_access_section(db, current_user, b, paket)]
    return [_bagian_detail(b, db, paket) for b in bagian_list]


@router.post("/", response_model=BagianPaketDetailOut)
def create_bagian(payload: BagianPaketCreate, paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    paket = _get_paket(paket_id, db, current_user, mutable=True)
    pelajaran = _validate_pelajaran_bagian(db, paket, payload.pelajaran_id)
    bagian = BagianPaket(
        paket_ujian_id=paket_id,
        nama=payload.nama.strip() or pelajaran.nama,
        urutan=payload.urutan if payload.urutan > 0 else _next_urutan(paket_id, db),
        durasi_menit=None,
        pelajaran_id=payload.pelajaran_id,
        is_random_soal=payload.is_random_soal,
        is_random_opsi=payload.is_random_opsi,
        deskripsi=payload.deskripsi,
    )
    db.add(bagian)
    db.flush()
    _sync_paket_totals(paket_id, db)
    db.commit()
    db.refresh(bagian)
    return _bagian_detail(bagian, db, paket)


@router.get("/{bagian_id}", response_model=BagianPaketDetailOut)
def get_bagian(bagian_id: int, paket_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    paket = _get_paket(paket_id, db, current_user)
    bagian = _get_bagian(bagian_id, paket_id, db)
    if current_user.role == "guru" and not guru_can_access_section(db, current_user, bagian, paket):
        raise HTTPException(status_code=403, detail="Bagian berada di luar mapel yang diampu")
    return _bagian_detail(bagian, db, paket)


@router.put("/{bagian_id}", response_model=BagianPaketDetailOut)
def update_bagian(bagian_id: int, payload: BagianPaketUpdate, paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    paket = _get_paket(paket_id, db, current_user, mutable=True)
    bagian = _get_bagian(bagian_id, paket_id, db)
    _ensure_bagian_editable(bagian)
    selected_pelajaran_id = payload.pelajaran_id if "pelajaran_id" in payload.model_fields_set else bagian.pelajaran_id
    pelajaran = _validate_pelajaran_bagian(db, paket, selected_pelajaran_id, bagian.id)
    if payload.nama is not None:
        bagian.nama = payload.nama.strip() or pelajaran.nama
    if payload.urutan is not None:
        bagian.urutan = payload.urutan
    if "pelajaran_id" in payload.model_fields_set:
        bagian.pelajaran_id = selected_pelajaran_id
    if payload.is_random_soal is not None:
        bagian.is_random_soal = payload.is_random_soal
    if payload.is_random_opsi is not None:
        bagian.is_random_opsi = payload.is_random_opsi
    if payload.deskripsi is not None:
        bagian.deskripsi = payload.deskripsi
    _revert_approval_if_needed(bagian)
    db.add(bagian)
    db.flush()
    _sync_paket_totals(paket_id, db)
    db.commit()
    db.refresh(bagian)
    return _bagian_detail(bagian, db, paket)


@router.patch("/{bagian_id}/durasi", response_model=BagianPaketDetailOut)
def update_bagian_duration(bagian_id: int, payload: BagianDurasiUpdate, paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["guru"]))):
    paket = _get_paket(paket_id, db, current_user, mutable=True)
    bagian = _get_bagian(bagian_id, paket_id, db)
    if not guru_can_access_section(db, current_user, bagian, paket):
        raise HTTPException(status_code=403, detail="Bagian berada di luar mapel yang diampu")
    if bagian.pelajaran_id is None:
        raise HTTPException(status_code=409, detail="Bagian legacy tanpa mata pelajaran tidak dapat diubah oleh guru")
    _ensure_bagian_editable(bagian)
    require_guru_scope(db, current_user, bagian.pelajaran_id, paket.program_id, paket.kelas_id)
    bagian.durasi_menit = payload.durasi_menit
    _revert_approval_if_needed(bagian)
    db.add(bagian)
    db.flush()
    _sync_paket_totals(paket_id, db)
    db.commit()
    db.refresh(bagian)
    return _bagian_detail(bagian, db, paket)


@router.delete("/{bagian_id}")
def delete_bagian(bagian_id: int, paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    _get_paket(paket_id, db, current_user, mutable=True)
    bagian = _get_bagian(bagian_id, paket_id, db)
    db.query(PaketSoal).filter(PaketSoal.bagian_paket_id == bagian.id).delete(synchronize_session=False)
    db.delete(bagian)
    db.flush()
    _sync_paket_totals(paket_id, db)
    db.commit()
    return {"message": "Bagian Paket deleted successfully"}


@router.put("/{bagian_id}/soal", response_model=BagianPaketDetailOut)
def set_bagian_soal(bagian_id: int, payload: BagianSoalUpdateRequest, paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["guru"]))):
    paket = _get_paket(paket_id, db, current_user, mutable=True)
    bagian = _get_bagian(bagian_id, paket_id, db)
    if not guru_can_access_section(db, current_user, bagian, paket):
        raise HTTPException(status_code=403, detail="Bagian berada di luar mapel yang diampu")
    if bagian.pelajaran_id is None:
        raise HTTPException(status_code=409, detail="Bagian legacy tanpa mata pelajaran tidak dapat diisi oleh guru")
    _ensure_bagian_editable(bagian)
    soal_ids = list(dict.fromkeys(payload.soal_ids))
    if soal_ids:
        existing_questions = db.query(Soal).filter(Soal.id.in_(soal_ids), Soal.status == "approved").all()
        existing = {s.id for s in existing_questions}
        missing = [sid for sid in soal_ids if sid not in existing]
        if missing:
            raise HTTPException(status_code=400, detail=f"Soal belum approved atau tidak ditemukan: {missing}")
        mismatched = [question.id for question in existing_questions if question.pelajaran_id != bagian.pelajaran_id]
        if mismatched:
            raise HTTPException(status_code=400, detail=f"Soal harus sesuai mata pelajaran bagian: {mismatched}")
        for question in existing_questions:
            require_guru_scope(db, current_user, question.pelajaran_id, paket.program_id, paket.kelas_id)

    # Soal hanya boleh berada satu kali dalam paket. Jika soal sudah ada pada
    # bagian lain / tanpa bagian, pindahkan relasinya ke bagian target.
    db.query(PaketSoal).filter(
        PaketSoal.paket_ujian_id == paket_id,
        PaketSoal.soal_id.in_(soal_ids) if soal_ids else False,
    ).delete(synchronize_session=False)

    db.query(PaketSoal).filter(PaketSoal.bagian_paket_id == bagian.id).delete(synchronize_session=False)
    for urutan, soal_id in enumerate(soal_ids, start=1):
        db.add(PaketSoal(paket_ujian_id=paket_id, soal_id=soal_id, urutan=urutan, bagian_paket_id=bagian.id))

    _revert_approval_if_needed(bagian)
    db.add(bagian)
    _sync_paket_totals(paket_id, db)
    db.commit()
    db.refresh(bagian)
    return _bagian_detail(bagian, db, paket)


@router.post("/{bagian_id}/submit-review", response_model=BagianPaketDetailOut)
def submit_bagian_review(
    bagian_id: int,
    paket_id: int,
    payload: BagianReviewAction,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["guru"])),
):
    paket = _get_paket(paket_id, db, current_user, mutable=True)
    bagian = db.query(BagianPaket).filter(BagianPaket.id == bagian_id, BagianPaket.paket_ujian_id == paket_id).with_for_update().first()
    if not bagian:
        raise HTTPException(status_code=404, detail="Bagian Paket not found")
    if not guru_can_access_section(db, current_user, bagian, paket):
        raise HTTPException(status_code=403, detail="Bagian berada di luar mapel yang diampu")
    if bagian.status not in ("draft", "revision_required"):
        raise HTTPException(status_code=409, detail="Hanya bagian draft atau perlu revisi yang dapat diajukan review")
    if not bagian.durasi_menit:
        raise HTTPException(status_code=400, detail="Durasi bagian wajib diisi sebelum diajukan review")
    soal_ids = [row.soal_id for row in db.query(PaketSoal).filter(PaketSoal.bagian_paket_id == bagian.id).all()]
    if not soal_ids:
        raise HTTPException(status_code=400, detail="Bagian wajib memiliki minimal satu soal sebelum diajukan review")
    belum_approved = db.query(Soal.id).filter(Soal.id.in_(soal_ids), Soal.status != "approved").first()
    if belum_approved:
        raise HTTPException(status_code=409, detail="Semua soal pada bagian ini harus berstatus approved sebelum diajukan review")
    bagian.status = "pending_review"
    bagian.submitted_for_review_at = datetime.now(timezone.utc)
    db.add(bagian)
    db.commit()
    db.refresh(bagian)
    return _bagian_detail(bagian, db, paket)


@router.post("/{bagian_id}/setujui", response_model=BagianPaketDetailOut)
def approve_bagian(
    bagian_id: int,
    paket_id: int,
    payload: BagianReviewAction,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    paket = _get_paket(paket_id, db, current_user)
    bagian = db.query(BagianPaket).filter(BagianPaket.id == bagian_id, BagianPaket.paket_ujian_id == paket_id).with_for_update().first()
    if not bagian:
        raise HTTPException(status_code=404, detail="Bagian Paket not found")
    if bagian.status != "pending_review":
        raise HTTPException(status_code=409, detail="Hanya bagian menunggu review yang dapat disetujui")
    bagian.status = "approved"
    bagian.review_note = payload.note
    bagian.reviewed_by = current_user.id
    bagian.reviewed_at = datetime.now(timezone.utc)
    db.add(bagian)
    db.commit()
    db.refresh(bagian)
    return _bagian_detail(bagian, db, paket)


@router.post("/{bagian_id}/minta-revisi", response_model=BagianPaketDetailOut)
def request_bagian_revision(
    bagian_id: int,
    paket_id: int,
    payload: BagianReviewReject,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    paket = _get_paket(paket_id, db, current_user)
    bagian = db.query(BagianPaket).filter(BagianPaket.id == bagian_id, BagianPaket.paket_ujian_id == paket_id).with_for_update().first()
    if not bagian:
        raise HTTPException(status_code=404, detail="Bagian Paket not found")
    if bagian.status != "pending_review":
        raise HTTPException(status_code=409, detail="Hanya bagian menunggu review yang dapat diminta revisi")
    bagian.status = "revision_required"
    bagian.review_note = payload.note
    bagian.reviewed_by = current_user.id
    bagian.reviewed_at = datetime.now(timezone.utc)
    bagian.revision_number = (bagian.revision_number or 0) + 1
    db.add(bagian)
    db.commit()
    db.refresh(bagian)
    return _bagian_detail(bagian, db, paket)
