"""Buat akun admin (mis. admin pertama setelah instalasi baru).

    venv/Scripts/python.exe scripts/create_admin.py <username>

Password ditanyakan lewat prompt (tidak tampil di layar maupun history shell).
Di VPS jalankan sebagai user aplikasi dengan .env termuat:
    sudo -u quantumcbt bash -c 'set -a; . ./.env; venv/bin/python scripts/create_admin.py admin'
"""
from getpass import getpass
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import func

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.models.user import User


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Pemakaian: python scripts/create_admin.py <username>")
    username = sys.argv[1].strip()
    with SessionLocal() as db:
        if db.query(User.id).filter(func.lower(User.username) == username.lower()).first():
            raise SystemExit(f"Username '{username}' sudah dipakai.")
        password = getpass("Password admin (min. 8 karakter): ")
        if len(password) < 8:
            raise SystemExit("Password minimal 8 karakter.")
        if password != getpass("Ulangi password: "):
            raise SystemExit("Password tidak sama.")
        db.add(User(username=username, password_hash=get_password_hash(password), role="admin"))
        db.commit()
    print(f"Admin '{username}' dibuat.")


if __name__ == "__main__":
    main()
