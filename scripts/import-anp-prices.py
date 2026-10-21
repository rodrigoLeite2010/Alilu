"""Import a weekly official ANP XLSX into the public, versioned price snapshot.
No runtime dependency, API subscription, station-level personal data or scheduled job.
Usage: python scripts/import-anp-prices.py https://www.gov.br/anp/.../resumo_semanal_....xlsx
"""
import datetime as dt
import hashlib
import io
import json
from pathlib import Path
import sys
from urllib.parse import urlparse
from urllib.request import urlopen
import xml.etree.ElementTree as ET
import zipfile

url = sys.argv[1]
parsed = urlparse(url)
if parsed.scheme != "https" or parsed.hostname != "www.gov.br" or not parsed.path.startswith("/anp/") or not parsed.path.endswith(".xlsx"):
    raise ValueError("Expected an official ANP HTTPS XLSX URL")
with urlopen(url, timeout=30) as response:
    if urlparse(response.url).hostname != "www.gov.br":
        raise ValueError("Unexpected redirect")
    raw = response.read(8_000_001)
if len(raw) > 8_000_000:
    raise ValueError("Workbook too large")
z = zipfile.ZipFile(io.BytesIO(raw))
ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
strings = ["".join(t.itertext()) for t in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("s:si", ns)]
def sheet_rows(filename):
    for row in ET.fromstring(z.read(filename)).findall(".//s:row", ns):
        cells = {}
        for c in row:
            key = "".join(char for char in c.attrib["r"] if char.isalpha())
            v = c.findtext("s:v", default="", namespaces=ns)
            cells[key] = strings[int(v)] if c.attrib.get("t") == "s" else v
        yield cells
def date(serial):
    return (dt.date(1899, 12, 30) + dt.timedelta(days=int(float(serial)))).isoformat()
fuels = {"GASOLINA COMUM": "gasolina", "ETANOL HIDRATADO": "etanol", "OLEO DIESEL": "diesel", "OLEO DIESEL S10": "diesel S10"}
entries = []
periods = set()
for filename, scope in [("xl/worksheets/sheet2.xml", "municipio"), ("xl/worksheets/sheet3.xml", "estado")]:
    rows = list(sheet_rows(filename))
    header = next((r for r in rows if r.get("A") == "DATA INICIAL"), None)
    if not header or header.get("H") != "PREÇO MÉDIO REVENDA" or header.get("E") != "PRODUTO":
        raise ValueError("ANP workbook layout changed; review importer before publishing")
    for r in rows:
        if r.get("E") not in fuels or r.get("G", "").lower() != "r$/l":
            continue
        price = float(r["H"])
        if not 0 < price < 100:
            raise ValueError("Unexpected fuel price")
        periods.add((date(r["A"]), date(r["B"])))
        entries.append({"state": r["C"] if scope == "municipio" else r["D"], "city": r["D"] if scope == "municipio" else "", "fuel": fuels[r["E"]], "price": round(price, 3), "stations": int(r["F"])})
if len(periods) != 1 or len(entries) < 100:
    raise ValueError("Missing or inconsistent ANP data")
start, end = periods.pop()
payload = {"source": url, "sha256": hashlib.sha256(raw).hexdigest(), "from": start, "to": end, "importedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "entries": entries}
target = Path(__file__).resolve().parents[1] / "public" / "data" / "viagens" / "anp-prices.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Imported {len(entries)} official averages, survey {start} to {end}; SHA256 {payload['sha256']}")
