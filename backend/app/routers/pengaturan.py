import json
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_role
from app.db.database import get_db
from app.models.pengaturan import Pengaturan
from app.schemas.pengaturan import PengaturanCreate, PengaturanOut, PengaturanUpdate

router = APIRouter(prefix="/pengaturan", tags=["pengaturan"])


def encode_value(value: Any) -> str:
    return json.dumps(value)


def decode_value(value: str | None) -> Any:
    if value is None:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def serialize_pengaturan(pengaturan: Pengaturan) -> PengaturanOut:
    return PengaturanOut(id=pengaturan.id, key=pengaturan.key, value=decode_value(pengaturan.value))


@router.get("/", response_model=List[PengaturanOut])
def list_pengaturan(db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    return [serialize_pengaturan(item) for item in db.query(Pengaturan).order_by(Pengaturan.key.asc()).all()]


@router.post("/", response_model=PengaturanOut)
def create_pengaturan(
    payload: PengaturanCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    existing = db.query(Pengaturan).filter(Pengaturan.key == payload.key).first()
    if existing:
        raise HTTPException(status_code=400, detail="Pengaturan key already exists")
    pengaturan = Pengaturan(key=payload.key, value=encode_value(payload.value))
    db.add(pengaturan)
    db.commit()
    db.refresh(pengaturan)
    return serialize_pengaturan(pengaturan)


@router.get("/{key}", response_model=PengaturanOut)
def get_pengaturan(key: str, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    pengaturan = db.query(Pengaturan).filter(Pengaturan.key == key).first()
    if not pengaturan:
        raise HTTPException(status_code=404, detail="Pengaturan not found")
    return serialize_pengaturan(pengaturan)


@router.put("/{key}", response_model=PengaturanOut)
def update_pengaturan(
    key: str,
    payload: PengaturanUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    pengaturan = db.query(Pengaturan).filter(Pengaturan.key == key).first()
    if pengaturan is None:
        pengaturan = Pengaturan(key=key)
        db.add(pengaturan)
    pengaturan.value = encode_value(payload.value)
    db.commit()
    db.refresh(pengaturan)
    return serialize_pengaturan(pengaturan)
