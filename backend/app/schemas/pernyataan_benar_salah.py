from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class PernyataanBenarSalahCreate(BaseModel):
    # id pernyataan yang sudah ada: dipertahankan agar jawaban siswa tetap valid.
    id: Optional[int] = None
    teks_pernyataan: str
    is_benar: bool


class PernyataanBenarSalahReplace(BaseModel):
    label_benar: str = "Benar"
    label_salah: str = "Salah"
    pernyataan: List[PernyataanBenarSalahCreate]


class PernyataanBenarSalahOut(BaseModel):
    id: int
    soal_id: int
    teks_pernyataan: str
    urutan: int

    model_config = ConfigDict(from_attributes=True)


class PernyataanBenarSalahAdminOut(PernyataanBenarSalahOut):
    is_benar: bool


class PernyataanBenarSalahReplaceOut(BaseModel):
    label_benar: str
    label_salah: str
    pernyataan: List[PernyataanBenarSalahAdminOut]
