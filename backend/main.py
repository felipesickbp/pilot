import os
import io
import csv
import time
import uuid
import secrets
import random
import re
import hmac
import hashlib
import smtplib
import threading
from datetime import date as dt_date, datetime, timedelta, timezone
from email.message import EmailMessage
from urllib.parse import urlencode
from typing import Any, Dict, List, Tuple, Optional

import chardet
import bcrypt
import pandas as pd
import requests
from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Response, Query
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.db import get_engine
from app.services.history_store import (
    delete_import_history,
    get_import_history_item,
    get_import_history_csv,
    init_history_schema,
    insert_import_history,
    list_import_history,
)
from app.services.posting_rules_store import (
    delete_posting_rule,
    init_posting_rules_schema,
    insert_posting_rule,
    list_posting_rules,
)
from app.services.auth_store import (
    create_auth_session,
    create_email_challenge,
    create_user,
    delete_auth_session,
    get_auth_session,
    get_email_challenge,
    get_latest_open_challenge_for_email,
    get_user_by_email,
    increment_challenge_attempts,
    init_auth_schema,
    insert_auth_audit,
    mark_challenge_used,
    set_user_verified,
    update_user_password,
    touch_auth_session,
)

app = FastAPI()

allowed = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_engine = get_engine()


@app.on_event("startup")
def _startup() -> None:
    init_auth_schema(db_engine)
    init_history_schema(db_engine)
    init_posting_rules_schema(db_engine)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/clients")
def clients():
    return [{"id": "demo", "name": "Demo Mandant"}]


# ------------------------------------------------------------
# App Authentication (email + password + email OTP)
# ------------------------------------------------------------

AUTH_SESSION_COOKIE = "bp_auth_sid"
AUTH_CSRF_COOKIE = "bp_csrf_token"
AUTH_SESSION_TTL_HOURS = int(os.getenv("AUTH_SESSION_TTL_HOURS", "12"))
AUTH_OTP_TTL_MINUTES = int(os.getenv("AUTH_OTP_TTL_MINUTES", "10"))
AUTH_OTP_MAX_ATTEMPTS = int(os.getenv("AUTH_OTP_MAX_ATTEMPTS", "6"))
AUTH_OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv("AUTH_OTP_RESEND_COOLDOWN_SECONDS", "45"))
AUTH_EMAIL_FROM = os.getenv("AUTH_EMAIL_FROM", "no-reply@bp-pilot.ch")
AUTH_SMTP_HOST = os.getenv("AUTH_SMTP_HOST", "")
AUTH_SMTP_PORT = int(os.getenv("AUTH_SMTP_PORT", "587"))
AUTH_SMTP_USER = os.getenv("AUTH_SMTP_USER", "")
AUTH_SMTP_PASS = os.getenv("AUTH_SMTP_PASS", "")
AUTH_SMTP_TLS = os.getenv("AUTH_SMTP_TLS", "true").lower() in ("1", "true", "yes")
AUTH_CODE_PEPPER = os.getenv("AUTH_CODE_PEPPER", "")
AUTH_APP_BASE_URL = os.getenv("AUTH_APP_BASE_URL", "https://app.bp-pilot.ch")

_rate_lock = threading.Lock()
_rate_hits: Dict[str, List[float]] = {}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _parse_iso(raw: str) -> datetime:
    try:
        dt = datetime.fromisoformat(str(raw))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return datetime.fromtimestamp(0, tz=timezone.utc)


def _is_secure_request(request: Request) -> bool:
    proto = (request.headers.get("x-forwarded-proto") or request.url.scheme or "").lower()
    return proto == "https"


def _normalize_email(raw: str) -> str:
    return str(raw or "").strip().lower()


def _client_ip(request: Request) -> str:
    xff = str(request.headers.get("x-forwarded-for") or "").strip()
    if xff:
        return xff.split(",")[0].strip()
    return str(request.client.host if request.client else "")


def _check_rate_limit(*, bucket: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    with _rate_lock:
        hits = _rate_hits.get(bucket, [])
        hits = [t for t in hits if (now - t) <= float(window_seconds)]
        if len(hits) >= int(limit):
            _rate_hits[bucket] = hits
            raise HTTPException(status_code=429, detail="Too many requests. Please try again shortly.")
        hits.append(now)
        _rate_hits[bucket] = hits


def _get_or_set_csrf_token(request: Request, response: Optional[Response] = None) -> str:
    token = str(request.cookies.get(AUTH_CSRF_COOKIE) or "").strip()
    if token:
        return token
    token = secrets.token_urlsafe(24)
    if response is not None:
        response.set_cookie(
            key=AUTH_CSRF_COOKIE,
            value=token,
            httponly=False,
            samesite="lax",
            secure=_is_secure_request(request),
            max_age=60 * 60 * 24,
            path="/",
        )
    return token


def _require_csrf(request: Request) -> None:
    cookie_token = str(request.cookies.get(AUTH_CSRF_COOKIE) or "").strip()
    header_token = str(request.headers.get("x-csrf-token") or "").strip()
    if not cookie_token or not header_token or not hmac.compare_digest(cookie_token, header_token):
        raise HTTPException(status_code=403, detail="CSRF validation failed.")


def _challenge_age_seconds(challenge: Dict[str, Any]) -> int:
    created = _parse_iso(str(challenge.get("created_at") or ""))
    return max(0, int((_utc_now() - created).total_seconds()))


def _validate_email(raw: str) -> str:
    email = _normalize_email(raw)
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=400, detail="Invalid email address.")
    return email


def _password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _password_verify(password: str, stored: str) -> bool:
    try:
        return bool(bcrypt.checkpw(password.encode("utf-8"), str(stored).encode("utf-8")))
    except Exception:
        return False


def _code_hash(code: str) -> str:
    material = f"{code}:{AUTH_CODE_PEPPER}".encode("utf-8")
    return hashlib.sha256(material).hexdigest()


def _send_email_code(*, email: str, code: str, purpose: str, challenge_id: str = "") -> None:
    if not AUTH_SMTP_HOST:
        raise HTTPException(status_code=500, detail="Email service is not configured.")

    title = "BP Pilot verification code"
    if purpose == "register":
        title = "BP Pilot registration verification"
    elif purpose == "login":
        title = "BP Pilot login verification"

    msg = EmailMessage()
    msg["Subject"] = title
    msg["From"] = AUTH_EMAIL_FROM
    msg["To"] = email
    lines = [
        f"Your verification code is: {code}",
        "",
        f"This code expires in {AUTH_OTP_TTL_MINUTES} minutes.",
    ]
    if purpose == "reset" and challenge_id:
        query = urlencode(
            {
                "mode": "reset",
                "step": "verify",
                "challenge_id": challenge_id,
                "code": code,
                "email": email,
            }
        )
        link = f"{AUTH_APP_BASE_URL}/login?{query}"
        lines.extend(
            [
                "",
                "Reset password directly here:",
                link,
            ]
        )
    lines.extend(
        [
            "",
            "If you did not request this, you can ignore this email.",
        ]
    )
    msg.set_content(
        "\n".join(lines)
    )

    try:
        with smtplib.SMTP(AUTH_SMTP_HOST, AUTH_SMTP_PORT, timeout=20) as smtp:
            if AUTH_SMTP_TLS:
                smtp.starttls()
            if AUTH_SMTP_USER:
                smtp.login(AUTH_SMTP_USER, AUTH_SMTP_PASS)
            smtp.send_message(msg)
    except Exception:
        raise HTTPException(status_code=500, detail="Could not send verification email.")


def _set_auth_cookie(response: Response, request: Request, sid: str) -> None:
    response.set_cookie(
        key=AUTH_SESSION_COOKIE,
        value=sid,
        httponly=True,
        samesite="lax",
        secure=_is_secure_request(request),
        max_age=AUTH_SESSION_TTL_HOURS * 3600,
        path="/",
    )


def _clear_auth_cookie(response: Response, request: Request) -> None:
    response.delete_cookie(
        key=AUTH_SESSION_COOKIE,
        path="/",
        samesite="lax",
        secure=_is_secure_request(request),
    )


def _get_auth_session_or_401(request: Request) -> Dict[str, Any]:
    sid = request.cookies.get(AUTH_SESSION_COOKIE, "")
    if not sid:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    sess = get_auth_session(db_engine, session_id=sid)
    if not sess:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    expires_at = _parse_iso(str(sess.get("expires_at") or ""))
    if expires_at <= _utc_now():
        delete_auth_session(db_engine, session_id=sid)
        raise HTTPException(status_code=401, detail="Session expired.")

    new_expiry = _utc_now() + timedelta(hours=AUTH_SESSION_TTL_HOURS)
    touch_auth_session(db_engine, session_id=sid, expires_at=_iso(new_expiry))
    return sess


class RegisterRequest(BaseModel):
    email: str
    password: str
    accept_terms: bool


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyRequest(BaseModel):
    challenge_id: str
    code: str


class ResendRequest(BaseModel):
    challenge_id: str


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirmRequest(BaseModel):
    challenge_id: str
    code: str
    new_password: str


def _create_and_send_challenge(*, user_id: str, email: str, purpose: str) -> Dict[str, Any]:
    latest = get_latest_open_challenge_for_email(db_engine, email=email, purpose=purpose)
    if latest and not latest.get("used_at") and _parse_iso(str(latest.get("expires_at") or "")) > _utc_now():
        age = _challenge_age_seconds(latest)
        if age < AUTH_OTP_RESEND_COOLDOWN_SECONDS:
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {AUTH_OTP_RESEND_COOLDOWN_SECONDS - age}s before requesting a new code.",
            )
    code = f"{secrets.randbelow(1000000):06d}"
    challenge = create_email_challenge(
        db_engine,
        user_id=user_id,
        email=email,
        purpose=purpose,
        code_hash=_code_hash(code),
        expires_at=_iso(_utc_now() + timedelta(minutes=AUTH_OTP_TTL_MINUTES)),
    )
    _send_email_code(
        email=email,
        code=code,
        purpose=purpose,
        challenge_id=str(challenge.get("challenge_id") or ""),
    )
    return challenge


@app.get("/auth/csrf")
def auth_csrf(request: Request, response: Response) -> Dict[str, Any]:
    token = _get_or_set_csrf_token(request, response)
    return {"csrf_token": token}


@app.post("/auth/register")
def auth_register(payload: RegisterRequest, request: Request) -> Dict[str, Any]:
    _require_csrf(request)
    email = _validate_email(payload.email)
    ip = _client_ip(request)
    _check_rate_limit(bucket=f"reg:ip:{ip}", limit=12, window_seconds=900)
    _check_rate_limit(bucket=f"reg:email:{email}", limit=8, window_seconds=900)

    password = str(payload.password or "")
    if len(password) < 10:
        insert_auth_audit(db_engine, event="register", email=email, ip=ip, success=False, detail="weak_password")
        raise HTTPException(status_code=400, detail="Password must be at least 10 characters.")
    if not payload.accept_terms:
        insert_auth_audit(db_engine, event="register", email=email, ip=ip, success=False, detail="terms_missing")
        raise HTTPException(status_code=400, detail="You must accept terms and agreements.")

    existing = get_user_by_email(db_engine, email=email)
    if existing:
        insert_auth_audit(db_engine, event="register", email=email, ip=ip, success=False, detail="email_exists")
        raise HTTPException(status_code=409, detail="Email already registered.")

    user = create_user(
        db_engine,
        email=email,
        password_hash=_password_hash(password),
        terms_accepted=True,
    )
    challenge = _create_and_send_challenge(user_id=str(user["user_id"]), email=email, purpose="register")
    insert_auth_audit(db_engine, event="register", email=email, ip=ip, success=True)
    return {
        "challenge_id": challenge["challenge_id"],
        "expires_in_seconds": AUTH_OTP_TTL_MINUTES * 60,
        "purpose": "register",
    }


@app.post("/auth/login")
def auth_login(payload: LoginRequest, request: Request) -> Dict[str, Any]:
    _require_csrf(request)
    email = _validate_email(payload.email)
    ip = _client_ip(request)
    _check_rate_limit(bucket=f"login:ip:{ip}", limit=20, window_seconds=900)
    _check_rate_limit(bucket=f"login:email:{email}", limit=10, window_seconds=900)

    password = str(payload.password or "")
    user = get_user_by_email(db_engine, email=email)
    if not user or not _password_verify(password, str(user.get("password_hash") or "")):
        insert_auth_audit(db_engine, event="login_password", email=email, ip=ip, success=False, detail="invalid_credentials")
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    challenge = _create_and_send_challenge(user_id=str(user["user_id"]), email=email, purpose="login")
    insert_auth_audit(db_engine, event="login_password", email=email, ip=ip, success=True)
    return {
        "challenge_id": challenge["challenge_id"],
        "expires_in_seconds": AUTH_OTP_TTL_MINUTES * 60,
        "purpose": "login",
    }


@app.post("/auth/resend")
def auth_resend(payload: ResendRequest, request: Request) -> Dict[str, Any]:
    _require_csrf(request)
    ip = _client_ip(request)
    _check_rate_limit(bucket=f"resend:ip:{ip}", limit=20, window_seconds=900)
    challenge_id = str(payload.challenge_id or "").strip()
    challenge = get_email_challenge(db_engine, challenge_id=challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Verification challenge not found.")
    if challenge.get("used_at"):
        raise HTTPException(status_code=400, detail="Verification challenge already used.")
    if _parse_iso(str(challenge.get("expires_at") or "")) <= _utc_now():
        raise HTTPException(status_code=400, detail="Verification code expired.")
    email = _normalize_email(str(challenge.get("email") or ""))
    purpose = str(challenge.get("purpose") or "")
    if purpose not in ("register", "login", "reset"):
        raise HTTPException(status_code=400, detail="Challenge cannot be resent.")
    fresh = _create_and_send_challenge(user_id=str(challenge.get("user_id") or ""), email=email, purpose=purpose)
    insert_auth_audit(db_engine, event="otp_resend", email=email, ip=ip, success=True, detail=purpose)
    return {
        "challenge_id": fresh["challenge_id"],
        "expires_in_seconds": AUTH_OTP_TTL_MINUTES * 60,
        "purpose": purpose,
    }


@app.post("/auth/verify")
def auth_verify(payload: VerifyRequest, request: Request, response: Response) -> Dict[str, Any]:
    _require_csrf(request)
    challenge_id = str(payload.challenge_id or "").strip()
    code = str(payload.code or "").strip()
    ip = _client_ip(request)
    _check_rate_limit(bucket=f"verify:ip:{ip}", limit=30, window_seconds=900)
    if not challenge_id or not re.fullmatch(r"\d{6}", code):
        raise HTTPException(status_code=400, detail="Invalid verification payload.")

    challenge = get_email_challenge(db_engine, challenge_id=challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Verification challenge not found.")
    email = _normalize_email(str(challenge.get("email") or ""))
    _check_rate_limit(bucket=f"verify:email:{email}", limit=20, window_seconds=900)

    if challenge.get("used_at"):
        raise HTTPException(status_code=400, detail="Verification challenge already used.")
    if int(challenge.get("attempts") or 0) >= AUTH_OTP_MAX_ATTEMPTS:
        insert_auth_audit(db_engine, event="otp_verify", email=email, ip=ip, success=False, detail="attempts_exceeded")
        raise HTTPException(status_code=429, detail="Too many verification attempts.")
    if _parse_iso(str(challenge.get("expires_at") or "")) <= _utc_now():
        insert_auth_audit(db_engine, event="otp_verify", email=email, ip=ip, success=False, detail="expired")
        raise HTTPException(status_code=400, detail="Verification code expired.")

    if not hmac.compare_digest(str(challenge.get("code_hash") or ""), _code_hash(code)):
        increment_challenge_attempts(db_engine, challenge_id=challenge_id)
        insert_auth_audit(db_engine, event="otp_verify", email=email, ip=ip, success=False, detail="invalid_code")
        raise HTTPException(status_code=401, detail="Invalid verification code.")

    mark_challenge_used(db_engine, challenge_id=challenge_id)
    user_id = str(challenge.get("user_id") or "")
    purpose = str(challenge.get("purpose") or "")
    if purpose == "register":
        set_user_verified(db_engine, user_id=user_id)

    old_sid = request.cookies.get(AUTH_SESSION_COOKIE, "")
    if old_sid:
        delete_auth_session(db_engine, session_id=old_sid)

    sess = create_auth_session(
        db_engine,
        user_id=user_id,
        email=email,
        expires_at=_iso(_utc_now() + timedelta(hours=AUTH_SESSION_TTL_HOURS)),
    )
    _set_auth_cookie(response, request, str(sess["session_id"]))
    insert_auth_audit(db_engine, event="otp_verify", email=email, ip=ip, success=True, detail=purpose)
    return {"authenticated": True, "email": email}


@app.post("/auth/password-reset/request")
def auth_password_reset_request(payload: PasswordResetRequest, request: Request) -> Dict[str, Any]:
    _require_csrf(request)
    email = _validate_email(payload.email)
    ip = _client_ip(request)
    _check_rate_limit(bucket=f"reset_req:ip:{ip}", limit=12, window_seconds=900)
    _check_rate_limit(bucket=f"reset_req:email:{email}", limit=6, window_seconds=900)

    challenge_id = ""
    user = get_user_by_email(db_engine, email=email)
    if user:
        challenge = _create_and_send_challenge(user_id=str(user["user_id"]), email=email, purpose="reset")
        challenge_id = str(challenge.get("challenge_id") or "")
    insert_auth_audit(db_engine, event="password_reset_request", email=email, ip=ip, success=True)
    # Keep response generic to avoid user enumeration.
    return {"ok": True, "challenge_id": challenge_id}


@app.post("/auth/password-reset/confirm")
def auth_password_reset_confirm(payload: PasswordResetConfirmRequest, request: Request) -> Dict[str, Any]:
    _require_csrf(request)
    challenge_id = str(payload.challenge_id or "").strip()
    code = str(payload.code or "").strip()
    new_password = str(payload.new_password or "")
    ip = _client_ip(request)
    _check_rate_limit(bucket=f"reset_confirm:ip:{ip}", limit=20, window_seconds=900)
    if len(new_password) < 10:
        raise HTTPException(status_code=400, detail="Password must be at least 10 characters.")
    if not challenge_id or not re.fullmatch(r"\d{6}", code):
        raise HTTPException(status_code=400, detail="Invalid verification payload.")

    challenge = get_email_challenge(db_engine, challenge_id=challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Verification challenge not found.")
    email = _normalize_email(str(challenge.get("email") or ""))
    if str(challenge.get("purpose") or "") != "reset":
        raise HTTPException(status_code=400, detail="Invalid reset challenge.")
    if challenge.get("used_at"):
        raise HTTPException(status_code=400, detail="Verification challenge already used.")
    if int(challenge.get("attempts") or 0) >= AUTH_OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many verification attempts.")
    if _parse_iso(str(challenge.get("expires_at") or "")) <= _utc_now():
        raise HTTPException(status_code=400, detail="Verification code expired.")
    if not hmac.compare_digest(str(challenge.get("code_hash") or ""), _code_hash(code)):
        increment_challenge_attempts(db_engine, challenge_id=challenge_id)
        insert_auth_audit(db_engine, event="password_reset_confirm", email=email, ip=ip, success=False, detail="invalid_code")
        raise HTTPException(status_code=401, detail="Invalid verification code.")

    mark_challenge_used(db_engine, challenge_id=challenge_id)
    update_user_password(
        db_engine,
        user_id=str(challenge.get("user_id") or ""),
        password_hash=_password_hash(new_password),
    )
    insert_auth_audit(db_engine, event="password_reset_confirm", email=email, ip=ip, success=True)
    return {"ok": True}


@app.get("/auth/session")
def auth_session(request: Request, response: Response) -> Dict[str, Any]:
    _get_or_set_csrf_token(request, response)
    try:
        sess = _get_auth_session_or_401(request)
    except HTTPException:
        return {"authenticated": False, "email": ""}
    return {
        "authenticated": True,
        "email": str(sess.get("email") or ""),
    }


@app.post("/auth/logout")
def auth_logout(request: Request, response: Response) -> Dict[str, Any]:
    _require_csrf(request)
    sid = request.cookies.get(AUTH_SESSION_COOKIE, "")
    if sid:
        sess = get_auth_session(db_engine, session_id=sid)
        delete_auth_session(db_engine, session_id=sid)
        insert_auth_audit(
            db_engine,
            event="logout",
            email=str((sess or {}).get("email") or ""),
            ip=_client_ip(request),
            success=True,
        )
    _clear_auth_cookie(response, request)
    return {"ok": True}


# ------------------------------------------------------------
# Bexio OAuth session support
# ------------------------------------------------------------

BEXIO_AUTHORIZE_URL = os.getenv("BEXIO_AUTHORIZE_URL") or os.getenv(
    "AUTH_URL", "https://auth.bexio.com/realms/bexio/protocol/openid-connect/auth"
)
BEXIO_TOKEN_URL = os.getenv("BEXIO_TOKEN_URL") or os.getenv(
    "TOKEN_URL", "https://auth.bexio.com/realms/bexio/protocol/openid-connect/token"
)
BEXIO_API_V2 = os.getenv("BEXIO_API_V2", "https://api.bexio.com/2.0")
BEXIO_API_V3 = os.getenv("BEXIO_API_V3", "https://api.bexio.com/3.0")
BEXIO_CLIENT_ID = os.getenv("BEXIO_CLIENT_ID", "")
BEXIO_CLIENT_SECRET = os.getenv("BEXIO_CLIENT_SECRET", "")
BEXIO_SCOPES = os.getenv("BEXIO_SCOPES", "openid profile email offline_access company_profile")
BEXIO_REDIRECT_URI = os.getenv("BEXIO_REDIRECT_URI", "")
BEXIO_SESSION_COOKIE = "bp_bexio_sid"
FALLBACK_CLIENT_NAME = "Connected bexio client"

# In-memory per-session auth state (sufficient for single-instance MVP).
_bexio_sessions: Dict[str, Dict[str, Any]] = {}


def _build_base_url(request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    return f"{proto}://{host}"


def _get_or_create_sid(request: Request, response: Response) -> str:
    sid = request.cookies.get(BEXIO_SESSION_COOKIE)
    if sid:
        return sid

    sid = str(uuid.uuid4())
    response.set_cookie(
        key=BEXIO_SESSION_COOKIE,
        value=sid,
        httponly=True,
        samesite="lax",
        secure=_is_secure_request(request),
        max_age=60 * 60 * 24 * 30,
        path="/",
    )
    return sid


def _is_placeholder_client_name(name: str) -> bool:
    s = str(name or "").strip().lower()
    return not s or s == FALLBACK_CLIENT_NAME.lower()


def _extract_client_name_from_payload(payload: Any) -> str:
    name_keys_primary = (
        "name",
        "company_name",
        "company",
        "profile_name",
        "display_name",
        "title",
        "organisation_name",
        "organization_name",
        "tenant_name",
        "legal_name",
        "firm_name",
        "firma",
    )

    if isinstance(payload, dict):
        # Common bexio company_profile variants.
        n1 = str(payload.get("name_1") or payload.get("name1") or "").strip()
        n2 = str(payload.get("name_2") or payload.get("name2") or "").strip()
        combined = " ".join(x for x in [n1, n2] if x).strip()
        if combined:
            return combined

        for key in name_keys_primary:
            v = payload.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()

        # Try all nested objects, not only "data", because bexio payload structure may vary.
        for _k, v in payload.items():
            if isinstance(v, (dict, list)):
                nested_name = _extract_client_name_from_payload(v)
                if nested_name:
                    return nested_name

    if isinstance(payload, list):
        for item in payload:
            nested_name = _extract_client_name_from_payload(item)
            if nested_name:
                return nested_name

    return ""


def _extract_client_id_from_payload(payload: Any) -> str:
    if isinstance(payload, dict):
        for key in ("id", "tenant_id", "company_id", "uuid", "uid"):
            v = payload.get(key)
            if v is not None and str(v).strip():
                return str(v).strip()
        nested = payload.get("data")
        if nested is not None:
            nested_id = _extract_client_id_from_payload(nested)
            if nested_id:
                return nested_id

    if isinstance(payload, list):
        for item in payload:
            nested_id = _extract_client_id_from_payload(item)
            if nested_id:
                return nested_id

    return ""


def _auth_headers(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}", "Accept": "application/json"}


def _auth(token: str) -> Dict[str, str]:
    return {
        **_auth_headers(token),
        "Accept": "application/json",
    }


def _auth_v2(token: str) -> Dict[str, str]:
    return {
        **_auth_headers(token),
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _refresh_access_token(sid: str, sess: Dict[str, Any]) -> Optional[str]:
    refresh_token = str(sess.get("refresh_token") or "")
    if not refresh_token:
        return None

    payload = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": BEXIO_CLIENT_ID,
        "client_secret": BEXIO_CLIENT_SECRET,
    }
    try:
        resp = requests.post(BEXIO_TOKEN_URL, data=payload, timeout=15)
        if resp.status_code >= 400:
            return None
        data = resp.json()
    except Exception:
        return None

    access_token = data.get("access_token")
    if not access_token:
        return None

    sess["access_token"] = access_token
    sess["refresh_token"] = data.get("refresh_token") or refresh_token
    sess["expires_at"] = int(time.time()) + int(data.get("expires_in") or 0)
    _bexio_sessions[sid] = sess
    return access_token


def _fetch_company_profile(sid: str, sess: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    access_token = str(sess.get("access_token") or "")
    if not access_token:
        return None

    # 1) Try v2 company_profile with streamlit-equivalent headers.
    try:
        r = requests.get(f"{BEXIO_API_V2}/company_profile", headers=_auth_v2(access_token), timeout=20)
        if r.status_code == 401:
            refreshed = _refresh_access_token(sid, sess)
            if refreshed:
                access_token = refreshed
                r = requests.get(f"{BEXIO_API_V2}/company_profile", headers=_auth_v2(access_token), timeout=20)
        if r.status_code < 400:
            payload = r.json()
            return payload if isinstance(payload, dict) else None
    except Exception:
        pass

    # 2) Fallback v3 company_profile.
    try:
        r = requests.get(f"{BEXIO_API_V3}/company_profile", headers=_auth(access_token), timeout=20)
        if r.status_code == 401:
            refreshed = _refresh_access_token(sid, sess)
            if refreshed:
                access_token = refreshed
                r = requests.get(f"{BEXIO_API_V3}/company_profile", headers=_auth(access_token), timeout=20)
        if r.status_code < 400:
            payload = r.json()
            return payload if isinstance(payload, dict) else None
    except Exception:
        pass

    return None


def _fetch_bexio_client_name(sid: str, sess: Dict[str, Any]) -> str:
    profile = _fetch_company_profile(sid, sess)
    if profile:
        name = _extract_client_name_from_payload(profile)
        if name:
            return name

    return ""


def _ensure_tenant_context(sid: str, sess: Dict[str, Any]) -> Tuple[str, str]:
    tenant_id = str(sess.get("tenant_id") or "").strip()
    tenant_name = str(sess.get("client_name") or "").strip()

    # If we only have the generic fallback name, retry profile lookup to resolve real client name.
    if tenant_id and tenant_name and not _is_placeholder_client_name(tenant_name):
        return tenant_id, tenant_name

    profile = _fetch_company_profile(sid, sess)
    if profile:
        profile_tenant_id = _extract_client_id_from_payload(profile)
        profile_tenant_name = _extract_client_name_from_payload(profile)
        if profile_tenant_id:
            tenant_id = f"bexio:{profile_tenant_id}"
        if profile_tenant_name:
            tenant_name = profile_tenant_name

    if not tenant_id:
        tenant_id = f"session:{sid}"
    if _is_placeholder_client_name(tenant_name):
        tenant_name = FALLBACK_CLIENT_NAME

    sess["tenant_id"] = tenant_id
    sess["client_name"] = tenant_name
    _bexio_sessions[sid] = sess
    return tenant_id, tenant_name


@app.get("/bexio/session")
def bexio_session(request: Request):
    _get_auth_session_or_401(request)
    sid = request.cookies.get(BEXIO_SESSION_COOKIE)
    sess = _bexio_sessions.get(sid or "", {})
    connected = bool(sess.get("access_token"))
    client_name = str(sess.get("client_name") or "").strip()
    tenant_id = str(sess.get("tenant_id") or "").strip()
    should_refresh_context = (not tenant_id) or _is_placeholder_client_name(client_name)
    if connected and sid and should_refresh_context:
        tenant_id, client_name = _ensure_tenant_context(sid, sess)
    return {
        "connected": connected,
        "client_name": client_name if connected else "",
        "tenant_id": tenant_id if connected else "",
    }


@app.get("/bexio/connect")
def bexio_connect(
    request: Request,
    response: Response,
    reconnect: bool = Query(default=False),
):
    _get_auth_session_or_401(request)
    if not BEXIO_CLIENT_ID or not BEXIO_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Missing BEXIO_CLIENT_ID / BEXIO_CLIENT_SECRET")

    sid = _get_or_create_sid(request, response)
    sess = _bexio_sessions.get(sid, {})
    if reconnect:
        sess = {}
    state = secrets.token_urlsafe(24)
    sess["oauth_state"] = state
    _bexio_sessions[sid] = sess

    redirect_uri = BEXIO_REDIRECT_URI or f"{_build_base_url(request)}/api/bexio/callback"
    params = {
        "response_type": "code",
        "client_id": BEXIO_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": BEXIO_SCOPES,
        "state": state,
    }
    auth_url = f"{BEXIO_AUTHORIZE_URL}?{urlencode(params)}"
    return {"auth_url": auth_url}


@app.get("/bexio/callback")
@app.get("/bexio/callback/")
def bexio_callback(
    request: Request,
    code: str = Query(default=""),
    state: str = Query(default=""),
):
    _get_auth_session_or_401(request)
    sid = request.cookies.get(BEXIO_SESSION_COOKIE, "")
    sess = _bexio_sessions.get(sid, {})
    expected_state = str(sess.get("oauth_state") or "")

    if not code:
        raise HTTPException(status_code=400, detail="Missing OAuth code")
    if not state or state != expected_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    redirect_uri = BEXIO_REDIRECT_URI or f"{_build_base_url(request)}/api/bexio/callback"
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": BEXIO_CLIENT_ID,
        "client_secret": BEXIO_CLIENT_SECRET,
    }
    token_resp = requests.post(BEXIO_TOKEN_URL, data=payload, timeout=15)
    if token_resp.status_code >= 400:
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {token_resp.text}")

    token_data = token_resp.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Token exchange did not return access_token")

    new_sess = {
        "oauth_state": "",
        "access_token": access_token,
        "refresh_token": token_data.get("refresh_token"),
        "expires_at": int(time.time()) + int(token_data.get("expires_in") or 0),
        "client_name": "",
    }
    _bexio_sessions[sid] = new_sess
    _ensure_tenant_context(sid, new_sess)

    app_redirect = os.getenv("BEXIO_APP_REDIRECT_AFTER_LOGIN", "/upload")
    if app_redirect.startswith("/"):
        app_redirect = f"{_build_base_url(request)}{app_redirect}"
    return RedirectResponse(url=app_redirect, status_code=302)


def _normalize_header(s: str) -> str:
    return (
        str(s or "")
        .strip()
        .lower()
        .replace(" ", "_")
        .replace(".", "")
        .replace("/", "_")
        .replace("-", "_")
        .replace("(", "")
        .replace(")", "")
    )


def _clean_df(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(how="all")
    df = df.fillna("")
    return df


def _score_candidate(df: pd.DataFrame, header_row: int, headers_normalized: List[str]) -> float:
    score = 0.0

    # Prefer wider tables
    score += min(len(headers_normalized), 12) * 0.05

    # Prefer non-empty headers
    non_empty = sum(1 for h in headers_normalized if h and not h.startswith("unnamed:"))
    score += min(non_empty, 12) * 0.04

    # Prefer realistic transaction-table keywords
    joined = " ".join(headers_normalized)
    keywords = [
        "datum",
        "date",
        "valuta",
        "avisierungstext",
        "beschreibung",
        "text",
        "saldo",
        "balance",
        "gutschrift",
        "lastschrift",
        "debit",
        "credit",
        "betrag",
        "amount",
    ]
    hits = sum(1 for k in keywords if k in joined)
    score += min(hits, 8) * 0.08

    # Prefer some data rows
    score += min(len(df), 20) * 0.01

    # Slight preference for headers not too deep in file
    if header_row <= 10:
        score += 0.05

    return round(min(score, 0.99), 2)


def _build_candidate(
    df: pd.DataFrame,
    encoding: str,
    delimiter: str,
    header_row: int,
    reason: str,
) -> Dict[str, Any]:
    df = _clean_df(df)
    headers_normalized = [_normalize_header(c) for c in df.columns]
    header_signature = "|".join(headers_normalized)

    return {
        "id": f"h{header_row}_{ord(delimiter[0])}",
        "encoding": encoding,
        "delimiter": delimiter,
        "header_row": int(header_row),
        "data_start_row": int(header_row + 1),
        "headers_normalized": headers_normalized,
        "header_signature": header_signature,
        "preview_rows": df.head(12).to_dict(orient="records"),
        "reason": reason,
        "confidence": _score_candidate(df, header_row, headers_normalized),
    }


def _detect_encoding(raw: bytes) -> str:
    guess = chardet.detect(raw[:200000])
    enc = guess.get("encoding") or "utf-8"
    # prefer utf-8-sig for BOM files
    if raw.startswith(b"\xef\xbb\xbf"):
        return "utf-8-sig"
    return enc


def _candidate_header_rows(lines: List[str], delimiter: str) -> List[int]:
    rows: List[int] = []
    for i, line in enumerate(lines[:20]):
        stripped = line.strip()
        if not stripped:
            continue

        # obvious metadata rows should still be considered lower-quality options
        if stripped.count(delimiter) >= 1:
            rows.append(i)

        # if a line looks like a real table header, prioritize it
        low = stripped.lower()
        if stripped.count(delimiter) >= 3:
            rows.append(i)
        if low.startswith("datum" + delimiter):
            rows.append(i)
        if "avisierungstext" in low:
            rows.append(i)

    # preserve order, unique
    seen = set()
    out = []
    for r in rows:
        if r not in seen:
            seen.add(r)
            out.append(r)
    return out[:8]


def _parse_csv_candidate(
    text: str,
    encoding: str,
    delimiter: str,
    header_row: int,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    try:
        df = pd.read_csv(
            io.StringIO(text),
            sep=delimiter,
            header=header_row,
            dtype=str,
            engine="python",
            skip_blank_lines=True,
            on_bad_lines="skip",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV: {e}")

    df = _clean_df(df)

    if df.empty:
        raise HTTPException(status_code=400, detail="Parsed CSV is empty")

    reason = "Detected transaction table"
    return df, _build_candidate(df, encoding, delimiter, header_row, reason)


def _analyze_csv_candidates(raw: bytes) -> List[Dict[str, Any]]:
    encoding = _detect_encoding(raw)
    text = raw.decode(encoding, errors="replace").lstrip("\ufeff")
    lines = text.splitlines()

    # detect delimiter, but keep fallbacks
    delimiters: List[str] = []
    sample = "\n".join([ln for ln in lines[:12] if ln.strip()])

    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=";,|\t,")
        delimiters.append(dialect.delimiter)
    except Exception:
        pass

    for d in [";", ",", "\t", "|"]:
        if d not in delimiters:
            delimiters.append(d)

    candidates: List[Dict[str, Any]] = []
    seen_keys = set()

    for delimiter in delimiters:
        header_rows = _candidate_header_rows(lines, delimiter)
        for header_row in header_rows:
            try:
                df, candidate = _parse_csv_candidate(text, encoding, delimiter, header_row)
            except Exception:
                continue

            # reject obviously bad parses
            headers = candidate["headers_normalized"]
            non_empty = [h for h in headers if h and not h.startswith("unnamed:")]
            if len(non_empty) < 2:
                continue

            key = (candidate["header_signature"], candidate["header_row"], candidate["delimiter"])
            if key in seen_keys:
                continue
            seen_keys.add(key)

            candidates.append(candidate)

    if not candidates:
        raise HTTPException(status_code=400, detail="Could not detect a valid table in CSV")

    candidates.sort(key=lambda x: x.get("confidence", 0), reverse=True)
    return candidates[:5]


def _analyze_xlsx_candidates(raw: bytes) -> List[Dict[str, Any]]:
    try:
        # first sheet only for now
        df = pd.read_excel(io.BytesIO(raw), engine="openpyxl", dtype=str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read XLSX: {e}")

    df = _clean_df(df)
    if df.empty:
        raise HTTPException(status_code=400, detail="Parsed XLSX is empty")

    candidate = _build_candidate(
        df=df,
        encoding="binary",
        delimiter=",",
        header_row=0,
        reason="Detected first worksheet table",
    )
    return [candidate]


@app.post("/imports/analyze-candidates")
async def analyze_candidates(file: UploadFile = File(...)) -> Dict[str, Any]:
    name = (file.filename or "").lower()
    raw = await file.read()

    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    if name.endswith(".csv"):
        candidates = _analyze_csv_candidates(raw)
    elif name.endswith(".xlsx"):
        candidates = _analyze_xlsx_candidates(raw)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type (use .csv or .xlsx)")

    return {"candidates": candidates}


class DirectImportRow(BaseModel):
    row: Optional[int] = None
    csv_row: Optional[int] = None
    doc: str = ""
    date: str
    text: str = ""
    amount: float
    currency: str = "CHF"
    fx: float = 1.0
    debit: str
    credit: str
    vatCode: str = ""
    vatAccount: str = ""
    reference_nr: str = ""


class DirectImportPostRequest(BaseModel):
    rows: List[DirectImportRow] = Field(default_factory=list)
    auto_reference_nr: bool = True
    batch_size: int = 25
    sleep_between_batches: float = 2.0
    max_retries: int = 5
    dry_run: bool = False


class PostingRuleCreateRequest(BaseModel):
    keyword: str
    account_no: str
    side: str = "auto"


class PostingRuleResponse(BaseModel):
    rule_id: str
    created_at: str
    tenant_id: str
    field: str
    op: str
    keyword: str
    account_no: str
    side: str


def _get_bexio_session_or_401(request: Request) -> Tuple[str, Dict[str, Any]]:
    _get_auth_session_or_401(request)
    sid = request.cookies.get(BEXIO_SESSION_COOKIE, "")
    sess = _bexio_sessions.get(sid, {})
    if not sid or not sess or not sess.get("access_token"):
        raise HTTPException(status_code=401, detail="Not connected to bexio")
    return sid, sess


def _get_valid_access_token(sid: str, sess: Dict[str, Any]) -> str:
    access_token = str(sess.get("access_token") or "")
    expires_at = int(sess.get("expires_at") or 0)
    if not access_token:
        raise HTTPException(status_code=401, detail="Not connected to bexio")

    if expires_at and time.time() >= max(0, expires_at - 30):
        refreshed = _refresh_access_token(sid, sess)
        if refreshed:
            access_token = refreshed
            return access_token

    return access_token


def _parse_date_to_iso_strict(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return ""

    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        y, mo, d = map(int, m.groups())
        return dt_date(y, mo, d).isoformat()

    m = re.fullmatch(r"(\d{1,2})\.(\d{1,2})\.(\d{2,4})\.?", s)
    if m:
        d, mo, y = m.groups()
        d = int(d)
        mo = int(mo)
        y = int(y)
        if y < 100:
            y += 2000 if y <= 69 else 1900
        return dt_date(y, mo, d).isoformat()

    try:
        d = pd.to_datetime(s, dayfirst=True, errors="coerce")
        if pd.isna(d):
            return ""
        return d.date().isoformat()
    except Exception:
        return ""


def _fetch_json_list(url: str, headers: Dict[str, str], timeout: int = 20) -> List[Dict[str, Any]]:
    r = requests.get(url, headers=headers, timeout=timeout)
    if r.status_code >= 400:
        return []
    payload = r.json()
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    return []


def _build_account_lookup(access_token: str) -> Tuple[Dict[str, int], Dict[int, int]]:
    headers = _auth(access_token)
    accounts = _fetch_json_list(f"{BEXIO_API_V3}/accounting/accounts", headers) or _fetch_json_list(
        f"{BEXIO_API_V2}/accounts", headers
    )

    by_number: Dict[str, int] = {}
    by_id: Dict[int, int] = {}
    for a in accounts:
        aid_raw = a.get("id")
        try:
            aid = int(aid_raw)
        except Exception:
            continue
        by_id[aid] = aid
        for key in ("account_no", "account_nr", "number"):
            val = str(a.get(key) or "").strip()
            if val:
                by_number[val] = aid
    return by_number, by_id


def _list_accounts_for_suggestions(access_token: str) -> List[Dict[str, Any]]:
    headers = _auth(access_token)
    accounts = _fetch_json_list(f"{BEXIO_API_V3}/accounting/accounts", headers) or _fetch_json_list(
        f"{BEXIO_API_V2}/accounts", headers
    )
    out: List[Dict[str, Any]] = []
    for a in accounts:
        aid_raw = a.get("id")
        try:
            aid = int(aid_raw)
        except Exception:
            continue

        number = ""
        for key in ("account_no", "account_nr", "number"):
            val = str(a.get(key) or "").strip()
            if val:
                number = val
                break
        if not number:
            continue

        name = str(a.get("name") or a.get("label") or a.get("title") or "").strip()
        out.append(
            {
                "id": aid,
                "number": number,
                "name": name,
                "display": f"{number} {name}".strip(),
            }
        )

    out.sort(key=lambda x: (str(x.get("number") or ""), str(x.get("name") or "")))
    return out


def _build_currency_lookup(access_token: str) -> Dict[str, int]:
    headers = _auth(access_token)
    currencies = _fetch_json_list(f"{BEXIO_API_V3}/currencies", headers) or _fetch_json_list(
        f"{BEXIO_API_V2}/currencies", headers
    )
    out: Dict[str, int] = {}
    for c in currencies:
        try:
            cid = int(c.get("id"))
        except Exception:
            continue
        for key in ("code", "name"):
            raw = str(c.get(key) or "").strip().upper()
            if raw:
                out[raw] = cid
    if "CHF" not in out:
        out["CHF"] = 1
    return out


def _build_tax_lookup(access_token: str) -> Dict[str, int]:
    headers = _auth(access_token)
    taxes = _fetch_json_list(f"{BEXIO_API_V3}/accounting/taxes", headers) or _fetch_json_list(
        f"{BEXIO_API_V2}/taxes", headers
    )
    out: Dict[str, int] = {}
    for t in taxes:
        try:
            tid = int(t.get("id"))
        except Exception:
            continue
        for key in ("code", "name", "title", "text"):
            raw = str(t.get(key) or "").strip().upper()
            if raw:
                out[raw] = tid
    return out


def _resolve_account_id(raw: str, by_number: Dict[str, int], by_id: Dict[int, int]) -> Optional[int]:
    s = str(raw or "").strip().replace(" ", "")
    if not s:
        return None
    if s in by_number:
        return by_number[s]
    try:
        n = int(float(s))
    except Exception:
        return None
    if n in by_id:
        return n
    if str(n) in by_number:
        return by_number[str(n)]
    return None


def _currency_id_from_input(raw: str, currency_lookup: Dict[str, int]) -> Optional[int]:
    s = str(raw or "").strip().upper()
    if not s:
        s = "CHF"
    if s in currency_lookup:
        return currency_lookup[s]
    try:
        n = int(float(s))
        return n
    except Exception:
        return None


def _post_with_backoff(
    sid: str,
    sess: Dict[str, Any],
    url: str,
    payload: Dict[str, Any],
    max_retries: int,
) -> Tuple[bool, Any]:
    for attempt in range(max_retries + 1):
        token = _get_valid_access_token(sid, sess)
        headers = {**_auth(token), "Content-Type": "application/json"}
        r = requests.post(url, headers=headers, json=payload, timeout=30)

        if r.status_code == 401 and attempt == 0:
            refreshed = _refresh_access_token(sid, sess)
            if refreshed:
                headers = {**_auth(refreshed), "Content-Type": "application/json"}
                r = requests.post(url, headers=headers, json=payload, timeout=30)

        if r.status_code < 400:
            return True, r

        if r.status_code not in (429, 500, 502, 503, 504) or attempt == max_retries:
            try:
                return False, f"HTTP {r.status_code}: {r.text}"
            except Exception:
                return False, f"HTTP {r.status_code}"

        sleep_s = 0.8 * (2 ** attempt) + random.uniform(0, 0.25)
        time.sleep(sleep_s)

    return False, "Max retries exceeded"


def _model_dump_compat(row: BaseModel) -> Dict[str, Any]:
    if hasattr(row, "model_dump"):
        return row.model_dump()
    return row.dict()  # type: ignore[attr-defined]


def _rows_to_csv_bytes(rows: List[Dict[str, Any]]) -> bytes:
    columns = [
        "row",
        "csv_row",
        "doc",
        "date",
        "text",
        "amount",
        "currency",
        "fx",
        "debit",
        "credit",
        "vatCode",
        "vatAccount",
        "reference_nr",
    ]
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return out.getvalue().encode("utf-8")


def _history_tenant_context_or_401(request: Request) -> Tuple[str, str]:
    sid, sess = _get_bexio_session_or_401(request)
    return _ensure_tenant_context(sid, sess)


@app.get("/imports/history")
def imports_history(request: Request, limit: int = Query(default=100, ge=1, le=500)) -> Dict[str, Any]:
    tenant_id, tenant_name = _history_tenant_context_or_401(request)
    items = list_import_history(db_engine, tenant_id=tenant_id, limit=limit)
    return {"tenant_id": tenant_id, "tenant_name": tenant_name, "items": items}


@app.get("/bexio/accounts")
def bexio_accounts(request: Request) -> Dict[str, Any]:
    sid, sess = _get_bexio_session_or_401(request)
    access_token = _get_valid_access_token(sid, sess)
    tenant_id, tenant_name = _ensure_tenant_context(sid, sess)

    cache = sess.get("accounts_cache")
    now_ts = int(time.time())
    if isinstance(cache, dict):
        cached_tenant = str(cache.get("tenant_id") or "")
        cached_until = int(cache.get("expires_at") or 0)
        cached_items = cache.get("items")
        if cached_tenant == tenant_id and cached_until > now_ts and isinstance(cached_items, list):
            return {"tenant_id": tenant_id, "tenant_name": tenant_name, "items": cached_items}

    items = _list_accounts_for_suggestions(access_token)
    sess["accounts_cache"] = {
        "tenant_id": tenant_id,
        "expires_at": now_ts + 1800,
        "items": items,
    }
    _bexio_sessions[sid] = sess
    return {"tenant_id": tenant_id, "tenant_name": tenant_name, "items": items}


@app.get("/posting-rules")
def get_posting_rules(request: Request) -> Dict[str, Any]:
    tenant_id, tenant_name = _history_tenant_context_or_401(request)
    items = list_posting_rules(db_engine, tenant_id=tenant_id)
    return {"tenant_id": tenant_id, "tenant_name": tenant_name, "items": items}


@app.post("/posting-rules")
def create_posting_rule(payload: PostingRuleCreateRequest, request: Request) -> PostingRuleResponse:
    tenant_id, _tenant_name = _history_tenant_context_or_401(request)

    keyword = str(payload.keyword or "").strip()
    account_no = str(payload.account_no or "").strip()
    side = str(payload.side or "auto").strip().lower()

    if not keyword:
        raise HTTPException(status_code=400, detail="keyword is required")
    if not account_no:
        raise HTTPException(status_code=400, detail="account_no is required")
    if side not in ("auto", "soll", "haben"):
        raise HTTPException(status_code=400, detail="side must be auto, soll, or haben")

    item = insert_posting_rule(
        db_engine,
        tenant_id=tenant_id,
        keyword=keyword,
        account_no=account_no,
        side=side,
    )
    return PostingRuleResponse(**item)


@app.delete("/posting-rules/{rule_id}")
def remove_posting_rule(rule_id: str, request: Request) -> Dict[str, Any]:
    tenant_id, _tenant_name = _history_tenant_context_or_401(request)
    deleted = delete_posting_rule(db_engine, tenant_id=tenant_id, rule_id=rule_id)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Posting rule not found")
    return {"deleted": True, "rule_id": rule_id}


@app.get("/imports/history/{import_id}/csv")
def imports_history_csv(import_id: str, request: Request) -> StreamingResponse:
    tenant_id, _tenant_name = _history_tenant_context_or_401(request)
    try:
        csv_bytes, file_name = get_import_history_csv(db_engine, tenant_id=tenant_id, import_id=import_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@app.get("/imports/history/{import_id}")
def imports_history_item(import_id: str, request: Request) -> Dict[str, Any]:
    tenant_id, _tenant_name = _history_tenant_context_or_401(request)
    try:
        item = get_import_history_item(db_engine, tenant_id=tenant_id, import_id=import_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return item


@app.delete("/imports/history/{import_id}")
def imports_history_delete(import_id: str, request: Request) -> Dict[str, Any]:
    tenant_id, _tenant_name = _history_tenant_context_or_401(request)
    deleted = delete_import_history(db_engine, tenant_id=tenant_id, import_id=import_id)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Import history item not found")
    return {"deleted": True, "import_id": import_id}


@app.post("/bexio/direct-import/post")
def post_direct_import_to_bexio(payload: DirectImportPostRequest, request: Request) -> Dict[str, Any]:
    sid, sess = _get_bexio_session_or_401(request)
    if not payload.rows:
        raise HTTPException(status_code=400, detail="No rows provided")

    access_token = _get_valid_access_token(sid, sess)
    account_by_number, account_by_id = _build_account_lookup(access_token)
    currency_lookup = _build_currency_lookup(access_token)
    tax_lookup = _build_tax_lookup(access_token)

    next_ref_nr_url = f"{BEXIO_API_V3}/accounting/manual_entries/next_ref_nr"
    manual_entries_url = f"{BEXIO_API_V3}/accounting/manual_entries"

    batch_size = max(1, min(200, int(payload.batch_size or 25)))
    sleep_between_batches = max(0.0, float(payload.sleep_between_batches or 0.0))
    max_retries = max(0, min(8, int(payload.max_retries or 5)))

    results: List[Dict[str, Any]] = []
    row_indices = list(range(len(payload.rows)))

    for start in range(0, len(row_indices), batch_size):
        chunk_indices = row_indices[start : start + batch_size]

        for idx in chunk_indices:
            row = payload.rows[idx]
            row_no = int(row.row or (idx + 1))
            csv_row = row.csv_row
            try:
                date_iso = _parse_date_to_iso_strict(str(row.date or ""))
                if not date_iso:
                    raise ValueError(f"Invalid date in row {row_no}: '{row.date}'")

                amount = abs(float(row.amount or 0))
                if amount <= 0:
                    raise ValueError(f"Amount must be > 0 in row {row_no}.")

                debit_id = _resolve_account_id(row.debit, account_by_number, account_by_id)
                credit_id = _resolve_account_id(row.credit, account_by_number, account_by_id)
                if not debit_id or not credit_id:
                    raise ValueError(f"Unknown debit/credit account in row {row_no}.")

                currency_raw = str(row.currency or "CHF").strip().upper()
                currency_id = _currency_id_from_input(currency_raw, currency_lookup)
                if not currency_id:
                    raise ValueError(f"Unknown currency '{currency_raw}' in row {row_no}.")

                rate = float(row.fx or 1.0)
                currency_factor = 1.0 if currency_raw == "CHF" or int(currency_id) == 1 else rate
                if currency_factor <= 0:
                    raise ValueError(f"Invalid exchange rate in row {row_no}.")

                tax_id = None
                vat_code = str(row.vatCode or "").strip().upper()
                if vat_code:
                    tax_id = tax_lookup.get(vat_code)
                    if not tax_id:
                        raise ValueError(f"VAT code '{vat_code}' not mapped in row {row_no}.")

                entry: Dict[str, Any] = {
                    "debit_account_id": int(debit_id),
                    "credit_account_id": int(credit_id),
                    "amount": float(amount),
                    "description": str(row.text or "").strip(),
                    "currency_id": int(currency_id),
                    "currency_factor": float(currency_factor),
                }
                if tax_id:
                    entry["tax_id"] = int(tax_id)
                    vat_account = str(row.vatAccount or "").strip()
                    if vat_account:
                        tax_account_id = _resolve_account_id(vat_account, account_by_number, account_by_id)
                        if tax_account_id:
                            entry["tax_account_id"] = int(tax_account_id)

                reference_nr = str(row.reference_nr or "").strip()
                if payload.auto_reference_nr and not reference_nr:
                    ref_resp = requests.get(next_ref_nr_url, headers=_auth(_get_valid_access_token(sid, sess)), timeout=20)
                    if ref_resp.status_code < 400:
                        reference_nr = str((ref_resp.json() or {}).get("next_ref_nr") or "").strip()

                request_payload: Dict[str, Any] = {
                    "type": "manual_single_entry",
                    "date": date_iso,
                    "entries": [entry],
                }
                if reference_nr:
                    request_payload["reference_nr"] = reference_nr

                if payload.dry_run:
                    results.append(
                        {
                            "row": row_no,
                            "csv_row": csv_row,
                            "status": "DRY_RUN",
                            "reference_nr": reference_nr,
                            "payload": request_payload,
                        }
                    )
                    continue

                ok, resp = _post_with_backoff(sid, sess, manual_entries_url, request_payload, max_retries)
                if ok:
                    created_id = None
                    try:
                        created_id = (resp.json() or {}).get("id")
                    except Exception:
                        created_id = None
                    results.append(
                        {
                            "row": row_no,
                            "csv_row": csv_row,
                            "status": "OK",
                            "id": created_id,
                            "reference_nr": reference_nr,
                        }
                    )
                else:
                    results.append(
                        {
                            "row": row_no,
                            "csv_row": csv_row,
                            "status": "ERROR",
                            "error": str(resp),
                        }
                    )
            except Exception as e:
                results.append(
                    {
                        "row": row_no,
                        "csv_row": csv_row,
                        "status": "ERROR",
                        "error": str(e),
                    }
                )

        if sleep_between_batches and (start + batch_size) < len(row_indices):
            time.sleep(sleep_between_batches)

    ok_count = sum(1 for r in results if r.get("status") == "OK")
    dry_count = sum(1 for r in results if r.get("status") == "DRY_RUN")
    error_count = sum(1 for r in results if r.get("status") == "ERROR")
    history_import_id = None
    history_warning = None
    try:
        tenant_id, tenant_name = _ensure_tenant_context(sid, sess)
        payload_rows = [_model_dump_compat(r) for r in payload.rows]
        history_import_id = insert_import_history(
            db_engine,
            tenant_id=tenant_id,
            tenant_name=tenant_name,
            payload_rows=payload_rows,
            results=results,
            csv_bytes=_rows_to_csv_bytes(payload_rows),
        )
    except Exception as e:
        history_warning = f"History persistence failed: {e}"

    return {
        "import_id": history_import_id,
        "ok_count": ok_count,
        "dry_run_count": dry_count,
        "error_count": error_count,
        "total": len(results),
        "results": results,
        "history_warning": history_warning,
    }
