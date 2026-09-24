from datetime import datetime, timedelta, timezone
import json
import random
from typing import Dict, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_current_active_user, guru_accessible_package_ids, guru_can_access_package, require_roles
from app.core.timeutils import ensure_utc, utc_now
from app.db.database import get_db
from app.models.jadwal_ujian import JadwalUjian
from app.models.bagian_paket import BagianPaket
from app.models.paket_soal import PaketSoal
from app.models.paket_ujian import PaketUjian
from app.models.ujian_siswa import UjianSiswa
from app.models.jawaban_siswa import JawabanSiswa
from app.models.log_kecurangan import LogKecurangan
from app.models.soal import Soal
from app.models.opsi_jawaban import OpsiJawaban
from app.models.pernyataan_benar_salah import PernyataanBenarSalah
from app.models.siswa import Siswa
from app.schemas.jawaban_siswa import JawabanRaguUpdate
from app.schemas.jawaban_siswa import JawabanSiswaOut
from app.schemas.log_kecurangan import LogKecuranganOut, UjianLogKecuranganCreate
from app.schemas.ujian_siswa import (
    BagianUjianOut,
    JawabanSaveOut,
    JawabanSaveRequest,
    OptionOut,
    PernyataanUjianOut,
    UjianSoalOut,
    UjianSiswaCreate,
    UjianSiswaOut,
    UjianSiswaStartOut,
    UjianSiswaStartRequest,
    LatihanStartRequest,
    UjianSiswaStateOut,
)
from app.services.scoring import compute_and_store_hasil, evaluate_question, load_kunci

router = APIRouter(prefix="/ujian-siswa", tags=["ujian_siswa"])


def get_siswa_for_current_user(current_user, db: Session) -> Siswa:
    siswa = db.query(Siswa).filter(Siswa.user_id == current_user.id).first()
    if not siswa:
        raise HTTPException(status_code=404, detail="Siswa profile not found")
    return siswa


def authorize_ujian(ujian: UjianSiswa, current_user, db: Session) -> None:
    if current_user.role == "siswa":
        linked_siswa = db.query(Siswa).filter(Siswa.id == ujian.siswa_id, Siswa.user_id == current_user.id).first()
        if not linked_siswa:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    elif current_user.role == "guru":
        # Guru hanya untuk paket dalam penugasannya (mis. tidak bisa memaksa
        # submit ujian siswa di luar mapel yang diampu).
        paket = db.query(PaketUjian).filter(PaketUjian.id == ujian.paket_ujian_id).first()
        if not paket or not guru_can_access_package(db, current_user, paket):
            raise HTTPException(status_code=403, detail="Paket berada di luar penugasan guru")
    elif current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def effective_durasi_menit(ujian: UjianSiswa, paket: PaketUjian) -> int:
    # Latihan yang di-scope ke satu bagian/mapel memakai durasi bagian itu
    # sendiri, bukan durasi total paket (yang mencakup semua mapel).
    if ujian.latihan_bagian_id is not None and ujian.bagian_urutan:
        bagian = next((b for b in ujian.bagian_urutan if b.get("bagian_id") == ujian.latihan_bagian_id), None)
        if bagian and bagian.get("durasi_menit"):
            return bagian["durasi_menit"]
    return paket.durasi_menit


def calculate_time_info(ujian: UjianSiswa, paket: PaketUjian) -> tuple[int, Optional[datetime]]:
    if paket.tipe == "latihan" and ujian.mode_latihan == "drill":
        return -1, None
    if ujian.started_at is None:
        started_at = utc_now()
    else:
        started_at = ensure_utc(ujian.started_at)
    finish_at = started_at + timedelta(minutes=effective_durasi_menit(ujian, paket))
    now = utc_now()
    sisa_waktu_detik = max(0, int((finish_at - now).total_seconds()))
    return sisa_waktu_detik, finish_at


def get_bagian_aktif(ujian: UjianSiswa) -> Optional[dict]:
    if not ujian.bagian_urutan:
        return None
    idx = ujian.bagian_aktif or 0
    if idx < 0 or idx >= len(ujian.bagian_urutan):
        return None
    return ujian.bagian_urutan[idx]


def is_bagian_terakhir(ujian: UjianSiswa, paket: PaketUjian) -> bool:
    if paket.tipe != "ujian" or not ujian.bagian_urutan:
        return True
    return (ujian.bagian_aktif or 0) >= len(ujian.bagian_urutan) - 1


def harus_dikumpulkan(ujian: UjianSiswa, paket: PaketUjian) -> bool:
    """Flag `bagian_terakhir` untuk frontend: saat waktu habis, True berarti
    kumpulkan, False berarti lanjut bagian. Bila waktu KESELURUHAN ujian sudah
    habis (mis. durasi paket < jumlah durasi bagian), lanjut bagian pasti
    ditolak server, jadi paksa jalur kumpulkan."""
    return is_bagian_terakhir(ujian, paket) or is_ujian_expired(ujian, paket)


def calculate_display_time_info(ujian: UjianSiswa, paket: PaketUjian) -> tuple[int, Optional[datetime]]:
    """Sisa waktu yang ditampilkan/diawasi frontend: khusus paket tipe ujian
    dengan bagian_urutan, ini adalah sisa waktu BAGIAN yang sedang aktif
    (dikunci ke sisa waktu keseluruhan ujian sebagai batas atas). Paket
    latihan atau ujian tanpa bagian tetap memakai sisa waktu keseluruhan."""
    whole_sisa, whole_finish = calculate_time_info(ujian, paket)
    if whole_sisa == -1:
        return whole_sisa, whole_finish
    if paket.tipe != "ujian":
        return whole_sisa, whole_finish
    bagian = get_bagian_aktif(ujian)
    durasi = bagian.get("durasi_menit") if bagian else None
    if not durasi:
        return whole_sisa, whole_finish
    mulai = ensure_utc(ujian.bagian_mulai_at) if ujian.bagian_mulai_at else ensure_utc(ujian.started_at) if ujian.started_at else utc_now()
    finish_bagian = mulai + timedelta(minutes=durasi)
    if whole_finish and finish_bagian > whole_finish:
        finish_bagian = whole_finish
    sisa = max(0, int((finish_bagian - utc_now()).total_seconds()))
    return sisa, finish_bagian


def get_ujian_status(ujian: UjianSiswa, paket: PaketUjian) -> str:
    if ujian.is_submitted:
        return "selesai"
    sisa_waktu_detik, _ = calculate_time_info(ujian, paket)
    if sisa_waktu_detik == 0:
        return "timeout"
    return "sedang"


def is_ujian_expired(ujian: UjianSiswa, paket: PaketUjian) -> bool:
    sisa_waktu_detik, _ = calculate_time_info(ujian, paket)
    return sisa_waktu_detik == 0


def ensure_ujian_active(ujian: UjianSiswa, paket: PaketUjian) -> None:
    if ujian.is_submitted:
        raise HTTPException(status_code=400, detail="Ujian has been submitted")
    if is_ujian_expired(ujian, paket):
        raise HTTPException(status_code=400, detail="Ujian time has expired")


def ensure_bagian_aktif_berjalan(ujian: UjianSiswa, paket: PaketUjian) -> None:
    """Batas waktu per bagian ditegakkan di server, bukan hanya oleh timer
    frontend: setelah waktu bagian aktif habis, jawabannya terkunci sampai
    siswa lanjut ke bagian berikutnya. Pesan sengaja tanpa kata "expired"
    karena frontend memakai kata itu sebagai sinyal mengumpulkan ujian."""
    if paket.tipe != "ujian" or not ujian.bagian_urutan:
        return
    sisa_bagian, _ = calculate_display_time_info(ujian, paket)
    if sisa_bagian == 0:
        raise HTTPException(status_code=409, detail="Waktu bagian ini sudah habis, lanjut ke bagian berikutnya")


def active_question_ids(ujian: UjianSiswa, paket: PaketUjian) -> list[int]:
    if paket.tipe == "ujian" and ujian.bagian_urutan:
        bagian = get_bagian_aktif(ujian)
        return (bagian or {}).get("soal_ids") or []
    return ujian.soal_urutan or []


def require_active_question(ujian: UjianSiswa, paket: PaketUjian, soal_id: int) -> None:
    if soal_id not in active_question_ids(ujian, paket):
        raise HTTPException(status_code=409, detail="Soal bukan bagian mapel yang sedang aktif")


@router.post("/", response_model=UjianSiswaOut)
def create_ujian_siswa(payload: UjianSiswaCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin", "guru"]))):
    siswa = db.query(Siswa).filter(Siswa.id == payload.siswa_id).first()
    paket = db.query(PaketUjian).filter(PaketUjian.id == payload.paket_ujian_id).first()
    jadwal = db.query(JadwalUjian).filter(JadwalUjian.id == payload.jadwal_ujian_id, JadwalUjian.is_deleted == False).first()
    if not siswa or not paket or not jadwal:
        raise HTTPException(status_code=404, detail="Siswa, paket, atau jadwal tidak ditemukan")
    if jadwal.paket_ujian_id != paket.id:
        raise HTTPException(status_code=400, detail="Jadwal tidak sesuai dengan paket ujian")
    ujian = UjianSiswa(
        siswa_id=payload.siswa_id,
        paket_ujian_id=payload.paket_ujian_id,
        jadwal_ujian_id=payload.jadwal_ujian_id,
    )
    db.add(ujian)
    db.commit()
    db.refresh(ujian)
    return ujian


@router.post("/mulai", response_model=UjianSiswaStartOut)
def start_ujian_siswa(
    payload: UjianSiswaStartRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    jadwal = (
        db.query(JadwalUjian)
        .filter(
            JadwalUjian.id == payload.jadwal_ujian_id,
            JadwalUjian.is_deleted == False,
            JadwalUjian.is_published == True,
        )
        .first()
    )
    if not jadwal:
        raise HTTPException(status_code=404, detail="Jadwal Ujian not found")

    if current_user.role == "siswa":
        siswa = get_siswa_for_current_user(current_user, db)
        if jadwal.program_id is not None and siswa.program_id != jadwal.program_id:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        if jadwal.kelas_id is not None and siswa.kelas_id != jadwal.kelas_id:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    else:
        if payload.siswa_id is None:
            raise HTTPException(status_code=400, detail="siswa_id is required for non-siswa users")
        siswa = db.query(Siswa).filter(Siswa.id == payload.siswa_id).first()
        if not siswa:
            raise HTTPException(status_code=404, detail="Siswa not found")

    paket = db.query(PaketUjian).filter(PaketUjian.id == jadwal.paket_ujian_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")

    now = utc_now()
    if ensure_utc(jadwal.mulai) > now:
        raise HTTPException(status_code=400, detail="Jadwal ujian belum dimulai")
    selesai = ensure_utc(jadwal.selesai)
    if selesai and selesai < now:
        raise HTTPException(status_code=400, detail="Jadwal ujian telah berakhir")

    if paket.is_archived or paket.tipe != "ujian":
        raise HTTPException(status_code=409, detail="Paket tidak tersedia sebagai Tryout. Gunakan menu Latihan untuk berlatih.")

    # Cegah mengerjakan ulang: siswa hanya boleh satu kali per jadwal ujian
    submitted_ujian = (
        db.query(UjianSiswa)
        .filter(
            UjianSiswa.siswa_id == siswa.id,
            UjianSiswa.jadwal_ujian_id == jadwal.id,
            UjianSiswa.is_submitted == True,
        )
        .first()
    )
    if submitted_ujian:
        raise HTTPException(status_code=400, detail="Anda sudah mengerjakan ujian ini")

    existing_ujian = (
        db.query(UjianSiswa)
        .filter(
            UjianSiswa.siswa_id == siswa.id,
            UjianSiswa.jadwal_ujian_id == jadwal.id,
            UjianSiswa.is_submitted == False,
        )
        .first()
    )
    if existing_ujian and existing_ujian.soal_urutan:
        if is_ujian_expired(existing_ujian, paket):
            raise HTTPException(status_code=400, detail="Ujian time has expired")
        sisa_waktu_detik, waktu_selesai = calculate_time_info(existing_ujian, paket)
        return UjianSiswaStartOut(
            ujian_siswa_id=existing_ujian.id,
            jadwal_ujian_id=jadwal.id,
            soal_urutan=existing_ujian.soal_urutan,
            waktu_mulai=existing_ujian.started_at,
            waktu_selesai=waktu_selesai,
            durasi_menit=paket.durasi_menit,
            jumlah_soal=len(existing_ujian.soal_urutan),
            sisa_waktu_detik=sisa_waktu_detik,
        )

    return _initialize_attempt(db, siswa, paket, jadwal.id)


@router.post("/mulai-latihan", response_model=UjianSiswaStartOut)
def start_latihan(payload: LatihanStartRequest, db: Session = Depends(get_db), current_user=Depends(require_roles(["siswa"]))):
    siswa = get_siswa_for_current_user(current_user, db)
    paket = db.query(PaketUjian).filter(PaketUjian.id == payload.paket_ujian_id, PaketUjian.is_archived == False).first()
    if not paket or paket.tipe not in ("latihan", "ujian"):
        raise HTTPException(status_code=404, detail="Latihan tidak tersedia")
    if paket.tipe == "ujian":
        # Latihan per-mapel dari paket Tryout: harus diizinkan admin, dan wajib
        # scoped ke satu bagian (bukan pengganti pengerjaan Tryout penuh yang
        # terikat jadwal & skor kohort).
        if not paket.izinkan_pilih_mapel:
            raise HTTPException(status_code=409, detail="Paket ini hanya bisa dikerjakan penuh berurutan, bukan per mapel")
        if payload.bagian_id is None:
            raise HTTPException(status_code=400, detail="Pilih mapel untuk latihan dari paket tryout ini")
        # Latihan mapel baru terbuka setelah tryout selesai dikerjakan, agar siswa
        # tidak bisa melihat soal lebih dulu lewat mode latihan.
        sudah_tryout = db.query(UjianSiswa.id).filter(
            UjianSiswa.siswa_id == siswa.id,
            UjianSiswa.paket_ujian_id == paket.id,
            UjianSiswa.jadwal_ujian_id.isnot(None),
            UjianSiswa.is_submitted == True,
        ).first()
        if not sudah_tryout:
            raise HTTPException(status_code=409, detail="Latihan mapel tersedia setelah tryout ini selesai dikerjakan")
    if (paket.program_id is not None and paket.program_id != siswa.program_id) or (paket.kelas_id is not None and paket.kelas_id != siswa.kelas_id):
        raise HTTPException(status_code=403, detail="Latihan di luar program atau kelas Anda")
    bagian_id = payload.bagian_id
    if bagian_id is not None and not db.query(BagianPaket.id).filter(BagianPaket.id == bagian_id, BagianPaket.paket_ujian_id == paket.id).first():
        raise HTTPException(status_code=404, detail="Bagian/mapel tidak ditemukan pada latihan ini")
    # Latihan per-mapel dari paket Tryout selalu berwaktu (drill hanya untuk
    # paket latihan, lihat calculate_time_info & konfirmasi-drill).
    mode = payload.mode if paket.tipe == "latihan" else "latihan"
    mode_filter = UjianSiswa.mode_latihan == mode
    if paket.tipe == "ujian":
        # Attempt lama tersimpan dengan mode_latihan NULL; tetap dilanjutkan.
        mode_filter = or_(mode_filter, UjianSiswa.mode_latihan.is_(None))
    existing_query = db.query(UjianSiswa).filter(
        UjianSiswa.siswa_id == siswa.id, UjianSiswa.paket_ujian_id == paket.id,
        UjianSiswa.is_submitted == False, UjianSiswa.jadwal_ujian_id.is_(None), mode_filter,
    )
    existing_query = existing_query.filter(UjianSiswa.latihan_bagian_id.is_(None)) if bagian_id is None else existing_query.filter(UjianSiswa.latihan_bagian_id == bagian_id)
    existing = existing_query.order_by(UjianSiswa.id.desc()).first()
    if existing and not is_ujian_expired(existing, paket):
        remaining, finish = calculate_time_info(existing, paket)
        return UjianSiswaStartOut(ujian_siswa_id=existing.id, jadwal_ujian_id=None, soal_urutan=existing.soal_urutan,
            bagian_urutan=existing.bagian_urutan, waktu_mulai=ensure_utc(existing.started_at), waktu_selesai=finish,
            durasi_menit=effective_durasi_menit(existing, paket), jumlah_soal=len(existing.soal_urutan), sisa_waktu_detik=remaining)
    if existing:
        existing.is_submitted = True
        existing.finished_at = utc_now()
        db.commit()
    return _initialize_attempt(db, siswa, paket, mode=mode, bagian_id=bagian_id)


def _initialize_attempt(db: Session, siswa: Siswa, paket: PaketUjian, jadwal_id: int | None = None, mode: str = "latihan", bagian_id: int | None = None):
    # Serialize starting an attempt with automatic approved-revision replacement.
    paket = db.query(PaketUjian).filter(PaketUjian.id == paket.id).with_for_update().first()
    # soal diambil dari relasi PaketSoal (bank soal), bukan filter kolom soal.paket_ujian_id
    paket_soal_rows = (
        db.query(PaketSoal)
        .filter(PaketSoal.paket_ujian_id == paket.id)
        .order_by(PaketSoal.urutan, PaketSoal.id)
        .all()
    )
    if bagian_id is not None:
        paket_soal_rows = [r for r in paket_soal_rows if r.bagian_paket_id == bagian_id]
    if not paket_soal_rows:
        raise HTTPException(status_code=400, detail="No soal available for paket ujian")

    soal_map = {soal.id: soal for soal in db.query(Soal).filter(Soal.id.in_([r.soal_id for r in paket_soal_rows]), Soal.status == "approved").all()}
    soal_ids = [r.soal_id for r in paket_soal_rows if r.soal_id in soal_map]
    if not soal_ids:
        raise HTTPException(status_code=400, detail="No soal available for paket ujian")

    if paket.is_random_soal:
        random.shuffle(soal_ids)

    # Bagian (sub-paket): urutkan soal per bagian sesuai definisi paket.
    bagian_urutan: List[BagianUjianOut] = []
    bagian_rows = (
        db.query(BagianPaket)
        .filter(BagianPaket.paket_ujian_id == paket.id)
        .order_by(BagianPaket.urutan, BagianPaket.id)
        .all()
    )
    if bagian_rows:
        paket_soal_by_bagian: Dict[int, List[int]] = {}
        for row in paket_soal_rows:
            if row.bagian_paket_id is not None:
                paket_soal_by_bagian.setdefault(row.bagian_paket_id, []).append(row.soal_id)
        for bagian in bagian_rows:
            bagian_soal_ids = [sid for sid in paket_soal_by_bagian.get(bagian.id, []) if sid in soal_map]
            if paket.is_random_soal:
                random.shuffle(bagian_soal_ids)
            if not bagian_soal_ids:
                continue
            bagian_urutan.append(
                BagianUjianOut(
                    bagian_id=bagian.id,
                    nama=bagian.nama,
                    urutan=len(bagian_urutan) + 1,
                    durasi_menit=bagian.durasi_menit,
                    pelajaran_id=bagian.pelajaran_id,
                    soal_ids=bagian_soal_ids,
                )
            )
        # susun ulang soal_ids mengikuti urutan bagian; soal tanpa bagian tetap disertakan di akhir
        if bagian_urutan:
            in_bagian = {sid for b in bagian_urutan for sid in b.soal_ids}
            sisa_soal = [sid for sid in soal_ids if sid not in in_bagian]
            soal_ids = [sid for b in bagian_urutan for sid in b.soal_ids] + sisa_soal

    # Potong jumlah soal secara proporsional per bagian agar soal_urutan dan
    # bagian_urutan tetap konsisten dengan jumlah_soal.
    if paket.jumlah_soal and paket.jumlah_soal > 0 and paket.jumlah_soal < len(soal_ids):
        if bagian_urutan:
            sisa_kapasitas = paket.jumlah_soal
            bagian_baru: List[BagianUjianOut] = []
            for b in bagian_urutan:
                if sisa_kapasitas <= 0:
                    break
                ambil = min(len(b.soal_ids), sisa_kapasitas)
                bagian_baru.append(BagianUjianOut(
                    bagian_id=b.bagian_id,
                    nama=b.nama,
                    urutan=b.urutan,
                    durasi_menit=b.durasi_menit,
                    pelajaran_id=b.pelajaran_id,
                    soal_ids=b.soal_ids[:ambil],
                ))
                sisa_kapasitas -= ambil
            all_soal_ids = soal_ids
            bagian_urutan = bagian_baru
            soal_ids = [sid for b in bagian_urutan for sid in b.soal_ids]
            if sisa_kapasitas > 0:
                # sisa kapasitas diisi soal tanpa bagian (atau yang belum terpakai)
                dipakai = {sid for b in bagian_urutan for sid in b.soal_ids}
                sisa = [sid for sid in all_soal_ids if sid not in dipakai]
                soal_ids = soal_ids + sisa[:sisa_kapasitas]
        else:
            soal_ids = soal_ids[: paket.jumlah_soal]

    if bagian_urutan:
        assigned = {sid for b in bagian_urutan for sid in b.soal_ids}
        remaining_ids = [sid for sid in soal_ids if sid not in assigned]
        if remaining_ids:
            bagian_urutan.append(BagianUjianOut(nama="Bagian lainnya", urutan=len(bagian_urutan) + 1, soal_ids=remaining_ids))

    opsi_urutan_map: Dict[str, List[int]] = {}
    for soal_id in soal_ids:
        opsi_items = (
            db.query(OpsiJawaban).filter(OpsiJawaban.soal_id == soal_id).order_by(OpsiJawaban.urutan).all()
        )
        opsi_ids = [opsi.id for opsi in opsi_items]
        if paket.is_random_opsi:
            random.shuffle(opsi_ids)
        opsi_urutan_map[str(soal_id)] = opsi_ids

    ujian = UjianSiswa(
        siswa_id=siswa.id,
        paket_ujian_id=paket.id,
        jadwal_ujian_id=jadwal_id,
        # Semua attempt latihan (tanpa jadwal) menyimpan mode-nya agar bisa
        # dilanjutkan oleh /mulai-latihan; attempt tryout berjadwal tetap NULL.
        mode_latihan=mode if jadwal_id is None else None,
        soal_urutan=soal_ids,
        opsi_urutan=opsi_urutan_map,
        bagian_urutan=[b.model_dump() for b in bagian_urutan] if bagian_urutan else None,
        latihan_bagian_id=bagian_id,
    )
    db.add(ujian)
    try:
        db.commit()
    except IntegrityError:
        # Siswa lain/klik ganda sudah membuat attempt untuk jadwal ini;
        # ambil attempt yang ada alih-alih membuat duplikat.
        db.rollback()
        existing = (
            db.query(UjianSiswa)
            .filter(
                UjianSiswa.siswa_id == siswa.id,
                UjianSiswa.jadwal_ujian_id == jadwal_id,
            )
            .order_by(UjianSiswa.id.asc())
            .first()
        )
        if not existing:
            raise HTTPException(status_code=409, detail="Gagal memulai ujian, coba lagi")
        if existing.soal_urutan and is_ujian_expired(existing, paket):
            raise HTTPException(status_code=400, detail="Ujian time has expired")
        sisa_waktu_detik, waktu_selesai = calculate_time_info(existing, paket)
        return UjianSiswaStartOut(
            ujian_siswa_id=existing.id,
            jadwal_ujian_id=jadwal_id,
            soal_urutan=existing.soal_urutan,
            bagian_urutan=[BagianUjianOut(**b) for b in existing.bagian_urutan] if existing.bagian_urutan else None,
            waktu_mulai=existing.started_at,
            waktu_selesai=waktu_selesai,
            durasi_menit=paket.durasi_menit,
            jumlah_soal=len(existing.soal_urutan) if existing.soal_urutan else 0,
            sisa_waktu_detik=sisa_waktu_detik,
        )
    db.refresh(ujian)

    sisa_waktu_detik, waktu_selesai = calculate_time_info(ujian, paket)
    return UjianSiswaStartOut(
        ujian_siswa_id=ujian.id,
        jadwal_ujian_id=jadwal_id,
        soal_urutan=soal_ids,
        bagian_urutan=bagian_urutan if bagian_urutan else None,
        waktu_mulai=ujian.started_at,
        waktu_selesai=waktu_selesai,
        durasi_menit=effective_durasi_menit(ujian, paket),
        jumlah_soal=len(soal_ids),
        sisa_waktu_detik=sisa_waktu_detik,
    )


@router.get("/", response_model=List[UjianSiswaOut])
def list_ujian_siswa(
    siswa_id: Optional[int] = None,
    paket_ujian_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    query = db.query(UjianSiswa)
    if current_user.role == "siswa":
        owned_ids = [row.id for row in db.query(Siswa.id).filter(Siswa.user_id == current_user.id).all()]
        query = query.filter(UjianSiswa.siswa_id.in_(owned_ids))
    elif current_user.role == "guru":
        paket_ids = guru_accessible_package_ids(db, current_user, [row.id for row in db.query(PaketUjian.id).all()])
        query = query.filter(UjianSiswa.paket_ujian_id.in_(paket_ids))
    elif current_user.role != "admin":
        return []
    if siswa_id is not None:
        query = query.filter(UjianSiswa.siswa_id == siswa_id)
    if paket_ujian_id is not None:
        query = query.filter(UjianSiswa.paket_ujian_id == paket_ujian_id)
    return query.all()


@router.get("/{ujian_id}/soal/{nomor_urut}", response_model=UjianSoalOut)
def get_ujian_soal(
    ujian_id: int,
    nomor_urut: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_id).first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")
    authorize_ujian(ujian, current_user, db)
    if not ujian.soal_urutan:
        raise HTTPException(status_code=400, detail="Ujian has no soal order saved")
    if nomor_urut < 1 or nomor_urut > len(ujian.soal_urutan):
        raise HTTPException(status_code=404, detail="Soal not found")

    soal_id = ujian.soal_urutan[nomor_urut - 1]
    soal = db.query(Soal).filter(Soal.id == soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")

    paket = db.query(PaketUjian).filter(PaketUjian.id == ujian.paket_ujian_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    ensure_ujian_active(ujian, paket)
    require_active_question(ujian, paket, soal_id)

    opsi_list = db.query(OpsiJawaban).filter(OpsiJawaban.soal_id == soal_id).all()
    opsi_urutan = ujian.opsi_urutan or {}
    current_order = opsi_urutan.get(str(soal_id))
    if current_order is None or set(current_order) != {o.id for o in opsi_list}:
        current_order = [opsi.id for opsi in opsi_list]
        if paket.is_random_opsi:
            random.shuffle(current_order)
        opsi_urutan[str(soal_id)] = current_order
        ujian.opsi_urutan = opsi_urutan
        db.add(ujian)
        db.commit()
        db.refresh(ujian)

    opsi_map = {opsi.id: opsi for opsi in opsi_list}
    opsi_sorted: List[OptionOut] = []
    for index, opsi_id in enumerate(current_order):
        opsi = opsi_map.get(opsi_id)
        if opsi:
            opsi_sorted.append(OptionOut(opsi_id=opsi.id, teks=opsi.teks_opsi, posisi=index))

    jawaban = (
        db.query(JawabanSiswa)
        .filter(JawabanSiswa.ujian_siswa_id == ujian.id, JawabanSiswa.soal_id == soal_id)
        .first()
    )
    jawaban_user = None
    jawaban_teks = None
    is_ragu = False
    pernyataan_rows = db.query(PernyataanBenarSalah).filter(PernyataanBenarSalah.soal_id == soal_id).order_by(PernyataanBenarSalah.urutan).all()
    if jawaban:
        is_ragu = bool(jawaban.is_ragu)
        if jawaban.jawaban:
            if soal.tipe == "benar_salah" and pernyataan_rows:
                try:
                    parsed = json.loads(jawaban.jawaban)
                    jawaban_user = parsed if isinstance(parsed, list) else []
                except (json.JSONDecodeError, ValueError, TypeError):
                    jawaban_user = []
            elif soal.tipe in ("pilihan_ganda", "benar_salah"):
                try:
                    jawaban_user = int(jawaban.jawaban)
                except ValueError:
                    jawaban_user = None
            elif soal.tipe == "pilihan_lebih_dari_satu":
                try:
                    parsed = json.loads(jawaban.jawaban)
                    jawaban_user = parsed if isinstance(parsed, list) else []
                except (json.JSONDecodeError, ValueError, TypeError):
                    jawaban_user = []
            else:
                jawaban_teks = jawaban.jawaban

    return UjianSoalOut(
        soal_id=soal.id,
        teks_soal=soal.teks_soal,
        tipe=soal.tipe,
        poin=soal.poin,
        opsi_urutan=current_order,
        opsi=opsi_sorted,
        label_benar=soal.label_benar if pernyataan_rows else None,
        label_salah=soal.label_salah if pernyataan_rows else None,
        pernyataan=[PernyataanUjianOut(pernyataan_id=row.id, teks=row.teks_pernyataan, urutan=row.urutan) for row in pernyataan_rows],
        jawaban_user=jawaban_user,
        jawaban_teks=jawaban_teks,
        is_ragu=is_ragu,
        # Drilling: soal yang sudah dikonfirmasi langsung tampil berwarna saat dibuka lagi.
        drill_feedback=drill_feedback(db, soal, jawaban)
        if ujian.mode_latihan == "drill" and jawaban is not None and jawaban.dikonfirmasi_at is not None
        else None,
    )


@router.post("/{ujian_id}/jawab", response_model=JawabanSaveOut)
def save_ujian_jawaban(
    ujian_id: int,
    payload: JawabanSaveRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_id).with_for_update().first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")
    authorize_ujian(ujian, current_user, db)
    paket = db.query(PaketUjian).filter(PaketUjian.id == ujian.paket_ujian_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    if ujian.is_submitted:
        raise HTTPException(status_code=400, detail="Ujian has been submitted")
    sisa_waktu_detik, _ = calculate_time_info(ujian, paket)
    if sisa_waktu_detik == 0:
        raise HTTPException(status_code=400, detail="Ujian time has expired")
    if not ujian.soal_urutan or payload.soal_id not in ujian.soal_urutan:
        raise HTTPException(status_code=400, detail="Soal does not belong to this ujian")
    require_active_question(ujian, paket, payload.soal_id)
    ensure_bagian_aktif_berjalan(ujian, paket)

    soal = db.query(Soal).filter(Soal.id == payload.soal_id).first()
    if not soal:
        raise HTTPException(status_code=404, detail="Soal not found")

    pernyataan_rows = db.query(PernyataanBenarSalah).filter(PernyataanBenarSalah.soal_id == payload.soal_id).all()
    if soal.tipe == "benar_salah" and pernyataan_rows:
        if payload.jawaban_pernyataan is None:
            raise HTTPException(status_code=400, detail="jawaban_pernyataan is required untuk soal benar/salah majemuk")
        ids = [item.pernyataan_id for item in payload.jawaban_pernyataan]
        if len(ids) != len(set(ids)):
            raise HTTPException(status_code=400, detail="Pernyataan tidak boleh dijawab lebih dari sekali")
        valid_ids = {row.id for row in pernyataan_rows}
        if not set(ids).issubset(valid_ids):
            raise HTTPException(status_code=400, detail="Invalid pernyataan untuk soal")
        nilai_jawaban = json.dumps([
            {"pernyataan_id": item.pernyataan_id, "jawaban": item.jawaban}
            for item in sorted(payload.jawaban_pernyataan, key=lambda item: item.pernyataan_id)
        ])
    elif soal.tipe in ("pilihan_ganda", "benar_salah"):
        if payload.opsi_jawaban_id is None:
            raise HTTPException(status_code=400, detail="opsi_jawaban_id is required untuk soal pilihan ganda/benar salah")
        opsi = (
            db.query(OpsiJawaban)
            .filter(OpsiJawaban.id == payload.opsi_jawaban_id, OpsiJawaban.soal_id == payload.soal_id)
            .first()
        )
        if not opsi:
            raise HTTPException(status_code=400, detail="Invalid opsi jawaban untuk soal")
        nilai_jawaban = str(payload.opsi_jawaban_id)
    elif soal.tipe == "pilihan_lebih_dari_satu":
        if payload.opsi_jawaban_ids is None:
            raise HTTPException(status_code=400, detail="opsi_jawaban_ids is required untuk soal pilihan lebih dari satu")
        # Validasi semua opsi yang dikirim memang milik soal ini.
        valid_ids = {
            row.id
            for row in db.query(OpsiJawaban.id)
            .filter(OpsiJawaban.soal_id == payload.soal_id, OpsiJawaban.id.in_(payload.opsi_jawaban_ids or [-1]))
            .all()
        }
        if not set(payload.opsi_jawaban_ids).issubset(valid_ids):
            raise HTTPException(status_code=400, detail="Invalid opsi jawaban untuk soal")
        # Simpan sebagai JSON list (format yang dibaca scoring).
        nilai_jawaban = json.dumps(payload.opsi_jawaban_ids)
    else:
        if payload.jawaban_teks is None:
            raise HTTPException(status_code=400, detail="jawaban_teks is required untuk soal esai/isian")
        nilai_jawaban = payload.jawaban_teks

    jawaban = (
        db.query(JawabanSiswa)
        .filter(JawabanSiswa.ujian_siswa_id == ujian.id, JawabanSiswa.soal_id == payload.soal_id)
        .first()
    )
    if jawaban and jawaban.dikonfirmasi_at is not None:
        raise HTTPException(status_code=409, detail="Jawaban sudah dikonfirmasi dan tidak dapat diubah")
    if jawaban:
        jawaban.jawaban = nilai_jawaban
        if soal.tipe not in ("pilihan_ganda", "benar_salah", "pilihan_lebih_dari_satu"):
            # Jawaban esai diubah lagi -> skor manual sebelumnya tidak berlaku lagi.
            jawaban.skor_manual = None
            jawaban.dinilai_oleh = None
            jawaban.dinilai_at = None
    else:
        jawaban = JawabanSiswa(
            ujian_siswa_id=ujian.id,
            soal_id=payload.soal_id,
            jawaban=nilai_jawaban,
        )
        db.add(jawaban)
    db.commit()
    db.refresh(jawaban)
    return JawabanSaveOut(status="saved", timestamp=jawaban.submitted_at)


@router.post("/{ujian_id}/konfirmasi-drill/{soal_id}")
def confirm_drill(ujian_id: int, soal_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["siswa"]))):
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_id).first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Latihan tidak ditemukan")
    authorize_ujian(ujian, current_user, db)
    paket = db.query(PaketUjian).filter(PaketUjian.id == ujian.paket_ujian_id).first()
    if not paket or paket.tipe != "latihan" or ujian.mode_latihan != "drill":
        raise HTTPException(status_code=403, detail="Pembahasan per soal hanya untuk mode drilling")
    ensure_ujian_active(ujian, paket)
    require_active_question(ujian, paket, soal_id)
    jawaban = db.query(JawabanSiswa).filter(JawabanSiswa.ujian_siswa_id == ujian_id, JawabanSiswa.soal_id == soal_id).first()
    if not jawaban or not jawaban.jawaban or not jawaban.jawaban.strip() or jawaban.jawaban == "[]":
        raise HTTPException(status_code=400, detail="Isi jawaban sebelum konfirmasi")
    soal = db.query(Soal).filter(Soal.id == soal_id).first()
    if jawaban.dikonfirmasi_at is None:
        # Setelah dikonfirmasi jawaban terkunci (lihat save_ujian_jawaban),
        # supaya siswa tidak mencoba semua opsi sampai berwarna hijau.
        jawaban.dikonfirmasi_at = utc_now()
        db.commit()
    return drill_feedback(db, soal, jawaban)


def drill_feedback(db: Session, soal: Soal, jawaban: JawabanSiswa) -> dict:
    """Hasil satu soal mode drilling: benar/salah, kunci (opsi yang benar untuk
    diwarnai hijau), per-pernyataan, dan pembahasan."""
    soal_id = soal.id
    pernyataan_rows = db.query(PernyataanBenarSalah).filter(PernyataanBenarSalah.soal_id == soal_id).order_by(PernyataanBenarSalah.urutan).all()
    opsi = db.query(OpsiJawaban).filter(OpsiJawaban.soal_id == soal_id, OpsiJawaban.is_benar == True).order_by(OpsiJawaban.urutan).all()
    correct = None
    kunci = [o.teks_opsi for o in opsi] if opsi else [soal.kunci_jawaban or "Belum tersedia"]
    pernyataan_feedback = []
    if soal.tipe == "benar_salah" and pernyataan_rows:
        try:
            parsed = json.loads(jawaban.jawaban)
            answers = {item["pernyataan_id"]: item["jawaban"] for item in parsed if isinstance(item, dict)}
        except (json.JSONDecodeError, TypeError, KeyError):
            answers = {}
        correct = len(answers) == len(pernyataan_rows) and all(answers.get(row.id) is row.is_benar for row in pernyataan_rows)
        kunci = [f"{row.urutan}. {soal.label_benar if row.is_benar else soal.label_salah}" for row in pernyataan_rows]
        pernyataan_feedback = [{
            "pernyataan_id": row.id,
            "teks": row.teks_pernyataan,
            "jawaban_user": answers.get(row.id),
            "jawaban_benar": bool(row.is_benar),
            "is_correct": row.id in answers and answers[row.id] is row.is_benar,
        } for row in pernyataan_rows]
    elif soal.tipe in ("pilihan_ganda", "benar_salah"):
        correct = jawaban.jawaban in {str(o.id) for o in opsi}
    elif soal.tipe == "pilihan_lebih_dari_satu":
        correct = set(json.loads(jawaban.jawaban)) == {o.id for o in opsi}
    elif soal.tipe == "isian" and soal.kunci_jawaban:
        from app.services.scoring import _isian_cocok_kunci
        correct = _isian_cocok_kunci(soal.kunci_jawaban, jawaban.jawaban)
    return {
        "soal_id": soal_id,
        "benar": correct,
        "kunci": kunci,
        "kunci_opsi_ids": [o.id for o in opsi] if not pernyataan_rows else [],
        "pernyataan": pernyataan_feedback,
        "pembahasan": soal.pembahasan or "Pembahasan belum tersedia",
    }


@router.patch("/{ujian_id}/ragu", response_model=JawabanSiswaOut)
def set_ragu_jawaban(
    ujian_id: int,
    payload: JawabanRaguUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Tandai / hapus tanda ragu-ragu pada jawaban soal (wajib ada soal_id di payload)."""
    if payload.soal_id is None:
        raise HTTPException(status_code=400, detail="soal_id is required")
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_id).first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")
    authorize_ujian(ujian, current_user, db)
    paket = db.query(PaketUjian).filter(PaketUjian.id == ujian.paket_ujian_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    if ujian.is_submitted:
        raise HTTPException(status_code=400, detail="Ujian has been submitted")
    if not ujian.soal_urutan or payload.soal_id not in ujian.soal_urutan:
        raise HTTPException(status_code=400, detail="Soal does not belong to this ujian")
    require_active_question(ujian, paket, payload.soal_id)
    sisa_waktu_detik, _ = calculate_time_info(ujian, paket)
    if sisa_waktu_detik == 0:
        raise HTTPException(status_code=400, detail="Ujian time has expired")
    ensure_bagian_aktif_berjalan(ujian, paket)

    jawaban = (
        db.query(JawabanSiswa)
        .filter(JawabanSiswa.ujian_siswa_id == ujian.id, JawabanSiswa.soal_id == payload.soal_id)
        .first()
    )
    if not jawaban:
        jawaban = JawabanSiswa(
            ujian_siswa_id=ujian.id,
            soal_id=payload.soal_id,
            jawaban=None,
        )
        db.add(jawaban)
    jawaban.is_ragu = payload.is_ragu
    db.commit()
    db.refresh(jawaban)
    return jawaban


@router.get("/{ujian_id}/sisa-waktu")
def get_ujian_sisa_waktu(
    ujian_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_id).first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")
    authorize_ujian(ujian, current_user, db)
    paket = db.query(PaketUjian).filter(PaketUjian.id == ujian.paket_ujian_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    sisa_waktu_detik, waktu_selesai = calculate_display_time_info(ujian, paket)
    return {
        "sisa_waktu_detik": sisa_waktu_detik,
        "server_time": datetime.now(timezone.utc),
        "waktu_selesai": waktu_selesai,
        "bagian_terakhir": harus_dikumpulkan(ujian, paket),
    }


@router.get("/{ujian_id}/state", response_model=UjianSiswaStateOut)
def get_ujian_state(
    ujian_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_id).first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")
    authorize_ujian(ujian, current_user, db)
    paket = db.query(PaketUjian).filter(PaketUjian.id == ujian.paket_ujian_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    if not ujian.soal_urutan:
        raise HTTPException(status_code=400, detail="Ujian has not been initialized with soal order")

    soal_tipe_map = {
        soal.id: soal.tipe
        for soal in db.query(Soal).filter(Soal.id.in_(ujian.soal_urutan)).all()
    }
    compound_ids = {
        row.soal_id for row in db.query(PernyataanBenarSalah.soal_id).filter(PernyataanBenarSalah.soal_id.in_(ujian.soal_urutan)).distinct().all()
    }
    jawaban_list = db.query(JawabanSiswa).filter(JawabanSiswa.ujian_siswa_id == ujian.id).all()
    jawaban_tersimpan: Dict[str, Union[int, str, None]] = {}
    ragu_ragu: Dict[str, bool] = {}
    for soal_id in ujian.soal_urutan:
        jawaban_tersimpan[str(soal_id)] = None
        ragu_ragu[str(soal_id)] = False
    for jawaban in jawaban_list:
        ragu_ragu[str(jawaban.soal_id)] = bool(jawaban.is_ragu)
        if not jawaban.jawaban:
            continue
        tipe_soal = soal_tipe_map.get(jawaban.soal_id)
        if tipe_soal == "benar_salah" and jawaban.soal_id in compound_ids:
            try:
                parsed = json.loads(jawaban.jawaban)
                jawaban_tersimpan[str(jawaban.soal_id)] = parsed if isinstance(parsed, list) else []
            except (json.JSONDecodeError, ValueError, TypeError):
                jawaban_tersimpan[str(jawaban.soal_id)] = []
        elif tipe_soal in ("pilihan_ganda", "benar_salah"):
            try:
                jawaban_tersimpan[str(jawaban.soal_id)] = int(jawaban.jawaban)
            except ValueError:
                jawaban_tersimpan[str(jawaban.soal_id)] = None
        elif tipe_soal == "pilihan_lebih_dari_satu":
            try:
                parsed = json.loads(jawaban.jawaban)
                jawaban_tersimpan[str(jawaban.soal_id)] = parsed if isinstance(parsed, list) else []
            except (json.JSONDecodeError, ValueError, TypeError):
                jawaban_tersimpan[str(jawaban.soal_id)] = []
        else:
            jawaban_tersimpan[str(jawaban.soal_id)] = jawaban.jawaban

    # Drilling: warna nomor soal (hijau benar / merah salah) untuk soal yang sudah
    # dikonfirmasi; None = perlu dibandingkan manual (esai / isian tanpa kunci).
    hasil_drill: Dict[str, Optional[bool]] = {}
    if ujian.mode_latihan == "drill":
        confirmed = [jawaban for jawaban in jawaban_list if jawaban.dikonfirmasi_at is not None]
        if confirmed:
            soal_map = {soal.id: soal for soal in db.query(Soal).filter(Soal.id.in_([j.soal_id for j in confirmed])).all()}
            kunci_map = load_kunci(db, soal_map)
            for jawaban in confirmed:
                soal = soal_map.get(jawaban.soal_id)
                if soal is None:
                    continue
                correct, _, pending = evaluate_question(db, soal, jawaban, kunci_map.get(soal.id))
                hasil_drill[str(soal.id)] = None if pending else correct

    sisa_waktu_detik, finish_at = calculate_display_time_info(ujian, paket)
    bagian_urutan_out: Optional[List[BagianUjianOut]] = None
    if ujian.bagian_urutan:
        bagian_urutan_out = [BagianUjianOut(**b) for b in ujian.bagian_urutan]
    return UjianSiswaStateOut(
        mode_latihan=ujian.mode_latihan,
        hasil_drill=hasil_drill,
        bagian_aktif=ujian.bagian_aktif or 0,
        soal_aktif_ids=active_question_ids(ujian, paket),
        ujian_siswa_id=ujian.id,
        jadwal_ujian_id=ujian.jadwal_ujian_id,
        status=get_ujian_status(ujian, paket),
        soal_urutan=ujian.soal_urutan,
        opsi_urutan=ujian.opsi_urutan or {},
        jawaban_tersimpan=jawaban_tersimpan,
        ragu_ragu=ragu_ragu,
        bagian_urutan=bagian_urutan_out,
        waktu_mulai=ensure_utc(ujian.started_at),
        waktu_selesai=finish_at,
        durasi_menit=effective_durasi_menit(ujian, paket),
        jumlah_soal=len(ujian.soal_urutan),
        sisa_waktu_detik=sisa_waktu_detik,
        bagian_terakhir=harus_dikumpulkan(ujian, paket),
    )


@router.post("/{ujian_id}/lanjut-bagian", response_model=UjianSiswaStateOut)
def advance_section(ujian_id: int, bagian_aktif: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["siswa"]))):
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_id).with_for_update().first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian tidak ditemukan")
    authorize_ujian(ujian, current_user, db)
    paket = db.query(PaketUjian).filter(PaketUjian.id == ujian.paket_ujian_id).first()
    if not paket:
        raise HTTPException(status_code=404, detail="Paket Ujian not found")
    ensure_ujian_active(ujian, paket)
    if paket.tipe != "ujian" or not ujian.bagian_urutan or bagian_aktif != (ujian.bagian_aktif or 0):
        raise HTTPException(status_code=409, detail="Bagian aktif sudah berubah, muat ulang ujian")
    if bagian_aktif + 1 >= len(ujian.bagian_urutan):
        raise HTTPException(status_code=409, detail="Bagian terakhir, kumpulkan ujian")
    updated = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_id, UjianSiswa.bagian_aktif == bagian_aktif).update({"bagian_aktif": bagian_aktif + 1, "bagian_mulai_at": utc_now()})
    if not updated:
        db.rollback()
        raise HTTPException(status_code=409, detail="Bagian aktif sudah berubah")
    db.commit()
    return get_ujian_state(ujian_id, db, current_user)


@router.post("/{ujian_id}/log-kecurangan", response_model=LogKecuranganOut)
def log_ujian_kecurangan(
    ujian_id: int,
    payload: UjianLogKecuranganCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_id).first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")
    authorize_ujian(ujian, current_user, db)
    log = LogKecurangan(
        ujian_siswa_id=ujian.id,
        tipe_kecurangan=payload.tipe,
        deskripsi=payload.deskripsi,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.patch("/{ujian_id}/submit", response_model=UjianSiswaOut)
def submit_ujian_siswa(ujian_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_id).with_for_update().first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")
    authorize_ujian(ujian, current_user, db)
    # prevent double submission
    if ujian.is_submitted:
        return ujian

    ujian.finished_at = datetime.now(timezone.utc)
    ujian.is_submitted = True
    try:
        compute_and_store_hasil(db, ujian)
        db.commit()
    except Exception:
        # Scoring gagal -> jangan tinggalkan ujian "submitted" tanpa hasil.
        db.rollback()
        raise HTTPException(status_code=500, detail="Gagal menghitung hasil ujian, coba lagi")
    db.refresh(ujian)
    return ujian


@router.get("/{ujian_id}", response_model=UjianSiswaOut)
def get_ujian_siswa(ujian_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_active_user)):
    ujian = db.query(UjianSiswa).filter(UjianSiswa.id == ujian_id).first()
    if not ujian:
        raise HTTPException(status_code=404, detail="Ujian Siswa not found")
    authorize_ujian(ujian, current_user, db)
    return ujian
