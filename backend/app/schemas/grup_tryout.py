from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class GrupTryoutCreate(BaseModel):
    nama: str
    deskripsi: Optional[str] = None
    is_active: bool = True

    @field_validator("nama")
    @classmethod
    def validate_nama(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Nama grup tryout wajib diisi")
        return value


class GrupTryoutOut(GrupTryoutCreate):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
