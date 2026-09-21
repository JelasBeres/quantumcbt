from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional


class LogKecuranganCreate(BaseModel):
    ujian_siswa_id: int
    tipe_kecurangan: Optional[str] = None
    deskripsi: Optional[str] = None


class UjianLogKecuranganCreate(BaseModel):
    tipe: Optional[str] = None
    deskripsi: Optional[str] = None


class LogKecuranganOut(BaseModel):
    id: int
    ujian_siswa_id: int
    tipe_kecurangan: Optional[str] = None
    deskripsi: Optional[str]
    created_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)
