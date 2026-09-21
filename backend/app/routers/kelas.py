from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_roles
from app.db.database import get_db
from app.models.kelas import Kelas
from app.schemas.kelas import KelasCreate, KelasOut

router = APIRouter(prefix="/kelas", tags=["kelas"])


@router.post("/", response_model=KelasOut)
def create_kelas(payload: KelasCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    k = Kelas(nama=payload.nama)
    db.add(k)
    db.commit()
    db.refresh(k)
    return k


@router.get("/", response_model=List[KelasOut])
def list_kelas(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    return db.query(Kelas).all()


@router.get("/{kelas_id}", response_model=KelasOut)
def get_kelas(kelas_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    k = db.query(Kelas).filter(Kelas.id == kelas_id).first()
    if not k:
        raise HTTPException(status_code=404, detail="Kelas not found")
    return k


@router.put("/{kelas_id}", response_model=KelasOut)
def update_kelas(kelas_id: int, payload: KelasCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    k = db.query(Kelas).filter(Kelas.id == kelas_id).first()
    if not k:
        raise HTTPException(status_code=404, detail="Kelas not found")
    k.nama = payload.nama
    db.add(k)
    db.commit()
    db.refresh(k)
    return k


@router.delete("/{kelas_id}")
def delete_kelas(kelas_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    k = db.query(Kelas).filter(Kelas.id == kelas_id).first()
    if not k:
        raise HTTPException(status_code=404, detail="Kelas not found")
    db.delete(k)
    db.commit()
    return {"message": "Kelas deleted successfully"}
