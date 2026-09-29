"""Rombak struktur kategori/paket dummy sesuai permintaan:
- Kategori hanya 3: UTBK, TKA SMA, TKA SMP (SKD CPNS dihapus).
- UTBK: 7 mapel (PU, PPU, PBM, PK, LBI, LBE, PM) -- nomenklatur resmi UTBK-SNBT
  karena singkatan "CB1/CBE" dari client tidak cocok istilah baku manapun.
- TKA SMA & TKA SMP: 3 mapel (Matematika, Bahasa Indonesia, Bahasa Inggris).
- Latihan = 1 paket gabungan semua mapel per kategori.
- Tryout = 3 paket (I/II/III) per kategori, masing-masing berisi semua mapel + jadwal aktif.
- Soal baru mencakup semua tipe: pilihan_ganda, pilihan_lebih_dari_satu, benar_salah, esai, isian.

Run: .\\venv\\Scripts\\python.exe scripts/seed_struktur_ujian.py
Aman dijalankan ulang: jika mapel "Penalaran Matematika" sudah ada, tidak ada perubahan.
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
from app.models.pernyataan_benar_salah import PernyataanBenarSalah
from app.models.paket_ujian import PaketUjian
from app.models.paket_soal import PaketSoal
from app.models.bagian_paket import BagianPaket
from app.models.jadwal_ujian import JadwalUjian
from app.models.kategori_paket import KategoriPaket

MARKER = "Soal Struktur v2"


def pg(teks, opsi, benar, bahasan, sulit="sedang"):
    return {"tipe": "pilihan_ganda", "teks": teks, "opsi": opsi, "benar": benar, "bahasan": bahasan, "sulit": sulit}


def pgk(teks, opsi, benar, bahasan, sulit="sedang"):
    return {"tipe": "pilihan_lebih_dari_satu", "teks": teks, "opsi": opsi, "benar": benar, "bahasan": bahasan, "sulit": sulit}


def bs_simple(teks, benar, bahasan, sulit="sedang"):
    return {"tipe": "benar_salah_simple", "teks": teks, "benar": benar, "bahasan": bahasan, "sulit": sulit}


def bs_compound(teks, pernyataan, bahasan, sulit="sedang"):
    return {"tipe": "benar_salah_compound", "teks": teks, "pernyataan": pernyataan, "bahasan": bahasan, "sulit": sulit}


def isian(teks, kunci, bahasan, sulit="sedang"):
    return {"tipe": "isian", "teks": teks, "kunci": kunci, "bahasan": bahasan, "sulit": sulit}


def esai(teks, bahasan, sulit="sedang"):
    return {"tipe": "esai", "teks": teks, "bahasan": bahasan, "sulit": sulit}


BANK_BARU = {
    "Pengetahuan dan Pemahaman Umum": [
        pg("Proses fotosintesis pada tumbuhan menghasilkan oksigen dan ...", ["Karbon dioksida", "Glukosa", "Nitrogen", "Air"], 1, "Fotosintesis mengubah CO2 dan air menjadi glukosa dan oksigen."),
        pg("Planet terbesar dalam tata surya adalah ...", ["Bumi", "Mars", "Jupiter", "Saturnus"], 2, "Jupiter adalah planet terbesar di tata surya."),
        pg("Ibu kota negara Australia adalah ...", ["Sydney", "Melbourne", "Canberra", "Perth"], 2, "Ibu kota Australia adalah Canberra, bukan Sydney atau Melbourne."),
        pg("Organisasi internasional yang menangani kesehatan dunia adalah ...", ["UNESCO", "WHO", "UNICEF", "FAO"], 1, "WHO (World Health Organization) menangani isu kesehatan dunia."),
        pg("Gunung tertinggi di dunia adalah ...", ["K2", "Everest", "Kilimanjaro", "Elbrus"], 1, "Gunung Everest adalah gunung tertinggi di dunia."),
        pg("Penemu telepon adalah ...", ["Thomas Edison", "Alexander Graham Bell", "Nikola Tesla", "James Watt"], 1, "Alexander Graham Bell dikenal sebagai penemu telepon."),
        pg("Mata uang resmi Jepang adalah ...", ["Won", "Yuan", "Yen", "Ringgit"], 2, "Mata uang Jepang adalah Yen."),
        pgk("Berikut yang termasuk sumber energi terbarukan adalah ...", ["Energi surya", "Batu bara", "Energi angin", "Minyak bumi", "Energi air"], [0, 2, 4], "Energi terbarukan meliputi surya, angin, dan air; batu bara serta minyak bumi adalah energi fosil."),
        pgk("Berikut yang merupakan negara anggota ASEAN adalah ...", ["Indonesia", "Jepang", "Thailand", "Korea Selatan", "Vietnam"], [0, 2, 4], "Anggota ASEAN antara lain Indonesia, Thailand, dan Vietnam; Jepang dan Korea Selatan bukan anggota ASEAN."),
        bs_compound(
            "Tentukan benar atau salah pernyataan berikut mengenai sistem tata surya:",
            [("Matahari adalah pusat tata surya", True), ("Bumi adalah planet terdekat dengan Matahari", False), ("Bulan adalah satelit alami Bumi", True), ("Venus adalah planet dengan cincin", False)],
            "Merkurius adalah planet terdekat Matahari, bukan Bumi; Saturnus (bukan Venus) planet yang terkenal dengan cincinnya.",
        ),
    ],
    "Pemahaman Bacaan dan Menulis": [
        pg("Bacalah paragraf berikut: 'Sampah plastik menjadi salah satu masalah lingkungan terbesar saat ini karena sulit terurai dan mencemari lautan.' Gagasan utama paragraf tersebut adalah ...", ["Sampah plastik mudah terurai", "Sampah plastik adalah masalah lingkungan karena sulit terurai", "Lautan tidak tercemar", "Plastik selalu bermanfaat bagi lingkungan"], 1, "Gagasan utama terdapat pada kalimat yang menyatakan sampah plastik sebagai masalah lingkungan."),
        pg("Kata 'terurai' pada paragraf di atas bermakna ...", ["tercampur", "terpecah menjadi unsur sederhana", "terbakar", "mengendap"], 1, "'Terurai' berarti terpecah menjadi bagian atau unsur yang lebih sederhana."),
        pg("Kalimat yang menggunakan kata baku adalah ...", ["Dia lagi nulis surat.", "Dia sedang menulis surat.", "Dia sedeng nulis surat.", "Dia sedang nulis surat."], 1, "Kata baku: 'sedang' dan 'menulis'."),
        pg("Paragraf yang baik memiliki struktur ...", ["kalimat utama - kalimat penjelas", "hanya kalimat penjelas", "kalimat acak", "tanpa kalimat utama"], 0, "Paragraf efektif memiliki kalimat utama yang didukung kalimat penjelas."),
        pg("Kata hubung 'meskipun' menunjukkan hubungan ...", ["sebab-akibat", "pertentangan", "waktu", "tujuan"], 1, "'Meskipun' adalah konjungsi konsesif yang menyatakan pertentangan."),
        pg("Ide pokok biasanya terletak di ...", ["tengah paragraf", "awal atau akhir paragraf", "judul saja", "catatan kaki"], 1, "Ide pokok umumnya berada di kalimat awal (deduktif) atau akhir (induktif) paragraf."),
        pg("Kalimat 'Meja itu di baca oleh adik' memiliki kesalahan penulisan pada kata ...", ["Meja", "di baca", "oleh", "adik"], 1, "Kata kerja pasif 'dibaca' seharusnya ditulis serangkai."),
        pg("Tujuan menulis ringkasan adalah ...", ["memperpanjang teks", "menyampaikan inti teks secara singkat", "mengubah makna teks", "menambah opini penulis"], 1, "Ringkasan bertujuan menyampaikan inti teks secara singkat dan objektif."),
        isian("Lengkapi kalimat: Karena hujan turun sangat lebat, jalan menjadi ____.", "banjir|becek|tergenang", "Jawaban menyesuaikan konteks akibat hujan lebat."),
        isian("Sinonim dari kata 'opini' adalah ____.", "pendapat|pandangan", "'Opini' bersinonim dengan 'pendapat' atau 'pandangan'."),
    ],
    "Literasi Bahasa Indonesia": [
        pg("Teks yang bertujuan meyakinkan pembaca disebut teks ...", ["narasi", "deskripsi", "persuasi", "eksposisi"], 2, "Teks persuasi bertujuan meyakinkan atau mengajak pembaca."),
        pg("Fungsi kata penghubung 'namun' adalah menyatakan ...", ["pertentangan", "sebab", "tujuan", "waktu"], 0, "'Namun' adalah konjungsi pertentangan."),
        pg("Kalimat yang berisi fakta adalah ...", ["Menurutku, film itu bagus.", "Air mendidih pada suhu 100°C.", "Sepertinya besok akan hujan.", "Saya kira dia benar."], 1, "Fakta adalah kebenaran yang dapat diverifikasi, seperti titik didih air."),
        pg("Struktur teks eksposisi terdiri atas ...", ["orientasi-komplikasi-resolusi", "tesis-argumen-penegasan ulang", "pembuka-isi-penutup surat", "judul saja"], 1, "Teks eksposisi memiliki struktur tesis, argumen, dan penegasan ulang."),
        pg("Kata 'namun' dan 'tetapi' termasuk kategori kata ...", ["kata benda", "kata hubung", "kata sifat", "kata kerja"], 1, "Keduanya adalah konjungsi (kata hubung)."),
        pg("Puisi yang tidak terikat rima dan jumlah baris disebut ...", ["pantun", "syair", "puisi bebas", "gurindam"], 2, "Puisi bebas tidak terikat aturan rima maupun jumlah baris."),
        pg("Majas yang membandingkan dua hal secara langsung disebut ...", ["metafora", "personifikasi", "hiperbola", "litotes"], 0, "Metafora membandingkan dua hal secara langsung tanpa kata pembanding."),
        pg("Ejaan yang tepat untuk kata serapan 'quality' adalah ...", ["kwalitas", "kualitas", "kwalitet", "kuwalitas"], 1, "Bentuk baku menurut KBBI adalah 'kualitas'."),
        esai("Tuliskan sebuah paragraf singkat (3-5 kalimat) yang menjelaskan pentingnya membaca bagi pelajar.", "Dinilai berdasarkan kejelasan gagasan, keterpaduan kalimat, dan tata bahasa."),
        esai("Jelaskan perbedaan antara teks fakta dan teks opini, sertakan masing-masing satu contoh.", "Dinilai berdasarkan ketepatan definisi dan relevansi contoh yang diberikan."),
    ],
    "Literasi Bahasa Inggris": [
        pg("Read the sentence: 'Despite the rain, they continued playing.' The word 'despite' shows ...", ["reason", "contrast", "time", "addition"], 1, "'Despite' introduces a contrast between two ideas."),
        pg("The main idea of a passage is usually found in the ...", ["last word", "topic sentence", "footnote", "title only"], 1, "The main idea is typically stated in the topic sentence."),
        pg("Choose the correct sentence.", ["She don't like coffee.", "She doesn't likes coffee.", "She doesn't like coffee.", "She not like coffee."], 2, "Subject 'she' with negative present simple: doesn't + base verb."),
        pg("The synonym of 'crucial' is ...", ["unimportant", "essential", "optional", "random"], 1, "'Crucial' means very important, similar to 'essential'."),
        pg("'Although he was tired, he finished the race.' This sentence shows ...", ["cause", "contrast", "condition", "purpose"], 1, "'Although' introduces a contrasting clause."),
        pg("Choose the word that best completes: 'The report was ___ detailed for a short summary.'", ["too", "enough", "so", "very"], 0, "'Too' + adjective expresses excess, matching the context of the sentence."),
        pg("Passive form of 'They built the bridge in 1990' is ...", ["The bridge built in 1990.", "The bridge was built in 1990.", "The bridge is built in 1990.", "The bridge has build in 1990."], 1, "Simple past passive: was/were + past participle."),
        pg("Which word is an antonym of 'abundant'?", ["plentiful", "scarce", "huge", "common"], 1, "'Abundant' means plentiful; its opposite is 'scarce'."),
        pg("In academic writing, a thesis statement usually appears in the ...", ["conclusion", "introduction", "middle body paragraph", "footnotes"], 1, "A thesis statement is typically placed in the introduction."),
        bs_simple("Statement: 'Reading the introduction and conclusion of a text can give a quick overview of its main idea.'", True, "This is a common and effective reading strategy, so the statement is true."),
    ],
    "Penalaran Matematika": [
        pg("Sebuah tangki berisi air sebanyak 3/5 dari kapasitasnya. Jika kapasitas tangki 200 liter, volume air adalah ...", ["100 liter", "120 liter", "140 liter", "160 liter"], 1, "3/5 × 200 = 120 liter."),
        pg("Jika 2 pekerja menyelesaikan pekerjaan dalam 6 hari, maka 3 pekerja dengan kecepatan sama menyelesaikan pekerjaan yang sama dalam ...", ["3 hari", "4 hari", "5 hari", "9 hari"], 1, "Total kerja = 2×6 = 12 orang-hari; 12/3 = 4 hari."),
        pg("Barisan 2, 5, 10, 17, 26, ... memiliki pola selisih ...", ["tetap", "ganjil berurutan", "genap berurutan", "kuadrat"], 1, "Selisih antarsuku: 3, 5, 7, 9 (ganjil berurutan)."),
        pg("Jika harga barang naik 10% menjadi Rp110.000, harga awal barang adalah ...", ["Rp95.000", "Rp100.000", "Rp105.000", "Rp99.000"], 1, "110.000 / 1,1 = 100.000."),
        pg("Perbandingan luas dua persegi dengan sisi 4 cm dan 6 cm adalah ...", ["2:3", "4:6", "16:9", "16:36 (disederhanakan 4:9)"], 3, "Luas = sisi²: 16 dan 36, rasio 16:36 = 4:9 setelah disederhanakan."),
        pg("Sebuah mobil menempuh 300 km dalam 4 jam, kecepatan rata-ratanya adalah ...", ["65 km/jam", "70 km/jam", "75 km/jam", "80 km/jam"], 2, "Kecepatan = jarak/waktu = 300/4 = 75 km/jam."),
        pg("Median dari data 4, 7, 9, 12, 15 adalah ...", ["7", "9", "10", "12"], 1, "Data sudah terurut, median adalah nilai tengah: 9."),
        pg("Jika x + y = 10 dan x − y = 4, maka nilai x adalah ...", ["3", "5", "6", "7"], 3, "Jumlahkan kedua persamaan: 2x = 14, sehingga x = 7."),
        pgk("Manakah pasangan bilangan berikut yang memiliki FPB 6?", ["12 dan 18", "10 dan 15", "24 dan 30", "14 dan 21", "18 dan 24"], [0, 2, 4], "FPB(12,18)=6, FPB(24,30)=6, FPB(18,24)=6; sedangkan FPB(10,15)=5 dan FPB(14,21)=7."),
        pgk("Manakah bilangan berikut yang merupakan bilangan prima?", ["7", "9", "11", "21", "13"], [0, 2, 4], "7, 11, dan 13 adalah bilangan prima; 9 = 3×3 dan 21 = 3×7 bukan prima."),
    ],
}

BANK_TAMBAHAN = {
    "Matematika": [
        pgk("Manakah dari bilangan berikut yang merupakan bilangan genap?", ["7", "12", "15", "20", "33"], [1, 3], "Bilangan genap habis dibagi 2: 12 dan 20."),
        bs_simple("23 adalah bilangan prima.", True, "23 hanya habis dibagi 1 dan 23, sehingga merupakan bilangan prima."),
        isian("Hasil dari 15% dari 200 adalah ____.", "30", "15% × 200 = 30."),
    ],
    "Bahasa Indonesia": [
        pgk("Manakah kata-kata di bawah ini yang termasuk kata baku?", ["analisis", "aktifitas", "karier", "tehnik", "sistem"], [0, 2, 4], "Bentuk baku: analisis, karier, sistem. Bentuk tidak baku: aktifitas (baku: aktivitas), tehnik (baku: teknik)."),
        bs_simple("Kata 'daripada' ditulis serangkai.", True, "'Daripada' merupakan kata gabung yang ditulis serangkai sesuai KBBI."),
        esai("Tuliskan satu paragraf pendek (3 kalimat) tentang manfaat menabung.", "Dinilai berdasarkan kejelasan gagasan dan keterpaduan kalimat."),
    ],
    "Bahasa Inggris": [
        pgk("Which of the following are irregular verbs?", ["go", "walk", "eat", "play", "buy"], [0, 2, 4], "'go' (went), 'eat' (ate), and 'buy' (bought) are irregular verbs; 'walk' and 'play' are regular."),
        bs_simple("'She has went to school' is grammatically correct.", False, "The correct present perfect form is 'She has gone to school'."),
        isian("The past tense of 'write' is ____.", "wrote", "'Write' is an irregular verb: write - wrote - written."),
    ],
}

# (nama_bagian, nama_pelajaran)
UTBK_MAPEL = [
    ("PU - Penalaran Umum", "Penalaran Umum"),
    ("PPU - Pengetahuan dan Pemahaman Umum", "Pengetahuan dan Pemahaman Umum"),
    ("PBM - Pemahaman Bacaan dan Menulis", "Pemahaman Bacaan dan Menulis"),
    ("PK - Pengetahuan Kuantitatif", "Pengetahuan Kuantitatif"),
    ("LBI - Literasi Bahasa Indonesia", "Literasi Bahasa Indonesia"),
    ("LBE - Literasi Bahasa Inggris", "Literasi Bahasa Inggris"),
    ("PM - Penalaran Matematika", "Penalaran Matematika"),
]
TKA_MAPEL = [
    ("Matematika", "Matematika"),
    ("Bahasa Indonesia", "Bahasa Indonesia"),
    ("Bahasa Inggris", "Bahasa Inggris"),
]


def main():
    if engine.dialect.name != "sqlite":
        raise RuntimeError("Seeder ini hanya untuk database SQLite lokal.")
    db_path = Path(engine.url.database).resolve()
    with SessionLocal() as db:
        if db.query(Pelajaran.id).filter_by(nama="Penalaran Matematika").first():
            print("Struktur v2 sudah pernah dijalankan; tidak ada perubahan.")
            return
    now = datetime.now(timezone.utc)
    backup = db_path.with_name(f"{db_path.stem}.before-struktur-{now.strftime('%Y%m%d-%H%M%S')}{db_path.suffix}")
    with sqlite3.connect(str(db_path)) as source, sqlite3.connect(str(backup)) as dest:
        source.backup(dest)
    print(f"Backup: {backup}")
    naive_now = now.replace(tzinfo=None)

    with SessionLocal.begin() as db:
        admin = db.query(User).filter_by(role="admin").order_by(User.id).first()

        def buat_soal(pelajaran_id: int, item: dict) -> int:
            tipe = "benar_salah" if item["tipe"] in ("benar_salah_simple", "benar_salah_compound") else item["tipe"]
            soal = Soal(
                pelajaran_id=pelajaran_id, subbab=MARKER, teks_soal=f"<p>{item['teks']}</p>", tipe=tipe,
                tingkat_kesulitan=item.get("sulit", "sedang"), poin=1.0, pembahasan=f"<p>{item['bahasan']}</p>",
                status="approved", created_by=admin.id, reviewed_by=admin.id, reviewed_at=naive_now, published_at=naive_now,
                kunci_jawaban=item["kunci"] if item["tipe"] == "isian" else None,
            )
            db.add(soal)
            db.flush()
            if item["tipe"] in ("pilihan_ganda", "pilihan_lebih_dari_satu"):
                benar = item["benar"] if isinstance(item["benar"], list) else [item["benar"]]
                for j, teks_opsi in enumerate(item["opsi"]):
                    db.add(OpsiJawaban(soal_id=soal.id, teks_opsi=teks_opsi, is_benar=(j in benar), urutan=j + 1))
            elif item["tipe"] == "benar_salah_simple":
                db.add(OpsiJawaban(soal_id=soal.id, teks_opsi="Benar", is_benar=item["benar"] is True, urutan=1))
                db.add(OpsiJawaban(soal_id=soal.id, teks_opsi="Salah", is_benar=item["benar"] is False, urutan=2))
            elif item["tipe"] == "benar_salah_compound":
                for k, (teks_pernyataan, is_benar) in enumerate(item["pernyataan"]):
                    db.add(PernyataanBenarSalah(soal_id=soal.id, teks_pernyataan=teks_pernyataan, urutan=k + 1, is_benar=is_benar))
            return soal.id

        # --- Pelajaran (mapel baru UTBK) ---
        pelajaran = {p.nama: p.id for p in db.query(Pelajaran).all()}
        for nama in list(BANK_BARU.keys()):
            if nama not in pelajaran:
                row = Pelajaran(nama=nama, is_active=True)
                db.add(row)
                db.flush()
                pelajaran[nama] = row.id

        # --- Soal baru (5 mapel UTBK, 10 soal @ campuran tipe) ---
        soal_ids: dict[str, list[int]] = {}
        for nama, items in BANK_BARU.items():
            soal_ids[nama] = [buat_soal(pelajaran[nama], item) for item in items]

        # --- Soal tambahan untuk mapel TKA (variasi tipe soal) ---
        for nama, items in BANK_TAMBAHAN.items():
            existing = db.query(Soal.id).filter(Soal.pelajaran_id == pelajaran[nama], Soal.status == "approved").all()
            ids = [row[0] for row in existing] + [buat_soal(pelajaran[nama], item) for item in items]
            soal_ids[nama] = ids

        # --- Mapel UTBK yang dipakai ulang tanpa soal baru (PU, PK sudah ada) ---
        for nama in ("Penalaran Umum", "Pengetahuan Kuantitatif"):
            existing = db.query(Soal.id).filter(Soal.pelajaran_id == pelajaran[nama], Soal.status == "approved").all()
            soal_ids[nama] = [row[0] for row in existing]

        # --- Bersihkan kategori & paket lama yang akan dirombak ---
        kategori_map = {k.kode: k for k in db.query(KategoriPaket).all()}
        old_paket_ids = [p.id for p in db.query(PaketUjian).filter(PaketUjian.kategori_id.in_(
            [k.id for k in kategori_map.values() if k.kode in ("utbk", "tka_sma", "tka_smp", "skd")]
        )).all()]
        if old_paket_ids:
            db.query(JadwalUjian).filter(JadwalUjian.paket_ujian_id.in_(old_paket_ids)).delete(synchronize_session=False)
            db.query(PaketSoal).filter(PaketSoal.paket_ujian_id.in_(old_paket_ids)).delete(synchronize_session=False)
            db.query(BagianPaket).filter(BagianPaket.paket_ujian_id.in_(old_paket_ids)).delete(synchronize_session=False)
            db.query(PaketUjian).filter(PaketUjian.id.in_(old_paket_ids)).delete(synchronize_session=False)
            db.flush()
        if "skd" in kategori_map:
            db.delete(kategori_map["skd"])

        # --- Bangun ulang paket per kategori ---
        def bangun(kode_kategori: str, mapel_list: list[tuple[str, str]], soal_per_bagian: int, durasi_per_bagian: int):
            kategori = kategori_map[kode_kategori]

            def bagian_specs():
                specs = []
                for nama_bagian, nama_pelajaran in mapel_list:
                    ids = soal_ids[nama_pelajaran][:soal_per_bagian]
                    specs.append((nama_bagian, pelajaran[nama_pelajaran], ids))
                return specs

            def buat_paket(nama: str, tipe: str) -> PaketUjian:
                specs = bagian_specs()
                total_soal = sum(len(ids) for _, _, ids in specs)
                paket = PaketUjian(
                    nama=nama, deskripsi=f"Paket {nama} ({kategori.nama})",
                    durasi_menit=durasi_per_bagian * len(specs), jumlah_soal=total_soal,
                    is_random_soal=True, is_random_opsi=True,
                    tipe=tipe, kategori=kode_kategori, kategori_id=kategori.id,
                    metode_penilaian="biasa", skala_kohort="utbk", created_by=admin.id,
                )
                db.add(paket)
                db.flush()
                urutan = 0
                for i, (nama_bagian, pelajaran_id, ids) in enumerate(specs):
                    bagian = BagianPaket(
                        paket_ujian_id=paket.id, nama=nama_bagian, urutan=i + 1,
                        durasi_menit=durasi_per_bagian, pelajaran_id=pelajaran_id,
                        is_random_soal=True, is_random_opsi=True,
                    )
                    db.add(bagian)
                    db.flush()
                    for sid in ids:
                        urutan += 1
                        db.add(PaketSoal(paket_ujian_id=paket.id, soal_id=sid, urutan=urutan, bagian_paket_id=bagian.id))
                return paket

            buat_paket(f"Latihan {kategori.nama}", "latihan")
            for label in ("I", "II", "III"):
                tryout = buat_paket(f"Tryout {kategori.nama} {label}", "ujian")
                db.add(JadwalUjian(
                    paket_ujian_id=tryout.id, mulai=naive_now - timedelta(days=1), selesai=naive_now + timedelta(days=30),
                    is_published=True, program_id=None, kelas_id=None, grup_tryout_id=None, is_deleted=False,
                    status="published", created_by=admin.id, reviewed_by=admin.id, reviewed_at=naive_now,
                ))

        bangun("utbk", UTBK_MAPEL, soal_per_bagian=10, durasi_per_bagian=15)
        bangun("tka_sma", TKA_MAPEL, soal_per_bagian=10, durasi_per_bagian=20)
        bangun("tka_smp", TKA_MAPEL, soal_per_bagian=10, durasi_per_bagian=20)

    print("Selesai: kategori UTBK/TKA SMA/TKA SMP dirombak dengan latihan gabungan + 3 tryout per kategori.")


if __name__ == "__main__":
    main()
