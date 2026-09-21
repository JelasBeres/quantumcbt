from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.db.database import SessionLocal

router = APIRouter()


@router.get("/health")
def read_health():
    return {"status": "ok"}


@router.get("/health/ready")
def read_readiness(response: Response):
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable", "database": "error"}
    return {"status": "ok", "database": "ok"}
