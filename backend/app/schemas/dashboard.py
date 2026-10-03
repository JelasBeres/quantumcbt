from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class DashboardStatistikOut(BaseModel):
    total_siswa: int
    total_paket_ujian: int
    total_jadwal_published: int
    ujian_berjalan: int
    rata_rata_nilai: Optional[float] = None


class DashboardAdminOut(BaseModel):
    total_siswa: int
    total_paket: int
    total_jadwal: int
    total_ujian_aktif: int
    total_ujian_selesai: int


class PerluTindakanItem(BaseModel):
    jenis: str  # soal | set_soal | jadwal
    id: int
    judul: str
    keterangan: Optional[str] = None
    diajukan_at: Optional[datetime] = None
    href: str


class PerluTindakanOut(BaseModel):
    soal_pending: int
    set_soal_pending: int
    jadwal_pending: int
    items: List[PerluTindakanItem]


class MonitoringUjianOut(BaseModel):
    ujian_siswa_id: int
    siswa_id: int
    nama_siswa: str
    paket_ujian_id: int
    nama_paket: str
    jadwal_ujian_id: Optional[int] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    status: str
    sisa_waktu_detik: int
    jumlah_soal: int = 0
    terjawab: int = 0
    jumlah_ragu: int = 0
    total_pelanggaran: int = 0
    kategori_id: Optional[int] = None
    kategori_nama: Optional[str] = None


class DashboardLogKecuranganOut(BaseModel):
    id: int
    ujian_siswa_id: int
    siswa_id: Optional[int] = None
    nama_siswa: Optional[str] = None
    tipe_kecurangan: Optional[str] = None
    deskripsi: Optional[str] = None
    created_at: Optional[datetime] = None
    paket_ujian_id: Optional[int] = None
    nama_paket: Optional[str] = None
    kategori_id: Optional[int] = None
    kategori_nama: Optional[str] = None


class DashboardHasilSiswaOut(BaseModel):
    hasil_ujian_id: int
    ujian_siswa_id: int
    siswa_id: int
    nama_siswa: str
    no_induk: Optional[str] = None
    paket_ujian_id: int
    nama_paket: str
    jadwal_ujian_id: Optional[int] = None
    skor: Optional[float] = None
    metode_penilaian: str = "biasa"
    kohort_status: Optional[str] = None
    skala: Optional[str] = None
    skor_mentah: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None
    kkm: float = 75
    calculated_at: Optional[datetime] = None


class RataRataSkalaOut(BaseModel):
    skala: str  # "biasa" (0-100), "tka" (200-800), "utbk" (0-1000)
    jumlah: int
    rata_rata: float
    tertinggi: float
    terendah: float


class HasilAnalyticsOut(BaseModel):
    jumlah_hasil: int
    rata_rata_nilai: Optional[float] = None
    nilai_tertinggi: Optional[float] = None
    nilai_terendah: Optional[float] = None
    jumlah_lulus_75: int
    # Nilai biasa dan kohort berbeda skala: rata_rata_nilai/tertinggi/terendah
    # hanya dari nilai biasa, rincian kohort per skala ada di sini.
    rata_rata_per_skala: List[RataRataSkalaOut] = []
