from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_roles
from app.db.database import get_db
from app.models.log_kecurangan import LogKecurangan
from app.models.siswa import Siswa
from app.models.ujian_siswa import UjianSiswa
from app.schemas.log_kecurangan import LogKecuranganCreate, LogKecuranganOut

router = APIRouter(prefix="/log-kecurangan", tags=["log_kecurangan"])


def _authorize_ujian_log(ujian_siswa_id: int, db: Session, current_user) -> UjianSiswa:
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_siswa_id).first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")
    if current_user.role == "siswa":
        linked = (
            db.query(Siswa)
            .filter(Siswa.id == ujian.siswa_id, Siswa.user_id == current_user.id)
            .first()
        )
        if not linked:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    return ujian


@router.post("/", response_model=LogKecuranganOut)
def create_log_kecurangan(payload: LogKecuranganCreate, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    _authorize_ujian_log(payload.ujian_siswa_id, db, current_user)
    log = LogKecurangan(
        ujian_siswa_id=payload.ujian_siswa_id,
        tipe_kecurangan=payload.tipe_kecurangan,
        deskripsi=payload.deskripsi,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/", response_model=List[LogKecuranganOut])
def list_log_kecurangan(
    ujian_siswa_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if ujian_siswa_id is not None:
        _authorize_ujian_log(ujian_siswa_id, db, current_user)
        query = db.query(LogKecurangan).filter(LogKecurangan.ujian_siswa_id == ujian_siswa_id)
    elif current_user.role == "siswa":
        query = (
            db.query(LogKecurangan)
            .join(UjianSiswa, LogKecurangan.ujian_siswa_id == UjianSiswa.id)
            .join(Siswa, UjianSiswa.siswa_id == Siswa.id)
            .filter(Siswa.user_id == current_user.id)
        )
    else:
        query = db.query(LogKecurangan)
    return query.all()


@router.get("/{log_id}", response_model=LogKecuranganOut)
def get_log_kecurangan(log_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    log = db.query(LogKecurangan).filter(LogKecurangan.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log Kecurangan not found")
    _authorize_ujian_log(log.ujian_siswa_id, db, current_user)
    return log
