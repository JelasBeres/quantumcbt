import os
import sys

# Tambahkan root directory backend ke sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models import (
    log_kecurangan, jawaban_siswa, hasil_ujian, ujian_siswa, jadwal_ujian,
    paket_soal, bagian_paket, kategori_paket, paket_mapel, paket_ujian,
    pernyataan_benar_salah, opsi_jawaban, soal_review_history, laporan_soal, soal,
    subbab, topik, pemberitahuan, login_activity, login_attempt, auth_session
)

def clear_vps_data():
    print("Memulai proses pembersihan data (Kecuali Akun: Admin, Guru, Siswa, Kelas, Program, Pelajaran)...")
    db: Session = SessionLocal()
    try:
        # Hapus data dari tabel-tabel transaksional secara berurutan untuk menghindari error Foreign Key
        models_to_clear = [
            log_kecurangan.LogKecurangan,
            jawaban_siswa.JawabanSiswa,
            hasil_ujian.HasilUjian,
            ujian_siswa.UjianSiswa,
            jadwal_ujian.JadwalUjian,
            paket_soal.PaketSoal,
            bagian_paket.BagianPaket,
            kategori_paket.KategoriPaket,
            paket_mapel.PaketMapel,
            paket_ujian.PaketUjian,
            pernyataan_benar_salah.PernyataanBenarSalah,
            opsi_jawaban.OpsiJawaban,
            soal_review_history.SoalReviewHistory,
            laporan_soal.LaporanSoal,
            soal.Soal,
            subbab.Subbab,
            topik.Topik,
            pemberitahuan.Pemberitahuan,
            login_activity.LoginActivity,
            login_attempt.LoginAttempt,
            auth_session.AuthSession
        ]

        for model in models_to_clear:
            print(f"Menghapus data dari {model.__tablename__}...")
            db.query(model).delete()
            
        db.commit()
        print("✅ Data berhasil dibersihkan! Akun (Admin, Guru, Siswa), Kelas, Program, dan Pelajaran tetap utuh.")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Terjadi kesalahan saat membersihkan data: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    konfirmasi = input("PERINGATAN: Aksi ini akan menghapus semua soal, ujian, dan riwayat! Yakin ingin melanjutkan? (y/n): ")
    if konfirmasi.lower() == 'y':
        clear_vps_data()
    else:
        print("Dibatalkan.")
