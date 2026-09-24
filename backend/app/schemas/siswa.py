from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Any, Dict, List, Optional

from app.core.timeutils import ensure_utc


class PilihanJurusan(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    jurusan: str = Field(min_length=1, max_length=200)
    universitas: str = Field(min_length=1, max_length=200)


class SiswaCreate(BaseModel):
    pilihan_jurusan: List[PilihanJurusan] = Field(default_factory=list, max_length=3)
    user_id: int
    nama_lengkap: str
    sekolah: Optional[str] = Field(default=None, max_length=200)
    no_induk: Optional[str] = None
    program_id: Optional[int] = None
    kelas_id: Optional[int] = None


class SiswaDenganAkun(BaseModel):
    pilihan_jurusan: List[PilihanJurusan] = Field(default_factory=list, max_length=3)
    nama_lengkap: str
    sekolah: Optional[str] = Field(default=None, max_length=200)
    username: str
    password: str
    no_induk: Optional[str] = None
    program_id: Optional[int] = None
    kelas_id: Optional[int] = None


class SiswaOut(BaseModel):
    pilihan_jurusan: Optional[List[PilihanJurusan]] = None
    id: int
    user_id: int
    nama_lengkap: str
    sekolah: Optional[str] = None
    no_induk: Optional[str] = None
    program_id: Optional[int] = None
    kelas_id: Optional[int] = None
    program_nama: Optional[str] = None
    kelas_nama: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SiswaProfilUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    nama_lengkap: str = Field(min_length=1, max_length=200)
    sekolah: Optional[str] = Field(default=None, max_length=200)
    pilihan_jurusan: List[PilihanJurusan] = Field(default_factory=list, max_length=3)

    @field_validator("sekolah")
    @classmethod
    def normalize_sekolah(cls, value):
        return value or None


class SiswaDashboardOut(BaseModel):
    siswa: SiswaOut
    jadwal_mendatang: int
    ujian_aktif: int
    riwayat_ujian: int
    hasil_terakhir: Optional[float] = None
    program_name: Optional[str] = None
    kelas_name: Optional[str] = None


class SiswaJadwalUjianOut(BaseModel):
    jadwal_ujian_id: int
    paket_ujian_id: int
    nama_paket: str
    mulai: datetime
    selesai: datetime
    is_published: bool
    status: str
    durasi_menit: int = 0
    jumlah_soal: int = 0
    pelajaran: Optional[str] = None
    tipe: str = "ujian"
    kategori: Optional[str] = None
    kategori_nama: Optional[str] = None
    deskripsi_paket: Optional[str] = None
    izinkan_pilih_mapel: bool = True

    @field_validator("mulai", "selesai")
    @classmethod
    def as_utc(cls, value: datetime) -> datetime:
        # Waktu tanpa zona dari SQLite adalah UTC; tandai agar browser tidak salah membaca.
        return ensure_utc(value)


class BagianTersediaOut(BaseModel):
    bagian_id: int
    nama: str
    urutan: int
    jumlah_soal: int = 0
    pelajaran_id: Optional[int] = None
    pelajaran_nama: Optional[str] = None


class SiswaJadwalTersediaOut(SiswaJadwalUjianOut):
    bagian: List[BagianTersediaOut] = Field(default_factory=list)


class SiswaRiwayatUjianOut(BaseModel):
    ujian_siswa_id: int
    paket_ujian_id: int
    nama_paket: str
    # Kategori paket (kode & nama) untuk riwayat bertingkat: kategori -> tryout -> mapel.
    kategori: Optional[str] = None
    kategori_nama: Optional[str] = None
    jadwal_ujian_id: Optional[int] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    is_submitted: bool
    skor: Optional[float] = None
    metode_penilaian: str = "biasa"
    kohort_status: Optional[str] = None
    skala: Optional[str] = None
    skor_mentah: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class SiswaDashboardDataOut(BaseModel):
    siswa: SiswaOut
    program_name: Optional[str] = None
    kelas_name: Optional[str] = None
    jadwal_mendatang: int
    ujian_aktif: int
    riwayat_ujian: int
    hasil_terakhir: Optional[float] = None
    rata_rata_nilai: Optional[float] = None
    jadwal: List[SiswaJadwalTersediaOut] = []
    riwayat: List[SiswaRiwayatUjianOut] = []
