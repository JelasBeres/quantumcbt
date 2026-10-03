from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.services.scoring import calculate_cohort_scores, deduplicate_latest_attempts, effective_program_key, evaluate_answer


def test_correctness_semantics_are_exact_and_unanswered_is_false():
    assert evaluate_answer("pilihan_ganda", "2", {2}) == (True, 1.0, False)
    assert evaluate_answer("pilihan_ganda", None, {2}) == (False, 0.0, False)
    assert evaluate_answer("pilihan_lebih_dari_satu", "[2, 4]", {2, 4}) == (True, 1.0, False)
    assert evaluate_answer("pilihan_lebih_dari_satu", "[2]", {2, 4}) == (False, 0.0, False)
    assert evaluate_answer("benar_salah", '[{"pernyataan_id": 1, "jawaban": true}, {"pernyataan_id": 2, "jawaban": false}]', correct_statements={1: True, 2: False}) == (True, 1.0, False)
    assert evaluate_answer("benar_salah", '[{"pernyataan_id": 1, "jawaban": true}]', correct_statements={1: True, 2: False}) == (False, 0.0, False)
    assert evaluate_answer("isian", " jakarta. ", fill_key="Jakarta|Batavia") == (True, 1.0, False)
    assert evaluate_answer("esai", "jawaban", manual_score=None) == (False, 0.0, True)
    assert evaluate_answer("esai", "jawaban", manual_score=75) == (True, 0.75, False)


def test_basic_cohort_targets_utbk_and_tka():
    points = {1: 1, 2: 1, 3: 1}
    rows = [
        {1: True, 2: True, 3: False},
        {1: True, 2: True, 3: False},
        {1: True, 2: True, 3: False},
        {1: False, 2: True, 3: True},
        {1: True, 2: True, 3: True},
        {1: True, 2: False, 3: False},
        {1: True, 2: False, 3: False},
        {1: True, 2: False, 3: False},
        {1: True, 2: False, 3: False},
        {1: True, 2: False, 3: False},
    ]
    utbk = calculate_cohort_scores(rows, points, "utbk")
    tka = calculate_cohort_scores(rows, points, "tka")
    assert [utbk.scores[index] for index in (0, 3, 4, 5)] == [429, 929, 1000, 71]
    assert [utbk.raw_scores[index] for index in (0, 3, 4, 5)] == [43, 93, 100, 7]
    assert [tka.scores[index] for index in (0, 3, 4, 5)] == [457, 757, 800, 243]


def test_question_points_affect_cohort_scale():
    rows = [{1: True, 2: False}] + [{1: False, 2: True}] * 14 + [{1: False, 2: False}] * 5
    result = calculate_cohort_scores(rows, {1: 1, 2: 9}, "utbk")
    assert result.scores[0] == 260
    assert result.scores[1] == 740
    assert calculate_cohort_scores(rows, {1: 1, 2: 9}, "tka").scores[-1] == 200


def test_small_cohort_uses_points_and_is_temporary():
    result = calculate_cohort_scores([{1: True, 2: False}], {1: 13, 2: 7}, "utbk")
    assert result.scores == [650]
    assert result.status == "sementara"


def test_tka_kohort_hanya_menilai_soal_mapel_yang_dipilih():
    """Peserta TKA memilih mapel berbeda; soal mapel yang tidak dipilih tidak
    boleh dihitung salah, sehingga jawaban sempurna tetap bernilai maksimal."""
    points = {q: 2 for q in range(1, 7)}
    fisika = {1: True, 2: True, 3: True, 4: True}
    kimia = {1: True, 2: True, 5: True, 6: True}
    result = calculate_cohort_scores([fisika] * 3 + [kimia] * 3, points, "tka")
    assert result.scores == [800] * 6
    # Proporsi soal Fisika dihitung dari 3 peserta yang mendapatkannya.
    assert result.proportions[3] == 1.0


def test_all_correct_has_no_cohort_score():
    result = calculate_cohort_scores([{1: True}] * 5, {1: 1}, "utbk")
    assert result.scores == [None] * 5
    assert result.status == "kosong"


@dataclass
class Attempt:
    id: int
    siswa_id: int
    finished_at: datetime


def test_latest_attempt_deduplication():
    now = datetime.now(timezone.utc)
    old = Attempt(1, 10, now)
    latest = Attempt(2, 10, now + timedelta(minutes=1))
    other = Attempt(3, 11, now)
    assert [attempt.id for attempt in deduplicate_latest_attempts([latest, other, old])] == [2, 3]


@dataclass
class Schedule:
    program_id: int | None


@dataclass
class Student:
    program_id: int | None


@dataclass
class Package:
    program_id: int | None


@dataclass
class CohortAttempt:
    siswa_id: int
    jadwal_ujian_id: int | None


def test_effective_program_separates_cohorts_and_has_fallback():
    schedules = {1: Schedule(7), 2: Schedule(8)}
    students = {10: Student(9), 11: Student(None)}
    package = Package(None)
    assert effective_program_key(CohortAttempt(10, 1), schedules, students, package) == "7"
    assert effective_program_key(CohortAttempt(10, 2), schedules, students, package) == "8"
    assert effective_program_key(CohortAttempt(11, None), schedules, students, package) == "tanpa_program"


def test_esai_tidak_dijawab_bernilai_nol_dan_tidak_menunggu_koreksi():
    assert evaluate_answer("esai", None) == (False, 0.0, False)
    assert evaluate_answer("esai", "<p> </p>") == (False, 0.0, False)
    assert evaluate_answer("esai", "<p>Jawaban</p>") == (False, 0.0, True)
    assert evaluate_answer("esai", '<p><img src="/uploads/a.png"></p>') == (False, 0.0, True)
