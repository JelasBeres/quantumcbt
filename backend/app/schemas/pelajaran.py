from pydantic import BaseModel, ConfigDict
from typing import Optional


class PelajaranCreate(BaseModel):
    nama: str
    program_id: Optional[int] = None
    is_active: bool = True


class PelajaranOut(BaseModel):
    id: int
    nama: str
    program_id: Optional[int]
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
