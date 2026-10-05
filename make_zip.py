"""Buat zip source code bersih dari commit HEAD.

Hanya file yang dilacak git yang masuk, jadi .env, database (*.db), log,
venv/node_modules, uploads, dan file lokal lain tidak ikut. Perubahan yang
belum di-commit juga tidak ikut: commit dulu sebelum membuat zip.

    python make_zip.py [nama-file.zip]
"""

import subprocess
import sys
import zipfile

OUT = sys.argv[1] if len(sys.argv) > 1 else "QUANTUMCBT_Clean.zip"
# Jangan sampai ikut ter-zip walau suatu saat ter-commit tanpa sengaja.
TERLARANG = (".env", ".db", ".sqlite", ".log", ".pem", ".key")


def main() -> None:
    if subprocess.run(["git", "status", "--porcelain", "--untracked-files=no"], capture_output=True, text=True, check=True).stdout.strip():
        print("!! Ada perubahan yang belum di-commit; tidak ikut ke dalam zip.")
    subprocess.run(["git", "archive", "--format=zip", "--prefix=QUANTUMCBT/", "-o", OUT, "HEAD"], check=True)
    with zipfile.ZipFile(OUT) as zf:
        names = zf.namelist()
    bocor = [n for n in names if n.endswith(TERLARANG) and not n.endswith(".example")]
    if bocor:
        raise SystemExit(f"Zip dibatalkan, berisi file sensitif: {bocor}")
    print(f"{OUT} dibuat ({len(names)} entri) dari commit HEAD.")


if __name__ == "__main__":
    main()
