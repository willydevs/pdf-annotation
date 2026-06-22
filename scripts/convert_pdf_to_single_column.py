#!/usr/bin/env python
"""Convert a multi-column PDF into a reflowed single-column PDF.

The script extracts positioned words with pdfplumber, groups them by detected
columns, rebuilds reading-order lines, and writes a new text-based PDF.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from statistics import median
from typing import Iterable

import pdfplumber
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer


LAW_HEADING_RE = re.compile(
    r"^(CONSTITUI[CÇ][AÃ]O|C[ÓO]DIGO|LEI|DECRETO|MEDIDA PROVIS[ÓO]RIA|EMENDA|S[ÚU]MULA|ATO\b)",
    re.IGNORECASE,
)


def normalize_text(text: str) -> str:
    text = text.replace("\u00a0", " ")
    return re.sub(r"\s+", " ", text).strip()


def dehyphenate(text: str) -> str:
    return re.sub(r"([A-Za-zÀ-ÖØ-öø-ÿ]{2,})-\s+([a-zà-öø-ÿ]{2,})", r"\1\2", text)


def column_ranges_by_largest_gaps(
    words: list[dict], page_width: float, columns: int
) -> list[tuple[float, float]]:
    if columns <= 1 or len(words) < columns * 8:
        return [(0, page_width)]

    xs = sorted((float(word["x0"]) + float(word["x1"])) / 2 for word in words)
    gaps = sorted(
        ((xs[index + 1] - xs[index], xs[index], xs[index + 1]) for index in range(len(xs) - 1)),
        reverse=True,
    )
    boundaries = sorted((left + right) / 2 for _, left, right in gaps[: columns - 1])
    edges = [0, *boundaries, page_width]
    return [(edges[index], edges[index + 1]) for index in range(columns)]


def detect_column_ranges(words: list[dict], page_width: float, gutter: float) -> list[tuple[float, float]]:
    """Return x ranges for likely text columns on the page."""
    if not words:
        return []

    xs = sorted((float(word["x0"]) + float(word["x1"])) / 2 for word in words)
    clusters: list[list[float]] = [[xs[0]]]

    for x in xs[1:]:
        if x - clusters[-1][-1] > gutter:
            clusters.append([x])
        else:
            clusters[-1].append(x)

    ranges: list[tuple[float, float]] = []
    for cluster in clusters:
        if len(cluster) < 8:
            continue
        ranges.append((max(0, min(cluster) - gutter / 2), min(page_width, max(cluster) + gutter / 2)))

    if len(ranges) <= 1:
        return [(0, page_width)]

    return ranges


def group_words_into_lines(words: list[dict], y_tolerance: float) -> list[str]:
    if not words:
        return []

    ordered = sorted(words, key=lambda word: (float(word["top"]), float(word["x0"])))
    lines: list[list[dict]] = []

    for word in ordered:
        top = float(word["top"])
        if not lines:
            lines.append([word])
            continue

        line_top = median(float(item["top"]) for item in lines[-1])
        if abs(top - line_top) <= y_tolerance:
            lines[-1].append(word)
        else:
            lines.append([word])

    rebuilt: list[str] = []
    for line in lines:
        line_text = normalize_text(" ".join(word["text"] for word in sorted(line, key=lambda item: float(item["x0"]))))
        if line_text:
            rebuilt.append(line_text)
    return rebuilt


def lines_from_page(page, args: argparse.Namespace) -> list[str]:
    cropped = page.crop((0, args.top_margin, page.width, page.height - args.bottom_margin))
    extracted_words = cropped.extract_words(
        x_tolerance=args.x_tolerance,
        y_tolerance=args.y_tolerance,
        keep_blank_chars=False,
        use_text_flow=False,
    )
    words = [word for word in extracted_words if word.get("upright", True)]

    if not words:
        return []

    column_ranges = (
        column_ranges_by_largest_gaps(words, page.width, args.columns)
        if args.columns
        else detect_column_ranges(words, page.width, args.gutter)
    )
    page_lines: list[str] = []

    for start, end in column_ranges:
        column_words = [
            word for word in words if start <= (float(word["x0"]) + float(word["x1"])) / 2 <= end
        ]
        column_lines = group_words_into_lines(column_words, args.y_tolerance)
        if column_lines:
            if page_lines:
                page_lines.append("")
            page_lines.extend(column_lines)

    return page_lines


def paragraph_blocks(lines: Iterable[str]) -> Iterable[str]:
    current: list[str] = []

    for line in lines:
        line = normalize_text(line)
        if not line:
            if current:
                yield dehyphenate(" ".join(current))
                current = []
            continue

        is_heading = LAW_HEADING_RE.search(line) or line.isupper()
        starts_new_article = re.match(r"^Art\.?\s*\d", line)

        if (is_heading or starts_new_article) and current:
            yield dehyphenate(" ".join(current))
            current = [line]
            continue

        if current and current[-1].endswith((".", ";", ":", "?", "!")) and re.match(r"^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9]", line):
            yield dehyphenate(" ".join(current))
            current = [line]
        else:
            current.append(line)

    if current:
        yield dehyphenate(" ".join(current))


def make_story(input_pdf: Path, args: argparse.Namespace) -> list:
    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Times-Roman",
        fontSize=args.font_size,
        leading=args.leading,
        alignment=TA_LEFT,
        firstLineIndent=0.35 * cm,
        spaceAfter=4,
    )
    heading = ParagraphStyle(
        "Heading",
        parent=body,
        fontName="Times-Bold",
        alignment=TA_CENTER,
        firstLineIndent=0,
        spaceBefore=8,
        spaceAfter=6,
    )
    page_marker = ParagraphStyle(
        "PageMarker",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=7,
        leading=9,
        textColor="#666666",
        alignment=TA_CENTER,
        spaceAfter=6,
    )

    story: list = []
    with pdfplumber.open(input_pdf) as pdf:
        total = len(pdf.pages)
        start = max(args.start_page, 1)
        end = min(args.end_page or total, total)

        for index in range(start - 1, end):
            lines = lines_from_page(pdf.pages[index], args)
            if not lines:
                continue

            if args.keep_page_markers:
                story.append(Paragraph(f"Pagina original {index + 1}", page_marker))

            for block in paragraph_blocks(lines):
                style = heading if LAW_HEADING_RE.search(block) or block.isupper() else body
                story.append(Paragraph(block, style))

            if args.page_breaks:
                story.append(PageBreak())
            else:
                story.append(Spacer(1, 8))

    if story and isinstance(story[-1], PageBreak):
        story.pop()
    return story


def convert(input_pdf: Path, output_pdf: Path, args: argparse.Namespace) -> None:
    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(output_pdf),
        pagesize=A4,
        rightMargin=args.margin,
        leftMargin=args.margin,
        topMargin=args.margin,
        bottomMargin=args.margin,
        title=f"{input_pdf.stem} - uma coluna",
        author="Codex PDF converter",
    )
    story = make_story(input_pdf, args)
    if not story:
        raise RuntimeError("No extractable text was found in the selected pages.")
    doc.build(story)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert a multi-column PDF to a single-column PDF.")
    parser.add_argument("input_pdf", type=Path)
    parser.add_argument("output_pdf", type=Path)
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--end-page", type=int)
    parser.add_argument("--font-size", type=float, default=9.5)
    parser.add_argument("--leading", type=float, default=12)
    parser.add_argument("--margin", type=float, default=1.7 * cm)
    parser.add_argument("--top-margin", type=float, default=28)
    parser.add_argument("--bottom-margin", type=float, default=28)
    parser.add_argument("--gutter", type=float, default=12)
    parser.add_argument("--columns", type=int, choices=[1, 2, 3, 4], help="Force a fixed number of source columns.")
    parser.add_argument("--x-tolerance", type=float, default=2)
    parser.add_argument("--y-tolerance", type=float, default=3)
    parser.add_argument("--page-breaks", action="store_true", help="Keep one output page break per original page.")
    parser.add_argument("--keep-page-markers", action="store_true", help="Insert original page markers in the output.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    convert(args.input_pdf, args.output_pdf, args)


if __name__ == "__main__":
    main()
