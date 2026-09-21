from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import require_guru_scope, require_roles
from app.db.database import get_db
from app.models.opsi_jawaban import OpsiJawaban
from app.models.soal import Soal
from app.schemas.opsi_jawaban import OpsiJawabanCreate, OpsiJawabanAdminOut

router = APIRouter(prefix="/opsi-jawaban", tags=["opsi_jawaban"])


def _get_soal(soal_id: int, db: Session) -> Soal:
    soal = db.query(Soal).filter(Soal.id == soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    return soal


def _require_read_soal(soal: Soal, current_user) -> None:
    if current_user.role == "admin":
        return
    if soal.status == "approved" or soal.created_by == current_user.id:
        return
    raise HTTPException(status_code=403, detail="Soal belum diterbitkan atau bukan milik Anda")


def _require_edit_soal(soal: Soal, current_user, db: Session) -> None:
    if current_user.role == "admin":
        return
    if soal.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Hanya pembuat soal yang dapat mengubah opsi")
    if soal.status not in {"draft", "rejected"}:
        raise HTTPException(status_code=409, detail="Opsi hanya dapat diubah saat soal draft atau perlu revisi")
    if soal.pelajaran_id is None:
        raise HTTPException(status_code=400, detail="Soal belum memiliki mata pelajaran")
    require_guru_scope(db, current_user, soal.pelajaran_id, kelas_id=soal.kelas_id)


def validate_opsi_payload(payload: OpsiJawabanCreate, db: Session, ignore_id: Optional[int] = None) -> Soal:
    soal = db.query(Soal).filter(Soal.id == payload.soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    if payload.urutan is not None:
        query = db.query(OpsiJawaban).filter(
            OpsiJawaban.soal_id == payload.soal_id,
            OpsiJawaban.urutan == payload.urutan,
        )
        if ignore_id is not None:
            query = query.filter(OpsiJawaban.id != ignore_id)
        if query.first():
            raise HTTPException(status_code=400, detail="Urutan opsi sudah digunakan untuk soal ini")
    return soal


@router.post("/", response_model=OpsiJawabanAdminOut)
def create_opsi_jawaban(payload: OpsiJawabanCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    soal = validate_opsi_payload(payload, db)
    _require_edit_soal(soal, current_user, db)
    opsi = OpsiJawaban(
        soal_id=payload.soal_id,
        teks_opsi=payload.teks_opsi,
        is_benar=payload.is_benar,
        urutan=payload.urutan,
    )
    db.add(opsi)
    db.commit()
    db.refresh(opsi)
    return opsi


@router.get("/", response_model=List[OpsiJawabanAdminOut])
def list_opsi_jawaban(soal_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    soal = _get_soal(soal_id, db)
    _require_read_soal(soal, current_user)
    return db.query(OpsiJawaban).filter(OpsiJawaban.soal_id == soal_id).order_by(OpsiJawaban.urutan, OpsiJawaban.id).all()


@router.get("/{opsi_id}", response_model=OpsiJawabanAdminOut)
def get_opsi_jawaban(opsi_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    opsi = db.query(OpsiJawaban).filter(OpsiJawaban.id == opsi_id).first()
    if not opsi:
        raise HTTPException(status_code=404, detail="Opsi jawaban not found")
    _require_read_soal(_get_soal(opsi.soal_id, db), current_user)
    return opsi


@router.put("/{opsi_id}", response_model=OpsiJawabanAdminOut)
def update_opsi_jawaban(opsi_id: int, payload: OpsiJawabanCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    opsi = db.query(OpsiJawaban).filter(OpsiJawaban.id == opsi_id).first()
    if not opsi:
        raise HTTPException(status_code=404, detail="Opsi jawaban not found")
    source_soal = _get_soal(opsi.soal_id, db)
    _require_edit_soal(source_soal, current_user, db)
    if payload.soal_id != opsi.soal_id:
        raise HTTPException(status_code=400, detail="Opsi tidak dapat dipindahkan ke soal lain")
    validate_opsi_payload(payload, db, ignore_id=opsi_id)
    opsi.teks_opsi = payload.teks_opsi
    opsi.is_benar = payload.is_benar
    opsi.urutan = payload.urutan
    db.add(opsi)
    db.commit()
    db.refresh(opsi)
    return opsi


@router.delete("/{opsi_id}")
def delete_opsi_jawaban(opsi_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    opsi = db.query(OpsiJawaban).filter(OpsiJawaban.id == opsi_id).first()
    if not opsi:
        raise HTTPException(status_code=404, detail="Opsi jawaban not found")
    _require_edit_soal(_get_soal(opsi.soal_id, db), current_user, db)
    db.delete(opsi)
    db.commit()
    return {"message": "Opsi jawaban deleted successfully"}
