from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_roles
from app.db.database import get_db
from app.models.grup_tryout import GrupTryout
from app.models.jadwal_ujian import JadwalUjian
from app.schemas.grup_tryout import GrupTryoutCreate, GrupTryoutOut

router = APIRouter(prefix="/grup-tryout", tags=["grup_tryout"])


def get_grup_or_404(grup_id: int, db: Session) -> GrupTryout:
    grup = db.query(GrupTryout).filter(GrupTryout.id == grup_id).first()
    if not grup:
        raise HTTPException(status_code=404, detail="Grup tryout not found")
    return grup


def ensure_unique_nama(nama: str, db: Session, ignore_id: int | None = None) -> None:
    query = db.query(GrupTryout).filter(GrupTryout.nama == nama)
    if ignore_id is not None:
        query = query.filter(GrupTryout.id != ignore_id)
    if query.first():
        raise HTTPException(status_code=400, detail="Nama grup tryout sudah digunakan")


@router.post("/", response_model=GrupTryoutOut)
def create_grup_tryout(
    payload: GrupTryoutCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    ensure_unique_nama(payload.nama, db)
    grup = GrupTryout(**payload.model_dump())
    db.add(grup)
    db.commit()
    db.refresh(grup)
    return grup


@router.get("/", response_model=List[GrupTryoutOut])
def list_grup_tryout(
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    query = db.query(GrupTryout)
    if is_active is not None:
        query = query.filter(GrupTryout.is_active == is_active)
    return query.order_by(GrupTryout.nama).all()


@router.get("/{grup_id}", response_model=GrupTryoutOut)
def get_grup_tryout(grup_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    return get_grup_or_404(grup_id, db)


@router.put("/{grup_id}", response_model=GrupTryoutOut)
def update_grup_tryout(
    grup_id: int,
    payload: GrupTryoutCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    grup = get_grup_or_404(grup_id, db)
    ensure_unique_nama(payload.nama, db, ignore_id=grup_id)
    for field, value in payload.model_dump().items():
        setattr(grup, field, value)
    db.commit()
    db.refresh(grup)
    return grup


@router.delete("/{grup_id}")
def delete_grup_tryout(
    grup_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    grup = get_grup_or_404(grup_id, db)
    if db.query(JadwalUjian.id).filter(JadwalUjian.grup_tryout_id == grup_id).first():
        raise HTTPException(status_code=400, detail="Grup tryout masih digunakan oleh jadwal ujian")
    db.delete(grup)
    db.commit()
    return {"message": "Grup tryout deleted successfully"}
