from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_roles
from app.db.database import get_db
from app.models.laporan_soal import LaporanSoal
from app.models.soal import Soal
from app.models.user import User
from app.schemas.laporan_soal import LaporanSoalCreate, LaporanSoalOut, LaporanSoalStatusUpdate

router = APIRouter(prefix="/laporan-soal", tags=["laporan_soal"])


@router.post("/", response_model=LaporanSoalOut)
def buat_laporan(
    payload: LaporanSoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Siswa/guru/admin melaporkan soal bermasalah."""
    soal = db.query(Soal).filter(Soal.id == payload.soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    laporan = LaporanSoal(
        soal_id=payload.soal_id,
        user_id=current_user.id,
        alasan=payload.alasan.strip() if payload.alasan else None,
        status="baru",
    )
    db.add(laporan)
    db.commit()
    db.refresh(laporan)
    return LaporanSoalOut(
        id=laporan.id,
        soal_id=laporan.soal_id,
        user_id=laporan.user_id,
        alasan=laporan.alasan,
        status=laporan.status,
        created_at=laporan.created_at,
        teks_soal=soal.teks_soal,
        nama_pelapor=current_user.username,
    )


@router.get("/", response_model=List[LaporanSoalOut])
def list_laporan(
    status: str = "baru",
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    """Daftar laporan soal untuk ditinjau admin/guru."""
    query = (
        db.query(LaporanSoal, Soal, User)
        .join(Soal, LaporanSoal.soal_id == Soal.id)
        .outerjoin(User, LaporanSoal.user_id == User.id)
    )
    if status:
        query = query.filter(LaporanSoal.status == status)
    rows = (
        query.order_by(LaporanSoal.created_at.desc(), LaporanSoal.id.desc())
        .limit(200)
        .all()
    )
    return [
        LaporanSoalOut(
            id=laporan.id,
            soal_id=laporan.soal_id,
            user_id=laporan.user_id,
            alasan=laporan.alasan,
            status=laporan.status,
            created_at=laporan.created_at,
            teks_soal=soal.teks_soal,
            nama_pelapor=user.username if user else None,
        )
        for laporan, soal, user in rows
    ]


@router.patch("/{laporan_id}/status", response_model=LaporanSoalOut)
def ubah_status_laporan(
    laporan_id: int,
    payload: LaporanSoalStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    laporan = db.query(LaporanSoal).filter(LaporanSoal.id == laporan_id).first()
    if not laporan:
        raise HTTPException(status_code=404, detail="Laporan not found")
    laporan.status = payload.status
    db.commit()
    db.refresh(laporan)
    return laporan

