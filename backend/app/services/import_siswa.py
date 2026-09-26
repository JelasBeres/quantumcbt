"""Import banyak siswa sekaligus dari file CSV.

Alur: file dicek dulu (preview, tidak menyimpan apa pun), admin konfirmasi, lalu file
yang sama dikirim ulang dan dicek ulang sebelum disimpan. Anti-duplikasi:
- username / no. induk yang sudah terdaftar  -> baris dilewati (data lama tidak diubah)
- username / no. induk yang dobel di dalam file -> baris berikutnya ditandai error
"""
import csv
import io
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.kelas import Kelas
from app.models.program import Program
from app.models.siswa import Siswa
from app.models.user import User

KOLOM = [
    "nama_lengkap", "username", "password", "no_induk", "sekolah", "program", "kelas",
    "jurusan_1", "universitas_1", "jurusan_2", "universitas_2", "jurusan_3", "universitas_3",
]
KOLOM_WAJIB = ["nama_lengkap", "username", "password", "program"]
MAKS_BARIS = 300
MAKS_UKURAN = 1024 * 1024  # 1 MB


class ImportError_(ValueError):
    """Kesalahan pada file secara keseluruhan (bukan per baris)."""


def _baca_csv(isi: bytes) -> List[Dict[str, str]]:
    if len(isi) > MAKS_UKURAN:
        raise ImportError_("Ukuran file maksimal 1 MB.")
    try:
        teks = isi.decode("utf-8-sig")
    except UnicodeDecodeError:
        teks = isi.decode("latin-1")
    if not teks.strip():
        raise ImportError_("File kosong.")
    # Excel berbahasa Indonesia menyimpan CSV dengan pemisah titik koma.
    baris_pertama = teks.splitlines()[0]
    pemisah = ";" if baris_pertama.count(";") > baris_pertama.count(",") else ","
    reader = csv.DictReader(io.StringIO(teks), delimiter=pemisah)
    header = [(h or "").strip().lower() for h in (reader.fieldnames or [])]
    kurang = [k for k in KOLOM_WAJIB if k not in header]
    if kurang:
        raise ImportError_(f"Kolom wajib tidak ditemukan: {', '.join(kurang)}. Gunakan template dari tombol Download Template.")
    rows = []
    for raw in reader:
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items() if k is not None}
        if any(row.values()):
            rows.append(row)
    if not rows:
        raise ImportError_("File tidak berisi data siswa.")
    if len(rows) > MAKS_BARIS:
        raise ImportError_(f"Maksimal {MAKS_BARIS} siswa per file. File ini berisi {len(rows)} baris, silakan pecah menjadi beberapa file.")
    return rows


def _nama_map(items) -> Dict[str, int]:
    return {item.nama.strip().lower(): item.id for item in items}


def periksa(db: Session, isi: bytes) -> List[dict]:
    """Cek setiap baris. Status: 'siap', 'dilewati' (sudah terdaftar), atau 'error'."""
    rows = _baca_csv(isi)
    program_map = _nama_map(db.query(Program).all())
    kelas_map = _nama_map(db.query(Kelas).all())

    usernames = [r.get("username", "").lower() for r in rows if r.get("username")]
    no_induks = [r.get("no_induk", "") for r in rows if r.get("no_induk")]
    username_terdaftar = {
        u for (u,) in db.query(func.lower(User.username)).filter(func.lower(User.username).in_(usernames)).all()
    } if usernames else set()
    no_induk_terdaftar = {
        n for (n,) in db.query(Siswa.no_induk).filter(Siswa.no_induk.in_(no_induks)).all()
    } if no_induks else set()

    hasil = []
    username_di_file: Dict[str, int] = {}
    no_induk_di_file: Dict[str, int] = {}
    for index, row in enumerate(rows, start=2):  # baris 1 = header
        pesan: List[str] = []
        status = "siap"
        username = row.get("username", "")
        no_induk = row.get("no_induk", "") or None
        for kolom in KOLOM_WAJIB:
            if not row.get(kolom):
                pesan.append(f"{kolom} wajib diisi")
        if username and " " in username:
            pesan.append("username tidak boleh mengandung spasi")
        if len(username) > 100:
            pesan.append("username maksimal 100 karakter")
        password = row.get("password", "")
        if password and len(password) < 6:
            pesan.append("password minimal 6 karakter")
        if len(row.get("nama_lengkap", "")) > 200 or len(row.get("sekolah", "")) > 200:
            pesan.append("nama/sekolah maksimal 200 karakter")
        if no_induk and len(no_induk) > 50:
            pesan.append("no_induk maksimal 50 karakter")

        program_id: Optional[int] = None
        if row.get("program"):
            program_id = program_map.get(row["program"].lower())
            if program_id is None:
                pesan.append(f"program \"{row['program']}\" tidak ditemukan")
        kelas_id: Optional[int] = None
        if row.get("kelas"):
            kelas_id = kelas_map.get(row["kelas"].lower())
            if kelas_id is None:
                pesan.append(f"kelas \"{row['kelas']}\" tidak ditemukan")

        kunci_user = username.lower()
        if kunci_user and kunci_user in username_di_file:
            pesan.append(f"username dobel dengan baris {username_di_file[kunci_user]}")
        if no_induk and no_induk in no_induk_di_file:
            pesan.append(f"no_induk dobel dengan baris {no_induk_di_file[no_induk]}")

        if pesan:
            status = "error"
        elif kunci_user in username_terdaftar:
            status, pesan = "dilewati", ["username sudah terdaftar"]
        elif no_induk and no_induk in no_induk_terdaftar:
            status, pesan = "dilewati", ["no_induk sudah terdaftar"]

        if kunci_user:
            username_di_file.setdefault(kunci_user, index)
        if no_induk:
            no_induk_di_file.setdefault(no_induk, index)

        pilihan = []
        for i in (1, 2, 3):
            jurusan = row.get(f"jurusan_{i}", "")
            if jurusan:
                pilihan.append({"jurusan": jurusan, "universitas": row.get(f"universitas_{i}", "")})

        hasil.append({
            "baris": index,
            "status": status,
            "pesan": "; ".join(pesan),
            "nama_lengkap": row.get("nama_lengkap", ""),
            "username": username,
            "no_induk": no_induk,
            "sekolah": row.get("sekolah", "") or None,
            "program": row.get("program", ""),
            "kelas": row.get("kelas", ""),
            "_program_id": program_id,
            "_kelas_id": kelas_id,
            "_password": password,
            "_pilihan_jurusan": pilihan,
        })
    return hasil


def publik(hasil: List[dict]) -> List[dict]:
    """Buang field internal (termasuk password) sebelum dikirim ke browser."""
    return [{k: v for k, v in row.items() if not k.startswith("_")} for row in hasil]


def simpan(db: Session, isi: bytes) -> dict:
    hasil = periksa(db, isi)
    siap = [row for row in hasil if row["status"] == "siap"]
    # bcrypt lambat (~0,25 dtk/password); dikerjakan paralel supaya 300 baris tetap cepat.
    with ThreadPoolExecutor(max_workers=4) as pool:
        hashes = list(pool.map(get_password_hash, [row["_password"] for row in siap]))
    for row, password_hash in zip(siap, hashes):
        user = User(username=row["username"], password_hash=password_hash, role="siswa", is_active=True)
        db.add(user)
        db.flush()
        db.add(Siswa(
            user_id=user.id,
            nama_lengkap=row["nama_lengkap"],
            sekolah=row["sekolah"],
            no_induk=row["no_induk"],
            program_id=row["_program_id"],
            kelas_id=row["_kelas_id"],
            pilihan_jurusan=row["_pilihan_jurusan"],
        ))
    db.commit()
    return {
        "berhasil": len(siap),
        "dilewati": sum(1 for row in hasil if row["status"] == "dilewati"),
        "error": sum(1 for row in hasil if row["status"] == "error"),
        "baris": publik(hasil),
    }
