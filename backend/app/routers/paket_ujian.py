from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import guru_accessible_package_ids, guru_can_access_package, guru_can_access_section, require_guru_scope, require_roles
from app.db.database import get_db
from app.models.bagian_paket import BagianPaket
from app.models.paket_mapel import PaketMapel
from app.models.kelas import Kelas
from app.models.jadwal_ujian import JadwalUjian
from app.models.kategori_paket import KategoriPaket
from app.models.opsi_jawaban import OpsiJawaban
from app.models.paket_soal import PaketSoal
from app.models.paket_ujian import PaketUjian
from app.models.pelajaran import Pelajaran
from app.models.program import Program
from app.models.soal import Soal
from app.models.ujian_siswa import UjianSiswa
from app.schemas.opsi_jawaban import OpsiJawabanAdminOut, OpsiJawabanOut
from app.schemas.paket_ujian import (
    PaketSoalUpdateRequest,
    PaketUjianCloneRequest,
    PaketUjianCreate,
    PaketUjianDetailOut,
    PaketUjianOut,
    PaketUjianUpdate,
    TIPE_PAKET,
)
from app.schemas.soal import SoalDetailAdminOut, SoalDetailOut

router = APIRouter(prefix="/paket-ujian", tags=["paket_ujian"])


@router.put("/{paket_id}/penugasan")
def assign_package(paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    if not db.query(PaketUjian.id).filter(PaketUjian.id == paket_id).first():
        raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
    raise HTTPException(status_code=410, detail="Penugasan guru per paket sudah tidak digunakan. Atur Mapel yang Diampu pada profil guru.")





def _soal_detail(soal: Soal, db: Session) -> SoalDetailOut:
    opsi_rows = (
        db.query(OpsiJawaban)
        .filter(OpsiJawaban.soal_id == soal.id)
        .order_by(OpsiJawaban.urutan, OpsiJawaban.id)
        .all()
    )
    return SoalDetailOut(
        id=soal.id,
        paket_ujian_id=soal.paket_ujian_id,
        pelajaran_id=soal.pelajaran_id,
        kelas_id=soal.kelas_id,
        topik_id=soal.topik_id,
        subbab_id=soal.subbab_id,
        subbab=soal.subbab,
        teks_soal=soal.teks_soal,
        tipe=soal.tipe,
        gambar_url=soal.gambar_url,
        poin=soal.poin,
        opsi_jawaban=[
            OpsiJawabanOut(
                id=opsi.id,
                soal_id=opsi.soal_id,
                teks_opsi=opsi.teks_opsi,
                urutan=opsi.urutan,
            )
            for opsi in opsi_rows
        ],
    )


def _soal_detail_admin(soal: Soal, db: Session) -> SoalDetailAdminOut:
    opsi_rows = (
        db.query(OpsiJawaban)
        .filter(OpsiJawaban.soal_id == soal.id)
        .order_by(OpsiJawaban.urutan, OpsiJawaban.id)
        .all()
    )
    return SoalDetailAdminOut(
        id=soal.id,
        paket_ujian_id=soal.paket_ujian_id,
        pelajaran_id=soal.pelajaran_id,
        kelas_id=soal.kelas_id,
        topik_id=soal.topik_id,
        subbab_id=soal.subbab_id,
        subbab=soal.subbab,
        teks_soal=soal.teks_soal,
        tipe=soal.tipe,
        gambar_url=soal.gambar_url,
        tingkat_kesulitan=soal.tingkat_kesulitan,
        poin=soal.poin,
        kunci_jawaban=soal.kunci_jawaban,
        pembahasan=soal.pembahasan,
        status=soal.status,
        created_by=soal.created_by,
        opsi_jawaban=[
            OpsiJawabanAdminOut(
                id=opsi.id,
                soal_id=opsi.soal_id,
                teks_opsi=opsi.teks_opsi,
                is_benar=opsi.is_benar,
                urutan=opsi.urutan,
            )
            for opsi in opsi_rows
        ],
    )


def _paket_soal_ids(db: Session, paket_id: int) -> List[int]:
    rows = (
        db.query(PaketSoal)
        .filter(PaketSoal.paket_ujian_id == paket_id)
        .order_by(PaketSoal.urutan, PaketSoal.id)
        .all()
    )
    return [row.soal_id for row in rows]


def _paket_readiness(paket_id: int, db: Session) -> tuple[int, int, int, bool]:
    rows = (
        db.query(BagianPaket.id, BagianPaket.durasi_menit, BagianPaket.status, func.count(PaketSoal.id))
        .outerjoin(PaketSoal, PaketSoal.bagian_paket_id == BagianPaket.id)
        .filter(BagianPaket.paket_ujian_id == paket_id)
        .group_by(BagianPaket.id, BagianPaket.durasi_menit, BagianPaket.status)
        .all()
    )
    jumlah_bagian = len(rows)
    jumlah_bagian_kosong = sum(1 for _, _, _, jumlah in rows if jumlah == 0)
    jumlah_bagian_approved = sum(1 for _, _, status, _ in rows if status == "approved")
    total_soal = sum(jumlah for _, _, _, jumlah in rows)
    durasi_valid = all(durasi is not None and 1 <= durasi <= 1440 for _, durasi, _, _ in rows)
    semua_bagian_approved = jumlah_bagian > 0 and jumlah_bagian_approved == jumlah_bagian
    soal_ids = [row[0] for row in db.query(PaketSoal.soal_id).filter(PaketSoal.paket_ujian_id == paket_id).distinct().all()]
    semua_soal_approved = True
    if soal_ids:
        semua_soal_approved = db.query(Soal.id).filter(Soal.id.in_(soal_ids), Soal.status != "approved").first() is None
    siap = (
        jumlah_bagian > 0
        and jumlah_bagian_kosong == 0
        and total_soal > 0
        and durasi_valid
        and semua_bagian_approved
        and semua_soal_approved
    )
    return jumlah_bagian, jumlah_bagian_kosong, jumlah_bagian_approved, siap


def _derive_skala_kohort(category: KategoriPaket) -> str:
    identity = f"{category.kode} {category.nama}".upper()
    return "tka" if "TKA" in identity else "utbk"


def _validate_scoring_method(tipe: str, metode_penilaian: str) -> None:
    if metode_penilaian == "kohort" and tipe != "ujian":
        raise HTTPException(status_code=400, detail="Benchmark Kohort hanya tersedia untuk Try Out")


def _category_values(paket: PaketUjian, db: Session) -> tuple[Optional[int], Optional[str], Optional[str]]:
    category = paket.kategori_ref
    if category is None and paket.kategori_id is not None:
        category = db.query(KategoriPaket).filter(KategoriPaket.id == paket.kategori_id).first()
    if category:
        return category.id, category.kode, category.nama
    return paket.kategori_id, paket.kategori, None


def _paket_out(paket: PaketUjian, db: Session, readiness: tuple[int, int, int, bool] | None = None) -> dict:
    jumlah_bagian, jumlah_bagian_kosong, jumlah_bagian_approved, siap = readiness or _paket_readiness(paket.id, db)
    kategori_id, kategori, kategori_nama = _category_values(paket, db)
    if jumlah_bagian == 0 and kategori is None:
        siap = paket.jumlah_soal > 0 and paket.durasi_menit > 0
    return {
        "id": paket.id,
        "nama": paket.nama,
        "deskripsi": paket.deskripsi,
        "durasi_menit": paket.durasi_menit,
        "jumlah_soal": paket.jumlah_soal,
        "is_random_soal": paket.is_random_soal,
        "is_random_opsi": paket.is_random_opsi,
        "pelajaran_id": paket.pelajaran_id,
        "kelas_id": paket.kelas_id,
        "program_id": paket.program_id,
        "tipe": paket.tipe or "ujian",
        "kategori_id": kategori_id,
        "kategori": kategori,
        "kategori_nama": kategori_nama,
        "metode_penilaian": paket.metode_penilaian or "biasa",
        "skala_kohort": paket.skala_kohort or "utbk",
        "izinkan_pilih_mapel": paket.izinkan_pilih_mapel if paket.izinkan_pilih_mapel is not None else True,
        "kkm": paket.kkm if paket.kkm is not None else 75,
        "created_by": paket.created_by,
        "is_archived": paket.is_archived,
        "archived_at": paket.archived_at,
        "assigned_guru_ids": paket.assigned_guru_ids,
        "jumlah_bagian": jumlah_bagian,
        "jumlah_bagian_kosong": jumlah_bagian_kosong,
        "jumlah_bagian_approved": jumlah_bagian_approved,
        "siap_dipublikasikan": siap,
    }


def _visible_paket_soal_ids(db: Session, paket: PaketUjian, user) -> List[int]:
    query = db.query(PaketSoal).filter(PaketSoal.paket_ujian_id == paket.id)
    if user.role == "guru":
        sections = db.query(BagianPaket).filter(BagianPaket.paket_ujian_id == paket.id).all()
        if sections:
            visible_section_ids = [section.id for section in sections if guru_can_access_section(db, user, section, paket)]
            query = query.filter(PaketSoal.bagian_paket_id.in_(visible_section_ids)) if visible_section_ids else query.filter(False)
    rows = query.order_by(PaketSoal.urutan, PaketSoal.id).all()
    return [row.soal_id for row in rows]


def serialize_paket_detail(paket: PaketUjian, db: Session, user=None) -> PaketUjianDetailOut:
    soal_ids = _visible_paket_soal_ids(db, paket, user) if user is not None else _paket_soal_ids(db, paket.id)
    soal_map = {soal.id: soal for soal in db.query(Soal).filter(Soal.id.in_(soal_ids)).all()} if soal_ids else {}
    soal_detail = [_soal_detail(soal_map[sid], db) for sid in soal_ids if sid in soal_map]
    return PaketUjianDetailOut(**_paket_out(paket, db), soal=soal_detail)


def _validate_category(db: Session, payload: PaketUjianCreate | PaketUjianUpdate, current_tipe: str | None = None, current_category: KategoriPaket | None = None) -> KategoriPaket:
    if not db.query(KategoriPaket.id).first():
        from app.routers.kategori_paket import seed_kategori_paket
        seed_kategori_paket(db)
    category = current_category
    if payload.kategori_id is not None:
        category = db.query(KategoriPaket).filter(KategoriPaket.id == payload.kategori_id).first()
    elif payload.kategori is not None:
        category = db.query(KategoriPaket).filter(KategoriPaket.kode == payload.kategori).first()
    if category is None:
        raise HTTPException(status_code=400, detail="Kategori paket tidak ditemukan")
    tipe = payload.tipe or current_tipe or "ujian"
    if not category.is_active:
        raise HTTPException(status_code=400, detail="Kategori paket tidak aktif")
    if category.tipe not in ("keduanya", tipe):
        raise HTTPException(status_code=400, detail="Kategori tidak berlaku untuk tipe paket ini")
    return category


def _validate_paket_refs(
    db: Session,
    payload: PaketUjianCreate | PaketUjianUpdate,
    current_tipe: str | None = None,
    current_category: KategoriPaket | None = None,
    require_category: bool = True,
) -> Optional[KategoriPaket]:
    if payload.pelajaran_id is not None:
        pelajaran = db.query(Pelajaran).filter(Pelajaran.id == payload.pelajaran_id).first()
        if not pelajaran:
            raise HTTPException(status_code=404, detail="Pelajaran not found")
        if pelajaran.program_id is not None and payload.program_id is not None and pelajaran.program_id != payload.program_id:
            raise HTTPException(status_code=400, detail="Pelajaran harus berasal dari program paket")
    if payload.kelas_id is not None:
        if not db.query(Kelas).filter(Kelas.id == payload.kelas_id).first():
            raise HTTPException(status_code=404, detail="Kelas not found")
    if payload.program_id is not None:
        if not db.query(Program).filter(Program.id == payload.program_id).first():
            raise HTTPException(status_code=404, detail="Program not found")
    elif isinstance(payload, PaketUjianCreate):
        raise HTTPException(status_code=400, detail="Program wajib diisi")
    if payload.tipe is not None and payload.tipe not in TIPE_PAKET:
        raise HTTPException(status_code=400, detail="Tipe paket tidak valid")
    tipe = payload.tipe or current_tipe or "ujian"
    metode = payload.metode_penilaian if payload.metode_penilaian is not None else "biasa"
    _validate_scoring_method(tipe, metode)
    if require_category or payload.kategori_id is not None or payload.kategori is not None or current_category is not None:
        return _validate_category(db, payload, current_tipe, current_category)
    return None


def _require_paket_access(paket: PaketUjian, user, db: Session) -> None:
    if not guru_can_access_package(db, user, paket):
        raise HTTPException(status_code=403, detail="Paket berada di luar mapel yang diampu")


def _has_locking_attempt(paket_id: int, db: Session) -> bool:
    # Latihan per-mapel (scoped ke satu bagian, lihat /ujian-siswa/mulai-latihan)
    # bukan pengerjaan resmi dan tidak boleh mengunci paket dari perubahan.
    return (
        db.query(UjianSiswa.id)
        .filter(UjianSiswa.paket_ujian_id == paket_id, UjianSiswa.latihan_bagian_id.is_(None))
        .first()
        is not None
    )


def _ensure_paket_mutable(paket: PaketUjian, db: Session) -> None:
    if paket.is_archived:
        raise HTTPException(status_code=409, detail="Paket telah diarsipkan dan tidak dapat diubah")
    if _has_locking_attempt(paket.id, db):
        raise HTTPException(status_code=409, detail="Paket sudah memiliki attempt siswa. Clone paket untuk melakukan perubahan")


@router.post("/", response_model=PaketUjianOut)
def create_paket_ujian(payload: PaketUjianCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    category = _validate_paket_refs(db, payload)
    paket = PaketUjian(
        nama=payload.nama,
        deskripsi=payload.deskripsi,
        durasi_menit=0,
        jumlah_soal=payload.jumlah_soal,
        is_random_soal=payload.is_random_soal,
        is_random_opsi=payload.is_random_opsi,
        pelajaran_id=payload.pelajaran_id,
        kelas_id=payload.kelas_id,
        program_id=payload.program_id,
        tipe=payload.tipe,
        kategori_id=category.id,
        kategori=category.kode,
        metode_penilaian=payload.metode_penilaian,
        skala_kohort=payload.skala_kohort or _derive_skala_kohort(category),
        izinkan_pilih_mapel=payload.izinkan_pilih_mapel,
        kkm=payload.kkm,
        created_by=current_user.id,
    )
    db.add(paket)
    db.commit()
    db.refresh(paket)
    return _paket_out(paket, db)


@router.get("/", response_model=List[PaketUjianOut])
def list_paket_ujian(include_archived: bool = False, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    query = db.query(PaketUjian)
    if not include_archived:
        query = query.filter(PaketUjian.is_archived == False, PaketUjian.tipe.in_(TIPE_PAKET))
    rows = query.order_by(PaketUjian.id.desc()).all()
    if current_user.role == "admin":
        visible = rows
    else:
        visible_ids = guru_accessible_package_ids(db, current_user, (p.id for p in rows))
        visible = [p for p in rows if p.id in visible_ids]
    return [_paket_out(p, db) for p in visible]




@router.get("/{paket_id}", response_model=PaketUjianDetailOut)
def get_paket_ujian(paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    paket = db.query(PaketUjian).filter(PaketUjian.id == paket_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    _require_paket_access(paket, current_user, db)
    return serialize_paket_detail(paket, db, current_user)


@router.get("/{paket_id}/soal", response_model=List[SoalDetailOut])
def list_paket_soal(paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    paket = db.query(PaketUjian).filter(PaketUjian.id == paket_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    _require_paket_access(paket, current_user, db)
    soal_ids = _visible_paket_soal_ids(db, paket, current_user)
    soal_map = {soal.id: soal for soal in db.query(Soal).filter(Soal.id.in_(soal_ids)).all()} if soal_ids else {}
    return [_soal_detail(soal_map[sid], db) for sid in soal_ids if sid in soal_map]


@router.get("/{paket_id}/review-soal", response_model=List[SoalDetailAdminOut])
def list_paket_soal_for_review(paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    paket = db.query(PaketUjian).filter(PaketUjian.id == paket_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    soal_ids = _paket_soal_ids(db, paket.id)
    soal_map = {soal.id: soal for soal in db.query(Soal).filter(Soal.id.in_(soal_ids)).all()} if soal_ids else {}
    return [_soal_detail_admin(soal_map[sid], db) for sid in soal_ids if sid in soal_map]


@router.put("/{paket_id}/soal", response_model=PaketUjianDetailOut)
def set_paket_soal(paket_id: int, payload: PaketSoalUpdateRequest, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    paket = db.query(PaketUjian).filter(PaketUjian.id == paket_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    _require_paket_access(paket, current_user, db)
    _ensure_paket_mutable(paket, db)

    soal_ids = list(dict.fromkeys(payload.soal_ids))  # hilangkan duplikat, jaga urutan
    if current_user.role == "guru":
        if db.query(BagianPaket.id).filter(BagianPaket.paket_ujian_id == paket_id).first():
            raise HTTPException(status_code=409, detail="Isi soal melalui bagian mapel yang diampu")
        if paket.pelajaran_id is None:
            raise HTTPException(status_code=409, detail="Paket legacy belum memiliki mata pelajaran")
        require_guru_scope(db, current_user, paket.pelajaran_id, paket.program_id, paket.kelas_id)
        old_ids = [r.soal_id for r in db.query(PaketSoal).filter(PaketSoal.paket_ujian_id == paket_id).all()]
        questions = db.query(Soal).filter(Soal.id.in_(set(soal_ids + old_ids))).all() if soal_ids or old_ids else []
        for question in questions:
            if question.pelajaran_id != paket.pelajaran_id:
                raise HTTPException(status_code=403, detail="Soal harus sesuai mapel paket")
            require_guru_scope(db, current_user, question.pelajaran_id, paket.program_id, paket.kelas_id)

    if soal_ids:
        questions = db.query(Soal).filter(Soal.id.in_(soal_ids), Soal.status == "approved").all()
        existing = {s.id for s in questions}
        missing = [sid for sid in soal_ids if sid not in existing]
        if missing:
            raise HTTPException(status_code=400, detail=f"Soal belum approved atau tidak ditemukan: {missing}")
        if current_user.role == "guru":
            mismatched = [question.id for question in questions if question.pelajaran_id != paket.pelajaran_id]
            if mismatched:
                raise HTTPException(status_code=403, detail=f"Soal harus sesuai mapel paket: {mismatched}")

    db.query(PaketSoal).filter(PaketSoal.paket_ujian_id == paket.id).delete(synchronize_session=False)
    for urutan, soal_id in enumerate(soal_ids, start=1):
        db.add(PaketSoal(paket_ujian_id=paket.id, soal_id=soal_id, urutan=urutan))

    paket.jumlah_soal = len(soal_ids)
    db.commit()
    db.refresh(paket)
    return serialize_paket_detail(paket, db, current_user)


@router.post("/{paket_id}/clone", response_model=PaketUjianDetailOut)
def clone_paket_ujian(
    paket_id: int,
    payload: PaketUjianCloneRequest | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    source = db.query(PaketUjian).filter(PaketUjian.id == paket_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")

    if source.tipe not in TIPE_PAKET:
        raise HTTPException(status_code=409, detail="Tipe paket sudah tidak digunakan")

    clone = PaketUjian(
        nama=payload.nama if payload and payload.nama else f"{source.nama} Copy",
        deskripsi=payload.deskripsi if payload and payload.deskripsi is not None else source.deskripsi,
        durasi_menit=source.durasi_menit,
        jumlah_soal=source.jumlah_soal,
        is_random_soal=source.is_random_soal,
        is_random_opsi=source.is_random_opsi,
        pelajaran_id=source.pelajaran_id,
        kelas_id=source.kelas_id,
        program_id=source.program_id,
        tipe=source.tipe or "ujian",
        kategori_id=source.kategori_id,
        kategori=source.kategori_ref.kode if source.kategori_ref else source.kategori,
        metode_penilaian=source.metode_penilaian or "biasa",
        skala_kohort=source.skala_kohort or "utbk",
        izinkan_pilih_mapel=source.izinkan_pilih_mapel if source.izinkan_pilih_mapel is not None else True,
        kkm=source.kkm if source.kkm is not None else 75,
        created_by=current_user.id,
    )
    db.add(clone)
    db.flush()

    for mapel in db.query(PaketMapel).filter(PaketMapel.paket_ujian_id == source.id).all():
        db.add(PaketMapel(paket_ujian_id=clone.id, pelajaran_id=mapel.pelajaran_id, urutan=mapel.urutan))

    section_id_map = {}
    for section in db.query(BagianPaket).filter(BagianPaket.paket_ujian_id == source.id).order_by(BagianPaket.urutan, BagianPaket.id).all():
        cloned_section = BagianPaket(
            paket_ujian_id=clone.id,
            nama=section.nama,
            urutan=section.urutan,
            durasi_menit=section.durasi_menit,
            pelajaran_id=section.pelajaran_id,
            is_random_soal=section.is_random_soal,
            is_random_opsi=section.is_random_opsi,
            deskripsi=section.deskripsi,
        )
        db.add(cloned_section)
        db.flush()
        section_id_map[section.id] = cloned_section.id

    for row in db.query(PaketSoal).filter(PaketSoal.paket_ujian_id == source.id).order_by(PaketSoal.urutan, PaketSoal.id).all():
        db.add(PaketSoal(
            paket_ujian_id=clone.id,
            soal_id=row.soal_id,
            urutan=row.urutan,
            bagian_paket_id=section_id_map.get(row.bagian_paket_id),
        ))

    db.commit()
    db.refresh(clone)
    return serialize_paket_detail(clone, db)


@router.put("/{paket_id}", response_model=PaketUjianOut)
def update_paket_ujian(paket_id: int, payload: PaketUjianUpdate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    paket = db.query(PaketUjian).filter(PaketUjian.id == paket_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    if current_user.role == "guru":
        raise HTTPException(status_code=403, detail="Metadata paket hanya dapat diubah admin")
    _ensure_paket_mutable(paket, db)
    tipe_baru = payload.tipe if payload.tipe is not None else (paket.tipe or "ujian")
    category_supplied = "kategori_id" in payload.model_fields_set or "kategori" in payload.model_fields_set
    if not category_supplied and paket.kategori_ref is None:
        _validate_paket_refs(db, payload, tipe_baru, require_category=False)
        category = None
    else:
        category = _validate_paket_refs(db, payload, tipe_baru, paket.kategori_ref)
    paket.nama = payload.nama
    paket.deskripsi = payload.deskripsi
    if payload.durasi_menit is not None:
        paket.durasi_menit = payload.durasi_menit
    paket.jumlah_soal = payload.jumlah_soal
    paket.is_random_soal = payload.is_random_soal
    paket.is_random_opsi = payload.is_random_opsi
    paket.pelajaran_id = payload.pelajaran_id
    paket.kelas_id = payload.kelas_id
    paket.program_id = payload.program_id
    paket.tipe = tipe_baru
    metode_baru = payload.metode_penilaian if payload.metode_penilaian is not None else (paket.metode_penilaian or "biasa")
    _validate_scoring_method(tipe_baru, metode_baru)
    paket.metode_penilaian = metode_baru
    if payload.skala_kohort is not None:
        paket.skala_kohort = payload.skala_kohort
    elif not paket.skala_kohort and category is not None:
        paket.skala_kohort = _derive_skala_kohort(category)
    if payload.izinkan_pilih_mapel is not None:
        paket.izinkan_pilih_mapel = payload.izinkan_pilih_mapel
    if payload.kkm is not None:
        paket.kkm = payload.kkm
    if category is not None:
        paket.kategori_id = category.id
        paket.kategori = category.kode
    db.add(paket)
    db.commit()
    db.refresh(paket)
    return _paket_out(paket, db)


@router.delete("/{paket_id}")
def delete_paket_ujian(paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    paket = db.query(PaketUjian).filter(PaketUjian.id == paket_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    _require_paket_access(paket, current_user, db)
    if db.query(JadwalUjian.id).filter(JadwalUjian.paket_ujian_id == paket.id).first():
        raise HTTPException(status_code=409, detail="Paket sudah memiliki jadwal dan tidak dapat dihapus")
    if _has_locking_attempt(paket.id, db):
        raise HTTPException(status_code=409, detail="Paket sudah memiliki attempt siswa dan tidak dapat dihapus")
    db.query(PaketSoal).filter(PaketSoal.paket_ujian_id == paket.id).delete(synchronize_session=False)
    db.query(PaketMapel).filter(PaketMapel.paket_ujian_id == paket.id).delete(synchronize_session=False)
    db.delete(paket)
    db.commit()
    return {"message": "Paket Ujian deleted successfully"}


@router.post("/{paket_id}/archive", response_model=PaketUjianOut)
def archive_paket_ujian(paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    paket = db.query(PaketUjian).filter(PaketUjian.id == paket_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    _require_paket_access(paket, current_user, db)
    paket.is_archived = True
    paket.archived_at = paket.archived_at or datetime.now(timezone.utc)
    db.commit(); db.refresh(paket)
    return _paket_out(paket, db)


@router.post("/{paket_id}/unarchive", response_model=PaketUjianOut)
def unarchive_paket_ujian(paket_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    paket = db.query(PaketUjian).filter(PaketUjian.id == paket_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    if paket.tipe not in TIPE_PAKET:
        raise HTTPException(status_code=409, detail="Tipe paket sudah tidak digunakan")
    paket.is_archived = False
    paket.archived_at = None
    db.commit(); db.refresh(paket)
    return _paket_out(paket, db)
