from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_roles
from app.db.database import get_db
from app.models.program import Program
from app.schemas.program import ProgramCreate, ProgramOut

router = APIRouter(prefix="/program", tags=["program"])


@router.post("/", response_model=ProgramOut)
def create_program(payload: ProgramCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    p = Program(nama=payload.nama, deskripsi=payload.deskripsi, is_active=payload.is_active)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/", response_model=List[ProgramOut])
def list_program(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    return db.query(Program).all()


@router.get("/{program_id}", response_model=ProgramOut)
def get_program(program_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    p = db.query(Program).filter(Program.id == program_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Program not found")
    return p


@router.put("/{program_id}", response_model=ProgramOut)
def update_program(program_id: int, payload: ProgramCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    p = db.query(Program).filter(Program.id == program_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Program not found")
    p.nama = payload.nama
    p.deskripsi = payload.deskripsi
    p.is_active = payload.is_active
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{program_id}")
def delete_program(program_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    p = db.query(Program).filter(Program.id == program_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Program not found")
    db.delete(p)
    db.commit()
    return {"message": "Program deleted successfully"}
