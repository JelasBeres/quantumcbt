from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Any, Dict, List, Optional, Union


class HasilUjianCreate(BaseModel):
    ujian_siswa_id: int
    skor: Optional[float] = None
    skor_per_pelajaran_json: Optional[Dict[str, Dict[str, Any]]] = None


class HasilUjianOut(BaseModel):
    id: int
    ujian_siswa_id: int
    skor: Optional[float]
    skor_per_pelajaran_json: Optional[Dict[str, Dict[str, Any]]] = None
    calculated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class HasilSoalOpsi(BaseModel):
    id: int
    label: str
    teks: str
    is_benar: bool


class HasilPernyataanDetail(BaseModel):
    pernyataan_id: int
    teks: str
    urutan: int
    jawaban_user: Optional[bool] = None
    jawaban_benar: bool
    is_correct: bool


class HasilSoalDetail(BaseModel):
    nomor: int
    # Nomor di dalam bagian (mulai lagi dari 1 tiap bagian), sama seperti saat mengerjakan.
    nomor_bagian: Optional[int] = None
    bagian_nama: Optional[str] = None
    soal_id: int
    teks_soal: str
    tipe: str
    poin: float = 1.0
    opsi: List[HasilSoalOpsi] = []
    label_benar: Optional[str] = None
    label_salah: Optional[str] = None
    pernyataan: List[HasilPernyataanDetail] = []
    jawaban_user: Optional[Union[int, str, List[int], List[Dict[str, Any]]]] = None
    jawaban_benar: Optional[Union[int, str, List[int]]] = None
    is_correct: Optional[bool] = None
    skor_manual: Optional[float] = None
    pembahasan: Optional[str] = None
    is_dijawab: bool = True


class HasilUjianDetailOut(BaseModel):
    ujian_siswa_id: int
    skor: Optional[float]
    soal: List[HasilSoalDetail]
    nama_paket: Optional[str] = None
    metode_penilaian: str = "biasa"
    kohort_status: Optional[str] = None
    skala: Optional[str] = None
    skor_mentah: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
