"""Helpers to keep datetime handling consistent and timezone-aware.

Semua waktu disimpan dan dibandingkan dalam UTC (timezone-aware). Nilai naive
yang datang dari klien atau dari baris database lama diperlakukan sebagai UTC.
"""

from datetime import datetime, timezone
from typing import Optional


def utc_now() -> datetime:
    """Waktu sekarang sebagai datetime timezone-aware (UTC)."""
    return datetime.now(timezone.utc)


def ensure_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Ubah datetime apa pun menjadi timezone-aware UTC.

    Datetime naive dianggap sudah dalam UTC, sehingga perbandingan dengan
    ``utc_now()`` tidak pernah membandingkan aware dengan naive.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
