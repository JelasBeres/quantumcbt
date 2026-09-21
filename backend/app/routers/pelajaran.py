from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_roles
from app.db.database import get_db
from app.models.pelajaran import Pelajaran
from app.schemas.pelajaran import PelajaranCreate, PelajaranOut

router = APIRouter(prefix="/pelajaran", tags=["pelajaran"])


@router.post("/", response_model=PelajaranOut)
def create_pelajaran(payload: PelajaranCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    pel = Pelajaran(nama=payload.nama, program_id=payload.program_id, is_active=payload.is_active)
    db.add(pel)
    db.commit()
    db.refresh(pel)
    return pel


@router.get("/", response_model=List[PelajaranOut])
def list_pelajaran(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    return db.query(Pelajaran).all()


@router.get("/{pelajaran_id}", response_model=PelajaranOut)
def get_pelajaran(pelajaran_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    pel = db.query(Pelajaran).filter(Pelajaran.id == pelajaran_id).first()
    if not pel:
        raise HTTPException(status_code=404, detail="Pelajaran not found")
    return pel


@router.put("/{pelajaran_id}", response_model=PelajaranOut)
def update_pelajaran(pelajaran_id: int, payload: PelajaranCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    pel = db.query(Pelajaran).filter(Pelajaran.id == pelajaran_id).first()
    if not pel:
        raise HTTPException(status_code=404, detail="Pelajaran not found")
    pel.nama = payload.nama
    pel.program_id = payload.program_id
    pel.is_active = payload.is_active
    db.add(pel)
    db.commit()
    db.refresh(pel)
    return pel


@router.delete("/{pelajaran_id}")
def delete_pelajaran(pelajaran_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    pel = db.query(Pelajaran).filter(Pelajaran.id == pelajaran_id).first()
    if not pel:
        raise HTTPException(status_code=404, detail="Pelajaran not found")
    db.delete(pel)
    db.commit()
    return {"message": "Pelajaran deleted successfully"}
