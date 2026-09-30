from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

BAGIAN_STATUS = ("draft", "pending_review", "revision_required", "approved")


class BagianPaketCreate(BaseModel):
    nama: str = ""
    urutan: int = 0
    wajib: bool = True
    durasi_menit: None = None
    pelajaran_id: int
    is_random_soal: Optional[bool] = True
    is_random_opsi: Optional[bool] = True
    deskripsi: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class BagianPaketUpdate(BaseModel):
    nama: Optional[str] = None
    urutan: Optional[int] = None
    wajib: Optional[bool] = None
    pelajaran_id: Optional[int] = None
    is_random_soal: Optional[bool] = None
    is_random_opsi: Optional[bool] = None
    deskripsi: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class BagianPaketOut(BaseModel):
    id: int
    paket_ujian_id: int
    nama: str
    urutan: int
    wajib: bool = True
    durasi_menit: Optional[int] = None
    pelajaran_id: Optional[int] = None
    is_random_soal: Optional[bool] = True
    is_random_opsi: Optional[bool] = True
    deskripsi: Optional[str] = None
    status: str = "draft"
    review_note: Optional[str] = None
    submitted_for_review_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    revision_number: int = 0

    model_config = ConfigDict(from_attributes=True)


class BagianPaketDetailOut(BagianPaketOut):
    jumlah_soal: int = 0
    soal_ids: List[int] = Field(default_factory=list)
    guru_pengampu: Optional[str] = None
    reviewer_nama: Optional[str] = None


class BagianDurasiUpdate(BaseModel):
    durasi_menit: int = Field(ge=1, le=1440)


class BagianSoalUpdateRequest(BaseModel):
    soal_ids: List[int]


class BagianReviewAction(BaseModel):
    note: Optional[str] = None


class BagianReviewReject(BaseModel):
    note: str = Field(min_length=3, max_length=2000)
