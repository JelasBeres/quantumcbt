from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, require_roles
from app.db.database import get_db
from app.models.guru_scope import GuruScope
from app.models.kelas import Kelas
from app.models.pelajaran import Pelajaran
from app.models.program import Program
from app.models.user import User
from app.models.guru import Guru
from app.schemas.guru_scope import GuruCreate, GuruProfileOut, GuruScopeCreate, GuruScopeDetailOut, GuruScopeOut, GuruUpdate


router = APIRouter(prefix="/guru-scope", tags=["guru_scope"])


def _ensure_unique_profile(db: Session, payload, exclude_user_id: int | None = None) -> None:
    filters = [(Guru.nip, payload.nip, "NIP"), (Guru.email, str(payload.email) if payload.email else None, "Email"), (Guru.no_hp, payload.no_hp, "Nomor HP")]
    for column, value, label in filters:
        if value is None:
            continue
        query = db.query(Guru).filter(column == value)
        if exclude_user_id is not None:
            query = query.filter(Guru.user_id != exclude_user_id)
        if query.first():
            raise HTTPException(status_code=409, detail=f"{label} sudah digunakan")


def _replace_scopes(db: Session, user_id: int, scopes: List[GuruScopeCreate]) -> None:
    db.query(GuruScope).filter(GuruScope.user_id == user_id).delete(synchronize_session=False)
    seen = set()
    for payload in scopes:
        _validate_references(db, payload)
        key = (payload.pelajaran_id, payload.program_id, payload.kelas_id)
        if key in seen:
            raise HTTPException(status_code=409, detail="Scope guru duplikat")
        seen.add(key)
        db.add(GuruScope(user_id=user_id, **payload.model_dump()))


def _profile_detail(db: Session, guru: Guru) -> GuruProfileOut:
    user = db.query(User).filter(User.id == guru.user_id).first()
    scopes = db.query(GuruScope).filter(GuruScope.user_id == guru.user_id).order_by(GuruScope.pelajaran_id).all()
    return GuruProfileOut(
        id=guru.id, user_id=guru.user_id, username=user.username, is_active=user.is_active,
        nama_lengkap=guru.nama_lengkap, nip=guru.nip, email=guru.email, no_hp=guru.no_hp,
        scopes=[_detail(db, scope) for scope in scopes],
    )


def _get_guru(db: Session, user_id: int) -> User:
    guru = db.query(User).filter(User.id == user_id).first()
    if not guru:
        raise HTTPException(status_code=404, detail="User not found")
    if guru.role != "guru":
        raise HTTPException(status_code=400, detail="Scope hanya dapat diberikan kepada user dengan role guru")
    return guru


def _validate_references(db: Session, payload: GuruScopeCreate) -> None:
    pelajaran = db.query(Pelajaran).filter(Pelajaran.id == payload.pelajaran_id).first()
    if not pelajaran:
        raise HTTPException(status_code=404, detail="Pelajaran not found")
    if not pelajaran.is_active:
        raise HTTPException(status_code=400, detail="Pelajaran tidak aktif")
    if payload.program_id is not None:
        program = db.query(Program).filter(Program.id == payload.program_id).first()
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
        if not program.is_active:
            raise HTTPException(status_code=400, detail="Program tidak aktif")
    if payload.kelas_id is not None and not db.query(Kelas.id).filter(Kelas.id == payload.kelas_id).first():
        raise HTTPException(status_code=404, detail="Kelas not found")


def _detail(db: Session, scope: GuruScope) -> GuruScopeDetailOut:
    guru = db.query(User).filter(User.id == scope.user_id).first()
    pelajaran = db.query(Pelajaran).filter(Pelajaran.id == scope.pelajaran_id).first()
    program = db.query(Program).filter(Program.id == scope.program_id).first() if scope.program_id else None
    kelas = db.query(Kelas).filter(Kelas.id == scope.kelas_id).first() if scope.kelas_id else None
    return GuruScopeDetailOut(
        id=scope.id,
        user_id=scope.user_id,
        pelajaran_id=scope.pelajaran_id,
        program_id=scope.program_id,
        kelas_id=scope.kelas_id,
        username=guru.username,
        pelajaran_nama=pelajaran.nama,
        program_nama=program.nama if program else None,
        kelas_nama=kelas.nama if kelas else None,
    )


@router.get("/", response_model=List[GuruScopeDetailOut])
def list_all_scopes(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    scopes = db.query(GuruScope).order_by(GuruScope.user_id, GuruScope.pelajaran_id).all()
    return [_detail(db, scope) for scope in scopes]


@router.get("/profiles", response_model=List[GuruProfileOut])
def list_guru_profiles(db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    return [_profile_detail(db, guru) for guru in db.query(Guru).order_by(Guru.nama_lengkap).all()]


@router.post("/profiles", response_model=GuruProfileOut)
def create_guru_profile(payload: GuruCreate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    username = payload.username.strip()
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=409, detail="Username sudah digunakan")
    _ensure_unique_profile(db, payload)
    try:
        user = User(username=username, password_hash=get_password_hash(payload.password), role="guru", is_active=True)
        db.add(user); db.flush()
        guru = Guru(user_id=user.id, nama_lengkap=payload.nama_lengkap.strip(), nip=payload.nip, email=str(payload.email) if payload.email else None, no_hp=payload.no_hp)
        db.add(guru); db.flush()
        _replace_scopes(db, user.id, payload.scopes)
        db.commit(); db.refresh(guru)
        return _profile_detail(db, guru)
    except HTTPException:
        db.rollback(); raise
    except Exception:
        db.rollback(); raise


@router.get("/profiles/{user_id}", response_model=GuruProfileOut)
def get_guru_profile(user_id: int, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    guru = db.query(Guru).filter(Guru.user_id == user_id).first()
    if not guru:
        raise HTTPException(status_code=404, detail="Profil guru not found")
    return _profile_detail(db, guru)


@router.put("/profiles/{user_id}", response_model=GuruProfileOut)
def update_guru_profile(user_id: int, payload: GuruUpdate, db: Session = Depends(get_db), current_user=Depends(require_roles(["admin"]))):
    guru = db.query(Guru).filter(Guru.user_id == user_id).first()
    if not guru:
        raise HTTPException(status_code=404, detail="Profil guru not found")
    _ensure_unique_profile(db, payload, exclude_user_id=user_id)
    try:
        guru.nama_lengkap = payload.nama_lengkap.strip(); guru.nip = payload.nip
        guru.email = str(payload.email) if payload.email else None; guru.no_hp = payload.no_hp
        _replace_scopes(db, user_id, payload.scopes)
        db.commit(); db.refresh(guru)
        return _profile_detail(db, guru)
    except HTTPException:
        db.rollback(); raise
    except Exception:
        db.rollback(); raise


@router.get("/me", response_model=List[GuruScopeDetailOut])
def list_my_scopes(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["guru"])),
):
    scopes = db.query(GuruScope).filter(GuruScope.user_id == current_user.id).order_by(GuruScope.pelajaran_id).all()
    return [_detail(db, scope) for scope in scopes]


@router.get("/user/{user_id}", response_model=List[GuruScopeDetailOut])
def list_user_scopes(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    _get_guru(db, user_id)
    scopes = db.query(GuruScope).filter(GuruScope.user_id == user_id).order_by(GuruScope.pelajaran_id).all()
    return [_detail(db, scope) for scope in scopes]


@router.post("/user/{user_id}", response_model=GuruScopeOut)
def create_user_scope(
    user_id: int,
    payload: GuruScopeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    _get_guru(db, user_id)
    _validate_references(db, payload)
    existing = db.query(GuruScope).filter(
        GuruScope.user_id == user_id,
        GuruScope.pelajaran_id == payload.pelajaran_id,
        GuruScope.program_id == payload.program_id,
        GuruScope.kelas_id == payload.kelas_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Scope guru sudah tersedia")
    scope = GuruScope(user_id=user_id, **payload.model_dump())
    db.add(scope)
    db.commit()
    db.refresh(scope)
    return scope


@router.delete("/{scope_id}")
def delete_scope(
    scope_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(["admin"])),
):
    scope = db.query(GuruScope).filter(GuruScope.id == scope_id).first()
    if not scope:
        raise HTTPException(status_code=404, detail="Scope guru not found")
    db.delete(scope)
    db.commit()
    return {"message": "Scope guru berhasil dihapus"}
