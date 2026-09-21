"""Run API tests against a disposable database, never the local app database."""

import os
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from sqlalchemy.orm import close_all_sessions


_database_directory = TemporaryDirectory(prefix="quantumcbt-tests-")
os.environ["DATABASE_URL"] = "sqlite:///" + (
    Path(_database_directory.name) / "test.db"
).as_posix()
os.environ["APP_ENV"] = "test"
os.environ["ALLOWED_HOSTS"] = "testserver,localhost,127.0.0.1"

from app.db.database import engine
from app.models import Base


@pytest.fixture(autouse=True)
def isolated_database():
    Base.metadata.create_all(engine)
    yield
    close_all_sessions()
    Base.metadata.drop_all(engine)


def pytest_sessionfinish(session, exitstatus):
    close_all_sessions()
    engine.dispose()
    _database_directory.cleanup()
