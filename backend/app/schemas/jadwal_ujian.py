from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional

from app.core.timeutils import ensure_utc


class JadwalUjianCreate(BaseModel):
    paket_ujian_id: int
    mulai: datetime
    selesai: datetime
    is_published: bool = False
    program_id: Optional[int] = None
    kelas_id: Optional[int] = None
    grup_tryout_id: Optional[int] = None
    durasi_menit_paket: Optional[int] = None

    @field_validator("mulai", "selesai")
    @classmethod
    def validate_timezone(cls, value: datetime) -> datetime:
        return ensure_utc(value)


class JadwalPublishUpdate(BaseModel):
    is_published: bool


class JadwalUjianOut(BaseModel):
    id: int
    paket_ujian_id: int
    mulai: datetime
    selesai: datetime
    is_published: bool
    program_id: Optional[int] = None
    kelas_id: Optional[int] = None
    grup_tryout_id: Optional[int] = None
    durasi_menit_paket: Optional[int] = None
    nama_paket: Optional[str] = None
    status: str = "draft"
    created_by: Optional[int] = None
    reviewed_by: Optional[int] = None
    submitted_for_review_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class JadwalReviewAction(BaseModel):
    note: Optional[str] = None


class JadwalReviewReject(BaseModel):
    note: str = Field(min_length=3, max_length=2000)


class JadwalDeleteRequest(BaseModel):
    alasan: str = Field(min_length=3, max_length=2000)
