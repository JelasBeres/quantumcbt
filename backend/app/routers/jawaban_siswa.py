from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_roles
from app.core.timeutils import utc_now
from app.db.database import get_db
from app.models.jawaban_siswa import JawabanSiswa
from app.models.siswa import Siswa
from app.models.soal import Soal
from app.models.ujian_siswa import UjianSiswa
from app.schemas.jawaban_siswa import (
    JawabanEsaiKoreksiItem,
    JawabanEsaiNilaiRequest,
    JawabanSiswaCreate,
    JawabanSiswaOut,
)
from app.services.scoring import compute_and_store_hasil

router = APIRouter(prefix="/jawaban-siswa", tags=["jawaban_siswa"])


@router.get("/esai/koreksi", response_model=List[JawabanEsaiKoreksiItem])
def list_jawaban_esai_koreksi(
    ujian_siswa_id: Optional[int] = None,
    paket_ujian_id: Optional[int] = None,
    hanya_belum_dinilai: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    """Daftar jawaban esai/isian untuk dikoreksi manual oleh guru/admin."""
    query = (
        db.query(JawabanSiswa, Soal, UjianSiswa, Siswa)
        .join(Soal, JawabanSiswa.soal_id == Soal.id)
        .join(UjianSiswa, JawabanSiswa.ujian_siswa_id == UjianSiswa.id)
        .join(Siswa, UjianSiswa.siswa_id == Siswa.id)
        .filter(Soal.tipe.in_(["esai", "isian"]))
    )
    if ujian_siswa_id is not None:
        query = query.filter(JawabanSiswa.ujian_siswa_id == ujian_siswa_id)
    if paket_ujian_id is not None:
        query = query.filter(UjianSiswa.paket_ujian_id == paket_ujian_id)
    if hanya_belum_dinilai:
        query = query.filter(JawabanSiswa.skor_manual.is_(None))

    rows: List[JawabanEsaiKoreksiItem] = []
    for jawaban, soal, ujian, siswa in query.order_by(JawabanSiswa.ujian_siswa_id, JawabanSiswa.soal_id).all():
        rows.append(
            JawabanEsaiKoreksiItem(
                jawaban_id=jawaban.id,
                ujian_siswa_id=ujian.id,
                siswa_id=siswa.id,
                nama_siswa=siswa.nama_lengkap,
                soal_id=soal.id,
                teks_soal=soal.teks_soal,
                tipe=soal.tipe,
                kunci_jawaban=soal.kunci_jawaban,
                is_ragu=bool(jawaban.is_ragu),
                jawaban_teks=jawaban.jawaban,
                skor_manual=jawaban.skor_manual,
                dinilai_oleh=jawaban.dinilai_oleh,
                dinilai_at=jawaban.dinilai_at,
            )
        )
    return rows


@router.patch("/{jawaban_id}/nilai", response_model=JawabanSiswaOut)
def nilai_jawaban_esai(
    jawaban_id: int,
    payload: JawabanEsaiNilaiRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    jawaban = db.query(JawabanSiswa).filter(JawabanSiswa.id == jawaban_id).first()
    if not jawaban:
        raise HTTPException(status_code=404, detail="Jawaban Siswa not found")
    soal = db.query(Soal).filter(Soal.id == jawaban.soal_id).first()
    if soal and soal.tipe == "pilihan_ganda":
        raise HTTPException(status_code=400, detail="Soal pilihan ganda dinilai otomatis, tidak perlu koreksi manual")

    jawaban.skor_manual = payload.skor_manual
    jawaban.dinilai_oleh = current_user.id
    jawaban.dinilai_at = utc_now()
    db.commit()
    db.refresh(jawaban)

    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == jawaban.ujian_siswa_id).first()
    if ujian and ujian.is_submitted:
        compute_and_store_hasil(db, ujian)
        db.commit()

    return jawaban


@router.post("/", response_model=JawabanSiswaOut)
def create_jawaban_siswa(payload: JawabanSiswaCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    jawaban = JawabanSiswa(
        ujian_siswa_id=payload.ujian_siswa_id,
        soal_id=payload.soal_id,
        jawaban=payload.jawaban,
    )
    db.add(jawaban)
    db.commit()
    db.refresh(jawaban)
    return jawaban


@router.get("/", response_model=List[JawabanSiswaOut])
def list_jawaban_siswa(
    ujian_siswa_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    query = db.query(JawabanSiswa)
    if ujian_siswa_id is not None:
        query = query.filter(JawabanSiswa.ujian_siswa_id == ujian_siswa_id)
    return query.all()


@router.put("/{jawaban_id}", response_model=JawabanSiswaOut)
def update_jawaban_siswa(jawaban_id: int, payload: JawabanSiswaCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    jawaban = db.query(JawabanSiswa).filter(JawabanSiswa.id == jawaban_id).first()
    if not jawaban:
        raise HTTPException(status_code=404, detail="Jawaban Siswa not found")
    jawaban.jawaban = payload.jawaban
    db.commit()
    db.refresh(jawaban)
    return jawaban


@router.get("/{jawaban_id}", response_model=JawabanSiswaOut)
def get_jawaban_siswa(jawaban_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    jawaban = db.query(JawabanSiswa).filter(JawabanSiswa.id == jawaban_id).first()
    if not jawaban:
        raise HTTPException(status_code=404, detail="Jawaban Siswa not found")
    return jawaban
