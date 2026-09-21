from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Dict, List, Literal, Optional, Union


class BagianUjianOut(BaseModel):
    bagian_id: Optional[int] = None
    nama: str
    urutan: int
    durasi_menit: Optional[int] = None
    pelajaran_id: Optional[int] = None
    soal_ids: List[int] = Field(default_factory=list)


class UjianSiswaCreate(BaseModel):
    siswa_id: int
    paket_ujian_id: int
    jadwal_ujian_id: Optional[int] = None


class UjianSiswaOut(BaseModel):
    id: int
    siswa_id: int
    paket_ujian_id: int
    jadwal_ujian_id: Optional[int] = None
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    is_submitted: bool
    soal_urutan: Optional[List[int]] = None
    opsi_urutan: Optional[Dict[str, List[int]]] = None
    bagian_urutan: Optional[List[BagianUjianOut]] = None

    model_config = ConfigDict(from_attributes=True)


class UjianSiswaStartRequest(BaseModel):
    jadwal_ujian_id: int
    siswa_id: Optional[int] = None
    grup_tryout_id: Optional[int] = None


class UjianSiswaStartOut(BaseModel):
    ujian_siswa_id: int
    jadwal_ujian_id: Optional[int]
    soal_urutan: List[int]
    bagian_urutan: Optional[List[BagianUjianOut]] = None
    waktu_mulai: Optional[datetime]
    waktu_selesai: Optional[datetime]
    durasi_menit: int
    jumlah_soal: int
    sisa_waktu_detik: int


class LatihanStartRequest(BaseModel):
    paket_ujian_id: int
    mode: Literal["latihan", "drill"] = "latihan"


class JawabanPernyataan(BaseModel):
    pernyataan_id: int
    jawaban: bool


class JawabanSaveRequest(BaseModel):
    soal_id: int
    opsi_jawaban_id: Optional[int] = None
    opsi_jawaban_ids: Optional[List[int]] = None
    jawaban_pernyataan: Optional[List[JawabanPernyataan]] = None
    jawaban_teks: Optional[str] = None

    @model_validator(mode="after")
    def validate_one_of(self) -> "JawabanSaveRequest":
        if self.opsi_jawaban_id is None and self.opsi_jawaban_ids is None and self.jawaban_pernyataan is None and self.jawaban_teks is None:
            raise ValueError("opsi_jawaban_id, opsi_jawaban_ids, jawaban_pernyataan, atau jawaban_teks harus diisi")
        return self


class JawabanSaveOut(BaseModel):
    status: str
    timestamp: Optional[datetime]


class OptionOut(BaseModel):
    opsi_id: int
    teks: str
    posisi: int


class PernyataanUjianOut(BaseModel):
    pernyataan_id: int
    teks: str
    urutan: int


class UjianSoalOut(BaseModel):
    soal_id: int
    teks_soal: str
    tipe: str
    poin: float = 1.0
    opsi_urutan: List[int]
    opsi: List[OptionOut]
    label_benar: Optional[str] = None
    label_salah: Optional[str] = None
    pernyataan: List[PernyataanUjianOut] = Field(default_factory=list)
    jawaban_user: Optional[Union[int, List[int], List[JawabanPernyataan]]] = None
    jawaban_teks: Optional[str] = None
    is_ragu: bool = False


class UjianSiswaStateOut(BaseModel):
    mode_latihan: Optional[str] = None
    bagian_aktif: int = 0
    soal_aktif_ids: List[int] = Field(default_factory=list)
    ujian_siswa_id: int
    jadwal_ujian_id: Optional[int]
    status: str
    soal_urutan: List[int]
    opsi_urutan: Dict[str, List[int]]
    jawaban_tersimpan: Dict[str, Union[int, str, list, None]]
    ragu_ragu: Dict[str, bool] = Field(default_factory=dict)
    bagian_urutan: Optional[List[BagianUjianOut]] = None
    waktu_mulai: Optional[datetime]
    waktu_selesai: Optional[datetime]
    durasi_menit: int
    jumlah_soal: int
    sisa_waktu_detik: int
