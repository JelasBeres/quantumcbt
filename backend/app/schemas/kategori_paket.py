from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class KategoriPaketBase(BaseModel):
    kode: str = Field(min_length=1, max_length=50, pattern=r"^[a-z0-9]+(?:_[a-z0-9]+)*$")
    nama: str = Field(min_length=1, max_length=100)
    deskripsi: Optional[str] = None
    tipe: Literal["ujian", "latihan", "keduanya"] = "keduanya"
    is_active: bool = True

    @field_validator("kode", "nama")
    @classmethod
    def strip_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Nilai wajib diisi")
        return value


class KategoriPaketCreate(KategoriPaketBase):
    pass


class KategoriPaketUpdate(KategoriPaketBase):
    pass


class KategoriPaketOut(KategoriPaketBase):
    id: int
    jumlah_paket: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
