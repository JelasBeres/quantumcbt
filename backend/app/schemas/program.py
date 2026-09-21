from pydantic import BaseModel, ConfigDict
from typing import Optional


class ProgramCreate(BaseModel):
    nama: str
    deskripsi: Optional[str] = None
    is_active: Optional[bool] = True


class ProgramOut(BaseModel):
    id: int
    nama: str
    deskripsi: Optional[str]
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
