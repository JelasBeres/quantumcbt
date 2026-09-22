"""Isi paket dummy di dev.db dengan soal pilihan ganda yang realistis (status approved).

Run: .\\venv\\Scripts\\python.exe scripts/seed_soal_realistis.py

- Membuat backup dev.db lebih dulu.
- Soal placeholder lama (\"Contoh soal ...\") diarsipkan, bukan dihapus.
- Setiap bagian (mapel) pada paket latihan/tryout dihubungkan ke soal baru.
- Jadwal tryout yang sedang berlangsung diperpanjang 7 hari agar bisa dikerjakan sampai selesai.
- Aman dijalankan ulang: jika soal realistis sudah ada, tidak ada yang diubah.
"""
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.database import engine, SessionLocal
from app.models.user import User
from app.models.pelajaran import Pelajaran
from app.models.soal import Soal
from app.models.opsi_jawaban import OpsiJawaban
from app.models.paket_ujian import PaketUjian
from app.models.paket_soal import PaketSoal
from app.models.bagian_paket import BagianPaket
from app.models.jadwal_ujian import JadwalUjian

MARKER = "Soal Realistis v1"

# (teks, [opsi], index_benar, pembahasan)
BANK = {
    "Matematika": [
        ("Jika f(x) = 2x + 3, maka nilai f(5) adalah ...", ["10", "11", "13", "16"], 2, "f(5) = 2(5) + 3 = 13."),
        ("Nilai x yang memenuhi 3x − 7 = 11 adalah ...", ["4", "5", "6", "7"], 2, "3x = 18, sehingga x = 6."),
        ("Akar-akar persamaan x² − 5x + 6 = 0 adalah ...", ["1 dan 6", "2 dan 3", "−2 dan −3", "−1 dan 6"], 1, "Faktorkan: (x − 2)(x − 3) = 0, sehingga x = 2 atau x = 3."),
        ("Jumlah 10 suku pertama deret aritmetika dengan suku pertama 2 dan beda 3 adalah ...", ["135", "145", "155", "165"], 2, "S10 = 10/2 × (2·2 + 9·3) = 5 × 31 = 155."),
        ("Turunan pertama dari f(x) = x³ − 4x adalah ...", ["3x² − 4", "3x² − 4x", "x² − 4", "3x − 4"], 0, "Turunkan tiap suku: 3x² − 4."),
        ("Nilai dari ∫ 2x dx dengan batas 0 sampai 3 adalah ...", ["3", "6", "9", "12"], 2, "Integral 2x adalah x². Maka 3² − 0² = 9."),
        ("Sebuah dadu dilempar satu kali. Peluang muncul mata dadu genap adalah ...", ["1/6", "1/3", "1/2", "2/3"], 2, "Mata genap ada 3 (2, 4, 6) dari 6 kemungkinan, sehingga peluangnya 3/6 = 1/2."),
        ("Jarak antara titik A(1, 2) dan B(4, 6) adalah ...", ["4", "5", "6", "7"], 1, "Jarak = √((4−1)² + (6−2)²) = √(9 + 16) = 5."),
        ("Nilai dari sin 30° + cos 60° adalah ...", ["1/2", "√3/2", "1", "√3"], 2, "sin 30° = 1/2 dan cos 60° = 1/2, jumlahnya 1."),
        ("Nilai dari ²log 32 adalah ...", ["3", "4", "5", "6"], 2, "32 = 2⁵ sehingga ²log 32 = 5."),
    ],
    "Bahasa Indonesia": [
        ("Kalimat yang paling efektif di bawah ini adalah ...",
         ["Para siswa-siswa sedang belajar di kelas.", "Siswa-siswa sedang belajar di kelas.", "Para siswa sedang belajar di kelas.", "Para siswa-siswa itu sedang belajar di dalam kelas itu."], 2,
         "Kata jamak 'para' tidak boleh digandakan dengan bentuk ulang, sehingga 'Para siswa sedang belajar di kelas' efektif."),
        ("Kalimat utama dalam sebuah paragraf berfungsi untuk ...", ["memberi contoh", "menyampaikan gagasan pokok", "menyimpulkan bacaan", "menambah keterangan"], 1, "Kalimat utama memuat gagasan pokok yang dijelaskan oleh kalimat penjelas."),
        ("Penulisan kata baku yang benar terdapat pada pilihan ...", ["analisa", "analisis", "analisys", "anelisis"], 1, "Bentuk baku menurut KBBI adalah 'analisis'."),
        ("Penulisan huruf kapital yang benar terdapat pada kalimat ...",
         ["Kami berlibur ke Pulau Bali bulan Juli.", "Kami berlibur ke pulau bali bulan juli.", "Kami berlibur ke Pulau bali Bulan Juli.", "kami berlibur ke Pulau Bali bulan Juli."], 0,
         "Nama geografi dan awal kalimat diawali huruf kapital, sedangkan nama bulan 'Juli' juga ditulis dengan huruf kapital."),
        ("Sinonim kata 'arif' adalah ...", ["pandai", "bijaksana", "cerdik", "kaya"], 1, "Arif berarti bijaksana."),
        ("Antonim kata 'hakiki' adalah ...", ["nyata", "sejati", "semu", "asli"], 2, "Hakiki berarti sebenarnya, lawannya adalah semu."),
        ("Makna ungkapan 'meja hijau' adalah ...", ["ruang makan", "pengadilan", "tempat rapat", "tempat belajar"], 1, "Meja hijau adalah kiasan untuk pengadilan."),
        ("Kata 'memperbaiki' terbentuk dari imbuhan ...", ["me- dan -i", "memper- dan -i", "me- dan -kan", "per- dan -an"], 1, "Kata dasar 'baik' mendapat imbuhan memper-...-i sehingga menjadi 'memperbaiki'."),
        ("Kalimat majemuk bertingkat terdapat pada kalimat ...",
         ["Ayah membaca koran dan ibu memasak.", "Adik menangis karena mainannya rusak.", "Ia datang, tetapi tidak masuk.", "Kakak menulis surat lalu mengirimnya."], 1,
         "Ada induk kalimat 'Adik menangis' dan anak kalimat 'karena mainannya rusak' yang dihubungkan konjungsi subordinatif 'karena'."),
        ("Tanda baca yang tepat untuk melengkapi kalimat 'Apakah kamu sudah makan__' adalah ...", ["titik (.)", "koma (,)", "tanda tanya (?)", "tanda seru (!)"], 2, "Kalimat tanya diakhiri tanda tanya."),
    ],
    "Bahasa Inggris": [
        ("She ___ to school every day.", ["go", "goes", "going", "gone"], 1, "Subjek tunggal 'she' pada simple present memakai verba + s/es: goes."),
        ("The past tense of 'buy' is ...", ["buyed", "bought", "buys", "boughted"], 1, "'Buy' adalah verba tak beraturan: buy - bought - bought."),
        ("If I ___ rich, I would travel around the world.", ["am", "was", "were", "be"], 2, "Conditional type 2 memakai 'were' untuk semua subjek."),
        ("The word 'big' has the closest meaning to ...", ["small", "large", "thin", "short"], 1, "Big bersinonim dengan large."),
        ("He is very good ___ mathematics.", ["in", "on", "at", "for"], 2, "Kolokasi yang benar: good at."),
        ("Choose the correct passive form: 'Tom wrote the letter.'", ["The letter is written by Tom.", "The letter was written by Tom.", "The letter written by Tom.", "The letter has wrote by Tom."], 1, "Simple past passive: was/were + past participle."),
        ("I have lived in this city ___ 2010.", ["for", "since", "during", "from"], 1, "'Since' dipakai bersama titik waktu tertentu dalam present perfect."),
        ("The opposite of 'ancient' is ...", ["old", "modern", "historic", "classic"], 1, "Ancient (kuno) berlawanan dengan modern."),
        ("Neither of the boys ___ ready for the test.", ["are", "were", "is", "be"], 2, "'Neither of' diikuti verba tunggal: is."),
        ("Look at the sky! It ___ rain soon.", ["will", "is going to", "would", "shall"], 1, "Prediksi berdasarkan bukti saat ini memakai 'be going to'."),
    ],
    "Penalaran Umum": [
        ("Semua mahasiswa rajin belajar. Budi adalah mahasiswa. Kesimpulan yang tepat adalah ...", ["Budi malas belajar", "Budi rajin belajar", "Sebagian Budi rajin", "Budi bukan mahasiswa"], 1, "Silogisme: jika semua M adalah R dan B adalah M, maka B adalah R."),
        ("Lanjutan pola 2, 4, 8, 16, ... adalah ...", ["18", "24", "32", "64"], 2, "Setiap suku dikali 2, sehingga 16 × 2 = 32."),
        ("Dokter : Rumah Sakit = Guru : ...", ["Buku", "Sekolah", "Murid", "Ujian"], 1, "Dokter bekerja di rumah sakit, guru bekerja di sekolah."),
        ("Lanjutan deret 3, 6, 11, 18, 27, ... adalah ...", ["36", "38", "40", "42"], 1, "Selisih antarsuku 3, 5, 7, 9, sehingga berikutnya +11: 27 + 11 = 38."),
        ("Jika hujan turun maka jalan basah. Jalan tidak basah. Kesimpulannya ...", ["Hujan turun", "Hujan tidak turun", "Jalan kering karena panas", "Tidak dapat disimpulkan"], 1, "Modus tollens: ¬Q maka ¬P. Jalan tidak basah, jadi hujan tidak turun."),
        ("Andi lebih tinggi dari Budi, dan Budi lebih tinggi dari Cici. Siapa yang paling pendek?", ["Andi", "Budi", "Cici", "Tidak dapat ditentukan"], 2, "Urutan tinggi: Andi > Budi > Cici, jadi Cici paling pendek."),
        ("Lanjutan deret huruf A, C, E, G, ... adalah ...", ["H", "I", "J", "K"], 1, "Loncat satu huruf tiap suku: A, C, E, G, I."),
        ("Pernyataan 'Semua burung dapat terbang' dibantah oleh fakta bahwa ...", ["elang dapat terbang", "penguin tidak dapat terbang", "merpati hidup di kota", "burung bertelur"], 1, "Satu contoh yang berlawanan (penguin) cukup untuk membantah pernyataan universal."),
        ("Lanjutan pola 1, 1, 2, 3, 5, 8, ... adalah ...", ["11", "12", "13", "14"], 2, "Deret Fibonacci: 5 + 8 = 13."),
        ("Bola : Bulat = Dadu : ...", ["Segitiga", "Kubus", "Lingkaran", "Balok"], 1, "Bola berbentuk bulat, dadu berbentuk kubus."),
    ],
    "Pengetahuan Kuantitatif": [
        ("25% dari 240 adalah ...", ["50", "55", "60", "65"], 2, "240 × 25/100 = 60."),
        ("Rata-rata dari 4, 6, 8, 10, 12 adalah ...", ["7", "8", "9", "10"], 1, "Jumlah = 40, dibagi 5 = 8."),
        ("Hasil dari 3/4 + 2/3 adalah ...", ["5/7", "17/12", "5/12", "6/7"], 1, "3/4 + 2/3 = 9/12 + 8/12 = 17/12."),
        ("Sebuah mobil melaju 60 km/jam selama 2,5 jam. Jarak yang ditempuh adalah ...", ["120 km", "140 km", "150 km", "160 km"], 2, "Jarak = 60 × 2,5 = 150 km."),
        ("Harga sebuah barang Rp50.000 naik 20%. Harga barunya adalah ...", ["Rp55.000", "Rp58.000", "Rp60.000", "Rp62.500"], 2, "Kenaikan = 20% × 50.000 = 10.000, harga baru 60.000."),
        ("Jika x/4 = 9/6, maka nilai x adalah ...", ["4", "5", "6", "8"], 2, "x = 4 × 9/6 = 6."),
        ("KPK dari 12 dan 18 adalah ...", ["6", "24", "36", "72"], 2, "12 = 2²·3 dan 18 = 2·3², KPK = 2²·3² = 36."),
        ("Persegi panjang berukuran 12 cm × 5 cm memiliki keliling ...", ["34 cm", "60 cm", "17 cm", "30 cm"], 0, "Keliling = 2(12 + 5) = 34 cm."),
        ("Hasil dari 2⁵ × 2³ adalah ...", ["64", "128", "256", "512"], 2, "2⁵ × 2³ = 2⁸ = 256."),
        ("Perbandingan uang A dan B adalah 3 : 5 dengan jumlah Rp40.000. Uang A adalah ...", ["Rp12.000", "Rp15.000", "Rp20.000", "Rp25.000"], 1, "A = 3/8 × 40.000 = 15.000."),
    ],
    "Tes Wawasan Kebangsaan": [
        ("Dasar negara Republik Indonesia adalah ...", ["UUD 1945", "Pancasila", "Proklamasi", "GBHN"], 1, "Pancasila adalah dasar negara dan pandangan hidup bangsa."),
        ("Sila ketiga Pancasila berbunyi ...", ["Kemanusiaan yang adil dan beradab", "Persatuan Indonesia", "Ketuhanan Yang Maha Esa", "Keadilan sosial bagi seluruh rakyat Indonesia"], 1, "Sila ketiga: Persatuan Indonesia."),
        ("UUD 1945 telah diamandemen sebanyak ... kali.", ["2", "3", "4", "5"], 2, "Amandemen dilakukan empat kali pada tahun 1999–2002."),
        ("Proklamasi kemerdekaan Indonesia dibacakan pada tanggal ...", ["17 Agustus 1945", "1 Juni 1945", "28 Oktober 1928", "10 November 1945"], 0, "Proklamasi dibacakan Soekarno-Hatta pada 17 Agustus 1945."),
        ("Semboyan yang tercantum pada lambang negara Garuda Pancasila adalah ...", ["Tut Wuri Handayani", "Bhinneka Tunggal Ika", "Merdeka atau Mati", "Jer Basuki Mawa Bea"], 1, "Bhinneka Tunggal Ika berarti berbeda-beda tetapi tetap satu."),
        ("Pasal 1 ayat (3) UUD 1945 menyatakan bahwa Indonesia adalah negara ...", ["kekuasaan", "hukum", "federal", "agama"], 1, "Negara Indonesia adalah negara hukum."),
        ("Lembaga negara yang memegang kekuasaan yudikatif tertinggi adalah ...", ["DPR", "Mahkamah Agung", "BPK", "Presiden"], 1, "Kekuasaan kehakiman dipegang Mahkamah Agung dan Mahkamah Konstitusi."),
        ("Sumpah Pemuda diikrarkan pada tanggal ...", ["20 Mei 1908", "28 Oktober 1928", "17 Agustus 1945", "1 Juni 1945"], 1, "Sumpah Pemuda diikrarkan pada 28 Oktober 1928."),
        ("Wawasan Nusantara adalah cara pandang bangsa Indonesia terhadap ...", ["wilayah sebagai satu kesatuan ipoleksosbudhankam", "pembagian wilayah provinsi", "hubungan luar negeri", "sistem pemerintahan daerah"], 0, "Wawasan Nusantara memandang Indonesia sebagai satu kesatuan politik, ekonomi, sosial budaya, dan pertahanan keamanan."),
        ("Upaya bela negara dapat dilakukan warga negara dengan cara ...", ["mengabaikan aturan", "menjaga persatuan dan menaati hukum", "menghindari kegiatan sosial", "menolak membayar pajak"], 1, "Bela negara dilakukan lewat sikap dan perilaku yang menjaga persatuan dan menaati hukum."),
    ],
}

# paket_id: {nama bagian: slice indeks soal bank}. Latihan memakai 10 soal, tryout 5 soal per mapel SMA.
PLAN = {
    1: {"Matematika": slice(0, 10)},
    2: {"Bahasa Indonesia": slice(0, 10)},
    3: {"Bahasa Inggris": slice(0, 10)},
    4: {"Matematika": slice(0, 5), "Bahasa Indonesia": slice(0, 5)},
    5: {"Matematika": slice(5, 10), "Bahasa Inggris": slice(5, 10)},
    6: {"Penalaran Umum": slice(0, 10)},
    7: {"Penalaran Umum": slice(0, 10), "Pengetahuan Kuantitatif": slice(0, 10)},
    8: {"Tes Wawasan Kebangsaan": slice(0, 10)},
}


def main():
    if engine.dialect.name != "sqlite":
        raise RuntimeError("Seeder ini hanya untuk database SQLite lokal.")
    db_path = Path(engine.url.database).resolve()
    with SessionLocal() as db:
        if db.query(Soal.id).filter(Soal.subbab == MARKER).first():
            print("Soal realistis sudah ada; tidak ada perubahan.")
            return
    now = datetime.now(timezone.utc)
    backup = db_path.with_name(f"{db_path.stem}.before-soal-{now.strftime('%Y%m%d-%H%M%S')}{db_path.suffix}")
    with sqlite3.connect(str(db_path)) as source, sqlite3.connect(str(backup)) as dest:
        source.backup(dest)
    print(f"Backup: {backup}")
    naive_now = now.replace(tzinfo=None)

    with SessionLocal.begin() as db:
        admin = db.query(User).filter_by(role="admin").order_by(User.id).first()
        # Arsipkan soal placeholder lama.
        for old in db.query(Soal).filter(Soal.teks_soal.like("%Contoh soal%")).all():
            old.status = "archived"
            old.archived_at = naive_now

        pelajaran = {}
        for nama in BANK:
            row = db.query(Pelajaran).filter_by(nama=nama).first() or Pelajaran(nama=nama, is_active=True)
            db.add(row); db.flush()
            pelajaran[nama] = row.id

        soal_ids = {}
        for nama, items in BANK.items():
            ids = []
            for i, (teks, opsi, benar, bahas) in enumerate(items):
                soal = Soal(pelajaran_id=pelajaran[nama], subbab=MARKER, teks_soal=f"<p>{teks}</p>", tipe="pilihan_ganda",
                            tingkat_kesulitan=["mudah", "sedang", "sulit"][i % 3], poin=1.0, pembahasan=f"<p>{bahas}</p>",
                            status="approved", created_by=admin.id, reviewed_by=admin.id, reviewed_at=naive_now, published_at=naive_now)
                db.add(soal); db.flush()
                for j, teks_opsi in enumerate(opsi):
                    db.add(OpsiJawaban(soal_id=soal.id, teks_opsi=teks_opsi, is_benar=(j == benar), urutan=j + 1))
                ids.append(soal.id)
            soal_ids[nama] = ids

        for paket_id, bagian_plan in PLAN.items():
            paket = db.get(PaketUjian, paket_id)
            if not paket:
                continue
            db.query(PaketSoal).filter(PaketSoal.paket_ujian_id == paket_id).delete()
            urutan = 0
            for bagian in db.query(BagianPaket).filter(BagianPaket.paket_ujian_id == paket_id).order_by(BagianPaket.urutan, BagianPaket.id):
                if bagian.nama not in bagian_plan:
                    continue
                bagian.pelajaran_id = pelajaran[bagian.nama]
                for sid in soal_ids[bagian.nama][bagian_plan[bagian.nama]]:
                    urutan += 1
                    db.add(PaketSoal(paket_ujian_id=paket_id, soal_id=sid, urutan=urutan, bagian_paket_id=bagian.id))
            paket.jumlah_soal = urutan

        # Tryout yang sedang berlangsung diperpanjang agar bisa dikerjakan sampai selesai.
        for jadwal in db.query(JadwalUjian).filter(JadwalUjian.is_deleted == False).all():
            if jadwal.mulai <= naive_now:
                jadwal.selesai = naive_now + timedelta(days=7)
    print("Selesai: 60 soal realistis (6 mapel × 10) terpasang ke paket latihan dan tryout.")


if __name__ == "__main__":
    main()
