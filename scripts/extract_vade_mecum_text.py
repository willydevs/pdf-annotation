#!/usr/bin/env python
from __future__ import annotations

import json
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "output" / "pdf" / "Vade_mecum_2026_uma_coluna.pdf"
OUTPUT = ROOT / "output" / "pdf" / "vade_mecum_text_pages.json"


def main() -> None:
    pages = []
    with pdfplumber.open(INPUT) as pdf:
        for index, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            pages.append({"pageNumber": index, "text": text})

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(pages, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(pages)} pages to {OUTPUT}")


if __name__ == "__main__":
    main()
