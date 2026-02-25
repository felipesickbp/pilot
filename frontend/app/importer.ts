import * as XLSX from "xlsx";

export type ParsedTableCandidate = {
  id: string;
  label: string;
  source: "csv" | "excel" | "xml";
  headerRow: number;
  headers: string[];
  rows: Record<string, string>[];
  confidence: number;
  reason: string;
};

export type ImportContext = {
  fileName: string;
  fileType: "csv" | "excel" | "xml";
  bankAccount: string;
  vatMode: "with" | "without";
  candidates: ParsedTableCandidate[];
  createdAt: string;
};

export type PreviewMapping = {
  candidateId: string;
  bankTemplate: "generic" | "ubs" | "clientis" | "acrevis" | "split_generic";
  dateColumn: string;
  currencyColumn: string;
  amountMode: "single" | "split";
  amountColumn: string;
  fallbackAmountColumn: string;
  signMode: "as_is" | "invert" | "debit_positive";
  debitColumn: string;
  creditColumn: string;
  textColumns: string[];
  dropSummaryRows: boolean;
};

export type NormalizedRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  fx: number;
  direction: "CRDT" | "DBIT";
  sollAccount: string;
  habenAccount: string;
  vatCode: string;
  amountDiagnostics?: AmountDiagnostics;
  originalRow?: Record<string, string>;
};

export type AmountDiagnostics = {
  usedDebit: boolean;
  usedCredit: boolean;
  usedFallback: boolean;
  ambiguousBothSides: boolean;
  summaryInheritedSign: boolean;
};

export type CleanupRuleOptions = {
  stripBookingWords: boolean;
  stripIbanRefs: boolean;
  stripAddressBits: boolean;
  titleCase: boolean;
};

export type CleanupRuleKey = keyof CleanupRuleOptions;

export type CleanupResult = {
  text: string;
  changedRules: CleanupRuleKey[];
};

export const IMPORT_CONTEXT_KEY = "bp_pilot_import_context_v1";
export const PREVIEW_ROWS_KEY = "bp_pilot_preview_rows_v1";
export const PREVIEW_META_KEY = "bp_pilot_preview_meta_v1";
export const STORAGE_KEY = "bp_pilot_direct_import_rows_v1";
export const STORAGE_META_KEY = "bp_pilot_direct_import_meta_v1";

export function safeText(x: string | null | undefined) {
  return (x || "").replace(/\s+/g, " ").trim();
}

export function normalizeHeader(s: string) {
  return safeText(s)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[()]/g, "")
    .replace(/[\/\-]/g, "_")
    .replace(/\s+/g, "_");
}

export function isoFromMaybeDate(s: string): string {
  const t = safeText(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

  let m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  return t;
}

export function parseAmountLoose(v: unknown): number {
  if (typeof v === "number") return v;
  const t = safeText(String(v ?? ""));
  if (!t) return 0;

  let s = t.replace(/["']/g, "").replace(/\s/g, "");
  s = s.replace(/'/g, "");

  if (/^-?\d+,\d+$/.test(s)) {
    s = s.replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(s)) {
    s = s.replace(/,/g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 12);
  const sample = lines.join("\n");
  const candidates = [";", ",", "\t", "|"];

  let best = ";";
  let bestScore = -1;

  for (const d of candidates) {
    const score = sample.split("\n").reduce((acc, line) => acc + (line.split(d).length - 1), 0);
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }

  return best;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out.map((x) => safeText(x));
}

function scoreHeader(headers: string[], rowCount: number, headerRow: number) {
  const norm = headers.map(normalizeHeader).join("|");
  const keywords = [
    "datum",
    "date",
    "buchungsdatum",
    "valutadatum",
    "abschlussdatum",
    "avisierungstext",
    "beschreibung",
    "buchungstext",
    "description",
    "gutschrift",
    "lastschrift",
    "belastung",
    "einzelbetrag",
    "betrag",
    "amount",
    "saldo",
    "wahrung",
    "waehrung",
    "currency",
  ];

  let hits = 0;
  for (const k of keywords) {
    if (norm.includes(k)) hits++;
  }

  let score = 0;
  score += Math.min(headers.length, 12) * 5;
  score += Math.min(hits, 10) * 10;
  score += Math.min(rowCount, 20) * 2;
  if (headerRow <= 12) score += 8;

  return {
    confidence: Math.min(0.99, score / 100),
    reason: hits >= 2 ? "Detected likely transaction table" : "Possible table candidate",
  };
}

function buildCandidate(
  id: string,
  source: "csv" | "excel" | "xml",
  headerRow: number,
  headers: string[],
  rows: Record<string, string>[],
  reasonOverride?: string
): ParsedTableCandidate {
  const scored = scoreHeader(headers, rows.length, headerRow);
  const confidence = scored.confidence;
  return {
    id,
    label: `#${id} · header row ${headerRow + 1} · conf ${Math.round(confidence * 100)}%`,
    source,
    headerRow,
    headers,
    rows,
    confidence,
    reason: reasonOverride || scored.reason,
  };
}

function parseCsvCandidates(text: string): ParsedTableCandidate[] {
  try {
    const enhanced = parseCsvCandidatesEnhanced(text);
    if (enhanced.length) return enhanced;
  } catch {}
  return parseCsvCandidatesLegacy(text);
}

function parseCsvCandidatesEnhanced(text: string): ParsedTableCandidate[] {
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/);
  const preferred = detectDelimiter(cleaned);
  const delimiters = [preferred, ";", ",", "\t", "|"].filter((d, i, arr) => arr.indexOf(d) === i);

  const candidates: ParsedTableCandidate[] = [];
  const seen = new Set<string>();

  for (const delimiter of delimiters) {
    for (let headerRow = 0; headerRow < Math.min(lines.length, 32); headerRow++) {
      const line = lines[headerRow];
      if (!line?.trim()) continue;

      const headers = splitCsvLine(line, delimiter);
      const nonEmptyHeaders = headers.filter((h) => h.trim());
      if (nonEmptyHeaders.length < 2) continue;

      const bodyLines = lines.slice(headerRow + 1).filter((l) => l.trim()).slice(0, 160);
      if (!bodyLines.length) continue;

      const rows: Record<string, string>[] = [];
      for (const bodyLine of bodyLines) {
        const cells = splitCsvLine(bodyLine, delimiter);
        const obj: Record<string, string> = {};
        for (let i = 0; i < headers.length; i++) {
          const key = headers[i] || `Column ${i + 1}`;
          obj[key] = cells[i] ?? "";
        }
        if (Object.values(obj).some((v) => safeText(v))) rows.push(obj);
      }

      if (!rows.length) continue;

      const key = `${delimiter}__${headers.map(normalizeHeader).join("|")}__${headerRow}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const candidate = buildCandidate(
        String(candidates.length + 1),
        "csv",
        headerRow,
        headers,
        rows
      );
      const delimLabel = delimiter === "\t" ? "TAB" : delimiter;
      candidate.label = `${candidate.label} · delim ${delimLabel}`;
      candidate.reason = `${candidate.reason} (delimiter ${delimLabel})`;
      candidates.push(candidate);
    }

    // headerless candidate for formats like Clientis
    const firstRows = lines.filter((l) => l.trim()).slice(0, 100);
    if (firstRows.length >= 3) {
      const parsed = firstRows.map((l) => splitCsvLine(l, delimiter));
      const widths = parsed.map((r) => r.length);
      const uniqueWidths = Array.from(new Set(widths));
      const mostCommonWidth = uniqueWidths
        .map((w) => ({ w, c: widths.filter((x) => x === w).length }))
        .sort((a, b) => b.c - a.c)[0]?.w;

      if (mostCommonWidth && mostCommonWidth >= 4) {
        const stableRows = parsed.filter((r) => r.length === mostCommonWidth);
        if (stableRows.length >= 3) {
          const headers = Array.from({ length: mostCommonWidth }, (_, i) => `Column ${i + 1}`);
          const rows = stableRows.map((cells) => {
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => {
              obj[h] = cells[i] ?? "";
            });
            return obj;
          });

          const firstCell = safeText(rows[0]?.["Column 1"]);
          const key = `${delimiter}__headerless__${mostCommonWidth}`;
          if (!seen.has(key) && /\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2}/.test(firstCell)) {
            seen.add(key);
            const candidate = buildCandidate(
              String(candidates.length + 1),
              "csv",
              0,
              headers,
              rows,
              "Detected headerless export (likely pre-normalized rows)"
            );
            const delimLabel = delimiter === "\t" ? "TAB" : delimiter;
            candidate.label = `${candidate.label} · delim ${delimLabel}`;
            candidates.push(candidate);
          }
        }
      }
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 8);
}

function parseCsvCandidatesLegacy(text: string): ParsedTableCandidate[] {
  const cleaned = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(cleaned);
  const lines = cleaned.split(/\r?\n/);

  const candidates: ParsedTableCandidate[] = [];
  const seen = new Set<string>();

  // header-based candidates
  for (let headerRow = 0; headerRow < Math.min(lines.length, 16); headerRow++) {
    const line = lines[headerRow];
    if (!line?.trim()) continue;

    const headers = splitCsvLine(line, delimiter);
    const nonEmptyHeaders = headers.filter((h) => h.trim());
    if (nonEmptyHeaders.length < 2) continue;

    const bodyLines = lines.slice(headerRow + 1).filter((l) => l.trim()).slice(0, 120);
    if (!bodyLines.length) continue;

    const rows: Record<string, string>[] = [];
    for (const bodyLine of bodyLines) {
      const cells = splitCsvLine(bodyLine, delimiter);
      const obj: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        const key = headers[i] || `Column ${i + 1}`;
        obj[key] = cells[i] ?? "";
      }
      if (Object.values(obj).some((v) => safeText(v))) rows.push(obj);
    }

    if (!rows.length) continue;

    const key = `${headers.map(normalizeHeader).join("|")}__${headerRow}`;
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push(
      buildCandidate(
        String(candidates.length + 1),
        "csv",
        headerRow,
        headers,
        rows,
      )
    );
  }

  // headerless candidate for formats like Clientis
  const firstRows = lines.filter((l) => l.trim()).slice(0, 80);
  if (firstRows.length >= 3) {
    const parsed = firstRows.map((l) => splitCsvLine(l, delimiter));
    const widths = parsed.map((r) => r.length);
    const mostCommonWidth = widths
      .sort((a, b) =>
        widths.filter((x) => x === b).length - widths.filter((x) => x === a).length
      )[0];

    if (mostCommonWidth >= 4) {
      const stableRows = parsed.filter((r) => r.length === mostCommonWidth);
      if (stableRows.length >= 3) {
        const headers = Array.from({ length: mostCommonWidth }, (_, i) => `Column ${i + 1}`);
        const rows = stableRows.map((cells) => {
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => {
            obj[h] = cells[i] ?? "";
          });
          return obj;
        });

        const firstCell = safeText(rows[0]?.["Column 1"]);
        if (/\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2}/.test(firstCell)) {
          candidates.push(
            buildCandidate(
              String(candidates.length + 1),
              "csv",
              0,
              headers,
              rows,
              "Detected headerless export (likely pre-normalized rows)"
            )
          );
        }
      }
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 8);
}

function parseExcelCandidates(fileData: ArrayBuffer): ParsedTableCandidate[] {
  try {
    const enhanced = parseExcelCandidatesEnhanced(fileData);
    if (enhanced.length) return enhanced;
  } catch {}
  return parseExcelCandidatesLegacy(fileData);
}

function parseExcelCandidatesEnhanced(fileData: ArrayBuffer): ParsedTableCandidate[] {
  const wb = XLSX.read(fileData, { type: "array" });
  const sheetNames = wb.SheetNames || [];
  if (!sheetNames.length) throw new Error("Excel file has no sheets.");

  const candidates: ParsedTableCandidate[] = [];
  const seen = new Set<string>();

  for (const sheetName of sheetNames.slice(0, 5)) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    }) as (string | number)[][];

    for (let headerRow = 0; headerRow < Math.min(matrix.length, 32); headerRow++) {
      const rawHeaders = matrix[headerRow] || [];
      const headers = rawHeaders.map((x) => safeText(String(x ?? "")));
      const nonEmptyHeaders = headers.filter(Boolean);
      if (nonEmptyHeaders.length < 2) continue;

      const body = matrix.slice(headerRow + 1, headerRow + 161);
      const rows: Record<string, string>[] = [];

      for (const row of body) {
        const obj: Record<string, string> = {};
        let any = false;
        for (let i = 0; i < headers.length; i++) {
          const key = headers[i] || `Column ${i + 1}`;
          const val = safeText(String(row?.[i] ?? ""));
          obj[key] = val;
          if (val) any = true;
        }
        if (any) rows.push(obj);
      }

      if (!rows.length) continue;

      const key = `${sheetName}__${headers.map(normalizeHeader).join("|")}__${headerRow}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const candidate = buildCandidate(
        String(candidates.length + 1),
        "excel",
        headerRow,
        headers,
        rows
      );
      candidate.label = `${candidate.label} · sheet ${sheetName}`;
      candidate.reason = `${candidate.reason} (sheet ${sheetName})`;
      candidates.push(candidate);
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 8);
}

function parseExcelCandidatesLegacy(fileData: ArrayBuffer): ParsedTableCandidate[] {
  const wb = XLSX.read(fileData, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) throw new Error("Excel file has no sheets.");

  const sheet = wb.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  }) as (string | number)[][];

  const candidates: ParsedTableCandidate[] = [];
  const seen = new Set<string>();

  for (let headerRow = 0; headerRow < Math.min(matrix.length, 16); headerRow++) {
    const rawHeaders = matrix[headerRow] || [];
    const headers = rawHeaders.map((x) => safeText(String(x ?? "")));
    const nonEmptyHeaders = headers.filter(Boolean);
    if (nonEmptyHeaders.length < 2) continue;

    const body = matrix.slice(headerRow + 1, headerRow + 121);
    const rows: Record<string, string>[] = [];

    for (const row of body) {
      const obj: Record<string, string> = {};
      let any = false;
      for (let i = 0; i < headers.length; i++) {
        const key = headers[i] || `Column ${i + 1}`;
        const val = safeText(String(row?.[i] ?? ""));
        obj[key] = val;
        if (val) any = true;
      }
      if (any) rows.push(obj);
    }

    if (!rows.length) continue;

    const key = `${headers.map(normalizeHeader).join("|")}__${headerRow}`;
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push(
      buildCandidate(
        String(candidates.length + 1),
        "excel",
        headerRow,
        headers,
        rows
      )
    );
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 8);
}

function textFromNode(root: Element, selectors: string[]): string {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el && el.textContent) {
      const v = safeText(el.textContent);
      if (v) return v;
    }
  }
  return "";
}

function parseCamtXml(xml: string, bankAccount: string): NormalizedRow[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("Invalid XML.");

  const entries = Array.from(doc.getElementsByTagName("Ntry"));
  const rows: NormalizedRow[] = [];

  for (let i = 0; i < entries.length; i++) {
    const ntry = entries[i];

    const amtEl = ntry.getElementsByTagName("Amt")[0];
    const amount = amtEl?.textContent ? parseAmountLoose(String(amtEl.textContent)) : NaN;
    const currency = amtEl?.getAttribute("Ccy") || "CHF";

    const dirEl = ntry.getElementsByTagName("CdtDbtInd")[0];
    const directionRaw = safeText(dirEl?.textContent || "");
    const direction: "CRDT" | "DBIT" = directionRaw === "DBIT" ? "DBIT" : "CRDT";

    const bookDate = textFromNode(ntry, ["BookgDt > Dt", "BookgDt Dt", "BookgDt/Dt"]);
    const valDate = textFromNode(ntry, ["ValDt > Dt", "ValDt Dt", "ValDt/Dt"]);
    const date = isoFromMaybeDate(bookDate || valDate || "");

    const tx = ntry.querySelector("NtryDtls TxDtls") as Element | null;
    let description = "";
    if (tx) {
      description =
        textFromNode(tx, [
          "RmtInf > Ustrd",
          "RmtInf Ustrd",
          "RmtInf/Ustrd",
          "AddtlTxInf",
          "RltdPties > Dbtr > Nm",
          "RltdPties > Cdtr > Nm",
        ]) || "";
    }
    if (!description) description = textFromNode(ntry, ["AddtlNtryInf", "NtryInf"]) || "CAMT entry";

    if (!date || !currency || !Number.isFinite(amount)) continue;

    const signed = direction === "DBIT" ? -Math.abs(amount) : Math.abs(amount);

    rows.push({
      id: `DI${String(i + 1).padStart(4, "0")}`,
      date,
      description,
      amount: signed,
      currency,
      fx: 1,
      direction,
      // Bank account logic: inflow -> Soll, outflow -> Haben
      sollAccount: signed > 0 ? bankAccount : "",
      habenAccount: signed < 0 ? bankAccount : "",
      vatCode: "",
    });
  }

  return rows;
}

function camtRowsToCandidate(rows: NormalizedRow[]): ParsedTableCandidate {
  const tableRows = rows.map((r) => ({
    Date: r.date,
    Description: r.description,
    Amount: String(r.amount),
    Currency: r.currency,
    Direction: r.direction,
  }));

  return {
    id: "1",
    label: "#1 · CAMT detected",
    source: "xml",
    headerRow: 0,
    headers: ["Date", "Description", "Amount", "Currency", "Direction"],
    rows: tableRows,
    confidence: 0.99,
    reason: "Parsed CAMT XML entries",
  };
}

export async function parseFileToContext(
  file: File,
  bankAccount: string,
  vatMode: "with" | "without"
): Promise<ImportContext> {
  const lower = file.name.toLowerCase();

  let fileType: "csv" | "excel" | "xml";
  let candidates: ParsedTableCandidate[] = [];

  if (lower.endsWith(".xml")) {
    const text = await file.text();
    const rows = parseCamtXml(text, bankAccount);
    if (!rows.length) throw new Error("No CAMT entries detected.");
    candidates = [camtRowsToCandidate(rows)];
    fileType = "xml";
  } else if (lower.endsWith(".csv")) {
    const text = await file.text();
    candidates = parseCsvCandidates(text);
    fileType = "csv";
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    candidates = parseExcelCandidates(buf);
    fileType = "excel";
  } else {
    throw new Error("Please upload .csv, .xlsx, .xls, or .xml.");
  }

  if (!candidates.length) throw new Error("No usable table candidates detected.");

  return {
    fileName: file.name,
    fileType,
    bankAccount,
    vatMode,
    candidates,
    createdAt: new Date().toISOString(),
  };
}

export function guessHeader(headers: string[], needles: string[]): string {
  const norm = headers.map(normalizeHeader);
  for (const needle of needles) {
    const idx = norm.findIndex((h) => h.includes(needle));
    if (idx >= 0) return headers[idx];
  }
  return "";
}

function detectBankTemplate(candidate: ParsedTableCandidate): PreviewMapping["bankTemplate"] {
  const headers = candidate.headers;

  const isHeaderless = headers.every((h) => /^Column \d+$/.test(h));
  const looksUBS = headers.some((h) =>
    ["Abschlussdatum", "Buchungsdatum", "Belastung", "Gutschrift", "Einzelbetrag"].includes(h)
  );
  const looksAcrevis = headers.some((h) => ["Buchungstext", "Betrag", "Valuta"].includes(h));

  let bankTemplate: PreviewMapping["bankTemplate"] = "generic";
  if (looksUBS) bankTemplate = "ubs";
  else if (isHeaderless) bankTemplate = "clientis";
  else if (looksAcrevis) bankTemplate = "acrevis";
  return bankTemplate;
}

export function buildMappingForTemplate(
  ctx: ImportContext,
  candidate: ParsedTableCandidate,
  template: PreviewMapping["bankTemplate"]
): PreviewMapping {
  const headers = candidate.headers;
  let dateColumn = "";
  let currencyColumn = "";
  let amountMode: PreviewMapping["amountMode"] = "single";
  let amountColumn = "";
  let fallbackAmountColumn = "";
  let signMode: PreviewMapping["signMode"] = "as_is";
  let debitColumn = "";
  let creditColumn = "";
  let textColumns: string[] = [];
  let dropSummaryRows = true;

  if (template === "ubs") {
    dateColumn =
      guessHeader(headers, ["buchungsdatum", "valutadatum", "abschlussdatum"]) || headers[0] || "";
    currencyColumn = guessHeader(headers, ["wahrung", "waehrung", "currency", "ccy"]);
    debitColumn = guessHeader(headers, ["belastung", "lastschrift", "debit"]);
    creditColumn = guessHeader(headers, ["gutschrift", "credit"]);
    fallbackAmountColumn = guessHeader(headers, ["einzelbetrag", "betrag", "amount"]);
    amountMode = debitColumn || creditColumn ? "split" : "single";
    signMode = "debit_positive";
    textColumns = headers.filter((h) => /^Beschreibung\d+$/i.test(h));
    if (!textColumns.length) {
      textColumns = headers.filter((h) =>
        ["Beschreibung1", "Beschreibung2", "Beschreibung3"].includes(h)
      );
    }
  } else if (template === "clientis") {
    dateColumn = "Column 1";
    textColumns = ["Column 2"];
    amountMode = "single";
    amountColumn = "Column 3";
    currencyColumn = "Column 4";
    signMode = "debit_positive";
    dropSummaryRows = false;
  } else if (template === "acrevis") {
    dateColumn = guessHeader(headers, ["datum", "valuta", "date"]);
    textColumns = [guessHeader(headers, ["buchungstext", "beschreibung", "text"])].filter(Boolean);
    amountMode = "single";
    amountColumn = guessHeader(headers, ["betrag", "amount"]);
    currencyColumn = "";
    signMode = "as_is";
    dropSummaryRows = false;
  } else {
    dateColumn = guessHeader(headers, ["datum", "date", "buchungsdatum", "valuta"]);
    currencyColumn = guessHeader(headers, ["wahrung", "waehrung", "currency", "ccy"]);
    amountColumn = guessHeader(headers, ["betrag", "amount", "einzelbetrag"]);
    debitColumn = guessHeader(headers, ["lastschrift", "belastung", "debit"]);
    creditColumn = guessHeader(headers, ["gutschrift", "credit"]);
    fallbackAmountColumn = guessHeader(headers, ["einzelbetrag", "betrag", "amount"]);
    amountMode = debitColumn || creditColumn ? "split" : "single";
    signMode = debitColumn || creditColumn ? "debit_positive" : "as_is";
    textColumns = headers.filter((h) => {
      const n = normalizeHeader(h);
      return (
        n.includes("beschreibung") ||
        n.includes("avisierungstext") ||
        n.includes("buchungstext") ||
        n.includes("text") ||
        n.includes("mitteilung") ||
        n.includes("verwendungszweck") ||
        n.includes("reference") ||
        n.includes("referenz")
      );
    }).slice(0, 3);
  }

  if (!textColumns.length && headers[1]) textColumns = [headers[1]];

  return {
    candidateId: candidate.id,
    bankTemplate: template,
    dateColumn,
    currencyColumn,
    amountMode,
    amountColumn,
    fallbackAmountColumn,
    signMode,
    debitColumn,
    creditColumn,
    textColumns,
    dropSummaryRows,
  };
}

export function buildPresetMapping(ctx: ImportContext, candidate: ParsedTableCandidate): PreviewMapping {
  const template = detectBankTemplate(candidate);
  return buildMappingForTemplate(ctx, candidate, template);
}

function isLikelySummaryBooking(text: string): boolean {
  const s = safeText(text).toLowerCase();
  return s.includes("sammelauftrag") || s.includes("sammelbuchung") || s.includes("sammelauftr");
}

function applySignMode(raw: number, signMode: PreviewMapping["signMode"]): number {
  if (signMode === "invert") return raw * -1;
  if (signMode === "debit_positive") return raw > 0 ? -Math.abs(raw) : raw;
  return raw;
}

function resolveAmount(
  row: Record<string, string>,
  mapping: PreviewMapping,
  currentSummarySign: 1 | -1 | null
): { amount: number; diagnostics: AmountDiagnostics } {
  const diagnostics: AmountDiagnostics = {
    usedDebit: false,
    usedCredit: false,
    usedFallback: false,
    ambiguousBothSides: false,
    summaryInheritedSign: false,
  };

  if (mapping.amountMode !== "split") {
    const raw = mapping.amountColumn ? parseAmountLoose(row[mapping.amountColumn] || "") : 0;
    return { amount: applySignMode(raw, mapping.signMode), diagnostics };
  }

  const debit = mapping.debitColumn ? parseAmountLoose(row[mapping.debitColumn] || "") : 0;
  const credit = mapping.creditColumn ? parseAmountLoose(row[mapping.creditColumn] || "") : 0;
  const fallback = mapping.fallbackAmountColumn
    ? parseAmountLoose(row[mapping.fallbackAmountColumn] || "")
    : 0;

  const hasDebit = debit !== 0;
  const hasCredit = credit !== 0;
  const hasFallback = fallback !== 0;

  if (hasDebit && hasCredit) {
    diagnostics.ambiguousBothSides = true;
    diagnostics.usedDebit = true;
    diagnostics.usedCredit = true;
    const amount = Math.abs(credit) - Math.abs(debit);
    return { amount, diagnostics };
  }

  if (hasCredit) {
    diagnostics.usedCredit = true;
    return { amount: Math.abs(credit), diagnostics };
  }

  if (hasDebit) {
    diagnostics.usedDebit = true;
    return { amount: -Math.abs(debit), diagnostics };
  }

  if (hasFallback) {
    diagnostics.usedFallback = true;
    if (mapping.bankTemplate === "ubs" && currentSummarySign) {
      diagnostics.summaryInheritedSign = true;
      const amount = currentSummarySign > 0 ? Math.abs(fallback) : -Math.abs(fallback);
      return { amount, diagnostics };
    }
    return { amount: applySignMode(fallback, mapping.signMode), diagnostics };
  }

  return { amount: 0, diagnostics };
}

export function normalizeRows(
  ctx: ImportContext,
  candidate: ParsedTableCandidate,
  mapping: PreviewMapping
): NormalizedRow[] {
  const bankAccount = ctx.bankAccount || "1020";
  const rows = candidate.rows || [];
  const out: NormalizedRow[] = [];

  let currentSummarySign: 1 | -1 | null = null;
  let currentSummaryDate = "";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const parsedDate = mapping.dateColumn ? isoFromMaybeDate(row[mapping.dateColumn] || "") : "";

    const descParts = mapping.textColumns
      .map((col) => safeText(row[col] || ""))
      .filter(Boolean);

    const description = descParts.join(" | ");
    const { amount, diagnostics } = resolveAmount(row, mapping, currentSummarySign);

    const currency = mapping.currencyColumn
      ? safeText(row[mapping.currencyColumn] || "") || "CHF"
      : "CHF";

    const isSummary = isLikelySummaryBooking(description);

    if (isSummary && parsedDate) {
      currentSummaryDate = parsedDate;
    }

    if (isSummary && amount !== 0) {
      currentSummarySign = amount > 0 ? 1 : -1;
    }

    if (mapping.dropSummaryRows && isSummary) {
      continue;
    }

    // UBS exports often only carry booking date on the Sammelbuchung parent row.
    // If we drop the parent row, inherit its date for child rows.
    const date =
      parsedDate || (mapping.bankTemplate === "ubs" && currentSummaryDate ? currentSummaryDate : "");

    if (!date && !description && !amount) continue;

    const direction: "CRDT" | "DBIT" = amount < 0 ? "DBIT" : "CRDT";

    out.push({
      id: `DI${String(out.length + 1).padStart(4, "0")}`,
      date,
      description: description || `Row ${i + 1}`,
      amount,
      currency,
      fx: 1,
      direction,
      // Swiss accounting wording:
      // cash inflow -> bank in Soll
      // cash outflow -> bank in Haben
      sollAccount: amount > 0 ? bankAccount : "",
      habenAccount: amount < 0 ? bankAccount : "",
      vatCode: "",
      amountDiagnostics: diagnostics,
      originalRow: row,
    });
  }

  return out;
}

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

export function cleanDescriptionWithDiagnostics(
  raw: string,
  opts: CleanupRuleOptions
): CleanupResult {
  let s = safeText(raw);
  const changed = new Set<CleanupRuleKey>();

  if (opts.stripBookingWords) {
    const before = s;
    s = s.replace(
      /^(gutschrift|lastschrift|belastung|kontoübertrag|preis für .*?|saldo dienstleistungspreisabschluss)\b[:\s-]*/i,
      ""
    );
    s = s.replace(/\be-banking-sammelauftrag\b/gi, "");
    s = s.replace(/\be-banking inland \(\*e\)\b/gi, "");
    if (s !== before) changed.add("stripBookingWords");
  }

  if (opts.stripIbanRefs) {
    const before = s;
    s = s.replace(/\bCH\d{2}[0-9A-Z ]{8,}\b/g, "");
    s = s.replace(/\b(referenz|referenzen|sender referenz|transaktions-nr|zahlungsgrund|qrr):.*$/i, "");
    s = s.replace(/\bKonto-Nr\.?\s*IBAN:.*$/i, "");
    if (s !== before) changed.add("stripIbanRefs");
  }

  if (opts.stripAddressBits) {
    const before = s;
    s = s.replace(/\b[A-ZÄÖÜa-zäöüß-]+strasse\s+\d+\b/gi, "");
    s = s.replace(/\b\d{4}\s+[A-ZÄÖÜa-zäöüß-]+\b/g, "");
    s = s.replace(/\bkosten:\s*.*$/i, "");
    s = s.replace(/\bCH\s*\|\s*/g, " ");
    s = s.replace(/\b[A-Z]{2}\d{5,}\b/g, "");

    // Special UBS sender extraction
    const sender = s.match(/absender:\s*(.*?)(?=\s+(konto-nr|iban|referenz|referenzen|kosten:|ch\d{2}|[0-9]{4}\s))/i);
    if (sender?.[1]) s = sender[1].trim();
    if (s !== before) changed.add("stripAddressBits");
  }

  s = s.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").trim();
  s = s.replace(/[|;,-]\s*$/g, "").trim();

  if (opts.titleCase && /[A-ZÄÖÜ]{4,}/.test(raw || "")) {
    const before = s;
    s = toTitleCase(s);
    if (s !== before) changed.add("titleCase");
  }

  return {
    text: s || "Unbekannte Buchung",
    changedRules: Array.from(changed),
  };
}

export function cleanDescription(
  raw: string,
  opts: CleanupRuleOptions
) {
  return cleanDescriptionWithDiagnostics(raw, opts).text;
}
