# DocFlow LibreOffice Worker

High-fidelity PDF ↔ DOCX/ODT conversion using LibreOffice headless (MPL 2.0).

## Architecture

- **unoserver** daemon running LibreOffice headless
- Listens on port 2003 (UNO socket), 2004 (conversion)
- Bundled Bengali fonts (Noto Sans/Serif Bengali + Siyam Rupali + Kalpurush + SolaimanLipi)

## Usage

```bash
docker build -t docflow-libreoffice .
docker run -p 2003:2003 -p 2004:2004 docflow-libreoffice
```

## Conversion API

The backend communicates with unoserver via the `unoserver` Python client:

```python
from unoserver import client
client = client.UnoClient()
client.convert("input.docx", outpath="output.pdf")
```

## Supported Conversions

- PDF → DOCX
- DOCX → PDF
- ODT → PDF
- PDF → ODT
- DOCX → ODT
