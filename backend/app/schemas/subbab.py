from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SubbabBase(BaseModel):
    topik_id: int
    nama: str = Field(min_length=1, max_length=150)
    is_active: bool = True

    @field_validator("nama")
    @classmethod
    def normalize_nama(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Nama sub bab wajib diisi")
        return value


class SubbabCreate(SubbabBase):
    pass


class SubbabOut(SubbabBase):
    id: int
    created_at: datetime
    updated_at: datetime
    pelajaran_id: int | None = None

    model_config = ConfigDict(from_attributes=True)
