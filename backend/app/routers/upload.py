from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.security import require_roles
from app.db.database import get_db

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "rich"
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024


def _valid_image_signature(content: bytes, extension: str) -> bool:
    signatures = {
        ".jpg": (b"\xff\xd8\xff",),
        ".jpeg": (b"\xff\xd8\xff",),
        ".png": (b"\x89PNG\r\n\x1a\n",),
        ".gif": (b"GIF87a", b"GIF89a"),
        ".webp": (b"RIFF",),
    }
    if not any(content.startswith(sig) for sig in signatures.get(extension, ())):
        return False
    return extension != ".webp" or len(content) >= 12 and content[8:12] == b"WEBP"


def read_validated_image(file: UploadFile, extension: str) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = file.file.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_IMAGE_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="Ukuran gambar maksimal 5MB")
        chunks.append(chunk)
    content = b"".join(chunks)
    if not _valid_image_signature(content, extension):
        raise HTTPException(status_code=400, detail="Isi file bukan gambar yang valid")
    return content


@router.post("/gambar")
def upload_gambar(
    file: UploadFile = File(...),
    db=Depends(get_db),
    current_user=Depends(require_roles(["admin", "guru"])),
):
    original_name = file.filename or ""
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Format gambar tidak didukung")
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar")

    content = read_validated_image(file, extension)

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    target_path = UPLOAD_ROOT / filename
    target_path.write_bytes(content)

    return {"url": f"/uploads/rich/{filename}"}
