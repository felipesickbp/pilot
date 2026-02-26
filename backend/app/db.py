import os
from functools import lru_cache

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

load_dotenv()


def get_database_url() -> str:
    raw = (os.getenv("DATABASE_URL") or "").strip()
    if raw:
        return raw
    return "sqlite:///imports.db"


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    db_url = get_database_url()
    if db_url.startswith("sqlite"):
        return create_engine(db_url, connect_args={"check_same_thread": False}, pool_pre_ping=True)
    return create_engine(db_url, pool_pre_ping=True)
