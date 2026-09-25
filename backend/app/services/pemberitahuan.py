from datetime import timedelta, timezone

from sqlalchemy.orm import Session

from app.models.jadwal_ujian import JadwalUjian
from app.models.paket_ujian import PaketUjian
from app.models.pemberitahuan import Pemberitahuan

WIB = timezone(timedelta(hours=7), "WIB")
_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
          "Agustus", "September", "Oktober", "November", "Desember"]


def _format_wib(value) -> str:
    local = (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).astimezone(WIB)
    return f"{local.day} {_BULAN[local.month - 1]} {local.year}, {local:%H.%M} WIB"


def sinkron_pemberitahuan_jadwal(db: Session, jadwal: JadwalUjian) -> None:
    """Jaga pemberitahuan "paket ujian baru" sesuai status jadwal: dibuat saat
    jadwal pertama kali dipublikasikan, disembunyikan saat jadwal ditarik atau
    dihapus, dan tampil lagi bila dipublikasikan ulang (tanpa dobel)."""
    notif = db.query(Pemberitahuan).filter(Pemberitahuan.jadwal_ujian_id == jadwal.id).first()
    tayang = bool(jadwal.is_published) and not jadwal.is_deleted
    if not tayang:
        if notif is not None:
            notif.is_active = False
        return
    paket = db.get(PaketUjian, jadwal.paket_ujian_id)
    if paket is None:
        return
    if notif is None:
        notif = Pemberitahuan(jadwal_ujian_id=jadwal.id, jenis="paket_baru", tampil_popup=True, created_by=jadwal.reviewed_by or jadwal.created_by)
        db.add(notif)
    notif.judul = f"Paket ujian baru: {paket.nama}"
    notif.isi = f"Try Out {paket.nama} dibuka mulai {_format_wib(jadwal.mulai)}." + (
        f" Kerjakan sebelum {_format_wib(jadwal.selesai)}." if jadwal.selesai else ""
    )
    notif.tautan = f"/siswa/paket/{jadwal.id}"
    notif.program_id = jadwal.program_id
    notif.kelas_id = jadwal.kelas_id
    notif.berlaku_sampai = jadwal.selesai
    notif.is_active = True
