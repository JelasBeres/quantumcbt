from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.core.timeutils import utc_now
from app.db.database import get_db
from app.models.pemberitahuan import Pemberitahuan, PemberitahuanDibaca
from app.routers.siswa import get_current_siswa_profile
from app.schemas.pemberitahuan import (
    PemberitahuanAdminOut,
    PemberitahuanCreate,
    PemberitahuanOut,
    PemberitahuanSiswaList,
    PemberitahuanSiswaOut,
)

router = APIRouter(prefix="/pemberitahuan", tags=["pemberitahuan"])

BATAS_DAFTAR_SISWA = 50


def _get_or_404(db: Session, pemberitahuan_id: int) -> Pemberitahuan:
    item = db.get(Pemberitahuan, pemberitahuan_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Pemberitahuan tidak ditemukan")
    return item


def _query_untuk_siswa(db: Session, siswa):
    now = utc_now()
    return db.query(Pemberitahuan).filter(
        Pemberitahuan.is_active == True,
        or_(Pemberitahuan.program_id.is_(None), Pemberitahuan.program_id == siswa.program_id),
        or_(Pemberitahuan.kelas_id.is_(None), Pemberitahuan.kelas_id == siswa.kelas_id),
        or_(Pemberitahuan.berlaku_sampai.is_(None), Pemberitahuan.berlaku_sampai > now),
    )


# ---------- Admin ----------

@router.get("/", response_model=List[PemberitahuanAdminOut])
def list_pemberitahuan(db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    items = db.query(Pemberitahuan).order_by(Pemberitahuan.created_at.desc(), Pemberitahuan.id.desc()).all()
    dibaca = dict(
        db.query(PemberitahuanDibaca.pemberitahuan_id, func.count(PemberitahuanDibaca.id))
        .group_by(PemberitahuanDibaca.pemberitahuan_id)
        .all()
    )
    return [
        PemberitahuanAdminOut.model_validate(item).model_copy(update={"jumlah_dibaca": dibaca.get(item.id, 0)})
        for item in items
    ]


@router.post("/", response_model=PemberitahuanOut)
def create_pemberitahuan(payload: PemberitahuanCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    item = Pemberitahuan(**payload.model_dump(), created_by=current_user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{pemberitahuan_id}", response_model=PemberitahuanOut)
def update_pemberitahuan(pemberitahuan_id: int, payload: PemberitahuanCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    item = _get_or_404(db, pemberitahuan_id)
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{pemberitahuan_id}")
def delete_pemberitahuan(pemberitahuan_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    item = _get_or_404(db, pemberitahuan_id)
    db.query(PemberitahuanDibaca).filter(PemberitahuanDibaca.pemberitahuan_id == item.id).delete(synchronize_session=False)
    db.delete(item)
    db.commit()
    return {"message": "Pemberitahuan dihapus"}


# ---------- Siswa ----------

@router.get("/saya", response_model=PemberitahuanSiswaList)
def list_pemberitahuan_saya(db: Session = Depends(get_db), current_user=Depends(require_roles(["siswa"]))):
    siswa = get_current_siswa_profile(db, current_user)
    query = _query_untuk_siswa(db, siswa)
    items = query.order_by(Pemberitahuan.created_at.desc(), Pemberitahuan.id.desc()).limit(BATAS_DAFTAR_SISWA).all()
    sudah_dibaca = {
        row[0]
        for row in db.query(PemberitahuanDibaca.pemberitahuan_id).filter(PemberitahuanDibaca.user_id == current_user.id).all()
    }
    belum_dibaca = query.filter(
        ~Pemberitahuan.id.in_(
            db.query(PemberitahuanDibaca.pemberitahuan_id).filter(PemberitahuanDibaca.user_id == current_user.id)
        )
    ).count()
    return PemberitahuanSiswaList(
        belum_dibaca=belum_dibaca,
        items=[
            PemberitahuanSiswaOut.model_validate(item).model_copy(update={"dibaca": item.id in sudah_dibaca})
            for item in items
        ],
    )


def _tandai_dibaca(db: Session, user_id: int, pemberitahuan_ids: list[int]) -> None:
    if not pemberitahuan_ids:
        return
    sudah = {
        row[0]
        for row in db.query(PemberitahuanDibaca.pemberitahuan_id).filter(
            PemberitahuanDibaca.user_id == user_id,
            PemberitahuanDibaca.pemberitahuan_id.in_(pemberitahuan_ids),
        )
    }
    baru = [pid for pid in pemberitahuan_ids if pid not in sudah]
    if not baru:
        return
    db.add_all([PemberitahuanDibaca(pemberitahuan_id=pid, user_id=user_id) for pid in baru])
    try:
        db.commit()
    except IntegrityError:
        # Dua tab menandai bersamaan: baris sudah ada, hasil akhirnya sama.
        db.rollback()


@router.post("/baca-semua")
def baca_semua_pemberitahuan(db: Session = Depends(get_db), current_user=Depends(require_roles(["siswa"]))):
    siswa = get_current_siswa_profile(db, current_user)
    ids = [row[0] for row in _query_untuk_siswa(db, siswa).with_entities(Pemberitahuan.id).all()]
    _tandai_dibaca(db, current_user.id, ids)
    return {"message": "Semua pemberitahuan ditandai dibaca"}


@router.post("/{pemberitahuan_id}/baca")
def baca_pemberitahuan(pemberitahuan_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["siswa"]))):
    siswa = get_current_siswa_profile(db, current_user)
    item = _query_untuk_siswa(db, siswa).filter(Pemberitahuan.id == pemberitahuan_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Pemberitahuan tidak ditemukan")
    _tandai_dibaca(db, current_user.id, [item.id])
    return {"message": "Pemberitahuan ditandai dibaca"}
