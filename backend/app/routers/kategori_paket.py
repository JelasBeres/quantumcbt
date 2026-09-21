from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.database import get_db
from app.models.kategori_paket import KategoriPaket
from app.models.paket_ujian import PaketUjian
from app.schemas.kategori_paket import KategoriPaketCreate, KategoriPaketOut, KategoriPaketUpdate

router = APIRouter(prefix="/kategori-paket", tags=["kategori_paket"])

DEFAULT_KATEGORI = (
    ("utbk", "UTBK", "Kategori paket Ujian Tulis Berbasis Komputer", "keduanya"),
    ("tka_sma", "TKA SMA", "Kategori Tes Kemampuan Akademik tingkat SMA", "keduanya"),
    ("tka_smp", "TKA SMP", "Kategori Tes Kemampuan Akademik tingkat SMP", "keduanya"),
)


def seed_kategori_paket(db: Session) -> None:
    existing = {row.kode: row for row in db.query(KategoriPaket).filter(KategoriPaket.kode.in_([item[0] for item in DEFAULT_KATEGORI])).all()}
    for kode, nama, deskripsi, tipe in DEFAULT_KATEGORI:
        if kode not in existing:
            db.add(KategoriPaket(kode=kode, nama=nama, deskripsi=deskripsi, tipe=tipe, is_active=True))
    db.flush()
    categories = {row.kode: row.id for row in db.query(KategoriPaket).all()}
    for kode, category_id in categories.items():
        db.query(PaketUjian).filter(PaketUjian.kategori_id.is_(None), PaketUjian.kategori == kode).update({PaketUjian.kategori_id: category_id}, synchronize_session=False)
    db.commit()


def _validate_unique(db: Session, payload: KategoriPaketCreate | KategoriPaketUpdate, exclude_id: int | None = None) -> None:
    query = db.query(KategoriPaket).filter(func.lower(KategoriPaket.kode) == payload.kode.lower())
    if exclude_id is not None:
        query = query.filter(KategoriPaket.id != exclude_id)
    if query.first():
        raise HTTPException(status_code=409, detail="Kode kategori sudah digunakan")
    query = db.query(KategoriPaket).filter(func.lower(KategoriPaket.nama) == payload.nama.lower())
    if exclude_id is not None:
        query = query.filter(KategoriPaket.id != exclude_id)
    if query.first():
        raise HTTPException(status_code=409, detail="Nama kategori sudah digunakan")


def _out(row: KategoriPaket, db: Session) -> dict:
    return {
        "id": row.id,
        "kode": row.kode,
        "nama": row.nama,
        "deskripsi": row.deskripsi,
        "tipe": row.tipe,
        "is_active": row.is_active,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "jumlah_paket": db.query(PaketUjian).filter(or_(PaketUjian.kategori_id == row.id, PaketUjian.kategori == row.kode)).count(),
    }


@router.get("/", response_model=List[KategoriPaketOut])
def list_kategori_paket(db: Session = Depends(get_db)):
    seed_kategori_paket(db)
    return [_out(row, db) for row in db.query(KategoriPaket).order_by(KategoriPaket.nama).all()]


@router.post("/", response_model=KategoriPaketOut)
def create_kategori_paket(payload: KategoriPaketCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    _validate_unique(db, payload)
    row = KategoriPaket(**payload.model_dump())
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Kode atau nama kategori sudah digunakan")
    db.refresh(row)
    return _out(row, db)


@router.put("/{kategori_id}", response_model=KategoriPaketOut)
def update_kategori_paket(kategori_id: int, payload: KategoriPaketUpdate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    row = db.query(KategoriPaket).filter(KategoriPaket.id == kategori_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    _validate_unique(db, payload, kategori_id)
    if payload.kode != row.kode and db.query(PaketUjian.id).filter(PaketUjian.kategori == row.kode).first():
        raise HTTPException(status_code=409, detail="Kode kategori yang sudah digunakan paket tidak dapat diubah")
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Kode atau nama kategori sudah digunakan")
    db.refresh(row)
    return _out(row, db)


@router.delete("/{kategori_id}")
def delete_kategori_paket(kategori_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    row = db.query(KategoriPaket).filter(KategoriPaket.id == kategori_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    if db.query(PaketUjian.id).filter(or_(PaketUjian.kategori_id == kategori_id, PaketUjian.kategori == row.kode)).first():
        raise HTTPException(status_code=409, detail="Kategori masih digunakan paket. Nonaktifkan kategori sebagai gantinya")
    db.delete(row)
    db.commit()
    return {"message": "Kategori berhasil dihapus"}
