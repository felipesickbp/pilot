import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.engine import Engine


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_auth_schema(engine: Engine) -> None:
    ddl = """
    CREATE TABLE IF NOT EXISTS auth_users (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      terms_accepted INTEGER NOT NULL DEFAULT 0,
      terms_accepted_at TEXT,
      email_verified_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_email_challenges (
      challenge_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_email_challenges_email ON auth_email_challenges (email, created_at DESC);

    CREATE TABLE IF NOT EXISTS auth_sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions (user_id, created_at DESC);
    """
    with engine.begin() as conn:
        for stmt in [s.strip() for s in ddl.split(";") if s.strip()]:
            conn.execute(text(stmt))


def get_user_by_email(engine: Engine, *, email: str) -> Optional[Dict[str, Any]]:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT user_id, email, password_hash, terms_accepted, terms_accepted_at, email_verified_at, created_at
                FROM auth_users
                WHERE lower(email) = lower(:email)
                """
            ),
            {"email": str(email)},
        ).mappings().first()
    return dict(row) if row else None


def create_user(
    engine: Engine,
    *,
    email: str,
    password_hash: str,
    terms_accepted: bool,
) -> Dict[str, Any]:
    item = {
        "user_id": str(uuid.uuid4()),
        "email": str(email).strip().lower(),
        "password_hash": str(password_hash),
        "terms_accepted": 1 if terms_accepted else 0,
        "terms_accepted_at": _now_iso() if terms_accepted else None,
        "email_verified_at": None,
        "created_at": _now_iso(),
    }
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO auth_users (
                  user_id, email, password_hash, terms_accepted, terms_accepted_at, email_verified_at, created_at
                ) VALUES (
                  :user_id, :email, :password_hash, :terms_accepted, :terms_accepted_at, :email_verified_at, :created_at
                )
                """
            ),
            item,
        )
    return item


def set_user_verified(engine: Engine, *, user_id: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE auth_users
                SET email_verified_at = :ts
                WHERE user_id = :user_id
                """
            ),
            {"ts": _now_iso(), "user_id": str(user_id)},
        )


def create_email_challenge(
    engine: Engine,
    *,
    user_id: str,
    email: str,
    purpose: str,
    code_hash: str,
    expires_at: str,
) -> Dict[str, Any]:
    item = {
        "challenge_id": str(uuid.uuid4()),
        "user_id": str(user_id),
        "email": str(email).strip().lower(),
        "purpose": str(purpose),
        "code_hash": str(code_hash),
        "expires_at": str(expires_at),
        "attempts": 0,
        "used_at": None,
        "created_at": _now_iso(),
    }
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO auth_email_challenges (
                  challenge_id, user_id, email, purpose, code_hash, expires_at, attempts, used_at, created_at
                ) VALUES (
                  :challenge_id, :user_id, :email, :purpose, :code_hash, :expires_at, :attempts, :used_at, :created_at
                )
                """
            ),
            item,
        )
    return item


def get_email_challenge(engine: Engine, *, challenge_id: str) -> Optional[Dict[str, Any]]:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT challenge_id, user_id, email, purpose, code_hash, expires_at, attempts, used_at, created_at
                FROM auth_email_challenges
                WHERE challenge_id = :challenge_id
                """
            ),
            {"challenge_id": str(challenge_id)},
        ).mappings().first()
    return dict(row) if row else None


def increment_challenge_attempts(engine: Engine, *, challenge_id: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE auth_email_challenges
                SET attempts = attempts + 1
                WHERE challenge_id = :challenge_id
                """
            ),
            {"challenge_id": str(challenge_id)},
        )


def mark_challenge_used(engine: Engine, *, challenge_id: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE auth_email_challenges
                SET used_at = :used_at
                WHERE challenge_id = :challenge_id
                """
            ),
            {"used_at": _now_iso(), "challenge_id": str(challenge_id)},
        )


def create_auth_session(
    engine: Engine,
    *,
    user_id: str,
    email: str,
    expires_at: str,
) -> Dict[str, Any]:
    item = {
        "session_id": str(uuid.uuid4()),
        "user_id": str(user_id),
        "email": str(email).strip().lower(),
        "expires_at": str(expires_at),
        "created_at": _now_iso(),
        "last_seen_at": _now_iso(),
    }
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO auth_sessions (
                  session_id, user_id, email, expires_at, created_at, last_seen_at
                ) VALUES (
                  :session_id, :user_id, :email, :expires_at, :created_at, :last_seen_at
                )
                """
            ),
            item,
        )
    return item


def get_auth_session(engine: Engine, *, session_id: str) -> Optional[Dict[str, Any]]:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT session_id, user_id, email, expires_at, created_at, last_seen_at
                FROM auth_sessions
                WHERE session_id = :session_id
                """
            ),
            {"session_id": str(session_id)},
        ).mappings().first()
    return dict(row) if row else None


def touch_auth_session(engine: Engine, *, session_id: str, expires_at: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE auth_sessions
                SET last_seen_at = :ts, expires_at = :expires_at
                WHERE session_id = :session_id
                """
            ),
            {"ts": _now_iso(), "expires_at": str(expires_at), "session_id": str(session_id)},
        )


def delete_auth_session(engine: Engine, *, session_id: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM auth_sessions WHERE session_id = :session_id"),
            {"session_id": str(session_id)},
        )
