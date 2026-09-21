from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.soal import SoalDetailOut

TIPE_PAKET = ("ujian", "latihan")
METODE_PENILAIAN = ("biasa", "kohort")
SKALA_KOHORT = ("utbk", "tka")


def _validate_scoring(tipe: str, metode_penilaian: str) -> None:
    if tipe != "ujian" and metode_penilaian == "kohort":
        raise ValueError("Benchmark Kohort hanya tersedia untuk Tryout")


class PaketUjianCreate(BaseModel):
    nama: str
    deskripsi: Optional[str] = None
    jumlah_soal: int = 0
    is_random_soal: bool = True
    is_random_opsi: bool = True
    pelajaran_id: Optional[int] = None
    kelas_id: Optional[int] = None
    program_id: int
    tipe: Literal["ujian", "latihan"] = "ujian"
    kategori_id: Optional[int] = None
    kategori: Optional[str] = None
    metode_penilaian: Literal["biasa", "kohort"] = "biasa"
    skala_kohort: Optional[Literal["utbk", "tka"]] = None

    @model_validator(mode="after")
    def validate_package(self):
        if self.kategori_id is None and self.kategori is None:
            raise ValueError("Kategori wajib diisi")
        _validate_scoring(self.tipe, self.metode_penilaian)
        return self


class PaketUjianUpdate(BaseModel):
    nama: str
    deskripsi: Optional[str] = None
    durasi_menit: Optional[int] = None
    jumlah_soal: int = 0
    is_random_soal: bool = True
    is_random_opsi: bool = True
    pelajaran_id: Optional[int] = None
    kelas_id: Optional[int] = None
    program_id: int
    tipe: Optional[Literal["ujian", "latihan"]] = None
    kategori_id: Optional[int] = None
    kategori: Optional[str] = None
    metode_penilaian: Optional[Literal["biasa", "kohort"]] = None
    skala_kohort: Optional[Literal["utbk", "tka"]] = None


class PaketUjianOut(BaseModel):
    assigned_guru_ids: Optional[List[int]] = None
    id: int
    nama: str
    deskripsi: Optional[str] = None
    durasi_menit: int
    jumlah_soal: int
    is_random_soal: bool
    is_random_opsi: bool
    pelajaran_id: Optional[int] = None
    kelas_id: Optional[int] = None
    program_id: Optional[int] = None
    tipe: str = "ujian"
    kategori_id: Optional[int] = None
    kategori: Optional[str] = None
    kategori_nama: Optional[str] = None
    metode_penilaian: Literal["biasa", "kohort"] = "biasa"
    skala_kohort: Literal["utbk", "tka"] = "utbk"
    jumlah_bagian: int = 0
    jumlah_bagian_kosong: int = 0
    siap_dipublikasikan: bool = False
    created_by: Optional[int] = None
    is_archived: bool = False
    archived_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PaketUjianDetailOut(PaketUjianOut):
    soal: List[SoalDetailOut] = Field(default_factory=list)


class PaketUjianCloneRequest(BaseModel):
    nama: Optional[str] = None
    deskripsi: Optional[str] = None


class PaketSoalUpdateRequest(BaseModel):
    soal_ids: List[int]
