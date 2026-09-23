from app.db.database import SessionLocal
from app.models.program import Program
from app.models.jadwal_ujian import JadwalUjian
from datetime import datetime, timedelta, timezone


def default_program_id():
    """Reference data for API tests that do not exercise program selection."""
    with SessionLocal() as db:
        program = db.query(Program).filter(Program.nama == "QA Program").first()
        if program is None:
            program = Program(nama="QA Program", is_active=True)
            db.add(program)
            db.commit()
            db.refresh(program)
        return program.id


def active_schedule_id(paket_id):
    with SessionLocal() as db:
        now = datetime.now(timezone.utc)
        jadwal = JadwalUjian(paket_ujian_id=paket_id, mulai=now - timedelta(minutes=1),
                            selesai=now + timedelta(hours=1), is_published=True, status="published")
        db.add(jadwal)
        db.commit()
        db.refresh(jadwal)
        return jadwal.id


def make_paket_ready(paket_id, durasi_menit=30):
    """Siapkan paket lama (tanpa bagian) agar lolos syarat penjadwalan tryout:
    satu bagian ber-mapel, berdurasi, disetujui, dan berisi soal approved."""
    from app.models.bagian_paket import BagianPaket
    from app.models.paket_soal import PaketSoal
    from app.models.paket_ujian import PaketUjian
    from app.models.pelajaran import Pelajaran
    from app.models.soal import Soal

    with SessionLocal() as db:
        pelajaran = Pelajaran(nama=f"Mapel Paket {paket_id}")
        db.add(pelajaran)
        db.flush()
        bagian = BagianPaket(paket_ujian_id=paket_id, nama="Bagian Utama", urutan=1, pelajaran_id=pelajaran.id,
                             durasi_menit=durasi_menit, status="approved")
        db.add(bagian)
        db.flush()
        links = db.query(PaketSoal).filter(PaketSoal.paket_ujian_id == paket_id).all()
        if not links:
            soal = Soal(teks_soal="Soal siap jadwal", tipe="esai", status="approved", pelajaran_id=pelajaran.id)
            db.add(soal)
            db.flush()
            links = [PaketSoal(paket_ujian_id=paket_id, soal_id=soal.id, urutan=1)]
            db.add_all(links)
        for link in links:
            link.bagian_paket_id = bagian.id
            db.query(Soal).filter(Soal.id == link.soal_id).update({Soal.status: "approved"})
        # Sama seperti _sync_paket_totals: total paket mengikuti bagian.
        paket = db.get(PaketUjian, paket_id)
        paket.durasi_menit = durasi_menit
        paket.jumlah_soal = len(links)
        db.commit()
