from pydantic import BaseModel, ConfigDict
from typing import List, Optional


class OpsiJawabanCreate(BaseModel):
    soal_id: int
    teks_opsi: str
    is_benar: bool = False
    urutan: Optional[int] = None


class OpsiJawabanNestedCreate(BaseModel):
    # id opsi yang sudah ada: dipertahankan agar jawaban siswa (disimpan sebagai id opsi) tetap valid.
    id: Optional[int] = None
    teks_opsi: str
    is_benar: bool = False
    urutan: Optional[int] = None


class OpsiJawabanListUpdate(BaseModel):
    opsi: List[OpsiJawabanNestedCreate]


class OpsiJawabanOut(BaseModel):
    id: int
    soal_id: int
    teks_opsi: str
    urutan: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class OpsiJawabanAdminOut(OpsiJawabanOut):
    is_benar: bool
