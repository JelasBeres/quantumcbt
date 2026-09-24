from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, require_guru_scope, require_roles
from app.db.database import get_db
from app.models.kelas import Kelas
from app.models.opsi_jawaban import OpsiJawaban
from app.models.pernyataan_benar_salah import PernyataanBenarSalah
from app.routers.upload import read_validated_image
from app.models.paket_soal import PaketSoal
from app.models.paket_ujian import PaketUjian
from app.models.pelajaran import Pelajaran
from app.models.soal import Soal
from app.models.soal_review_history import SoalReviewHistory
from app.models.subbab import Subbab
from app.models.topik import Topik
from app.models.guru import Guru
from app.models.user import User
from app.schemas.opsi_jawaban import OpsiJawabanListUpdate, OpsiJawabanNestedCreate, OpsiJawabanAdminOut, OpsiJawabanOut
from app.schemas.pernyataan_benar_salah import PernyataanBenarSalahAdminOut, PernyataanBenarSalahReplace, PernyataanBenarSalahReplaceOut
from app.schemas.soal import SoalAdminOut, SoalCreate, SoalDetailAdminOut, SoalDetailOut, SoalGenerateOut, SoalGenerateRequest, SoalOut, SoalPreviewOut, SoalReviewAction, SoalReviewHistoryOut, SoalReviewReject

router = APIRouter(prefix="/soal", tags=["soal"])

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "soal"
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
VALID_SOAL_STATUS = {"draft", "pending_review", "rejected", "approved", "archived"}


def _history(db: Session, soal: Soal, actor_id: int | None, action: str, from_status: str | None, to_status: str, note: str | None = None) -> None:
    db.add(SoalReviewHistory(
        soal_id=soal.id,
        actor_user_id=actor_id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        note=note,
    ))


def _creator_names(db: Session, soal_list: List[Soal]) -> dict[int, str]:
    """Nama pembuat soal: pakai nama lengkap guru bila ada, jika tidak pakai username."""
    user_ids = {soal.created_by for soal in soal_list if soal.created_by is not None}
    if not user_ids:
        return {}
    names = {
        user_id: username
        for user_id, username in db.query(User.id, User.username).filter(User.id.in_(user_ids)).all()
    }
    for user_id, nama_lengkap in db.query(Guru.user_id, Guru.nama_lengkap).filter(Guru.user_id.in_(user_ids)).all():
        if nama_lengkap:
            names[user_id] = nama_lengkap
    return names


def _with_creator_names(db: Session, soal_list: List[Soal]) -> List[SoalAdminOut]:
    names = _creator_names(db, soal_list)
    rows: List[SoalAdminOut] = []
    for soal in soal_list:
        row = SoalAdminOut.model_validate(soal)
        row.created_by_name = names.get(soal.created_by) if soal.created_by is not None else None
        rows.append(row)
    return rows


def _can_read_soal(soal: Soal, user) -> bool:
    return user.role == "admin" or soal.status == "approved" or soal.created_by == user.id


def _require_read_soal(soal: Soal, user) -> None:
    if not _can_read_soal(soal, user):
        raise HTTPException(status_code=403, detail="Soal belum diterbitkan atau bukan milik Anda")


def _require_edit_soal(soal: Soal, user) -> None:
    if user.role == "admin":
        return
    if soal.created_by != user.id:
        raise HTTPException(status_code=403, detail="Hanya pembuat soal yang dapat mengubah soal ini")
    if soal.status not in {"draft", "rejected"}:
        raise HTTPException(status_code=409, detail="Soal hanya dapat diedit saat draft atau perlu revisi")


def validate_soal_payload(payload: SoalCreate, db: Session) -> tuple[int | None, str | None]:
    if payload.paket_ujian_id is not None:
        paket = db.query(PaketUjian).filter(PaketUjian.id == payload.paket_ujian_id).first()
        if not paket:
            raise HTTPException(status_code=404, detail="Paket Ujian not found")
    if payload.pelajaran_id is not None:
        pelajaran = db.query(Pelajaran).filter(Pelajaran.id == payload.pelajaran_id).first()
        if not pelajaran:
            raise HTTPException(status_code=404, detail="Pelajaran not found")
    if payload.kelas_id is not None:
        kelas = db.query(Kelas).filter(Kelas.id == payload.kelas_id).first()
        if not kelas:
            raise HTTPException(status_code=404, detail="Kelas not found")
    topik = None
    if payload.topik_id is not None:
        topik = db.query(Topik).filter(Topik.id == payload.topik_id).first()
        if not topik:
            raise HTTPException(status_code=404, detail="Topik not found")
        if payload.pelajaran_id != topik.pelajaran_id:
            raise HTTPException(status_code=400, detail="Bab tidak sesuai dengan mata pelajaran")
    if (payload.subbab_id is not None or payload.subbab) and topik is None:
        raise HTTPException(status_code=400, detail="Pilih bab sebelum memilih sub bab")
    if payload.subbab_id is not None:
        if payload.topik_id is None:
            raise HTTPException(status_code=400, detail="Pilih bab sebelum memilih sub bab")
        subbab = db.query(Subbab).filter(Subbab.id == payload.subbab_id).first()
        if not subbab:
            raise HTTPException(status_code=404, detail="Sub bab tidak ditemukan")
        if subbab.topik_id != payload.topik_id:
            raise HTTPException(status_code=400, detail="Sub bab tidak sesuai dengan bab yang dipilih")
        linked_topik = db.query(Topik).filter(Topik.id == subbab.topik_id).first()
        if not linked_topik or payload.pelajaran_id != linked_topik.pelajaran_id:
            raise HTTPException(status_code=400, detail="Sub bab tidak sesuai dengan mata pelajaran")
        return subbab.id, subbab.nama
    if payload.subbab and payload.topik_id is not None:
        subbab = db.query(Subbab).filter(
            Subbab.topik_id == payload.topik_id,
            func.lower(Subbab.nama) == payload.subbab.lower(),
        ).first()
        if subbab:
            return subbab.id, subbab.nama
    return None, payload.subbab



def validate_opsi_for_tipe(tipe: str, opsi_payload: List[OpsiJawabanNestedCreate]) -> List[OpsiJawabanNestedCreate]:
    opsi_valid = [o for o in opsi_payload if o.teks_opsi and o.teks_opsi.strip()]
    if tipe == "pilihan_ganda":
        if len(opsi_valid) < 2:
            raise HTTPException(status_code=400, detail="Soal pilihan ganda wajib punya minimal dua opsi")
        if sum(1 for o in opsi_valid if o.is_benar) != 1:
            raise HTTPException(status_code=400, detail="Soal pilihan ganda wajib punya tepat satu kunci jawaban")
    elif tipe == "pilihan_lebih_dari_satu":
        if len(opsi_valid) < 2:
            raise HTTPException(status_code=400, detail="Soal pilihan lebih dari satu wajib punya minimal dua opsi")
        if sum(1 for o in opsi_valid if o.is_benar) < 2:
            raise HTTPException(status_code=400, detail="Soal pilihan lebih dari satu wajib punya minimal dua kunci jawaban")
    elif tipe == "benar_salah":
        if len(opsi_valid) != 2:
            raise HTTPException(status_code=400, detail="Soal benar/salah wajib punya tepat dua opsi")
        if sum(1 for o in opsi_valid if o.is_benar) != 1:
            raise HTTPException(status_code=400, detail="Soal benar/salah wajib punya tepat satu kunci jawaban")
    return opsi_valid


def _sync_child_rows(db: Session, existing: list, items: list, make_row) -> list:
    """Sinkronkan baris opsi/pernyataan milik soal secara in-place.

    Jawaban siswa menyimpan id opsi/pernyataan, jadi baris lama WAJIB
    dipertahankan (bukan hapus-lalu-buat-ulang); kalau tidak, semua jawaban
    yang sudah masuk dianggap salah saat skor dihitung ulang. Item dipasangkan
    ke baris lama lewat `id`; payload lama tanpa id dipasangkan per posisi.
    Mengembalikan baris hasil sesuai urutan `items`.
    """
    by_id = {row.id: row for row in existing}
    matched: list = []
    used: set[int] = set()
    if any(getattr(item, "id", None) is not None for item in items):
        for item in items:
            row = by_id.get(item.id) if item.id is not None else None
            if row is not None and row.id in used:
                row = None
            matched.append(row)
            if row is not None:
                used.add(row.id)
    else:
        matched = [existing[i] if i < len(existing) else None for i in range(len(items))]
        used = {row.id for row in matched if row is not None}
    for row in existing:
        if row.id not in used:
            db.delete(row)
    # Geser urutan baris lama ke nilai sementara dulu agar tidak bentrok
    # dengan unique (soal_id, urutan) saat urutan ditukar.
    for index, row in enumerate(row for row in matched if row is not None):
        row.urutan = -(index + 1)
    db.flush()
    result = []
    for position, (item, row) in enumerate(zip(items, matched), start=1):
        # Baris baru sengaja belum di-add ke session: pemanggil mengisi kolom
        # wajib dulu, baru db.add(), agar autoflush tidak menyimpan baris kosong.
        result.append((position, item, row if row is not None else make_row()))
    return result


def _pernyataan_rows(soal_id: int, db: Session) -> List[PernyataanBenarSalah]:
    return (
        db.query(PernyataanBenarSalah)
        .filter(PernyataanBenarSalah.soal_id == soal_id)
        .order_by(PernyataanBenarSalah.urutan, PernyataanBenarSalah.id)
        .all()
    )


def serialize_soal_detail(soal: Soal, db: Session) -> SoalDetailOut:
    opsi_list = (
        db.query(OpsiJawaban)
        .filter(OpsiJawaban.soal_id == soal.id)
        .order_by(OpsiJawaban.urutan, OpsiJawaban.id)
        .all()
    )
    pernyataan = _pernyataan_rows(soal.id, db)
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
        opsi_jawaban=opsi_list,
        label_benar=soal.label_benar if pernyataan else None,
        label_salah=soal.label_salah if pernyataan else None,
        pernyataan=pernyataan,
    )


def serialize_soal_detail_admin(soal: Soal, db: Session) -> SoalDetailAdminOut:
    opsi_list = (
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
        label_benar=soal.label_benar,
        label_salah=soal.label_salah,
        pembahasan=soal.pembahasan,
        status=soal.status,
        created_by=soal.created_by,
        created_by_name=_creator_names(db, [soal]).get(soal.created_by) if soal.created_by is not None else None,
        opsi_jawaban=opsi_list,
        pernyataan=_pernyataan_rows(soal.id, db),
    )


@router.post("/", response_model=SoalOut)
def create_soal(payload: SoalCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    if payload.paket_ujian_id is not None and current_user.role == "guru":
        from app.routers.paket_ujian import _require_paket_access, _ensure_paket_mutable

        paket = db.query(PaketUjian).filter(PaketUjian.id == payload.paket_ujian_id).first()
        if not paket:
            raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
        _require_paket_access(paket, current_user, db)

        _ensure_paket_mutable(paket, db)
    if current_user.role == "guru":
        if payload.pelajaran_id is None:
            raise HTTPException(status_code=400, detail="Pelajaran wajib dipilih")
        pelajaran = db.query(Pelajaran).filter(Pelajaran.id == payload.pelajaran_id).first()
        if not pelajaran:
            raise HTTPException(status_code=404, detail="Pelajaran not found")
        require_guru_scope(db, current_user, payload.pelajaran_id, pelajaran.program_id, payload.kelas_id)
    subbab_id, subbab_name = validate_soal_payload(payload, db)
    soal = Soal(
        paket_ujian_id=payload.paket_ujian_id,
        pelajaran_id=payload.pelajaran_id,
        kelas_id=payload.kelas_id,
        topik_id=payload.topik_id,
        subbab_id=subbab_id,
        subbab=subbab_name,
        teks_soal=payload.teks_soal,
        tipe=payload.tipe,
        gambar_url=payload.gambar_url,
        tingkat_kesulitan=payload.tingkat_kesulitan,
        poin=payload.poin,
        kunci_jawaban=payload.kunci_jawaban,
        label_benar=payload.label_benar,
        label_salah=payload.label_salah,
        pembahasan=payload.pembahasan,
        status="approved" if current_user.role == "admin" else "draft",
        created_by=current_user.id,
        reviewed_by=current_user.id if current_user.role == "admin" else None,
        reviewed_at=datetime.now(timezone.utc) if current_user.role == "admin" else None,
        published_at=datetime.now(timezone.utc) if current_user.role == "admin" else None,
    )
    db.add(soal)
    db.flush()
    _history(db, soal, current_user.id, "created", None, soal.status)

    # Jika paket diberikan (untuk kompatibilitas lama/tes), tautkan ke relasi bank
    if payload.paket_ujian_id is not None:
        paket = db.query(PaketUjian).filter(PaketUjian.id == payload.paket_ujian_id).first()
        urutan = (
            db.query(PaketSoal)
            .filter(PaketSoal.paket_ujian_id == payload.paket_ujian_id)
            .count()
        ) + 1
        db.add(PaketSoal(paket_ujian_id=payload.paket_ujian_id, soal_id=soal.id, urutan=urutan))
        if paket:
            paket.jumlah_soal = urutan

    db.commit()
    db.refresh(soal)
    return soal


@router.get("/", response_model=List[SoalAdminOut])
def list_soal(
    paket_ujian_id: Optional[int] = None,
    pelajaran_id: Optional[int] = None,
    kelas_id: Optional[int] = None,
    topik_id: Optional[int] = None,
    subbab_id: Optional[int] = None,
    subbab: Optional[str] = None,
    status_filter: Optional[str] = None,
    mine: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    query = db.query(Soal)
    if status_filter is not None and status_filter not in VALID_SOAL_STATUS:
        raise HTTPException(status_code=400, detail="Status soal tidak valid")
    if current_user.role == "guru":
        query = query.filter(
            Soal.created_by == current_user.id if mine
            else or_(Soal.status == "approved", Soal.created_by == current_user.id)
        )
    if status_filter is not None:
        query = query.filter(Soal.status == status_filter)
    if paket_ujian_id is not None:
        query = query.filter(Soal.paket_ujian_id == paket_ujian_id)
    if pelajaran_id is not None:
        query = query.filter(Soal.pelajaran_id == pelajaran_id)
    if kelas_id is not None:
        query = query.filter(Soal.kelas_id == kelas_id)
    if topik_id is not None:
        query = query.filter(Soal.topik_id == topik_id)
    if subbab_id is not None:
        query = query.filter(Soal.subbab_id == subbab_id)
    if subbab is not None:
        query = query.filter(Soal.subbab == subbab.strip())
    return _with_creator_names(db, query.order_by(Soal.id.desc()).all())


@router.post("/generate-kandidat", response_model=SoalGenerateOut)
def generate_kandidat_soal(
    payload: SoalGenerateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    if not db.query(Pelajaran.id).filter(Pelajaran.id == payload.pelajaran_id).first():
        raise HTTPException(status_code=404, detail="Pelajaran not found")
    require_guru_scope(db, current_user, payload.pelajaran_id, payload.program_id, payload.kelas_id)
    if payload.kelas_id is not None and not db.query(Kelas.id).filter(Kelas.id == payload.kelas_id).first():
        raise HTTPException(status_code=404, detail="Kelas not found")
    if payload.topik_id is not None:
        topik = db.query(Topik).filter(Topik.id == payload.topik_id).first()
        if not topik:
            raise HTTPException(status_code=404, detail="Topik not found")
        if topik.pelajaran_id != payload.pelajaran_id:
            raise HTTPException(status_code=400, detail="Bab tidak sesuai dengan mata pelajaran")
    if payload.subbab_id is not None:
        subbab = db.query(Subbab).filter(Subbab.id == payload.subbab_id).first()
        if not subbab:
            raise HTTPException(status_code=404, detail="Sub bab tidak ditemukan")
        if subbab.topik_id != payload.topik_id:
            raise HTTPException(status_code=400, detail="Sub bab tidak sesuai dengan bab yang dipilih")

    query = db.query(Soal).filter(
        Soal.pelajaran_id == payload.pelajaran_id,
        Soal.tipe == payload.tipe,
        Soal.tingkat_kesulitan == payload.kesulitan,
        Soal.status == "approved",
    )
    if payload.kelas_id is not None:
        query = query.filter(Soal.kelas_id == payload.kelas_id)
    if payload.topik_id is not None:
        query = query.filter(Soal.topik_id == payload.topik_id)
    if payload.exclude_ids:
        query = query.filter(~Soal.id.in_(set(payload.exclude_ids)))
    if payload.subbab_id is not None:
        query = query.filter(Soal.subbab_id == payload.subbab_id)
    elif payload.subbab and payload.subbab.strip():
        query = query.filter(Soal.subbab == payload.subbab.strip())

    available = query.count()
    items = query.order_by(func.random()).limit(payload.jumlah).all()
    selected = len(items)
    return SoalGenerateOut(
        requested=payload.jumlah,
        available=available,
        selected=selected,
        shortage=max(0, payload.jumlah - selected),
        items=items,
    )


@router.get("/{soal_id}", response_model=SoalDetailAdminOut)
def get_soal(soal_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    soal = db.query(Soal).filter(Soal.id == soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    _require_read_soal(soal, current_user)
    return serialize_soal_detail_admin(soal, db)


@router.get("/{soal_id}/preview", response_model=SoalPreviewOut)
def preview_soal(soal_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    soal = db.query(Soal).filter(Soal.id == soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    _require_read_soal(soal, current_user)
    detail = serialize_soal_detail(soal, db)
    return SoalPreviewOut(
        id=soal.id,
        teks_soal=soal.teks_soal,
        tipe=soal.tipe,
        poin=soal.poin,
        gambar_url=soal.gambar_url,
        contains_html="<" in soal.teks_soal and ">" in soal.teks_soal,
        contains_latex="\\" in soal.teks_soal or "$" in soal.teks_soal,
        opsi_jawaban=detail.opsi_jawaban,
        label_benar=detail.label_benar,
        label_salah=detail.label_salah,
        pernyataan=detail.pernyataan,
    )


@router.post("/{soal_id}/upload-gambar", response_model=SoalDetailAdminOut)
def upload_gambar_soal(
    soal_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    soal = db.query(Soal).filter(Soal.id == soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    _require_edit_soal(soal, current_user)

    original_name = file.filename or ""
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Format gambar tidak didukung")
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar")

    content = read_validated_image(file, extension)

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    target_path = UPLOAD_ROOT / filename
    target_path.write_bytes(content)

    soal.gambar_url = f"/uploads/soal/{filename}"
    db.add(soal)
    db.commit()
    db.refresh(soal)
    return serialize_soal_detail_admin(soal, db)


@router.get("/{soal_id}/opsi", response_model=List[OpsiJawabanAdminOut])
def list_opsi_by_soal(soal_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    soal = db.query(Soal).filter(Soal.id == soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    return (
        db.query(OpsiJawaban)
        .filter(OpsiJawaban.soal_id == soal_id)
        .order_by(OpsiJawaban.urutan, OpsiJawaban.id)
        .all()
    )


@router.post("/{soal_id}/opsi", response_model=OpsiJawabanAdminOut)
def create_opsi_by_soal(
    soal_id: int,
    payload: OpsiJawabanNestedCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    soal = db.query(Soal).filter(Soal.id == soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    _require_edit_soal(soal, current_user)
    if payload.urutan is not None:
        existing = (
            db.query(OpsiJawaban)
            .filter(OpsiJawaban.soal_id == soal_id, OpsiJawaban.urutan == payload.urutan)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Urutan opsi sudah digunakan untuk soal ini")
    opsi = OpsiJawaban(
        soal_id=soal_id,
        teks_opsi=payload.teks_opsi,
        is_benar=payload.is_benar,
        urutan=payload.urutan,
    )
    db.add(opsi)
    db.commit()
    db.refresh(opsi)
    return opsi


@router.put("/{soal_id}/opsi", response_model=List[OpsiJawabanAdminOut])
def replace_opsi_by_soal(
    soal_id: int,
    payload: OpsiJawabanListUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    """Ganti seluruh opsi jawaban sebuah soal sekaligus (untuk form soal lengkap)."""
    soal = db.query(Soal).filter(Soal.id == soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    _require_edit_soal(soal, current_user)

    # Soal esai/isian tidak perlu opsi jawaban, langsung return empty list
    if soal.tipe in ("esai", "isian"):
        db.query(OpsiJawaban).filter(OpsiJawaban.soal_id == soal_id).delete(synchronize_session=False)
        db.commit()
        return []
    
    opsi_valid = validate_opsi_for_tipe(soal.tipe or "pilihan_ganda", payload.opsi)

    existing = (
        db.query(OpsiJawaban)
        .filter(OpsiJawaban.soal_id == soal_id)
        .order_by(OpsiJawaban.urutan, OpsiJawaban.id)
        .all()
    )
    created: List[OpsiJawabanAdminOut] = []
    for urutan, item, opsi in _sync_child_rows(db, existing, opsi_valid, lambda: OpsiJawaban(soal_id=soal_id)):
        opsi.teks_opsi = item.teks_opsi
        opsi.is_benar = item.is_benar
        opsi.urutan = item.urutan if item.urutan is not None else urutan
        db.add(opsi)
        db.flush()
        created.append(
            OpsiJawabanAdminOut(
                id=opsi.id,
                soal_id=opsi.soal_id,
                teks_opsi=opsi.teks_opsi,
                is_benar=opsi.is_benar,
                urutan=opsi.urutan,
            )
        )
    db.commit()
    return created


@router.put("/{soal_id}/pernyataan-benar-salah", response_model=PernyataanBenarSalahReplaceOut)
def replace_pernyataan_benar_salah(
    soal_id: int,
    payload: PernyataanBenarSalahReplace,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    soal = db.query(Soal).filter(Soal.id == soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    _require_edit_soal(soal, current_user)
    if soal.tipe != "benar_salah":
        raise HTTPException(status_code=400, detail="Pernyataan hanya dapat digunakan untuk soal benar/salah")
    label_benar = payload.label_benar.strip()
    label_salah = payload.label_salah.strip()
    if not label_benar or not label_salah:
        raise HTTPException(status_code=400, detail="Label jawaban wajib diisi")
    if label_benar.casefold() == label_salah.casefold():
        raise HTTPException(status_code=400, detail="Label jawaban harus berbeda")
    rows = [item for item in payload.pernyataan if item.teks_pernyataan and item.teks_pernyataan.strip()]
    if len(rows) != len(payload.pernyataan) or not rows:
        raise HTTPException(status_code=400, detail="Minimal satu pernyataan tidak kosong wajib diisi")

    soal.label_benar = label_benar
    soal.label_salah = label_salah
    db.add(soal)
    created = []
    existing = _pernyataan_rows(soal_id, db)
    for urutan, item, row in _sync_child_rows(db, existing, rows, lambda: PernyataanBenarSalah(soal_id=soal_id)):
        row.teks_pernyataan = item.teks_pernyataan
        row.urutan = urutan
        row.is_benar = item.is_benar
        db.add(row)
        db.flush()
        created.append(PernyataanBenarSalahAdminOut.model_validate(row))
    db.commit()
    return PernyataanBenarSalahReplaceOut(
        label_benar=label_benar,
        label_salah=label_salah,
        pernyataan=created,
    )


@router.put("/{soal_id}", response_model=SoalAdminOut)
def update_soal(soal_id: int, payload: SoalCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    soal = db.query(Soal).filter(Soal.id == soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    _require_edit_soal(soal, current_user)
    _require_read_soal(soal, current_user)
    if current_user.role == "guru":
        if payload.pelajaran_id is None:
            raise HTTPException(status_code=400, detail="Pelajaran wajib dipilih")
        pelajaran = db.query(Pelajaran).filter(Pelajaran.id == payload.pelajaran_id).first()
        if not pelajaran:
            raise HTTPException(status_code=404, detail="Pelajaran not found")
        require_guru_scope(db, current_user, payload.pelajaran_id, pelajaran.program_id, payload.kelas_id)
    subbab_id, subbab_name = validate_soal_payload(payload, db)
    hierarchy_changed = payload.pelajaran_id != soal.pelajaran_id or payload.topik_id != soal.topik_id
    soal.paket_ujian_id = payload.paket_ujian_id
    soal.pelajaran_id = payload.pelajaran_id
    soal.kelas_id = payload.kelas_id
    if "subbab_id" in payload.model_fields_set or "subbab" in payload.model_fields_set:
        soal.subbab_id = subbab_id
        soal.subbab = subbab_name
    elif hierarchy_changed:
        soal.subbab_id = None
        soal.subbab = None
    soal.topik_id = payload.topik_id
    soal.teks_soal = payload.teks_soal
    soal.tipe = payload.tipe
    soal.gambar_url = payload.gambar_url
    soal.tingkat_kesulitan = payload.tingkat_kesulitan
    soal.poin = payload.poin
    soal.kunci_jawaban = payload.kunci_jawaban
    if payload.label_benar is not None:
        soal.label_benar = payload.label_benar
    if payload.label_salah is not None:
        soal.label_salah = payload.label_salah
    soal.pembahasan = payload.pembahasan
    if soal.status == "rejected":
        previous = soal.status
        soal.status = "draft"
        soal.rejection_reason = None
        soal.reviewed_by = None
        soal.reviewed_at = None
        _history(db, soal, current_user.id, "revised", previous, soal.status)
    db.add(soal)
    db.commit()
    db.refresh(soal)
    return soal


@router.post("/{soal_id}/submit-review", response_model=SoalAdminOut)
def submit_soal_review(
    soal_id: int,
    payload: SoalReviewAction,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["guru"])),
):
    soal = db.query(Soal).filter(Soal.id == soal_id).with_for_update().first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    _require_edit_soal(soal, current_user)
    previous = soal.status
    soal.status = "pending_review"
    soal.submitted_for_review_at = datetime.now(timezone.utc)
    soal.rejection_reason = None
    _history(db, soal, current_user.id, "submitted", previous, soal.status, payload.note)
    db.commit()
    db.refresh(soal)
    return soal


@router.post("/{soal_id}/withdraw-review", response_model=SoalAdminOut)
def withdraw_soal_review(
    soal_id: int,
    payload: SoalReviewAction,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["guru"])),
):
    soal = db.query(Soal).filter(Soal.id == soal_id).with_for_update().first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    if soal.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Hanya pembuat soal yang dapat menarik review")
    if soal.status != "pending_review":
        raise HTTPException(status_code=409, detail="Hanya soal menunggu review yang dapat ditarik")
    previous = soal.status
    soal.status = "draft"
    soal.submitted_for_review_at = None
    _history(db, soal, current_user.id, "withdrawn", previous, soal.status, payload.note)
    db.commit()
    db.refresh(soal)
    return soal


@router.post("/{soal_id}/approve", response_model=SoalAdminOut)
def approve_soal(
    soal_id: int,
    payload: SoalReviewAction,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    soal = db.query(Soal).filter(Soal.id == soal_id).with_for_update().first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    if soal.status != "pending_review":
        raise HTTPException(status_code=409, detail="Hanya soal menunggu review yang dapat disetujui")
    previous = soal.status
    now = datetime.now(timezone.utc)
    soal.status = "approved"
    soal.reviewed_by = current_user.id
    soal.reviewed_at = now
    soal.published_at = now
    soal.rejection_reason = None
    _history(db, soal, current_user.id, "approved", previous, soal.status, payload.note)
    if soal.parent_soal_id:
        from app.models.ujian_siswa import UjianSiswa
        from app.models.jadwal_ujian import JadwalUjian
        ancestors = set()
        parent_id = soal.parent_soal_id
        while parent_id and parent_id not in ancestors:
            ancestors.add(parent_id)
            parent = db.query(Soal).filter(Soal.id == parent_id).first()
            parent_id = parent.parent_soal_id if parent else None
        links = db.query(PaketSoal).filter(PaketSoal.soal_id.in_(ancestors)).all()
        for link in links:
            paket = db.query(PaketUjian).filter(PaketUjian.id == link.paket_ujian_id).with_for_update().first()
            if not paket or paket.is_archived:
                continue
            if db.query(UjianSiswa.id).filter(UjianSiswa.paket_ujian_id == paket.id).first():
                continue
            if db.query(JadwalUjian.id).filter(JadwalUjian.paket_ujian_id == paket.id, JadwalUjian.is_deleted == False, JadwalUjian.is_published == True, JadwalUjian.mulai <= now).first():
                continue
            duplicate = db.query(PaketSoal).filter(PaketSoal.paket_ujian_id == paket.id, PaketSoal.soal_id == soal.id).first()
            if duplicate:
                db.delete(link)
            else:
                link.soal_id = soal.id
            db.flush()
            paket.jumlah_soal = db.query(PaketSoal).filter(PaketSoal.paket_ujian_id == paket.id).count()
    db.commit()
    db.refresh(soal)
    return soal


@router.post("/{soal_id}/reject", response_model=SoalAdminOut)
def reject_soal(
    soal_id: int,
    payload: SoalReviewReject,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    soal = db.query(Soal).filter(Soal.id == soal_id).with_for_update().first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    if soal.status != "pending_review":
        raise HTTPException(status_code=409, detail="Hanya soal menunggu review yang dapat ditolak")
    previous = soal.status
    soal.status = "rejected"
    soal.reviewed_by = current_user.id
    soal.reviewed_at = datetime.now(timezone.utc)
    soal.rejection_reason = payload.note
    _history(db, soal, current_user.id, "rejected", previous, soal.status, payload.note)
    db.commit()
    db.refresh(soal)
    return soal


@router.post("/{soal_id}/archive", response_model=SoalAdminOut)
def archive_soal(
    soal_id: int,
    payload: SoalReviewAction,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    soal = db.query(Soal).filter(Soal.id == soal_id).with_for_update().first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    if soal.status != "approved":
        raise HTTPException(status_code=409, detail="Hanya soal approved yang dapat diarsipkan")
    previous = soal.status
    soal.status = "archived"
    soal.archived_at = datetime.now(timezone.utc)
    _history(db, soal, current_user.id, "archived", previous, soal.status, payload.note)
    db.commit()
    db.refresh(soal)
    return soal


@router.post("/{soal_id}/revision", response_model=SoalAdminOut)
def create_soal_revision(
    soal_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    source = db.query(Soal).filter(Soal.id == soal_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Soal not found")
    if source.status != "approved":
        raise HTTPException(status_code=409, detail="Revisi hanya dibuat dari soal approved")
    if current_user.role == "guru":
        # Guru boleh merevisi soal approved miliknya sendiri maupun guru lain
        # dalam penugasannya; revisi selalu berupa draft baru yang wajib
        # disetujui admin (guru tidak pernah bisa approve).
        if source.pelajaran_id is None:
            raise HTTPException(status_code=403, detail="Soal belum memiliki penugasan mata pelajaran")
        subject = db.query(Pelajaran).filter(Pelajaran.id == source.pelajaran_id).first()
        require_guru_scope(db, current_user, source.pelajaran_id, subject.program_id if subject else None, source.kelas_id)
    revision = Soal(
        paket_ujian_id=None,
        pelajaran_id=source.pelajaran_id,
        kelas_id=source.kelas_id,
        topik_id=source.topik_id,
        subbab_id=source.subbab_id,
        subbab=source.subbab,
        teks_soal=source.teks_soal,
        tipe=source.tipe,
        gambar_url=source.gambar_url,
        tingkat_kesulitan=source.tingkat_kesulitan,
        poin=source.poin,
        kunci_jawaban=source.kunci_jawaban,
        label_benar=source.label_benar,
        label_salah=source.label_salah,
        pembahasan=source.pembahasan,
        status="draft",
        created_by=current_user.id,
        parent_soal_id=source.id,
        version=(source.version or 1) + 1,
    )
    db.add(revision)
    db.flush()
    for opsi in db.query(OpsiJawaban).filter(OpsiJawaban.soal_id == source.id).order_by(OpsiJawaban.urutan).all():
        db.add(OpsiJawaban(
            soal_id=revision.id,
            teks_opsi=opsi.teks_opsi,
            is_benar=opsi.is_benar,
            urutan=opsi.urutan,
        ))
    for row in _pernyataan_rows(source.id, db):
        db.add(PernyataanBenarSalah(
            soal_id=revision.id,
            teks_pernyataan=row.teks_pernyataan,
            urutan=row.urutan,
            is_benar=row.is_benar,
        ))
    _history(db, revision, current_user.id, "revision_created", source.status, revision.status, f"Revisi dari soal #{source.id}")
    db.commit()
    db.refresh(revision)
    return revision


@router.get("/{soal_id}/review-history", response_model=List[SoalReviewHistoryOut])
def list_soal_review_history(
    soal_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    soal = db.query(Soal).filter(Soal.id == soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    _require_read_soal(soal, current_user)
    return db.query(SoalReviewHistory).filter(SoalReviewHistory.soal_id == soal_id).order_by(SoalReviewHistory.created_at, SoalReviewHistory.id).all()


@router.delete("/{soal_id}")
def delete_soal(soal_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    soal = db.query(Soal).filter(Soal.id == soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")
    _require_edit_soal(soal, current_user)
    if db.query(PaketSoal).filter(PaketSoal.soal_id == soal.id).first():
        raise HTTPException(status_code=409, detail="Soal sudah digunakan dalam paket dan tidak dapat dihapus")
    db.delete(soal)
    db.commit()
    return {"message": "Soal deleted successfully"}
