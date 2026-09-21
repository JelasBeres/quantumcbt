from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class GuruScopeCreate(BaseModel):
    pelajaran_id: int
    program_id: Optional[int] = None
    kelas_id: Optional[int] = None


class GuruScopeOut(BaseModel):
    id: int
    user_id: int
    pelajaran_id: int
    program_id: Optional[int]
    kelas_id: Optional[int]

    model_config = ConfigDict(from_attributes=True)


class GuruScopeDetailOut(GuruScopeOut):
    username: str
    pelajaran_nama: str
    program_nama: Optional[str] = None
    kelas_nama: Optional[str] = None


class GuruCreate(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str
    nama_lengkap: str = Field(min_length=2, max_length=200)
    nip: Optional[str] = Field(default=None, max_length=100)
    email: Optional[EmailStr] = None
    no_hp: Optional[str] = Field(default=None, max_length=30)
    scopes: List[GuruScopeCreate] = Field(min_length=1)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        from app.schemas.auth import Register
        Register(username="validation", password=value, role="guru")
        return value

    @field_validator("nip", "no_hp")
    @classmethod
    def normalize_optional(cls, value: Optional[str]) -> Optional[str]:
        value = value.strip() if value else None
        return value or None


class GuruUpdate(BaseModel):
    nama_lengkap: str = Field(min_length=2, max_length=200)
    nip: Optional[str] = Field(default=None, max_length=100)
    email: Optional[EmailStr] = None
    no_hp: Optional[str] = Field(default=None, max_length=30)
    scopes: List[GuruScopeCreate] = Field(min_length=1)


class GuruProfileOut(BaseModel):
    id: int
    user_id: int
    username: str
    is_active: bool
    nama_lengkap: str
    nip: Optional[str] = None
    email: Optional[str] = None
    no_hp: Optional[str] = None
    scopes: List[GuruScopeDetailOut] = Field(default_factory=list)
