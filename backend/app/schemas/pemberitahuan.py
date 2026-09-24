from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

JenisPemberitahuan = Literal["info", "promo", "paket_baru"]


class PemberitahuanCreate(BaseModel):
    judul: str = Field(min_length=1, max_length=200)
    isi: Optional[str] = None
    jenis: JenisPemberitahuan = "info"
    tautan: Optional[str] = Field(default=None, max_length=500)
    program_id: Optional[int] = None
    kelas_id: Optional[int] = None
    tampil_popup: bool = True
    is_active: bool = True
    berlaku_sampai: Optional[datetime] = None

    @field_validator("judul")
    @classmethod
    def _judul_tidak_kosong(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Judul wajib diisi")
        return value

    @field_validator("tautan")
    @classmethod
    def _tautan_aman(cls, value: Optional[str]) -> Optional[str]:
        # Hanya path internal (/siswa/...) atau http(s) agar tidak bisa
        # menyisipkan javascript: dsb. ke tombol di sisi siswa.
        value = (value or "").strip()
        if not value:
            return None
        if value.startswith("/") and not value.startswith("//"):
            return value
        if value.lower().startswith(("https://", "http://")):
            return value
        raise ValueError("Tautan harus diawali / (halaman aplikasi) atau https://")


class PemberitahuanOut(BaseModel):
    id: int
    judul: str
    isi: Optional[str] = None
    jenis: str
    tautan: Optional[str] = None
    program_id: Optional[int] = None
    kelas_id: Optional[int] = None
    tampil_popup: bool
    is_active: bool
    berlaku_sampai: Optional[datetime] = None
    jadwal_ujian_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PemberitahuanAdminOut(PemberitahuanOut):
    jumlah_dibaca: int = 0


class PemberitahuanSiswaOut(PemberitahuanOut):
    dibaca: bool = False


class PemberitahuanSiswaList(BaseModel):
    belum_dibaca: int
    items: list[PemberitahuanSiswaOut]
