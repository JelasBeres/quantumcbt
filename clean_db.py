import sqlite3

def clean_db(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Tables to clear
    tables_to_clear = [
        'jawaban_siswa', 'ujian_siswa', 'jadwal_ujian', 'hasil_ujian', 'log_kecurangan',
        'opsi_jawaban', 'pernyataan_benar_salah', 'soal_review_history', 'laporan_soal',
        'soal', 'paket_soal', 'paket_mapel', 'bagian_paket', 'paket_ujian', 'kategori_paket',
        'subbab', 'topik', 'pelajaran', 'program', 'kelas', 'pemberitahuan', 'login_activity', 'login_attempt', 'auth_session'
    ]

    for table in tables_to_clear:
        try:
            cur.execute(f"DELETE FROM {table}")
            print(f"Cleared {table}")
        except Exception as e:
            print(f"Could not clear {table}: {e}")

    conn.commit()
    conn.close()
    print("Database cleaned successfully!")

if __name__ == "__main__":
    clean_db("backend/dev-local.db")
