from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional


class LaporanSoalCreate(BaseModel):
    soal_id: int
    alasan: str


class LaporanSoalOut(BaseModel):
    id: int
    soal_id: int
    user_id: Optional[int] = None
    alasan: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    teks_soal: Optional[str] = None
    nama_pelapor: Optional[str] = None
    soal_status: Optional[str] = None
    soal_created_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class LaporanSoalStatusUpdate(BaseModel):
    status: str
