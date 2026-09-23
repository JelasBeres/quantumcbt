from typing import Any, Dict, List, Optional, Union
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user
from app.db.database import get_db
from app.models.hasil_ujian import HasilUjian
from app.models.jawaban_siswa import JawabanSiswa
from app.models.opsi_jawaban import OpsiJawaban
from app.models.pernyataan_benar_salah import PernyataanBenarSalah
from app.models.paket_ujian import PaketUjian
from app.models.siswa import Siswa
from app.models.soal import Soal
from app.models.ujian_siswa import UjianSiswa
from app.schemas.hasil_ujian import (
    HasilPernyataanDetail,
    HasilSoalDetail,
    HasilSoalOpsi,
    HasilUjianCreate,
    HasilUjianDetailOut,
    HasilUjianOut,
)
from app.services.scoring import compute_and_store_hasil

router = APIRouter(prefix="/hasil-ujian", tags=["hasil_ujian"])


def authorize_hasil_access(ujian: UjianSiswa, current_user, db: Session) -> None:
    if current_user.role == "siswa":
        linked_siswa = db.query(Siswa).filter(Siswa.id == ujian.siswa_id, Siswa.user_id == current_user.id).first()
        if not linked_siswa:
            raise HTTPException(status_code=403, detail="Insufficient permissions")


@router.post("/", response_model=HasilUjianOut)
def create_hasil_ujian(payload: HasilUjianCreate, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    if current_user.role not in ["admin", "guru"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == payload.ujian_siswa_id).first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")

    hasil = db.query(HasilUjian).filter(HasilUjian.ujian_siswa_id == payload.ujian_siswa_id).first()
    if hasil is None:
        hasil = HasilUjian(ujian_siswa_id=payload.ujian_siswa_id)
        db.add(hasil)
    hasil.skor = payload.skor
    hasil.skor_per_pelajaran_json = payload.skor_per_pelajaran_json
    db.commit()
    db.refresh(hasil)
    return hasil


@router.get("/", response_model=List[HasilUjianOut])
def list_hasil_ujian(
    ujian_siswa_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    query = db.query(HasilUjian)
    if ujian_siswa_id is not None:
        query = query.filter(HasilUjian.ujian_siswa_id == ujian_siswa_id)
    if current_user.role == "siswa":
        siswa = db.query(Siswa).filter(Siswa.user_id == current_user.id).first()
        if not siswa:
            return []
        ujian_ids = [ujian.id for ujian in db.query(UjianSiswa).filter(UjianSiswa.siswa_id == siswa.id).all()]
        query = query.filter(HasilUjian.ujian_siswa_id.in_(ujian_ids))
    return query.all()


@router.get("/ujian/{ujian_siswa_id}", response_model=HasilUjianOut)
def get_hasil_by_ujian_siswa(
    ujian_siswa_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_siswa_id).first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")
    authorize_hasil_access(ujian, current_user, db)
    hasil = db.query(HasilUjian).filter(HasilUjian.ujian_siswa_id == ujian_siswa_id).first()
    if not hasil:
        raise HTTPException(status_code=404, detail="Hasil Ujian not found")
    return hasil


@router.get("/ujian/{ujian_siswa_id}/detail", response_model=HasilUjianDetailOut)
def get_hasil_detail(
    ujian_siswa_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Detail jawaban per soal: jawaban siswa vs kunci jawaban."""
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_siswa_id).first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")
    authorize_hasil_access(ujian, current_user, db)
    if current_user.role == "siswa" and not ujian.is_submitted:
        raise HTTPException(status_code=403, detail="Hasil belum tersedia")

    hasil = db.query(HasilUjian).filter(HasilUjian.ujian_siswa_id == ujian_siswa_id).first()
    if current_user.role == "siswa" and not hasil:
        raise HTTPException(status_code=404, detail="Hasil Ujian not found")

    paket = db.query(PaketUjian).filter(PaketUjian.id == ujian.paket_ujian_id).first()
    metadata = (hasil.skor_per_pelajaran_json or {}).get("_meta", {}) if hasil else {}

    soal_detail: List[HasilSoalDetail] = []
    if not ujian.soal_urutan:
        return HasilUjianDetailOut(
            ujian_siswa_id=ujian.id,
            skor=hasil.skor if hasil else None,
            soal=[],
            nama_paket=paket.nama if paket else None,
            metode_penilaian=metadata.get("metode_penilaian", paket.metode_penilaian if paket else "biasa"),
            kohort_status=metadata.get("kohort_status"),
            skala=metadata.get("skala"),
            skor_mentah=metadata.get("skor_mentah"),
            metadata=metadata,
        )

    soal_map = {s.id: s for s in db.query(Soal).filter(Soal.id.in_(ujian.soal_urutan)).all()}
    jawaban_map = {
        j.soal_id: j
        for j in db.query(JawabanSiswa).filter(JawabanSiswa.ujian_siswa_id == ujian.id).all()
    }

    LABEL = ["A", "B", "C", "D", "E", "F", "G", "H"]

    posisi_bagian: Dict[int, tuple[int, str]] = {}
    for bagian in ujian.bagian_urutan or []:
        for i, sid in enumerate(bagian.get("soal_ids") or [], start=1):
            posisi_bagian[sid] = (i, bagian.get("nama") or "")

    for idx, soal_id in enumerate(ujian.soal_urutan, start=1):
        soal = soal_map.get(soal_id)
        if not soal:
            continue

        opsi_rows = (
            db.query(OpsiJawaban)
            .filter(OpsiJawaban.soal_id == soal.id)
            .order_by(OpsiJawaban.urutan, OpsiJawaban.id)
            .all()
        )
        opsi_out = [
            HasilSoalOpsi(id=o.id, label=LABEL[i] if i < len(LABEL) else str(i + 1), teks=o.teks_opsi, is_benar=o.is_benar)
            for i, o in enumerate(opsi_rows)
        ]

        jawaban = jawaban_map.get(soal.id)
        pernyataan_rows = db.query(PernyataanBenarSalah).filter(PernyataanBenarSalah.soal_id == soal.id).order_by(PernyataanBenarSalah.urutan).all()
        pernyataan_out: List[HasilPernyataanDetail] = []
        is_correct: Optional[bool] = None
        jawaban_user: Optional[Union[int, str, List[int], List[Dict[str, Any]]]] = None
        jawaban_benar: Optional[Union[int, str, List[int]]] = None
        skor_manual: Optional[float] = None

        kunci_ids = [o.id for o in opsi_rows if o.is_benar]

        if soal.tipe in ("pilihan_ganda", "benar_salah"):
            if soal.tipe == "benar_salah" and pernyataan_rows:
                try:
                    parsed = json.loads(jawaban.jawaban) if jawaban and jawaban.jawaban else []
                    answers = {item["pernyataan_id"]: item["jawaban"] for item in parsed if isinstance(item, dict)}
                    jawaban_user = parsed
                except (json.JSONDecodeError, TypeError, KeyError):
                    answers = {}
                    jawaban_user = []
                for row in pernyataan_rows:
                    user_value = answers.get(row.id)
                    pernyataan_out.append(HasilPernyataanDetail(
                        pernyataan_id=row.id,
                        teks=row.teks_pernyataan,
                        urutan=row.urutan,
                        jawaban_user=user_value,
                        jawaban_benar=bool(row.is_benar),
                        is_correct=user_value is not None and bool(user_value) == bool(row.is_benar),
                    ))
                is_correct = len(answers) == len(pernyataan_rows) and all(item.is_correct for item in pernyataan_out)
                jawaban_benar = None
            else:
                jawaban_benar = kunci_ids[0] if kunci_ids else None
                if jawaban and jawaban.jawaban:
                    try:
                        jawaban_user = int(jawaban.jawaban)
                    except ValueError:
                        jawaban_user = None
                is_correct = jawaban_user is not None and jawaban_user == jawaban_benar
        elif soal.tipe == "pilihan_lebih_dari_satu":
            jawaban_benar = kunci_ids
            if jawaban and jawaban.jawaban:
                try:
                    parsed = json.loads(jawaban.jawaban)
                    jawaban_user = parsed if isinstance(parsed, list) else None
                except (json.JSONDecodeError, ValueError, TypeError):
                    jawaban_user = None
            jawaban_set = set(jawaban_user) if jawaban_user else set()
            is_correct = bool(jawaban_set) and jawaban_set == set(kunci_ids)
        elif soal.tipe == "isian" and soal.kunci_jawaban:
            jawaban_benar = soal.kunci_jawaban
            jawaban_user = jawaban.jawaban if jawaban else None
            from app.services.scoring import _isian_cocok_kunci
            is_correct = bool(jawaban_user) and _isian_cocok_kunci(soal.kunci_jawaban, jawaban_user)
        else:
            jawaban_user = jawaban.jawaban if jawaban else None
            skor_manual = jawaban.skor_manual if jawaban else None
            if jawaban and jawaban.skor_manual is not None:
                is_correct = jawaban.skor_manual >= 60

        soal_detail.append(
            HasilSoalDetail(
                nomor=idx,
                nomor_bagian=posisi_bagian.get(soal.id, (None, None))[0],
                bagian_nama=posisi_bagian.get(soal.id, (None, None))[1] or None,
                soal_id=soal.id,
                teks_soal=soal.teks_soal,
                tipe=soal.tipe,
                poin=soal.poin,
                opsi=opsi_out,
                label_benar=soal.label_benar if pernyataan_rows else None,
                label_salah=soal.label_salah if pernyataan_rows else None,
                pernyataan=pernyataan_out,
                jawaban_user=jawaban_user,
                jawaban_benar=jawaban_benar,
                is_correct=is_correct,
                skor_manual=skor_manual,
                pembahasan=soal.pembahasan,
            )
        )

    return HasilUjianDetailOut(
        ujian_siswa_id=ujian.id,
        skor=hasil.skor if hasil else None,
        soal=soal_detail,
        nama_paket=paket.nama if paket else None,
        metode_penilaian=metadata.get("metode_penilaian", paket.metode_penilaian if paket else "biasa"),
        kohort_status=metadata.get("kohort_status"),
        skala=metadata.get("skala"),
        skor_mentah=metadata.get("skor_mentah"),
        metadata=metadata,
    )


@router.post("/{ujian_siswa_id}/compute", response_model=HasilUjianOut)
def compute_hasil_ujian(
    ujian_siswa_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if current_user.role not in ["admin", "guru"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_siswa_id).first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")
    if not ujian.is_submitted:
        raise HTTPException(status_code=400, detail="Ujian has not been submitted")
    hasil = compute_and_store_hasil(db, ujian)
    db.commit()
    db.refresh(hasil)
    return hasil


@router.get("/{hasil_id}", response_model=HasilUjianOut)
def get_hasil_ujian(hasil_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    hasil = db.query(HasilUjian).filter(HasilUjian.id == hasil_id).first()
    if not hasil:
        raise HTTPException(status_code=404, detail="Hasil Ujian not found")
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == hasil.ujian_siswa_id).first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")
    authorize_hasil_access(ujian, current_user, db)
    return hasil
