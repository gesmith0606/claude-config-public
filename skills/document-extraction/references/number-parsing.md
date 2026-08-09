# Number/currency normalization & validation tie-outs

Extraction errors hide in numbers. Normalize deliberately, then prove the result with tie-outs.

## Normalize a financial string → number
Handle all of these before you trust a value:
- **Thousands/decimal separators:** `1,234.56` (US) vs `1.234,56` (EU). Know the document's locale.
- **Parentheses = negative:** `(1,234)` → `-1234`. Also trailing `-` or `CR`/`DR` markers.
- **Currency/symbols:** strip `$ € £ ¥`, `USD`, `%`; record the unit separately, don't discard it.
- **Footnote marks:** `1,234¹` / `1,234 *` — strip the marker, keep the number.
- **Scale:** a header saying *"(in thousands)"* / *"$mm"* multiplies every value. Capture scale once and apply it; getting this wrong is a 1000× error.

```python
import re
def to_number(s: str) -> float | None:
    s = s.strip()
    if s in {"", "-", "—", "n/a", "NA"}: return None
    neg = s.startswith("(") and s.endswith(")")
    s = re.sub(r"[^\d.,-]", "", s.strip("()"))
    s = s.replace(",", "")              # US locale; flip for EU ('.'/',' swap)
    try:
        v = float(s)
    except ValueError:
        return None
    return -v if neg else v
```
Keep the **raw string** alongside the parsed value so a reviewer can see what was on the page.

## Validation tie-outs (the part that catches bad extraction)
Run these as `data-quality` assertions on the extracted output:
- **Vertical totals:** `sum(line_items.amount) == stated_total` (within a cent tolerance for rounding).
- **Subtotal chain:** `sum(parts) == subtotal`, `sum(subtotals) == grand_total`.
- **Accounting identity:** `debits == credits`; `assets == liabilities + equity`.
- **Cross-field:** `qty * unit_price == amount`; `opening + net_change == closing`.
- **Row count:** rows extracted == count the document states ("42 transactions").
- **Range/sign:** percentages in [0,100] (or [-100,…]); dates within the document's period.

```python
TOL = 0.01
assert abs(items["amount"].sum() - stated_total) <= TOL, "line items don't tie to total"
assert len(items) == declared_count, f"{len(items)} rows vs {declared_count} declared"
```

## Exceptions report (don't drop, surface)
Emit a small report next to the data: which records failed which check, their source page, the raw vs
parsed value, and the confidence. A human resolves those; everything that ties out flows through clean.
This keeps the pipeline **fail-closed** (bad data is flagged, not silently shipped) — the `data-quality`
principle applied to extraction.
