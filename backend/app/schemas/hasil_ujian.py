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
    # None saat kunci disembunyikan (jadwal tryout paket ini belum berakhir).
    is_benar: Optional[bool] = None


class HasilPernyataanDetail(BaseModel):
    pernyataan_id: int
    teks: str
    urutan: int
    jawaban_user: Optional[bool] = None
    jawaban_benar: Optional[bool] = None
    is_correct: Optional[bool] = None


class HasilBagianDetail(BaseModel):
    bagian_id: Optional[int] = None
    nama: str
    urutan: int
    pelajaran_id: Optional[int] = None
    pelajaran_nama: Optional[str] = None


class HasilSoalDetail(BaseModel):
    nomor: int
    # Nomor di dalam bagian (mulai lagi dari 1 tiap bagian), sama seperti saat mengerjakan.
    nomor_bagian: Optional[int] = None
    bagian_id: Optional[int] = None
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
    # Penanda ragu-ragu dari siswa saat mengerjakan (ditampilkan di riwayat/pembahasan).
    is_ragu: bool = False


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
    # True bila kunci, status benar/salah, dan pembahasan ditahan untuk siswa
    # karena masih ada jadwal tryout paket ini yang belum berakhir.
    # Bagian/set soal pada attempt ini (urut pengerjaan), untuk riwayat per mapel.
    bagian: List[HasilBagianDetail] = []
    kunci_disembunyikan: bool = False
    kunci_tersedia_at: Optional[datetime] = None
