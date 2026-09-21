from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TopikBase(BaseModel):
    pelajaran_id: int
    nama: str = Field(min_length=1, max_length=150)
    is_active: bool = True

    @field_validator("nama")
    @classmethod
    def normalize_nama(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Nama bab wajib diisi")
        return value


class TopikCreate(TopikBase):
    pass


class TopikOut(TopikBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
