"""Salin seluruh data dari SQLite ke PostgreSQL.

Schema target harus sudah dibuat lebih dulu dengan `alembic upgrade head`.
Data dibaca lewat model SQLAlchemy supaya tipe (boolean, datetime, enum)
dikonversi dengan benar, lalu sequence id Postgres disesuaikan.

Pemakaian:
    python scripts/migrate_sqlite_to_postgres.py SQLITE_PATH POSTGRES_URL [--truncate]
"""
import argparse
import sys
from pathlib import Path

from sqlalchemy import create_engine, func, select, text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models import Base  # noqa: E402

BATCH_SIZE = 500


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("sqlite_path")
    parser.add_argument("postgres_url")
    parser.add_argument("--truncate", action="store_true", help="kosongkan tabel target dulu")
    args = parser.parse_args()

    source = create_engine(f"sqlite:///{Path(args.sqlite_path).resolve()}")
    target = create_engine(args.postgres_url)
    tables = Base.metadata.sorted_tables

    with source.connect() as src, target.begin() as dst:
        if args.truncate:
            names = ", ".join(f'"{t.name}"' for t in tables)
            dst.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
        else:
            for table in tables:
                if dst.execute(select(func.count()).select_from(table)).scalar():
                    sys.exit(f"Tabel {table.name} di target tidak kosong. Pakai --truncate.")

        for table in tables:
            rows = [dict(r._mapping) for r in src.execute(select(table))]
            # FK ke tabel sendiri (mis. soal.parent_soal_id) diisi setelah semua baris masuk.
            self_refs = [fk.parent.name for fk in table.foreign_keys if fk.column.table is table]
            deferred = [(row, {c: row[c] for c in self_refs}) for row in rows if any(row[c] is not None for c in self_refs)]
            for row, _ in deferred:
                for c in self_refs:
                    row[c] = None
            for i in range(0, len(rows), BATCH_SIZE):
                dst.execute(table.insert(), rows[i:i + BATCH_SIZE])
            pk = list(table.primary_key.columns)
            for row, values in deferred:
                dst.execute(
                    table.update().where(*[col == row[col.name] for col in pk]).values(**values)
                )
            print(f"{table.name}: {len(rows)} baris")

        for table in tables:
            for column in table.primary_key.columns:
                seq = dst.execute(
                    text("SELECT pg_get_serial_sequence(:t, :c)"),
                    {"t": table.name, "c": column.name},
                ).scalar()
                if seq:
                    dst.execute(
                        text(
                            f'SELECT setval(:s, COALESCE((SELECT MAX("{column.name}") '
                            f'FROM "{table.name}"), 0) + 1, false)'
                        ),
                        {"s": seq},
                    )

    print("Selesai.")


if __name__ == "__main__":
    main()
