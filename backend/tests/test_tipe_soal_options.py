import pytest
from fastapi import HTTPException

from app.routers.soal import validate_opsi_for_tipe
from app.schemas.opsi_jawaban import OpsiJawabanNestedCreate


def opsi(teks: str, benar: bool = False) -> OpsiJawabanNestedCreate:
    return OpsiJawabanNestedCreate(teks_opsi=teks, is_benar=benar)


def test_pilihan_ganda_tepat_satu_kunci():
    valid = validate_opsi_for_tipe(
        "pilihan_ganda",
        [opsi("A", True), opsi("B"), opsi("C")],
    )
    assert len(valid) == 3

    with pytest.raises(HTTPException):
        validate_opsi_for_tipe("pilihan_ganda", [opsi("A", True), opsi("B", True)])


def test_pilihan_lebih_dari_satu_minimal_dua_kunci():
    valid = validate_opsi_for_tipe(
        "pilihan_lebih_dari_satu",
        [opsi("A", True), opsi("B", True), opsi("C")],
    )
    assert sum(item.is_benar for item in valid) == 2

    with pytest.raises(HTTPException):
        validate_opsi_for_tipe("pilihan_lebih_dari_satu", [opsi("A", True), opsi("B")])


def test_benar_salah_tepat_dua_opsi_satu_kunci():
    valid = validate_opsi_for_tipe(
        "benar_salah",
        [opsi("Benar", True), opsi("Salah")],
    )
    assert len(valid) == 2
    assert sum(item.is_benar for item in valid) == 1

    with pytest.raises(HTTPException):
        validate_opsi_for_tipe("benar_salah", [opsi("Benar", True), opsi("Salah"), opsi("Mungkin")])
