from pydantic import BaseModel, ConfigDict


class PaketMapelCreate(BaseModel):
    pelajaran_id: int

    model_config = ConfigDict(extra="forbid")


class PaketMapelOut(BaseModel):
    pelajaran_id: int
    nama: str
    urutan: int
    jumlah_set: int
    jumlah_set_approved: int
    jumlah_soal: int
