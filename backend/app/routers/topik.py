from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.database import get_db
from app.models.pelajaran import Pelajaran
from app.models.soal import Soal
from app.models.subbab import Subbab
from app.models.topik import Topik
from app.schemas.topik import TopikCreate, TopikOut

router = APIRouter(prefix="/topik", tags=["topik"])


def _validate_topik(db: Session, payload: TopikCreate, exclude_id: int | None = None) -> None:
    if not db.query(Pelajaran.id).filter(Pelajaran.id == payload.pelajaran_id).first():
        raise HTTPException(status_code=404, detail="Mata pelajaran tidak ditemukan")
    query = db.query(Topik.id).filter(
        Topik.pelajaran_id == payload.pelajaran_id,
        func.lower(Topik.nama) == payload.nama.lower(),
    )
    if exclude_id is not None:
        query = query.filter(Topik.id != exclude_id)
    if query.first():
        raise HTTPException(status_code=409, detail="Nama bab sudah digunakan pada mata pelajaran ini")


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Nama bab sudah digunakan pada mata pelajaran ini")


@router.post("/", response_model=TopikOut)
def create_topik(payload: TopikCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    _validate_topik(db, payload)
    topik = Topik(**payload.model_dump())
    db.add(topik)
    _commit(db)
    db.refresh(topik)
    return topik


@router.get("/", response_model=List[TopikOut])
def list_topik(
    pelajaran_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Topik)
    if pelajaran_id is not None:
        query = query.filter(Topik.pelajaran_id == pelajaran_id)
    return query.order_by(Topik.nama).all()


@router.put("/{topik_id}", response_model=TopikOut)
def update_topik(topik_id: int, payload: TopikCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    topik = db.query(Topik).filter(Topik.id == topik_id).first()
    if not topik:
        raise HTTPException(status_code=404, detail="Bab tidak ditemukan")
    _validate_topik(db, payload, topik_id)
    if payload.pelajaran_id != topik.pelajaran_id and db.query(Soal.id).filter(Soal.topik_id == topik_id).first():
        raise HTTPException(status_code=409, detail="Bab yang digunakan soal tidak dapat dipindah ke mata pelajaran lain")
    topik.pelajaran_id = payload.pelajaran_id
    topik.nama = payload.nama
    topik.is_active = payload.is_active
    _commit(db)
    db.refresh(topik)
    return topik


@router.delete("/{topik_id}")
def delete_topik(topik_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    topik = db.query(Topik).filter(Topik.id == topik_id).first()
    if not topik:
        raise HTTPException(status_code=404, detail="Bab tidak ditemukan")
    if db.query(Soal.id).filter(Soal.topik_id == topik_id).first():
        raise HTTPException(status_code=409, detail="Bab masih digunakan oleh soal. Nonaktifkan bab sebagai gantinya")
    if db.query(Subbab.id).filter(Subbab.topik_id == topik_id).first():
        raise HTTPException(status_code=409, detail="Bab masih memiliki sub bab. Hapus atau nonaktifkan sub bab terlebih dahulu")
    db.delete(topik)
    _commit(db)
    return {"message": "Bab berhasil dihapus"}
