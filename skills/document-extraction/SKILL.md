---
name: document-extraction
description: >-
  Turn unstructured or semi-structured documents — PDFs (digital or scanned), Word, HTML,
  emails — into clean, VALIDATED structured data (tables/records → CSV/parquet/JSON). Use when
  extracting tables, line items, or key fields from financial statements, invoices, receipts,
  contracts, reports, or forms at any scale; covers OCR, table extraction, normalization, and
  tie-out validation.
---

# document-extraction

Extract **trustworthy structured data** from documents. The job isn't "read the PDF" — it's "produce
rows you'd stake a number on," with the failures surfaced rather than silently swallowed.

Run all tooling with **python3** (on Windows use a real interpreter / `py -3`, never the MS-Store stub).
For sensitive material see **Confidentiality** below.

## When to use vs neighbors
- **This skill** — document → structured data, with validation. The orchestration.
- `pdf` — the PDF mechanics this leans on (text/table extraction, OCR, forms, splitting).
- `docx` — Word read/extract. `xlsx` — spreadsheet read/write (use it to emit the result to Excel).
- `regex-vs-llm-structured-text` — the deterministic-first parse decision (used in step 3).
- `data-quality` — the assertion library behind step 4. `dataframes` — post-extraction cleanup.

## The pipeline (don't skip a step)
1. **Classify the source.** Digital-text PDF vs scanned-image PDF vs DOCX vs HTML vs already-tabular.
   `pdfplumber`/`pdf` can tell you if a PDF has a real text layer (chars present) or is image-only.
2. **Extract** by type (see the matrix below). Tables ≠ prose — pick a table extractor for tables.
3. **Parse fields** deterministically first; escalate to an LLM only for the variable bits (step 3 detail).
4. **Validate** before you trust it — types, required fields, ranges, and **tie-outs** (totals, counts).
5. **Output** clean parquet/CSV/JSON **plus** an exceptions/confidence report. Never silently drop rows.

## Method by document type
| Source | Text | Tables | Notes |
|---|---|---|---|
| Digital PDF | `pypdf`, `pdfplumber` | `pdfplumber` (stream), `camelot`/`tabula` (lattice) | check for a text layer first |
| Scanned PDF / image | OCR: `ocrmypdf` → then digital path, or `pytesseract` | OCR then table-detect | 300+ dpi, deskew first |
| DOCX | `python-docx` (`docx` skill) | `python-docx` tables | styles/headers are reliable anchors |
| HTML / email | `selectolax`/BeautifulSoup | `pandas.read_html` | emails: strip quoted history |
| Already tabular (csv/xls) | — | `pandas`/`xlsx` | you probably don't need this skill |

Lattice = ruled/grid tables (use camelot `flavor='lattice'`); stream = whitespace-aligned columns
(`pdfplumber` or camelot `flavor='stream'`). Full library matrix → `references/extraction-methods.md`.

## Field parsing: deterministic first, LLM only for the hard parts
Anchor on **labels**, not pixel coordinates — layouts drift between document versions. Use regex /
positional rules for stable fields; reach for an LLM **only** when layout is variable or semantics are
fuzzy, and when you do, force a **schema** (e.g. pydantic / structured output) and keep a confidence
score per field. This is exactly the `regex-vs-llm-structured-text` decision — read it.

## Validation: never trust an un-tied-out extraction
Apply `data-quality` assertions to the *output*: required-not-null, type/range, accepted domain, and
the ones that catch extraction errors specifically —
- **Tie-outs:** sum(line items) == stated total; sum(parts) == subtotal == grand total; debits == credits.
- **Counts:** rows extracted == rows expected (e.g. "page says 42 transactions").
- **Cross-field:** dates in range, quantity × unit price == amount.
Route anything failing or low-confidence to an **exceptions report** for human review — don't drop it.

## Gotchas
- **Numbers:** currency symbols, thousands separators, `(123)` = negative, trailing footnote marks,
  and **scale** ("in thousands/millions" in a header). Normalize explicitly → `references/number-parsing.md`.
- **OCR:** digit confusions (O/0, l/1, S/5, B/8); validate against checksums/tie-outs, not vibes.
- **Multi-page tables:** headers repeat per page; merged/spanned cells split wrong — verify column count.
- **Provenance:** keep the source file + page (+ bbox if you have it) for every extracted value. In
  finance/audit contexts that audit trail is the deliverable, not a nicety.

## Confidentiality
For deal/financial/PII documents, extract **locally** (local `python3` + Tesseract/pdf tooling). Do
**not** send sensitive docs to hosted OCR/LLM extraction services without explicit authorization — see
the confidentiality posture in `~/.claude/CLAUDE.md`. Never commit extracted data rows.

## References
- `references/extraction-methods.md` — per-format library matrix, table extraction (lattice vs stream), OCR pipeline.
- `references/number-parsing.md` — number/currency normalization + the validation tie-out patterns.
