from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Literal, Optional

from app.schemas.opsi_jawaban import OpsiJawabanAdminOut, OpsiJawabanOut
from app.schemas.pernyataan_benar_salah import PernyataanBenarSalahAdminOut, PernyataanBenarSalahOut


ALLOWED_TIPE_SOAL = {"pilihan_ganda", "pilihan_lebih_dari_satu", "benar_salah", "esai", "isian"}


class SoalCreate(BaseModel):
    subbab_id: Optional[int] = None
    subbab: Optional[str] = Field(default=None, max_length=150)

    @field_validator("subbab", mode="before")
    @classmethod
    def normalize_subbab(cls, value):
        if isinstance(value, str):
            return value.strip() or None
        return value

    paket_ujian_id: Optional[int] = None
    pelajaran_id: Optional[int] = None
    kelas_id: Optional[int] = None
    topik_id: Optional[int] = None
    teks_soal: str
    tipe: Optional[str] = "pilihan_ganda"
    gambar_url: Optional[str] = None
    tingkat_kesulitan: Literal["mudah", "sedang", "sulit"] = "sedang"
    poin: float = Field(default=1.0, gt=0)
    kunci_jawaban: Optional[str] = None
    label_benar: Optional[str] = "Benar"
    label_salah: Optional[str] = "Salah"
    pembahasan: Optional[str] = None

    @field_validator("tipe")
    @classmethod
    def validate_tipe(cls, value: Optional[str]) -> str:
        tipe = value or "pilihan_ganda"
        if tipe not in ALLOWED_TIPE_SOAL:
            allowed = ", ".join(sorted(ALLOWED_TIPE_SOAL))
            raise ValueError(f"tipe soal harus salah satu dari: {allowed}")
        return tipe

class SoalOut(BaseModel):
    subbab_id: Optional[int] = None
    subbab: Optional[str] = None
    id: int
    paket_ujian_id: Optional[int] = None
    pelajaran_id: Optional[int] = None
    kelas_id: Optional[int] = None
    topik_id: Optional[int] = None
    teks_soal: str
    tipe: Optional[str]
    gambar_url: Optional[str] = None
    tingkat_kesulitan: Literal["mudah", "sedang", "sulit"] = "sedang"
    poin: float = 1.0
    status: Literal["draft", "pending_review", "rejected", "approved", "archived"] = "draft"
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    submitted_for_review_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    published_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    parent_soal_id: Optional[int] = None
    version: int = 1

    model_config = ConfigDict(from_attributes=True)


class SoalAdminOut(SoalOut):
    kunci_jawaban: Optional[str] = None
    pembahasan: Optional[str] = None
    label_benar: Optional[str] = "Benar"
    label_salah: Optional[str] = "Salah"


class SoalDetailOut(SoalOut):
    opsi_jawaban: List[OpsiJawabanOut] = Field(default_factory=list)
    label_benar: Optional[str] = None
    label_salah: Optional[str] = None
    pernyataan: List[PernyataanBenarSalahOut] = Field(default_factory=list)


class SoalDetailAdminOut(SoalAdminOut):
    opsi_jawaban: List[OpsiJawabanAdminOut] = Field(default_factory=list)
    pernyataan: List[PernyataanBenarSalahAdminOut] = Field(default_factory=list)


class SoalPageOut(BaseModel):
    total: int
    items: List[SoalDetailOut] = Field(default_factory=list)
    limit: int = 50
    offset: int = 0


class SoalGenerateRequest(BaseModel):
    subbab_id: Optional[int] = None
    subbab: Optional[str] = Field(default=None, max_length=150)
    pelajaran_id: int
    kelas_id: Optional[int] = None
    topik_id: Optional[int] = None
    tipe: str
    kesulitan: Literal["mudah", "sedang", "sulit"]
    jumlah: int = Field(ge=1, le=100)
    exclude_ids: List[int] = Field(default_factory=list)

    @field_validator("tipe")
    @classmethod
    def validate_generate_tipe(cls, value: str) -> str:
        if value not in ALLOWED_TIPE_SOAL:
            allowed = ", ".join(sorted(ALLOWED_TIPE_SOAL))
            raise ValueError(f"tipe soal harus salah satu dari: {allowed}")
        return value


class SoalGenerateOut(BaseModel):
    requested: int
    available: int
    selected: int
    shortage: int
    items: List[SoalAdminOut] = Field(default_factory=list)


class SoalReviewAction(BaseModel):
    note: Optional[str] = None


class SoalReviewReject(BaseModel):
    note: str = Field(min_length=3, max_length=2000)


class SoalReviewHistoryOut(BaseModel):
    id: int
    soal_id: int
    actor_user_id: Optional[int]
    action: str
    from_status: Optional[str]
    to_status: str
    note: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SoalPreviewOut(BaseModel):
    id: int
    teks_soal: str
    tipe: str
    poin: float = 1.0
    gambar_url: Optional[str] = None
    contains_html: bool
    contains_latex: bool
    opsi_jawaban: List[OpsiJawabanOut] = Field(default_factory=list)
    label_benar: Optional[str] = None
    label_salah: Optional[str] = None
    pernyataan: List[PernyataanBenarSalahOut] = Field(default_factory=list)
