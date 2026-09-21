from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional


class JawabanSiswaCreate(BaseModel):
    ujian_siswa_id: int
    soal_id: int
    jawaban: Optional[str] = None


class JawabanSiswaOut(BaseModel):
    id: int
    ujian_siswa_id: int
    soal_id: int
    jawaban: Optional[str]
    submitted_at: Optional[datetime]
    is_ragu: bool = False
    skor_manual: Optional[float] = None
    dinilai_oleh: Optional[int] = None
    dinilai_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class JawabanRaguUpdate(BaseModel):
    soal_id: int
    is_ragu: bool


class JawabanEsaiKoreksiItem(BaseModel):
    jawaban_id: int
    ujian_siswa_id: int
    siswa_id: int
    nama_siswa: str
    soal_id: int
    teks_soal: str
    tipe: str
    kunci_jawaban: Optional[str] = None
    jawaban_teks: Optional[str] = None
    is_ragu: bool = False
    skor_manual: Optional[float] = None
    dinilai_oleh: Optional[int] = None
    dinilai_at: Optional[datetime] = None


class JawabanEsaiNilaiRequest(BaseModel):
    skor_manual: float = Field(ge=0, le=100)
