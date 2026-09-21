from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional


class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "siswa"


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class UserPageOut(BaseModel):
    total: int
    items: List[UserOut] = Field(default_factory=list)


class UserStatusUpdate(BaseModel):
    is_active: bool
