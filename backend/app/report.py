"""One-page PDF report for a single alert, for field inspectors."""
from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

ZONE_LABELS = {
    "canal": "Kanal muhofaza zonasi",
    "river": "Daryo muhofaza zonasi",
    "power_line": "Elektr liniyasi qo'riqlash zonasi",
    "railway": "Temir yo'l zonasi",
    "park": "Bog' / yashil hudud",
    "cemetery": "Qabriston",
    "farmland": "Qishloq xo'jaligi yeri",
}
CHANGE_LABELS = {
    "new_construction": "Yangi qurilish",
    "land_clearing": "Yer tozalash (qurilish boshlanishi mumkin)",
    "demolition": "Buzilish",
}
PERMIT_LABELS = {
    "none": "Ruxsatnoma topilmadi",
    "matched": "Ruxsatnoma bilan mos",
    "partial": "Ruxsatnoma bilan qisman mos",
    "no_data": "Ruxsatnoma tekshirilmadi",
}


def _ascii(text: str) -> str:
    """fpdf2 core fonts support latin-1 only."""
    return (
        text.replace("‘", "'").replace("’", "'").replace("ʻ", "'")
        .replace("ʼ", "'").replace("–", "-").replace("—", "-")
        .encode("latin-1", "replace").decode("latin-1")
    )


def build_pdf(alert: dict, data_dir: Path, is_mock: bool, audit: list[dict] | None = None) -> bytes:
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    if is_mock:
        pdf.set_font("Helvetica", "B", 60)
        pdf.set_text_color(245, 225, 225)
        with pdf.rotation(35, 105, 160):
            pdf.text(50, 170, "DEMO")
        pdf.set_text_color(0, 0, 0)

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(8, 145, 178)
    pdf.cell(0, 5, "SiteSentinel", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, _ascii(f"Ogohlantirish {alert['alert_id']}"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(120, 120, 120)
    pdf.multi_cell(0, 5, _ascii(
        "Avtomatik sun'iy yo'ldosh monitoringi natijasi. Bu noqonuniylik haqida xulosa emas: "
        "joyida vakolatli inspektor tekshiruvi talab qilinadi."
    ))
    if is_mock:
        pdf.set_text_color(200, 60, 60)
        pdf.cell(0, 6, "DEMO: sintetik ma'lumot", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(3)

    rows = [
        ("Tuman", alert["district"]),
        ("Koordinata", f"{alert['lat']:.6f}, {alert['lon']:.6f}"),
        ("Maydon", f"{alert['area_m2']:,.0f} m2"),
        ("O'zgarish turi", CHANGE_LABELS.get(alert["change_type"], alert["change_type"])),
        ("Taxminiy boshlanish", alert.get("start_month") or "-"),
        ("Zonalar", ", ".join(ZONE_LABELS.get(z, z) for z in alert.get("zones", [])) or "Cheklangan zona yo'q"),
        ("Ruxsatnoma", PERMIT_LABELS.get(alert["permit_match"], alert["permit_match"])),
        ("Model ishonchi", f"{alert['confidence'] * 100:.0f}%"),
        ("Xavf balli", f"{alert['risk_score']:.0f} / 100"),
        ("Holat", alert.get("status", "new")),
        ("Google Maps", f"https://www.google.com/maps?q={alert['lat']:.6f},{alert['lon']:.6f}"),
    ]
    for k, v in rows:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(45, 7, _ascii(k))
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 7, _ascii(str(v)), new_x="LMARGIN", new_y="NEXT")

    r = alert["risk"]
    pdf.ln(2)
    pdf.set_font("Helvetica", "I", 9)
    pdf.multi_cell(0, 5, _ascii(
        f"Xavf = 100 x ishonch {r['confidence']:.2f} x zona {r['zone_weight']:.2f} "
        f"x maydon {r['area_factor']:.2f} x ruxsatnoma {r['permit_factor']:.2f}"
    ))

    before = data_dir / (alert.get("chip_before") or "")
    after = data_dir / (alert.get("chip_after") or "")
    if before.is_file() and after.is_file():
        pdf.ln(4)
        y = pdf.get_y()
        pdf.set_font("Helvetica", "B", 10)
        pdf.text(10, y, "Oldin")
        pdf.text(110, y, "Keyin")
        pdf.image(str(before), x=10, y=y + 2, w=90)
        pdf.image(str(after), x=110, y=y + 2, w=90)
        pdf.set_y(y + 96)

    if alert.get("note"):
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, "Inspektor izohi", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 5, _ascii(alert["note"]), new_x="LMARGIN", new_y="NEXT")

    if audit:
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, "Harakatlar tarixi", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for e in audit[:15]:
            line = f"{e['ts'][:16].replace('T', ' ')}  {e['user']}: {e.get('old_status') or '-'} -> {e['new_status']}"
            if e.get("note"):
                line += f"  ({e['note']})"
            pdf.multi_cell(0, 5, _ascii(line), new_x="LMARGIN", new_y="NEXT")

    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(120, 120, 120)
    pdf.multi_cell(0, 4, _ascii("Avtomatik sun'iy yo'ldosh aniqlovi. Yakuniy qaror faqat joyida tekshiruvdan keyin qabul qilinadi."))

    return bytes(pdf.output())
