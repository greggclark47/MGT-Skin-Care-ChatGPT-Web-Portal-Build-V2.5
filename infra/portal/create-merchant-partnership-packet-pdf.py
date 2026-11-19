from __future__ import annotations

import re
import unicodedata
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs" / "production" / "MERCHANT-PARTNERSHIP-OUTREACH-PACKET.md"
OUTPUT = ROOT / "output" / "pdf" / "MGT-Merchant-Feature-and-Omni-Retail-Outreach-Packet-2026-11-03.pdf"


def clean(text: str) -> str:
    text = text.strip()
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", text)
    text = text.replace("&", "&amp;")
    text = text.replace("<b>", "__BOLD_OPEN__").replace("</b>", "__BOLD_CLOSE__")
    text = text.replace("<", "&lt;").replace(">", "&gt;")
    return text.replace("__BOLD_OPEN__", "<b>").replace("__BOLD_CLOSE__", "</b>")


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = letter
    canvas.setStrokeColor(colors.HexColor("#6C4AA0"))
    canvas.setLineWidth(0.7)
    canvas.line(doc.leftMargin, height - 0.53 * inch, width - doc.rightMargin, height - 0.53 * inch)
    canvas.setFillColor(colors.HexColor("#302442"))
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(doc.leftMargin, height - 0.38 * inch, "MGT SKIN CARE")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(width - doc.rightMargin, height - 0.38 * inch, "Merchant feature and omni-retail outreach packet")
    canvas.setStrokeColor(colors.HexColor("#D2C5DE"))
    canvas.line(doc.leftMargin, 0.48 * inch, width - doc.rightMargin, 0.48 * inch)
    canvas.setFillColor(colors.HexColor("#665A71"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(doc.leftMargin, 0.32 * inch, "Working outreach packet - legal, privacy, commercial, and brand review required")
    canvas.drawRightString(width - doc.rightMargin, 0.32 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_pdf() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("PacketTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, leading=27, textColor=colors.HexColor("#2C1A42"), spaceAfter=11, alignment=TA_LEFT)
    subtitle = ParagraphStyle("PacketSubtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=10, leading=14, textColor=colors.HexColor("#665A71"), spaceAfter=18)
    h1 = ParagraphStyle("Section", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=colors.HexColor("#4A2875"), spaceBefore=15, spaceAfter=7)
    h2 = ParagraphStyle("Subsection", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=colors.HexColor("#302442"), spaceBefore=10, spaceAfter=5)
    body = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.4, leading=14, textColor=colors.HexColor("#29232F"), spaceAfter=7)
    bullet = ParagraphStyle("Bullet", parent=body, leftIndent=14, firstLineIndent=-10, bulletIndent=2, spaceAfter=3)
    numbered = ParagraphStyle("Numbered", parent=body, leftIndent=18, firstLineIndent=-14, bulletIndent=1, spaceAfter=3)
    callout = ParagraphStyle("Callout", parent=body, backColor=colors.HexColor("#F2EDF8"), borderColor=colors.HexColor("#BBA2D4"), borderWidth=0.6, borderPadding=9, spaceBefore=4, spaceAfter=12)

    frame = Frame(0.72 * inch, 0.68 * inch, letter[0] - 1.44 * inch, letter[1] - 1.36 * inch, id="body")
    document = BaseDocTemplate(str(OUTPUT), pagesize=letter, leftMargin=0.72 * inch, rightMargin=0.72 * inch, topMargin=0.73 * inch, bottomMargin=0.68 * inch)
    document.addPageTemplates([PageTemplate(id="packet", frames=[frame], onPage=header_footer)])

    story = []
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    for raw in lines:
        line = raw.strip()
        if not line:
            story.append(Spacer(1, 3))
            continue
        if line.startswith("# "):
            story.append(Paragraph(clean(line[2:]), title))
            story.append(Paragraph("Merchant authorization, direct-link commerce, transparent placement, and aggregate-only reporting", subtitle))
            continue
        if line.startswith("## "):
            story.append(Paragraph(clean(line[3:]), h1))
            continue
        if line.startswith("### "):
            story.append(Paragraph(clean(line[4:]), h2))
            continue
        if line.startswith("- [ ] "):
            story.append(Paragraph("[ ] " + clean(line[6:]), bullet))
            continue
        if line.startswith("- "):
            story.append(Paragraph("- " + clean(line[2:]), bullet))
            continue
        match = re.match(r"^(\d+)\.\s+(.*)$", line)
        if match:
            story.append(Paragraph(match.group(1) + ". " + clean(match.group(2)), numbered))
            continue
        if line.startswith("Prepared:") or line.startswith("Status:"):
            story.append(Paragraph(clean(line), subtitle))
            continue
        style = callout if line.startswith("This is not a signed agreement") else body
        story.append(Paragraph(clean(line), style))

    document.build(story)


if __name__ == "__main__":
    build_pdf()
