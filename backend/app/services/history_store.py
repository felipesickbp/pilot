import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple, cast

from sqlalchemy import text
from sqlalchemy.engine import Engine


def _json_default(o: Any) -> Any:
    try:
        import numpy as np

        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating,)):
            return float(o)
        if isinstance(o, (np.bool_,)):
            return bool(o)
    except Exception:
        pass

    try:
        import pandas as pd

        if pd.isna(o):
            return None
        if isinstance(o, pd.Timestamp):
            return o.to_pydatetime().isoformat()
    except Exception:
        pass

    if isinstance(o, datetime):
        return o.isoformat()
    return str(o)


def init_history_schema(engine: Engine) -> None:
    dialect = engine.dialect.name.lower()
    if "postgres" in dialect:
        ddl = """
        CREATE TABLE IF NOT EXISTS import_history (
          import_id text PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          tenant_id text NOT NULL,
          tenant_name text,
          row_count int NOT NULL DEFAULT 0,
          payload_json jsonb NOT NULL,
          results_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          csv_bytes bytea
        );
        CREATE INDEX IF NOT EXISTS idx_import_history_tenant_created
          ON import_history (tenant_id, created_at DESC);
        """
    else:
        ddl = """
        CREATE TABLE IF NOT EXISTS import_history (
          import_id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          tenant_id TEXT NOT NULL,
          tenant_name TEXT,
          row_count INTEGER NOT NULL DEFAULT 0,
          payload_json TEXT NOT NULL DEFAULT '[]',
          results_json TEXT NOT NULL DEFAULT '[]',
          csv_bytes BLOB
        );
        CREATE INDEX IF NOT EXISTS idx_import_history_tenant_created
          ON import_history (tenant_id, created_at DESC);
        """
    with engine.begin() as conn:
        for stmt in [s.strip() for s in ddl.split(";") if s.strip()]:
            conn.execute(text(stmt))


def insert_import_history(
    engine: Engine,
    *,
    tenant_id: str,
    tenant_name: str,
    payload_rows: List[Dict[str, Any]],
    results: List[Dict[str, Any]],
    csv_bytes: bytes | None,
) -> str:
    dialect = engine.dialect.name.lower()
    history_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    payload_json = json.dumps(payload_rows or [], ensure_ascii=False, default=_json_default)
    results_json = json.dumps(results or [], ensure_ascii=False, default=_json_default)
    row_count = len(payload_rows or [])

    params = {
        "import_id": history_id,
        "created_at": created_at,
        "tenant_id": str(tenant_id),
        "tenant_name": str(tenant_name or ""),
        "row_count": int(row_count),
        "payload_json": payload_json,
        "results_json": results_json,
        "csv_bytes": csv_bytes,
    }

    with engine.begin() as conn:
        if "postgres" in dialect:
            conn.execute(
                text(
                    """
                    INSERT INTO import_history (
                      import_id, created_at, tenant_id, tenant_name, row_count,
                      payload_json, results_json, csv_bytes
                    )
                    VALUES (
                      :import_id, :created_at, :tenant_id, :tenant_name, :row_count,
                      CAST(:payload_json AS jsonb), CAST(:results_json AS jsonb), :csv_bytes
                    )
                    """
                ),
                params,
            )
        else:
            conn.execute(
                text(
                    """
                    INSERT INTO import_history (
                      import_id, created_at, tenant_id, tenant_name, row_count,
                      payload_json, results_json, csv_bytes
                    )
                    VALUES (
                      :import_id, :created_at, :tenant_id, :tenant_name, :row_count,
                      :payload_json, :results_json, :csv_bytes
                    )
                    """
                ),
                params,
            )
    return history_id


def _parse_json_value(raw: Any) -> Any:
    if raw is None:
        return None
    if isinstance(raw, (dict, list)):
        return raw
    if isinstance(raw, (bytes, bytearray, memoryview)):
        try:
            raw = bytes(raw).decode("utf-8", errors="replace")
        except Exception:
            return None
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return None
        try:
            return json.loads(s)
        except Exception:
            return None
    return None


def list_import_history(engine: Engine, *, tenant_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT import_id, created_at, tenant_id, tenant_name, row_count
                FROM import_history
                WHERE tenant_id = :tenant_id
                ORDER BY created_at DESC
                LIMIT :limit
                """
            ),
            {"tenant_id": str(tenant_id), "limit": int(limit)},
        ).mappings().all()
    return [dict(row) for row in rows]


def get_import_history_item(engine: Engine, *, tenant_id: str, import_id: str) -> Dict[str, Any]:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT
                  import_id, created_at, tenant_id, tenant_name, row_count,
                  payload_json, results_json
                FROM import_history
                WHERE tenant_id = :tenant_id AND import_id = :import_id
                """
            ),
            {"tenant_id": str(tenant_id), "import_id": str(import_id)},
        ).mappings().first()

    if not row:
        raise ValueError("Import history item not found")

    item = dict(row)
    item["payload_json"] = cast(List[Dict[str, Any]], _parse_json_value(item.get("payload_json")) or [])
    item["results_json"] = cast(List[Dict[str, Any]], _parse_json_value(item.get("results_json")) or [])
    return item


def get_import_history_csv(engine: Engine, *, tenant_id: str, import_id: str) -> Tuple[bytes, str]:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT import_id, csv_bytes
                FROM import_history
                WHERE tenant_id = :tenant_id AND import_id = :import_id
                """
            ),
            {"tenant_id": str(tenant_id), "import_id": str(import_id)},
        ).mappings().first()

    if not row or row.get("csv_bytes") is None:
        raise ValueError("CSV not found for this history item")

    csv_bytes = row["csv_bytes"]
    if isinstance(csv_bytes, memoryview):
        csv_bytes = csv_bytes.tobytes()
    return csv_bytes, f"import_{row['import_id']}.csv"


def delete_import_history(engine: Engine, *, tenant_id: str, import_id: str) -> int:
    with engine.begin() as conn:
        res = conn.execute(
            text(
                """
                DELETE FROM import_history
                WHERE tenant_id = :tenant_id AND import_id = :import_id
                """
            ),
            {"tenant_id": str(tenant_id), "import_id": str(import_id)},
        )
    return int(res.rowcount or 0)
