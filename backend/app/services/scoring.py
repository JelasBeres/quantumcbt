from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import json
from typing import Any, Dict, Hashable, Iterable, Mapping, Optional, Sequence

from sqlalchemy.orm import Session

from app.models.hasil_ujian import HasilUjian
from app.models.jadwal_ujian import JadwalUjian
from app.models.jawaban_siswa import JawabanSiswa
from app.models.opsi_jawaban import OpsiJawaban
from app.models.paket_soal import PaketSoal
from app.models.paket_ujian import PaketUjian
from app.models.pelajaran import Pelajaran
from app.models.pernyataan_benar_salah import PernyataanBenarSalah
from app.models.siswa import Siswa
from app.models.soal import Soal
from app.models.ujian_siswa import UjianSiswa


@dataclass(frozen=True)
class CohortScoreResult:
    scores: list[Optional[int]]
    raw_scores: list[Optional[int]]
    weights: Dict[int, float]
    proportions: Dict[int, float]
    status: str
    n: int


def round_half_up(value: float) -> int:
    return int(Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def scale_cohort_score(ratio: float, scale: str) -> int:
    bounded = max(0.0, min(1.0, ratio))
    if scale == "tka":
        return round_half_up(200.0 + bounded * 600.0)
    return round_half_up(bounded * 1000.0)


def calculate_cohort_scores(
    answers: Sequence[Mapping[int, bool]],
    question_points: Mapping[int, float],
    scale: str = "utbk",
) -> CohortScoreResult:
    n = len(answers)
    question_ids = list(question_points)
    proportions = {
        question_id: (sum(1 for row in answers if row.get(question_id) is True) / n if n else 0.0)
        for question_id in question_ids
    }
    weights = {
        question_id: float(question_points[question_id])
        * (1.0 if n < 5 else 1.0 - proportions[question_id])
        for question_id in question_ids
    }
    total_weight = sum(weights.values())
    status = "kosong" if not answers or total_weight <= 0 else ("sementara" if n < 5 else "final")
    if total_weight <= 0:
        empty = [None for _ in answers]
        return CohortScoreResult(empty, empty.copy(), weights, proportions, status, n)
    ratios = [
        sum(weights[question_id] for question_id in question_ids if row.get(question_id) is True) / total_weight
        for row in answers
    ]
    return CohortScoreResult(
        [scale_cohort_score(ratio, scale) for ratio in ratios],
        [round_half_up(ratio * 100.0) for ratio in ratios],
        weights,
        proportions,
        status,
        n,
    )


def deduplicate_latest_attempts(attempts: Iterable[Any]) -> list[Any]:
    latest: Dict[Hashable, Any] = {}
    for attempt in attempts:
        student_id = getattr(attempt, "siswa_id")
        previous = latest.get(student_id)
        finished_at = getattr(attempt, "finished_at", None)
        previous_finished_at = getattr(previous, "finished_at", None) if previous is not None else None
        current_key = (finished_at.timestamp() if finished_at is not None else float("-inf"), getattr(attempt, "id"))
        previous_key = (
            previous_finished_at.timestamp() if previous_finished_at is not None else float("-inf"),
            getattr(previous, "id"),
        ) if previous is not None else None
        if previous_key is None or current_key > previous_key:
            latest[student_id] = attempt
    return sorted(latest.values(), key=lambda attempt: getattr(attempt, "id"))


def effective_program_key(
    attempt: UjianSiswa,
    schedules: Mapping[int, JadwalUjian],
    students: Mapping[int, Siswa],
    package: PaketUjian,
) -> str:
    schedule = schedules.get(attempt.jadwal_ujian_id) if attempt.jadwal_ujian_id is not None else None
    student = students.get(attempt.siswa_id)
    program_id = (
        schedule.program_id if schedule and schedule.program_id is not None
        else student.program_id if student and student.program_id is not None
        else package.program_id
    )
    return str(program_id) if program_id is not None else "tanpa_program"


def _empty_breakdown_entry(pelajaran_id: Optional[int], nama: str) -> Dict[str, Any]:
    return {
        "pelajaran_id": pelajaran_id,
        "nama": nama,
        "jumlah_soal": 0,
        "jumlah_benar": 0,
        "skor": 0.0,
    }


def _normalize_teks(text: str) -> str:
    return " ".join(text.strip().lower().split())


def _isian_cocok_kunci(kunci_jawaban: str, jawaban_siswa: str) -> bool:
    kunci_list = [k for k in kunci_jawaban.split("|") if k.strip()]
    jawaban = _normalize_teks(jawaban_siswa).rstrip(".")
    return any(_normalize_teks(k).rstrip(".") == jawaban for k in kunci_list)


def evaluate_answer(
    question_type: str,
    raw_answer: Optional[str],
    correct_option_ids: Iterable[int] = (),
    correct_statements: Optional[Mapping[int, bool]] = None,
    fill_key: Optional[str] = None,
    manual_score: Optional[float] = None,
) -> tuple[bool, float, bool]:
    option_ids = set(correct_option_ids)
    if question_type == "benar_salah" and correct_statements:
        try:
            parsed = json.loads(raw_answer) if raw_answer else []
            answers = {
                item["pernyataan_id"]: item["jawaban"]
                for item in parsed
                if isinstance(item, dict) and "pernyataan_id" in item and "jawaban" in item
            }
        except (json.JSONDecodeError, TypeError, KeyError):
            answers = {}
        correct = len(answers) == len(correct_statements) and all(
            statement_id in answers and answers[statement_id] is bool(expected)
            for statement_id, expected in correct_statements.items()
        )
        return correct, 1.0 if correct else 0.0, False
    if question_type in ("pilihan_ganda", "benar_salah"):
        try:
            selected_id = int(raw_answer) if raw_answer else None
        except (TypeError, ValueError):
            selected_id = None
        correct = selected_id is not None and selected_id in option_ids
        return correct, 1.0 if correct else 0.0, False
    if question_type == "pilihan_lebih_dari_satu":
        try:
            selected = json.loads(raw_answer) if raw_answer else []
            selected_ids = set(selected) if isinstance(selected, list) else set()
        except (json.JSONDecodeError, TypeError, ValueError):
            selected_ids = set()
        correct = bool(selected_ids) and selected_ids == option_ids
        return correct, 1.0 if correct else 0.0, False
    if question_type == "isian" and fill_key:
        correct = bool(raw_answer) and _isian_cocok_kunci(fill_key, raw_answer)
        return correct, 1.0 if correct else 0.0, False
    if manual_score is not None:
        fraction = max(0.0, min(100.0, manual_score)) / 100.0
        return fraction >= 0.6, fraction, False
    return False, 0.0, True


def _attempt_questions(db: Session, ujian: UjianSiswa) -> list[Soal]:
    if ujian.soal_urutan:
        soal_map = {soal.id: soal for soal in db.query(Soal).filter(Soal.id.in_(ujian.soal_urutan)).all()}
        return [soal_map[soal_id] for soal_id in ujian.soal_urutan if soal_id in soal_map]
    package_rows = (
        db.query(PaketSoal)
        .filter(PaketSoal.paket_ujian_id == ujian.paket_ujian_id)
        .order_by(PaketSoal.urutan, PaketSoal.id)
        .all()
    )
    question_ids = [row.soal_id for row in package_rows]
    if not question_ids:
        return []
    soal_map = {soal.id: soal for soal in db.query(Soal).filter(Soal.id.in_(question_ids)).all()}
    return [soal_map[soal_id] for soal_id in question_ids if soal_id in soal_map]


def _evaluate_question(
    db: Session,
    soal: Soal,
    jawaban: Optional[JawabanSiswa],
) -> tuple[bool, float, bool]:
    if soal.tipe == "benar_salah":
        statements = db.query(PernyataanBenarSalah).filter(PernyataanBenarSalah.soal_id == soal.id).all()
        if statements:
            return evaluate_answer(
                soal.tipe,
                jawaban.jawaban if jawaban else None,
                correct_statements={row.id: bool(row.is_benar) for row in statements},
            )

    if soal.tipe in ("pilihan_ganda", "benar_salah", "pilihan_lebih_dari_satu"):
        correct_option_ids = {
            option.id
            for option in db.query(OpsiJawaban).filter(OpsiJawaban.soal_id == soal.id).all()
            if option.is_benar
        }
        return evaluate_answer(
            soal.tipe,
            jawaban.jawaban if jawaban else None,
            correct_option_ids=correct_option_ids,
        )

    if soal.tipe == "isian" and soal.kunci_jawaban:
        result = evaluate_answer(
            soal.tipe,
            jawaban.jawaban if jawaban else None,
            fill_key=soal.kunci_jawaban,
        )
        if jawaban is not None:
            jawaban.skor_manual = 100.0 if result[0] else 0.0
            jawaban.dinilai_oleh = None
            jawaban.dinilai_at = None
        return result

    return evaluate_answer(
        soal.tipe,
        jawaban.jawaban if jawaban else None,
        manual_score=jawaban.skor_manual if jawaban else None,
    )


def calculate_ujian_score(db: Session, ujian: UjianSiswa) -> tuple[float, Dict[str, Dict[str, Any]], int]:
    questions = _attempt_questions(db, ujian)
    answer_map = {
        answer.soal_id: answer
        for answer in db.query(JawabanSiswa).filter(JawabanSiswa.ujian_siswa_id == ujian.id).all()
    }
    subject_ids = {question.pelajaran_id for question in questions if question.pelajaran_id is not None}
    subject_map = (
        {
            subject.id: subject.nama
            for subject in db.query(Pelajaran).filter(Pelajaran.id.in_(subject_ids)).all()
        }
        if subject_ids
        else {}
    )
    total_points = 0.0
    earned_points = 0.0
    pending = 0
    breakdown: Dict[str, Dict[str, Any]] = {}
    breakdown_points: Dict[str, float] = {}
    breakdown_earned: Dict[str, float] = {}

    for question in questions:
        key = str(question.pelajaran_id) if question.pelajaran_id is not None else "tanpa_pelajaran"
        if key not in breakdown:
            breakdown[key] = _empty_breakdown_entry(
                question.pelajaran_id,
                subject_map.get(question.pelajaran_id, "Tanpa Pelajaran"),
            )
            breakdown_points[key] = 0.0
            breakdown_earned[key] = 0.0
        points = float(question.poin or 1.0)
        correct, fraction, is_pending = _evaluate_question(db, question, answer_map.get(question.id))
        breakdown[key]["jumlah_soal"] += 1
        if correct:
            breakdown[key]["jumlah_benar"] += 1
        if is_pending:
            pending += 1
        total_points += points
        earned_points += points * fraction
        breakdown_points[key] += points
        breakdown_earned[key] += points * fraction

    for key, item in breakdown.items():
        item["skor"] = (
            breakdown_earned[key] / breakdown_points[key] * 100.0
            if breakdown_points[key] > 0
            else 0.0
        )
    score = earned_points / total_points * 100.0 if total_points > 0 else 0.0
    return score, breakdown, pending


def _upsert_hasil(
    db: Session,
    ujian: UjianSiswa,
    score: Optional[float],
    breakdown: Dict[str, Dict[str, Any]],
    metadata: Dict[str, Any],
) -> HasilUjian:
    hasil = db.query(HasilUjian).filter(HasilUjian.ujian_siswa_id == ujian.id).first()
    if hasil is None:
        hasil = HasilUjian(ujian_siswa_id=ujian.id)
        db.add(hasil)
    payload: Dict[str, Any] = dict(breakdown)
    payload["_meta"] = metadata
    hasil.skor = score
    hasil.skor_per_pelajaran_json = payload
    hasil.calculated_at = datetime.now(timezone.utc)
    db.flush()
    return hasil


def _compute_ordinary(db: Session, ujian: UjianSiswa) -> HasilUjian:
    score, breakdown, pending = calculate_ujian_score(db, ujian)
    return _upsert_hasil(
        db,
        ujian,
        score,
        breakdown,
        {
            "metode_penilaian": "biasa",
            "esai_belum_dinilai": pending,
            "menunggu_koreksi": pending > 0,
            "skor_mentah": round_half_up(score),
        },
    )


def _cohort_attempts(db: Session, target: UjianSiswa, package: PaketUjian) -> list[UjianSiswa]:
    attempts = (
        db.query(UjianSiswa)
        .filter(
            UjianSiswa.paket_ujian_id == package.id,
            UjianSiswa.is_submitted == True,
        )
        .all()
    )
    schedule_ids = {attempt.jadwal_ujian_id for attempt in attempts if attempt.jadwal_ujian_id is not None}
    student_ids = {attempt.siswa_id for attempt in attempts}
    schedules = {
        schedule.id: schedule
        for schedule in db.query(JadwalUjian).filter(JadwalUjian.id.in_(schedule_ids)).all()
    } if schedule_ids else {}
    students = {
        student.id: student
        for student in db.query(Siswa).filter(Siswa.id.in_(student_ids)).all()
    } if student_ids else {}
    target_key = effective_program_key(target, schedules, students, package)
    grouped = [
        attempt
        for attempt in attempts
        if effective_program_key(attempt, schedules, students, package) == target_key
    ]
    return deduplicate_latest_attempts(grouped)


def _compute_cohort(db: Session, target: UjianSiswa, package: PaketUjian) -> HasilUjian:
    attempts = _cohort_attempts(db, target, package)
    if not attempts:
        attempts = [target]
    questions_by_attempt = {attempt.id: _attempt_questions(db, attempt) for attempt in attempts}
    question_map = {
        question.id: question
        for questions in questions_by_attempt.values()
        for question in questions
    }
    question_points = {question_id: float(question.poin or 1.0) for question_id, question in question_map.items()}
    answers_by_attempt: Dict[int, Dict[int, JawabanSiswa]] = {attempt.id: {} for attempt in attempts}
    attempt_ids = [attempt.id for attempt in attempts]
    if attempt_ids:
        for answer in db.query(JawabanSiswa).filter(JawabanSiswa.ujian_siswa_id.in_(attempt_ids)).all():
            answers_by_attempt[answer.ujian_siswa_id][answer.soal_id] = answer

    correctness_rows: list[Dict[int, bool]] = []
    pending_by_attempt: Dict[int, int] = {}
    breakdown_by_attempt: Dict[int, Dict[str, Dict[str, Any]]] = {}
    subject_ids = {question.pelajaran_id for question in question_map.values() if question.pelajaran_id is not None}
    subject_map = {
        subject.id: subject.nama
        for subject in db.query(Pelajaran).filter(Pelajaran.id.in_(subject_ids)).all()
    } if subject_ids else {}

    for attempt in attempts:
        row: Dict[int, bool] = {}
        pending = 0
        breakdown: Dict[str, Dict[str, Any]] = {}
        for question_id, question in question_map.items():
            correct, _, is_pending = _evaluate_question(
                db,
                question,
                answers_by_attempt[attempt.id].get(question_id),
            )
            row[question_id] = correct
            if is_pending:
                pending += 1
            key = str(question.pelajaran_id) if question.pelajaran_id is not None else "tanpa_pelajaran"
            if key not in breakdown:
                breakdown[key] = _empty_breakdown_entry(
                    question.pelajaran_id,
                    subject_map.get(question.pelajaran_id, "Tanpa Pelajaran"),
                )
            breakdown[key]["jumlah_soal"] += 1
            if correct:
                breakdown[key]["jumlah_benar"] += 1
        correctness_rows.append(row)
        pending_by_attempt[attempt.id] = pending
        breakdown_by_attempt[attempt.id] = breakdown

    scale = package.skala_kohort or "utbk"
    calculation = calculate_cohort_scores(correctness_rows, question_points, scale)
    results: Dict[int, HasilUjian] = {}
    cohort_has_pending = any(pending_by_attempt.values())
    for index, attempt in enumerate(attempts):
        pending = pending_by_attempt[attempt.id]
        score = calculation.scores[index] if not cohort_has_pending else None
        raw_score = calculation.raw_scores[index] if not cohort_has_pending else None
        status = calculation.status if not cohort_has_pending else "sementara"
        breakdown = breakdown_by_attempt[attempt.id]
        for key, item in breakdown.items():
            subject_question_ids = [
                question_id
                for question_id, question in question_map.items()
                if (str(question.pelajaran_id) if question.pelajaran_id is not None else "tanpa_pelajaran") == key
            ]
            total_weight = sum(calculation.weights[question_id] for question_id in subject_question_ids)
            earned_weight = sum(
                calculation.weights[question_id]
                for question_id in subject_question_ids
                if correctness_rows[index].get(question_id) is True
            )
            item["skor"] = earned_weight / total_weight * 100.0 if total_weight > 0 else 0.0
        results[attempt.id] = _upsert_hasil(
            db,
            attempt,
            score,
            breakdown,
            {
                "metode_penilaian": "kohort",
                "kohort_n": calculation.n,
                "kohort_status": status,
                "skala": scale,
                "skor_mentah": raw_score,
                "esai_belum_dinilai": pending,
                "menunggu_koreksi": pending > 0,
                "weights": {
                    str(question_id): {
                        "p": calculation.proportions[question_id],
                        "bobot": calculation.weights[question_id],
                    }
                    for question_id in question_map
                },
            },
        )

    if target.id in results:
        return results[target.id]
    score, breakdown, pending = calculate_ujian_score(db, target)
    return _upsert_hasil(
        db,
        target,
        None,
        breakdown,
        {
            "metode_penilaian": "kohort",
            "kohort_n": calculation.n,
            "kohort_status": "sementara" if pending else calculation.status,
            "skala": scale,
            "skor_mentah": None,
            "esai_belum_dinilai": pending,
            "menunggu_koreksi": pending > 0,
            "weights": {
                str(question_id): {
                    "p": calculation.proportions[question_id],
                    "bobot": calculation.weights[question_id],
                }
                for question_id in question_map
            },
        },
    )


def compute_and_store_hasil(db: Session, ujian: UjianSiswa) -> HasilUjian:
    package = db.query(PaketUjian).filter(PaketUjian.id == ujian.paket_ujian_id).first()
    if package and package.tipe == "ujian" and package.metode_penilaian == "kohort":
        return _compute_cohort(db, ujian, package)
    return _compute_ordinary(db, ujian)
