import uuid
from datetime import datetime, timezone
from typing import Dict, List

from sqlalchemy import text
from sqlalchemy.engine import Engine


def init_posting_rules_schema(engine: Engine) -> None:
    dialect = engine.dialect.name.lower()
    if "postgres" in dialect:
        ddl = """
        CREATE TABLE IF NOT EXISTS posting_rules (
          rule_id text PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now(),
          tenant_id text NOT NULL,
          field text NOT NULL DEFAULT 'description',
          op text NOT NULL DEFAULT 'contains',
          keyword text NOT NULL,
          account_no text NOT NULL,
          side text NOT NULL DEFAULT 'auto'
        );
        CREATE INDEX IF NOT EXISTS idx_posting_rules_tenant_created
          ON posting_rules (tenant_id, created_at DESC);
        """
    else:
        ddl = """
        CREATE TABLE IF NOT EXISTS posting_rules (
          rule_id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          tenant_id TEXT NOT NULL,
          field TEXT NOT NULL DEFAULT 'description',
          op TEXT NOT NULL DEFAULT 'contains',
          keyword TEXT NOT NULL,
          account_no TEXT NOT NULL,
          side TEXT NOT NULL DEFAULT 'auto'
        );
        CREATE INDEX IF NOT EXISTS idx_posting_rules_tenant_created
          ON posting_rules (tenant_id, created_at DESC);
        """

    with engine.begin() as conn:
        for stmt in [s.strip() for s in ddl.split(";") if s.strip()]:
            conn.execute(text(stmt))


def list_posting_rules(engine: Engine, *, tenant_id: str) -> List[Dict[str, str]]:
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT rule_id, created_at, tenant_id, field, op, keyword, account_no, side
                FROM posting_rules
                WHERE tenant_id = :tenant_id
                ORDER BY created_at DESC
                """
            ),
            {"tenant_id": str(tenant_id)},
        ).mappings().all()
    return [dict(x) for x in rows]


def insert_posting_rule(
    engine: Engine,
    *,
    tenant_id: str,
    keyword: str,
    account_no: str,
    side: str = "auto",
    field: str = "description",
    op: str = "contains",
) -> Dict[str, str]:
    item = {
        "rule_id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "tenant_id": str(tenant_id),
        "field": str(field or "description"),
        "op": str(op or "contains"),
        "keyword": str(keyword),
        "account_no": str(account_no),
        "side": str(side or "auto"),
    }

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO posting_rules (
                  rule_id, created_at, tenant_id, field, op, keyword, account_no, side
                )
                VALUES (
                  :rule_id, :created_at, :tenant_id, :field, :op, :keyword, :account_no, :side
                )
                """
            ),
            item,
        )
    return item


def delete_posting_rule(engine: Engine, *, tenant_id: str, rule_id: str) -> int:
    with engine.begin() as conn:
        res = conn.execute(
            text(
                """
                DELETE FROM posting_rules
                WHERE tenant_id = :tenant_id AND rule_id = :rule_id
                """
            ),
            {"tenant_id": str(tenant_id), "rule_id": str(rule_id)},
        )
    return int(res.rowcount or 0)
