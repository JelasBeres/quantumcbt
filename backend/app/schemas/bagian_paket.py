from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class BagianPaketCreate(BaseModel):
    nama: str = ""
    urutan: int = 0
    durasi_menit: None = None
    pelajaran_id: int
    is_random_soal: Optional[bool] = True
    is_random_opsi: Optional[bool] = True
    deskripsi: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class BagianPaketUpdate(BaseModel):
    nama: Optional[str] = None
    urutan: Optional[int] = None
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
    durasi_menit: Optional[int] = None
    pelajaran_id: Optional[int] = None
    is_random_soal: Optional[bool] = True
    is_random_opsi: Optional[bool] = True
    deskripsi: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BagianPaketDetailOut(BagianPaketOut):
    jumlah_soal: int = 0
    soal_ids: List[int] = Field(default_factory=list)


class BagianDurasiUpdate(BaseModel):
    durasi_menit: int = Field(ge=1, le=1440)


class BagianSoalUpdateRequest(BaseModel):
    soal_ids: List[int]
