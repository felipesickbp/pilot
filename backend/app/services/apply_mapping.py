from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

# -------------------------------------------------------------------
# Compatibility layer:
# Your app/models/canonical.py might use different class names.
# We import the module and pick whichever names exist.
# This prevents ImportError and keeps your backend alive.
# -------------------------------------------------------------------

from app.models import canonical as cm


def _pick(*names: str):
    for n in names:
        if hasattr(cm, n):
            return getattr(cm, n)
    return None


CanonicalTransactionModel = _pick("CanonicalTransactionV1", "CanonicalTransaction", "CanonicalTx", "TransactionCanonical")
TransactionIssueModel = _pick("TransactionIssue", "Issue", "TxIssue")
DraftPostingModel = _pick("DraftPostingV1", "DraftPosting", "PostingDraft")
MappingTemplateModel = _pick("MappingTemplateV1", "MappingTemplate", "MappingTemplateSchema")

# Minimal fallbacks if your canonical.py doesn't define them yet
class _FallbackIssue(BaseModel):
    code: str
    message: str
    field: Optional[str] = None

class _FallbackCanonicalTx(BaseModel):
    schema_version: str = "canonical_tx_v1"
    import_id: str
    row_index: int
    source_file_name: str
    booking_date: Optional[str] = None
    valuta_date: Optional[str] = None
    currency: Optional[str] = "CHF"
    amount_signed: Optional[float] = None
    direction: Optional[str] = None
    exchange_rate: Optional[float] = None
    text_raw: str = ""
    text_clean: Optional[str] = None
    balance: Optional[float] = None
    raw: Dict[str, Any] = Field(default_factory=dict)
    status: str = "ok"
    issues: List[_FallbackIssue] = Field(default_factory=list)

class _FallbackDraftPosting(BaseModel):
    label: str
    amount: float
    currency: str = "CHF"
    exchange_rate: float = 1.0
    debit_account: str = ""
    credit_account: str = ""
    vat_code: Optional[str] = None
    vat_account: Optional[str] = None

# If missing, we still need MappingTemplate-like structure for apply-stage.
# In practice, you SHOULD have MappingTemplateV1 in canonical.py already.
class _FallbackSelector(BaseModel):
    by_header_normalized: Optional[str] = None
    by_header: Optional[str] = None
    by_index: Optional[int] = None

class _FallbackColumnSelector(BaseModel):
    select: _FallbackSelector

class _FallbackAmountMapping(BaseModel):
    mode: str = "signed"  # "signed" or "debit_credit"
    signed_column: _FallbackColumnSelector = _FallbackColumnSelector(select=_FallbackSelector())
    debit_column: _FallbackColumnSelector = _FallbackColumnSelector(select=_FallbackSelector())
    credit_column: _FallbackColumnSelector = _FallbackColumnSelector(select=_FallbackSelector())

class _FallbackMapping(BaseModel):
    date_column: _FallbackColumnSelector
    text_columns: List[_FallbackColumnSelector] = Field(default_factory=list)
    amount: _FallbackAmountMapping = _FallbackAmountMapping()
    valuta_date_column: Optional[_FallbackColumnSelector] = None
    currency_column: Optional[_FallbackColumnSelector] = None
    fixed_currency: Optional[str] = None

class _FallbackCsvInput(BaseModel):
    delimiter: str = ";"
    encoding: str = "auto"
    decimal_separator: str = "auto"
    thousands_separator: str = "auto"
    trim_cells: bool = True
    drop_empty_trailing_columns: bool = True

class _FallbackTableInput(BaseModel):
    header_row: int = 1
    data_start_row: int = 2

class _FallbackInput(BaseModel):
    kind: str = "csv"
    csv: _FallbackCsvInput = _FallbackCsvInput()
    table: _FallbackTableInput = _FallbackTableInput()

class _FallbackValidation(BaseModel):
    date_formats: List[str] = Field(default_factory=lambda: ["yyyy-mm-dd", "dd.mm.yyyy", "dd.mm.yy"])
    max_parse_errors_before_fail: int = 0

class _FallbackPreprocessing(BaseModel):
    explode_compound_rows: bool = True

class _FallbackTemplate(BaseModel):
    input: _FallbackInput
    mapping: _FallbackMapping
    validation: _FallbackValidation = _FallbackValidation()
    preprocessing: _FallbackPreprocessing = _FallbackPreprocessing()


# Bind effective types
IssueT = TransactionIssueModel or _FallbackIssue
TxT = CanonicalTransactionModel or _FallbackCanonicalTx
PostingT = DraftPostingModel or _FallbackDraftPosting
TemplateT = MappingTemplateModel or _FallbackTemplate

# ----------------------------
# Parsing helpers
# ----------------------------

_NUM_RE = re.compile(r"[^0-9,\.\-\(\)']+")


def _normalize_header(s: str) -> str:
    t = (s or "").strip().lower()
    t = re.sub(r"\s+", " ", t).strip()
    t = t.replace(" ", "_")
    t = re.sub(r"[^a-z0-9_]+", "_", t)
    t = re.sub(r"_+", "_", t).strip("_")
    return t


def _decode_bytes(raw: bytes, encoding: str) -> Tuple[str, str]:
    if encoding == "auto":
        for e in ("utf-8-sig", "utf-8", "iso-8859-1", "windows-1252"):
            try:
                return raw.decode(e), e
            except Exception:
                pass
        return raw.decode("utf-8", errors="replace"), "utf-8"
    return raw.decode(encoding, errors="replace"), encoding


def _looks_like_date(s: str) -> bool:
    t = (s or "").strip()
    if not t:
        return False
    return bool(
        re.match(r"^\d{4}-\d{2}-\d{2}$", t)
        or re.match(r"^\d{2}\.\d{2}\.\d{4}$", t)
        or re.match(r"^\d{2}\.\d{2}\.\d{2}$", t)
    )


def _parse_date_to_iso(s: str, date_formats: List[str]) -> Optional[str]:
    t = (s or "").strip()
    if not t:
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}$", t):
        return t

    fmts = date_formats or ["yyyy-mm-dd", "dd.mm.yyyy", "dd.mm.yy"]
    for f in fmts:
        try:
            if f == "yyyy-mm-dd":
                dt = datetime.strptime(t, "%Y-%m-%d")
                return dt.strftime("%Y-%m-%d")
            if f == "dd.mm.yyyy":
                dt = datetime.strptime(t, "%d.%m.%Y")
                return dt.strftime("%Y-%m-%d")
            if f == "dd.mm.yy":
                dt = datetime.strptime(t, "%d.%m.%y")
                return dt.strftime("%Y-%m-%d")
        except Exception:
            continue
    return None


def _parse_number(s: Any, decimal_separator: str = "auto", thousands_separator: str = "auto") -> Optional[float]:
    if s is None:
        return None
    t = str(s).strip()
    if t == "":
        return None

    if t.startswith('="') and t.endswith('"'):
        t = t[2:-1].strip()

    neg = False
    if t.startswith("(") and t.endswith(")"):
        neg = True
        t = t[1:-1].strip()

    t = _NUM_RE.sub("", t)
    t = t.replace("'", "")

    if decimal_separator == "auto":
        if "," in t and "." in t:
            if t.rfind(",") > t.rfind("."):
                t = t.replace(".", "")
                t = t.replace(",", ".")
            else:
                t = t.replace(",", "")
        elif "," in t and "." not in t:
            t = t.replace(",", ".")
    else:
        if decimal_separator == ",":
            t = t.replace(".", "")
            t = t.replace(",", ".")
        elif decimal_separator == ".":
            t = t.replace(",", "")

    try:
        v = float(t)
        if neg:
            v = -v
        return v
    except Exception:
        return None


def _csv_read_rows(text: str, delimiter: str) -> List[List[str]]:
    f = io.StringIO(text)
    reader = csv.reader(f, delimiter=delimiter)
    return [row for row in reader]


def _safe_get(row: Dict[str, Any], key: Optional[str]) -> str:
    if not key:
        return ""
    v = row.get(key, "")
    if v is None:
        return ""
    return str(v).strip()


def _compose_text(row: Dict[str, Any], cols: List[str]) -> str:
    parts: List[str] = []
    for c in cols:
        v = _safe_get(row, c)
        if v:
            parts.append(v)
    text = " ".join(parts)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _find_amount_fallback(headers_norm: List[str]) -> List[str]:
    candidates: List[str] = []
    for h in headers_norm:
        if any(k in h for k in ("betrag_detail", "einzelbetrag", "betrag", "amount", "summe", "total", "gutschrift", "lastschrift")):
            candidates.append(h)

    def score(x: str) -> int:
        if "betrag_detail" in x:
            return 0
        if "einzelbetrag" in x:
            return 1
        if x in ("betrag", "amount"):
            return 2
        return 3

    return sorted(list(dict.fromkeys(candidates)), key=score)


@dataclass
class _AmountResult:
    signed: Optional[float]
    direction: Optional[str]
    source: str


def _compute_signed_amount(row: Dict[str, Any], headers_norm: List[str], template: Any, parent_sign: Optional[int] = None) -> _AmountResult:
    dec = getattr(getattr(template.input, "csv", None), "decimal_separator", "auto")
    thou = getattr(getattr(template.input, "csv", None), "thousands_separator", "auto")

    mode = getattr(getattr(template.mapping, "amount", None), "mode", "signed")

    signed: Optional[float] = None
    direction: Optional[str] = None
    source = "mapped"

    if mode == "signed":
        col = getattr(getattr(getattr(template.mapping.amount, "signed_column", None), "select", None), "by_header_normalized", None)
        signed = _parse_number(_safe_get(row, col), dec, thou) if col else None
    else:
        dcol = getattr(getattr(getattr(template.mapping.amount, "debit_column", None), "select", None), "by_header_normalized", None)
        ccol = getattr(getattr(getattr(template.mapping.amount, "credit_column", None), "select", None), "by_header_normalized", None)
        debit = _parse_number(_safe_get(row, dcol), dec, thou) if dcol else None
        credit = _parse_number(_safe_get(row, ccol), dec, thou) if ccol else None

        if credit is not None and debit is not None:
            signed = credit - debit
        elif credit is not None:
            signed = credit
        elif debit is not None:
            signed = debit if debit < 0 else -debit

    if signed is not None:
        direction = "CRDT" if signed > 0 else "DBIT" if signed < 0 else None

    # Fallback for continuation rows
    if signed is None or abs(signed) < 1e-12:
        fb_cols = _find_amount_fallback(headers_norm)
        for h in fb_cols:
            v = _parse_number(_safe_get(row, h), dec, thou)
            if v is None or abs(v) < 1e-12:
                continue
            signed = v
            source = f"fallback:{h}"
            break

        if signed is not None and parent_sign in (-1, 1):
            signed = abs(signed) * parent_sign
        if signed is not None:
            direction = "CRDT" if signed > 0 else "DBIT" if signed < 0 else None

    return _AmountResult(signed=signed, direction=direction, source=source)


def _expand_compound_rows(rows: List[Dict[str, Any]], headers_norm: List[str], template: Any) -> List[Dict[str, Any]]:
    date_col = getattr(getattr(getattr(template.mapping, "date_column", None), "select", None), "by_header_normalized", None)
    if not date_col:
        return rows

    text_cols = []
    for c in getattr(template.mapping, "text_columns", []) or []:
        hn = getattr(getattr(c, "select", None), "by_header_normalized", None)
        if hn:
            text_cols.append(hn)

    def is_group_parent(text: str) -> bool:
        t = (text or "").lower()
        return re.search(r"\(\d+\)", t) is not None or "sammel" in t

    out: List[Dict[str, Any]] = []
    i = 0
    tol = 0.02

    while i < len(rows):
        r = rows[i]
        d = _safe_get(r, date_col)
        if d and _looks_like_date(d):
            parent_text = _compose_text(r, text_cols) if text_cols else ""
            parent_amt = _compute_signed_amount(r, headers_norm, template).signed

            # gather children until next dated row
            j = i + 1
            children: List[Dict[str, Any]] = []
            while j < len(rows):
                rr = rows[j]
                dd = _safe_get(rr, date_col)
                if dd and _looks_like_date(dd):
                    break
                if any(str(v).strip() for v in rr.values()):
                    children.append(rr)
                j += 1

            if children and is_group_parent(parent_text) and parent_amt is not None and abs(parent_amt) > 1e-9:
                sign = 1 if parent_amt > 0 else -1
                fixed_children: List[Dict[str, Any]] = []
                child_amounts: List[float] = []
                for c in children:
                    c2 = dict(c)
                    c2[date_col] = d
                    ar = _compute_signed_amount(c2, headers_norm, template, parent_sign=sign)
                    if ar.signed is not None and abs(ar.signed) > 1e-9:
                        child_amounts.append(ar.signed)
                    fixed_children.append(c2)

                if child_amounts and abs(sum(child_amounts) - parent_amt) <= tol:
                    out.extend(fixed_children)
                    i = j
                    continue

            out.append(r)
            i += 1
        else:
            out.append(r)
            i += 1

    # carry-forward date for remaining undated rows
    last_date = None
    for k in range(len(out)):
        dd = _safe_get(out[k], date_col)
        if dd and _looks_like_date(dd):
            last_date = dd
        elif (not dd) and last_date:
            out[k] = dict(out[k])
            out[k][date_col] = last_date

    return out


def build_draft_posting(tx: Any, bank_account_gl: str, vat_enabled: bool) -> Any:
    amount = getattr(tx, "amount_signed", None)
    if amount is None:
        amount = 0.0

    debit = ""
    credit = ""
    if amount > 0:
        debit = bank_account_gl
    elif amount < 0:
        credit = bank_account_gl

    label = getattr(tx, "text_clean", None) or getattr(tx, "text_raw", "") or ""

    return PostingT(
        label=label,
        amount=abs(float(amount)),
        currency=getattr(tx, "currency", "CHF") or "CHF",
        exchange_rate=getattr(tx, "exchange_rate", None) or 1.0,
        debit_account=debit,
        credit_account=credit,
        vat_code=getattr(tx, "vat_code", None) if vat_enabled else None,
        vat_account=getattr(tx, "vat_account", None) if vat_enabled else None,
    )


def apply_mapping_csv_bytes(
    raw: bytes,
    template: Any,
    *,
    import_id: str,
    source_file_name: str,
    bank_account_gl: Optional[str] = None,
    vat_enabled: bool = False,
) -> Dict[str, Any]:
    assert getattr(template.input, "kind", "csv") == "csv", "CSV apply only in this function"

    encoding = getattr(getattr(template.input, "csv", None), "encoding", "auto")
    text, enc_used = _decode_bytes(raw, encoding)

    delimiter = getattr(getattr(template.input, "csv", None), "delimiter", ";") or ";"
    if delimiter == "auto":
        delimiter = ";"

    all_rows = _csv_read_rows(text, delimiter=delimiter)

    header_row = getattr(getattr(template.input, "table", None), "header_row", 1)
    data_start_row = getattr(getattr(template.input, "table", None), "data_start_row", 2)

    if not isinstance(header_row, int) or not isinstance(data_start_row, int):
        raise ValueError("header_row and data_start_row must be integers")

    h_i = max(header_row - 1, 0)
    d_i = max(data_start_row - 1, 0)

    if h_i >= len(all_rows):
        return {
            "rows_ok": 0,
            "rows_error": 1,
            "errors": [{"row_index": 0, "issues": [{"code": "header_out_of_range", "message": "Header row out of range"}], "raw": {}}],
            "transactions": [],
            "postings_draft": [],
            "meta": {"encoding_used": enc_used, "delimiter": delimiter},
        }

    headers = all_rows[h_i]
    headers_norm = [_normalize_header(h) for h in headers]

    parsed_rows: List[Dict[str, Any]] = []
    for ridx in range(d_i, len(all_rows)):
        row = all_rows[ridx]
        if not row or all((c or "").strip() == "" for c in row):
            continue
        row2 = list(row[: len(headers_norm)])
        if len(row2) < len(headers_norm):
            row2.extend([""] * (len(headers_norm) - len(row2)))
        obj = {headers_norm[k]: row2[k] for k in range(len(headers_norm))}
        parsed_rows.append(obj)

    explode = True
    if hasattr(template, "preprocessing") and hasattr(template.preprocessing, "explode_compound_rows"):
        explode = bool(template.preprocessing.explode_compound_rows)
    if explode:
        parsed_rows = _expand_compound_rows(parsed_rows, headers_norm, template)

    date_col = getattr(getattr(getattr(template.mapping, "date_column", None), "select", None), "by_header_normalized", None)
    valuta_col = None
    if getattr(template.mapping, "valuta_date_column", None):
        valuta_col = getattr(getattr(template.mapping.valuta_date_column, "select", None), "by_header_normalized", None)

    currency_col = None
    if getattr(template.mapping, "currency_column", None):
        currency_col = getattr(getattr(template.mapping.currency_column, "select", None), "by_header_normalized", None)

    fixed_currency = getattr(template.mapping, "fixed_currency", None)

    text_cols: List[str] = []
    for c in getattr(template.mapping, "text_columns", []) or []:
        hn = getattr(getattr(c, "select", None), "by_header_normalized", None)
        if hn:
            text_cols.append(hn)

    date_formats = getattr(getattr(template, "validation", None), "date_formats", None) or ["yyyy-mm-dd", "dd.mm.yyyy", "dd.mm.yy"]
    max_fail = int(getattr(getattr(template, "validation", None), "max_parse_errors_before_fail", 0) or 0)

    transactions: List[Any] = []
    postings: List[Any] = []
    errors: List[Dict[str, Any]] = []

    for idx, raw_row in enumerate(parsed_rows, start=data_start_row):
        issues: List[Any] = []

        booking_raw = _safe_get(raw_row, date_col)
        booking_iso = _parse_date_to_iso(booking_raw, date_formats)
        if not booking_iso:
            issues.append(IssueT(code="invalid_date", message="Could not parse booking_date", field="booking_date"))

        valuta_iso = None
        if valuta_col:
            vraw = _safe_get(raw_row, valuta_col)
            if vraw:
                valuta_iso = _parse_date_to_iso(vraw, date_formats)

        text_raw = _compose_text(raw_row, text_cols)
        if not text_raw:
            issues.append(IssueT(code="missing_text", message="text_raw is empty after composition", field="text_raw"))

        currency = fixed_currency or None
        if not currency and currency_col:
            currency = _safe_get(raw_row, currency_col) or None
        if not currency:
            currency = "CHF"

        ar = _compute_signed_amount(raw_row, headers_norm, template)
        if ar.signed is None:
            issues.append(IssueT(code="missing_amount", message="Could not parse amount", field="amount_signed"))

        status = "ok" if not issues else "error"

        tx = TxT(
            schema_version="canonical_tx_v1",
            import_id=import_id,
            row_index=idx,
            source_file_name=source_file_name,
            booking_date=booking_iso,
            valuta_date=valuta_iso,
            currency=currency,
            amount_signed=ar.signed,
            direction=ar.direction,
            exchange_rate=None,
            text_raw=text_raw,
            text_clean=None,
            balance=None,
            raw=raw_row,
            status=status,
            issues=issues,
        )

        if status == "error" and max_fail == 0:
            errors.append({"row_index": idx, "issues": [i.model_dump() for i in issues], "raw": raw_row})
            continue

        transactions.append(tx)
        if bank_account_gl:
            postings.append(build_draft_posting(tx, bank_account_gl, vat_enabled))

    return {
        "rows_ok": len(transactions),
        "rows_error": len(errors),
        "errors": errors,
        "transactions": [t.model_dump() for t in transactions],
        "postings_draft": [p.model_dump() for p in postings],
        "meta": {"encoding_used": enc_used, "delimiter": delimiter},
    }
