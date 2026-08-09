# Extraction methods — library matrix & patterns

All examples use `python3`. Install only what the source type needs; don't pull camelot+tabula+ocrmypdf
for a job that's one digital PDF.

## Library matrix

| Need | Library | Notes |
|---|---|---|
| PDF text layer present? | `pdfplumber` | `page.extract_text()` empty / `page.chars == []` ⇒ image-only ⇒ OCR |
| PDF plain text | `pypdf`, `pdfplumber` | pypdf fast; pdfplumber keeps layout/positions |
| PDF tables (whitespace) | `pdfplumber`, `camelot(flavor='stream')` | no ruling lines |
| PDF tables (ruled grid) | `camelot(flavor='lattice')`, `tabula-py` | needs visible cell borders; tabula needs Java |
| Scanned PDF → searchable | `ocrmypdf` | adds a text layer in place, then use the digital path |
| Image/low-level OCR | `pytesseract` + `Pillow` | needs the Tesseract binary installed on the OS |
| DOCX text + tables | `python-docx` | see the `docx` skill |
| HTML tables | `pandas.read_html` | returns a list of DataFrames |
| HTML DOM | `selectolax` (fast) / `beautifulsoup4` | selectolax is much faster on big pages |
| Layout/key-value (forms) | `pdfplumber` words+bbox; LLM for variable forms | anchor on label text, not coordinates |

## Detect a text layer (decide OCR vs not)
```python
import pdfplumber
with pdfplumber.open(path) as pdf:
    has_text = any(p.extract_text() for p in pdf.pages)
# has_text False ⇒ scanned/image PDF ⇒ run OCR first
```

## Tables: lattice vs stream
- **Lattice** — ruled cells. `camelot.read_pdf(path, flavor="lattice", pages="all")`. Most reliable when
  borders exist (bank statements, invoices with grids).
- **Stream** — columns separated by whitespace only. `pdfplumber` `page.extract_table(table_settings=...)`
  or `camelot(flavor="stream")`. Tune column boundaries; verify the column count per page.
- **Multi-page:** concatenate per-page tables; drop the repeated header row on pages 2+. Watch merged
  cells — a spanned cell can shift every column to its right.

## OCR pipeline (scanned docs)
1. Rasterize at **≥300 dpi**; deskew/denoise (`ocrmypdf` does this; or OpenCV before `pytesseract`).
2. OCR to a text layer (`ocrmypdf in.pdf out.pdf`) then run the normal digital extraction.
3. For tables in scans, OCR first, then table-detect on the searchable PDF — don't table-detect raw pixels.
4. **Always validate OCR numerics against tie-outs/checksums** — OCR silently swaps O/0, l/1, S/5, B/8.

## Field extraction strategy (ties to `regex-vs-llm-structured-text`)
1. **Deterministic first:** regex/anchor/positional for stable labeled fields. Cheap, auditable, local.
2. **LLM only for the variable/fuzzy remainder**, and always with a schema + per-field confidence:
```python
# pydantic schema + an LLM structured-output call; keep page provenance per record
class LineItem(BaseModel):
    description: str
    qty: float | None
    unit_price: float | None
    amount: float
    source_page: int
    confidence: float
```
3. Merge deterministic + LLM results; mark anything LLM-sourced or low-confidence for review.

## Provenance
Attach `source_file`, `source_page` (and bbox when available) to every record. It powers the exceptions
report, lets a human re-check a flagged value at its origin, and is the audit trail in finance contexts.
