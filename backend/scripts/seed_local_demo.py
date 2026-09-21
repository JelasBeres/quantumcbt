"""Add a linked demo dataset once, exclusively to this workspace's dev-local.db.

Run: .\venv\Scripts\python.exe scripts/seed_local_demo.py
Existing users/passwords and academic records are not overwritten.
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db.database import engine, SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.siswa import Siswa
from app.models.pelajaran import Pelajaran
from app.models.kelas import Kelas
from app.models.topik import Topik
from app.models.guru_scope import GuruScope
from app.models.soal import Soal
from app.models.opsi_jawaban import OpsiJawaban
from app.models.soal_review_history import SoalReviewHistory
from app.models.paket_ujian import PaketUjian
from app.models.paket_soal import PaketSoal
from app.models.bagian_paket import BagianPaket
from app.models.grup_tryout import GrupTryout
from app.models.jadwal_ujian import JadwalUjian
from app.models.ujian_siswa import UjianSiswa
from app.models.jawaban_siswa import JawabanSiswa
from app.models.hasil_ujian import HasilUjian
from app.models.pengaturan import Pengaturan
from app.services.scoring import calculate_ujian_score

MARKER = "local_demo_dataset_v1"


def main():
    target = (ROOT / "dev-local.db").resolve()
    if engine.dialect.name != "sqlite" or Path(engine.url.database).resolve() != target:
        raise RuntimeError("Seeder only supports this workspace's dev-local.db")
    with SessionLocal() as db:
        if db.query(Pengaturan).filter_by(key=MARKER).first():
            print("Demo dataset already exists; no changes made.")
            return
    now = datetime.now(timezone.utc)
    backup = target.with_name("dev-local.before-demo-" + now.strftime("%Y%m%d-%H%M%S") + ".db")
    with sqlite3.connect(str(target)) as source, sqlite3.connect(str(backup)) as dest:
        source.backup(dest)

    with SessionLocal.begin() as db:
        admin = db.query(User).filter_by(username="admin").one()
        guru = db.query(User).filter_by(username="guru.demo").one()
        demo_user = db.query(User).filter_by(username="siswa.demo").one()
        demo = db.query(Siswa).filter_by(user_id=demo_user.id).one()
        assert demo.program_id and demo.kelas_id, "Demo student needs academic assignment"
        math = db.query(Pelajaran).filter_by(nama="Matematika Demo", program_id=demo.program_id).one()
        physics = Pelajaran(nama="Fisika Dummy", program_id=demo.program_id)
        kelas11 = Kelas(nama="Kelas 11 Dummy")
        db.add_all([physics, kelas11]); db.flush()
        for subject, kelas_id in [(math, kelas11.id), (physics, demo.kelas_id), (physics, kelas11.id)]:
            db.add(GuruScope(user_id=guru.id, pelajaran_id=subject.id, program_id=demo.program_id, kelas_id=kelas_id))
        chapters = []
        for subject, name in [(math, "Aljabar Dummy"), (math, "Geometri Dummy"), (physics, "Gerak Dummy")]:
            chapter = Topik(pelajaran_id=subject.id, nama=name, is_active=True)
            db.add(chapter); db.flush(); chapters.append(chapter)

        students = [demo]
        names = ["Alya", "Bima", "Citra", "Dimas", "Elsa", "Farhan", "Gita", "Hana"]
        password_hash = get_password_hash("SiswaDummy2026!")
        for index, name in enumerate(names, 1):
            username = f"siswa.dummy{index:02d}"
            assert not db.query(User).filter_by(username=username).first(), f"Account collision: {username}"
            user = User(username=username, password_hash=password_hash, role="siswa", is_active=True)
            db.add(user); db.flush()
            student = Siswa(user_id=user.id, nama_lengkap=f"{name} Dummy", no_induk=f"DUMMY-2026-{index:03d}",
                            sekolah=f"SMA Dummy {(index % 3) + 1}", program_id=demo.program_id, kelas_id=demo.kelas_id)
            db.add(student); db.flush(); students.append(student)

        questions = []
        options = {}

        def question(chapter, subbab, prompt, explanation, choices, correct, *, tipe="pilihan_ganda", status="approved", kelas_id=None, answer=None):
            q = Soal(pelajaran_id=chapter.pelajaran_id, kelas_id=kelas_id or demo.kelas_id,
                     topik_id=chapter.id, subbab=subbab, teks_soal=prompt, tipe=tipe,
                     tingkat_kesulitan=["mudah", "sedang", "sulit"][len(questions) % 3],
                     pembahasan=explanation, kunci_jawaban=answer, created_by=guru.id, status=status,
                     submitted_for_review_at=now if status != "draft" else None,
                     reviewed_by=admin.id if status in ("approved", "rejected") else None,
                     reviewed_at=now if status in ("approved", "rejected") else None,
                     published_at=now if status == "approved" else None,
                     rejection_reason="Perjelas langkah penyelesaian dan pembahasannya." if status == "rejected" else None)
            db.add(q); db.flush()
            rows = []
            for i, choice in enumerate(choices):
                row = OpsiJawaban(soal_id=q.id, teks_opsi=str(choice), is_benar=i in correct, urutan=i+1)
                db.add(row); rows.append(row)
            db.flush(); options[q.id] = rows
            db.add(SoalReviewHistory(soal_id=q.id, actor_user_id=guru.id, action="created", from_status=None,
                                    to_status="draft", note="Data dummy lokal"))
            if status != "draft":
                db.add(SoalReviewHistory(soal_id=q.id, actor_user_id=guru.id, action="submitted", from_status="draft", to_status="pending_review"))
            if status in ("approved", "rejected"):
                db.add(SoalReviewHistory(soal_id=q.id, actor_user_id=admin.id, action=status, from_status="pending_review", to_status=status, note=q.rejection_reason))
            questions.append(q)
            return q

        for i in range(1, 25):
            chapter = chapters[(i-1)//8]
            if i <= 8:
                subbab, prompt, value = "Persamaan Linear", f"Jika x + {i} = {3*i}, berapa nilai x?", 2*i
                explanation = f"Kurangi kedua ruas dengan {i}; x = {value}."
            elif i <= 16:
                subbab, prompt, value = "Luas Persegi", f"Persegi bersisi {i-6} cm. Berapa luasnya dalam cm persegi?", (i-6)**2
                explanation = f"Luas = sisi dikali sisi = {value} cm persegi."
            else:
                subbab, prompt, value = "Kecepatan Konstan", f"Benda menempuh {i*4} meter selama 4 detik. Berapa kecepatannya dalam m/s?", i
                explanation = f"Kecepatan = jarak / waktu = {value} m/s."
            question(chapter, subbab, prompt, explanation, [value, value+1, value+2, value+3], [0])
        question(chapters[0], "Bilangan", "Pilih semua bilangan prima berikut.", "2 dan 3 hanya memiliki dua faktor positif.", [2, 3, 4, 6], [0, 1], tipe="pilihan_lebih_dari_satu")
        question(chapters[1], "Bangun Datar", "Persegi mempunyai empat sisi sama panjang.", "Pernyataan sesuai definisi persegi.", ["Benar", "Salah"], [0], tipe="benar_salah")
        question(chapters[0], "Persamaan Linear", "Tentukan x pada 2x = 12.", "Bagi kedua ruas dengan 2; x = 6.", [], [], tipe="isian", answer="6")
        essay = question(chapters[2], "Kecepatan Konstan", "Jelaskan perbedaan kelajuan dan kecepatan.", "Kelajuan adalah skalar, kecepatan adalah vektor yang memperhitungkan arah.", [], [], tipe="esai")
        for status in ("draft", "pending_review", "rejected"):
            for i in range(3):
                question(chapters[i], "Latihan Konsep", f"[{status} dummy {i+1}] Hitung {i+2} + {i+3}.",
                         f"Hasil penjumlahan adalah {2*i+5}.", [2*i+5, 2*i+6, 2*i+7, 2*i+8], [0],
                         status=status, kelas_id=kelas11.id if i==1 else demo.kelas_id)

        def package(name, selected, tipe, status, start, end):
            p = PaketUjian(nama=name, deskripsi="Data dummy untuk pengujian browser lokal.", tipe=tipe,
                           durasi_menit=45, jumlah_soal=len(selected), program_id=demo.program_id,
                           kelas_id=demo.kelas_id, created_by=guru.id)
            db.add(p); db.flush()
            sections = {}
            for q in selected:
                if q.pelajaran_id not in sections:
                    part = BagianPaket(paket_ujian_id=p.id, nama="Matematika" if q.pelajaran_id==math.id else "Fisika",
                                       pelajaran_id=q.pelajaran_id, urutan=len(sections)+1, durasi_menit=None)
                    db.add(part); db.flush(); sections[q.pelajaran_id] = part
            for i, q in enumerate(selected, 1):
                db.add(PaketSoal(paket_ujian_id=p.id, soal_id=q.id, urutan=i, bagian_paket_id=sections[q.pelajaran_id].id))
            group = GrupTryout(nama=f"Grup {name}", deskripsi="Grup dummy lokal", is_active=True)
            db.add(group); db.flush()
            schedule = JadwalUjian(paket_ujian_id=p.id, mulai=start, selesai=end, program_id=demo.program_id,
                                  kelas_id=demo.kelas_id, grup_tryout_id=group.id, durasi_menit_paket=45,
                                  status=status, is_published=status=="published", created_by=guru.id,
                                  submitted_for_review_at=now if status=="pending_review" else None,
                                  reviewed_by=admin.id if status=="published" else None,
                                  reviewed_at=now if status=="published" else None)
            db.add(schedule); db.flush()
            return p, schedule, sections

        package("Latihan Dummy - Siap Dikerjakan", questions[:6]+questions[16:20]+questions[24:28], "latihan", "published", now-timedelta(hours=1), now+timedelta(days=7))
        package("Tryout Dummy - Besok", questions[:8]+questions[16:24], "ujian", "published", now+timedelta(days=1), now+timedelta(days=1,hours=2))
        selected = questions[:8]+questions[16:20]+[essay]
        historical, schedule, sections = package("Tryout Dummy - Riwayat Nilai", selected, "ujian", "published", now-timedelta(days=2,hours=2), now-timedelta(days=2))
        package("Tryout Dummy - Menunggu Review", questions[8:16], "ujian", "pending_review", now+timedelta(days=3), now+timedelta(days=3,hours=2))
        for index, student in enumerate(students):
            start = now-timedelta(days=2,hours=1)
            attempt = UjianSiswa(siswa_id=student.id, paket_ujian_id=historical.id, jadwal_ujian_id=schedule.id,
                                started_at=start, finished_at=start+timedelta(minutes=30), is_submitted=True,
                                soal_urutan=[q.id for q in selected], opsi_urutan={str(q.id): [o.id for o in options[q.id]] for q in selected},
                                bagian_urutan=[{"bagian_id":part.id,"nama":part.nama,"urutan":part.urutan,
                                               "durasi_menit":None,"pelajaran_id":subject,
                                               "soal_ids":[q.id for q in selected if q.pelajaran_id==subject]} for subject,part in sections.items()])
            db.add(attempt); db.flush()
            for i, q in enumerate(selected):
                answer = "Kelajuan tidak memiliki arah, kecepatan memiliki arah." if q.id==essay.id else str(options[q.id][0 if i < 6+index%7 else 1].id)
                db.add(JawabanSiswa(ujian_siswa_id=attempt.id, soal_id=q.id, jawaban=answer, submitted_at=attempt.finished_at,
                                   skor_manual=80 if q.id==essay.id and index%2 else None,
                                   dinilai_oleh=guru.id if q.id==essay.id and index%2 else None,
                                   dinilai_at=attempt.finished_at if q.id==essay.id and index%2 else None))
            db.flush()
            score, breakdown, pending = calculate_ujian_score(db, attempt)
            breakdown["_meta"] = {"esai_belum_dinilai": pending, "menunggu_koreksi": pending>0}
            db.add(HasilUjian(ujian_siswa_id=attempt.id, skor=score, skor_per_pelajaran_json=breakdown, calculated_at=attempt.finished_at))
        summary = {"questions":len(questions), "new_students":8, "packages":4, "schedules":4, "completed_attempts":len(students), "created_at":now.isoformat()}
        db.add(Pengaturan(key=MARKER, value=json.dumps(summary)))
    print("Backup:", backup.name)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
