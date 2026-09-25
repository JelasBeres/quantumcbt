from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, guru_has_scope, require_roles
from app.db.database import get_db
from app.models.bagian_paket import BagianPaket
from app.models.paket_mapel import PaketMapel
from app.models.paket_soal import PaketSoal
from app.models.pelajaran import Pelajaran
from app.routers.bagian_paket import _get_paket, _sync_paket_totals, _validate_pelajaran_bagian, ensure_paket_mapel
from app.schemas.paket_mapel import PaketMapelCreate, PaketMapelOut

# Alur admin latihan: Paket -> Mapel -> Set soal (bagian) -> Soal.
router = APIRouter(prefix="/paket-ujian/{paket_id}/mapel", tags=["paket_mapel"])


def _mapel_list(db: Session, paket_id: int) -> List[PaketMapelOut]:
    mapel_rows = (
        db.query(PaketMapel)
        .filter(PaketMapel.paket_ujian_id == paket_id)
        .order_by(PaketMapel.urutan, PaketMapel.id)
        .all()
    )
    sections = db.query(BagianPaket).filter(BagianPaket.paket_ujian_id == paket_id).all()
    soal_count = {b.id: 0 for b in sections}
    for (bagian_id,) in db.query(PaketSoal.bagian_paket_id).filter(PaketSoal.paket_ujian_id == paket_id).all():
        if bagian_id in soal_count:
            soal_count[bagian_id] += 1
    ids = [m.pelajaran_id for m in mapel_rows]
    nama = {p.id: p.nama for p in db.query(Pelajaran).filter(Pelajaran.id.in_(ids)).all()} if ids else {}
    result = []
    for mapel in mapel_rows:
        sets = [b for b in sections if b.pelajaran_id == mapel.pelajaran_id]
        result.append(PaketMapelOut(
            pelajaran_id=mapel.pelajaran_id,
            nama=nama.get(mapel.pelajaran_id, "-"),
            urutan=mapel.urutan,
            jumlah_set=len(sets),
            jumlah_set_approved=sum(1 for b in sets if b.status == "approved"),
            jumlah_soal=sum(soal_count[b.id] for b in sets),
        ))
    return result


@router.get("/", response_model=List[PaketMapelOut])
def list_mapel(paket_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    paket = _get_paket(paket_id, db, current_user)
    result = _mapel_list(db, paket_id)
    if current_user.role == "guru":
        result = [m for m in result if guru_has_scope(db, current_user, m.pelajaran_id, paket.program_id, paket.kelas_id)]
    return result


@router.post("/", response_model=PaketMapelOut)
def add_mapel(payload: PaketMapelCreate, paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    paket = _get_paket(paket_id, db, current_user, mutable=True)
    pelajaran = _validate_pelajaran_bagian(db, paket, payload.pelajaran_id)
    exists = (
        db.query(PaketMapel.id)
        .filter(PaketMapel.paket_ujian_id == paket_id, PaketMapel.pelajaran_id == pelajaran.id)
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail=f"Mapel {pelajaran.nama} sudah ada dalam paket ini")
    ensure_paket_mapel(db, paket_id, pelajaran.id)
    db.commit()
    return next(m for m in _mapel_list(db, paket_id) if m.pelajaran_id == pelajaran.id)


@router.delete("/{pelajaran_id}")
def delete_mapel(pelajaran_id: int, paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    _get_paket(paket_id, db, current_user, mutable=True)
    mapel = (
        db.query(PaketMapel)
        .filter(PaketMapel.paket_ujian_id == paket_id, PaketMapel.pelajaran_id == pelajaran_id)
        .first()
    )
    if not mapel:
        raise HTTPException(status_code=404, detail="Mapel tidak ada dalam paket ini")
    # Menghapus mapel ikut menghapus semua set soal mapel itu beserta relasi soalnya.
    bagian_ids = [
        bagian_id
        for (bagian_id,) in db.query(BagianPaket.id)
        .filter(BagianPaket.paket_ujian_id == paket_id, BagianPaket.pelajaran_id == pelajaran_id)
        .all()
    ]
    if bagian_ids:
        db.query(PaketSoal).filter(PaketSoal.bagian_paket_id.in_(bagian_ids)).delete(synchronize_session=False)
        db.query(BagianPaket).filter(BagianPaket.id.in_(bagian_ids)).delete(synchronize_session=False)
    db.delete(mapel)
    _sync_paket_totals(paket_id, db)
    db.commit()
    return {"message": "Mapel dihapus dari paket"}
