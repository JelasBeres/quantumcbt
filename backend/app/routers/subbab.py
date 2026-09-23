from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_roles
from app.db.database import get_db
from app.models.pelajaran import Pelajaran
from app.models.soal import Soal
from app.models.subbab import Subbab
from app.models.topik import Topik
from app.schemas.subbab import SubbabCreate, SubbabOut

router = APIRouter(prefix="/subbab", tags=["subbab"])


def _out(row: Subbab, db: Session) -> dict:
    topik = db.query(Topik).filter(Topik.id == row.topik_id).first()
    return {"id": row.id, "topik_id": row.topik_id, "pelajaran_id": topik.pelajaran_id if topik else None, "nama": row.nama, "is_active": row.is_active, "created_at": row.created_at, "updated_at": row.updated_at}


def _validate(db: Session, payload: SubbabCreate, exclude_id: int | None = None) -> Topik:
    topik = db.query(Topik).filter(Topik.id == payload.topik_id).first()
    if not topik:
        raise HTTPException(status_code=404, detail="Bab tidak ditemukan")
    query = db.query(Subbab.id).filter(Subbab.topik_id == payload.topik_id, func.lower(Subbab.nama) == payload.nama.lower())
    if exclude_id is not None:
        query = query.filter(Subbab.id != exclude_id)
    if query.first():
        raise HTTPException(status_code=409, detail="Nama sub bab sudah digunakan pada bab ini")
    return topik


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Nama sub bab sudah digunakan pada bab ini")


@router.get("/", response_model=List[SubbabOut])
def list_subbab(topik_id: Optional[int] = None, pelajaran_id: Optional[int] = None, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    query = db.query(Subbab).join(Topik, Topik.id == Subbab.topik_id)
    if topik_id is not None:
        query = query.filter(Subbab.topik_id == topik_id)
    if pelajaran_id is not None:
        query = query.filter(Topik.pelajaran_id == pelajaran_id)
    return [_out(row, db) for row in query.order_by(Subbab.nama).all()]


@router.post("/", response_model=SubbabOut)
def create_subbab(payload: SubbabCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    _validate(db, payload)
    row = Subbab(**payload.model_dump())
    db.add(row)
    _commit(db)
    db.refresh(row)
    return _out(row, db)


@router.put("/{subbab_id}", response_model=SubbabOut)
def update_subbab(subbab_id: int, payload: SubbabCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    row = db.query(Subbab).filter(Subbab.id == subbab_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Sub bab tidak ditemukan")
    _validate(db, payload, subbab_id)
    if payload.topik_id != row.topik_id and db.query(Soal.id).filter(Soal.subbab_id == subbab_id).first():
        raise HTTPException(status_code=409, detail="Sub bab yang digunakan soal tidak dapat dipindah ke bab lain")
    row.topik_id = payload.topik_id
    row.nama = payload.nama
    row.is_active = payload.is_active
    db.query(Soal).filter(Soal.subbab_id == subbab_id).update({Soal.subbab: payload.nama}, synchronize_session=False)
    _commit(db)
    db.refresh(row)
    return _out(row, db)


@router.delete("/{subbab_id}")
def delete_subbab(subbab_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    row = db.query(Subbab).filter(Subbab.id == subbab_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Sub bab tidak ditemukan")
    if db.query(Soal.id).filter(Soal.subbab_id == subbab_id).first():
        raise HTTPException(status_code=409, detail="Sub bab masih digunakan oleh soal. Nonaktifkan sub bab sebagai gantinya")
    db.delete(row)
    _commit(db)
    return {"message": "Sub bab berhasil dihapus"}
