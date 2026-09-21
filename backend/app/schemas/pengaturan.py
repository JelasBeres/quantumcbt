from typing import Any

from pydantic import BaseModel, ConfigDict


class PengaturanCreate(BaseModel):
    key: str
    value: Any = None


class PengaturanUpdate(BaseModel):
    value: Any = None


class PengaturanOut(BaseModel):
    id: int
    key: str
    value: Any = None

    model_config = ConfigDict(from_attributes=True)
