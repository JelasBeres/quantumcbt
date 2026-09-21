from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
import re


class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: Optional[str] = None


class Login(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class RefreshToken(BaseModel):
    refresh_token: str


class ChangePassword(BaseModel):
    current_password: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validasi password strength: min 8 char, minimal 1 uppercase, 1 lowercase, 1 digit"""
        if len(v) < 8:
            raise ValueError('Password minimal 8 karakter')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password harus mengandung minimal 1 huruf besar')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password harus mengandung minimal 1 huruf kecil')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password harus mengandung minimal 1 angka')
        common_passwords = {'password123', 'admin123', 'test1234', '12345678', 'qwerty123', 'abc123456'}
        if v.lower() in common_passwords:
            raise ValueError('Password terlalu umum, pilih password yang lebih kuat')
        return v


class ResetPassword(BaseModel):
    user_id: int
    new_password: str

    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validasi password strength: min 8 char, minimal 1 uppercase, 1 lowercase, 1 digit"""
        if len(v) < 8:
            raise ValueError('Password minimal 8 karakter')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password harus mengandung minimal 1 huruf besar')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password harus mengandung minimal 1 huruf kecil')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password harus mengandung minimal 1 angka')
        common_passwords = {'password123', 'admin123', 'test1234', '12345678', 'qwerty123', 'abc123456'}
        if v.lower() in common_passwords:
            raise ValueError('Password terlalu umum, pilih password yang lebih kuat')
        return v


class Logout(BaseModel):
    refresh_token: Optional[str] = None


class Register(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str
    role: Literal["admin", "guru", "siswa"] = "siswa"

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validasi password strength: min 8 char, minimal 1 uppercase, 1 lowercase, 1 digit"""
        if len(v) < 8:
            raise ValueError('Password minimal 8 karakter')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password harus mengandung minimal 1 huruf besar')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password harus mengandung minimal 1 huruf kecil')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password harus mengandung minimal 1 angka')
        common_passwords = {'password123', 'admin123', 'test1234', '12345678', 'qwerty123', 'abc123456'}
        if v.lower() in common_passwords:
            raise ValueError('Password terlalu umum, pilih password yang lebih kuat')
        return v
