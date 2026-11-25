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


STATUS_LABELS = {"new": "Yangi", "in_review": "Tekshiruvda", "confirmed": "Tasdiqlandi", "false_positive": "Yolg'on signal"}


def _provenance(meta: dict) -> list[str]:
    s1 = ", ".join(meta.get("scenes_t1", [])) or meta.get("period_t1", "-")
    s2 = ", ".join(meta.get("scenes_t2", [])) or meta.get("period_t2", "-")
    return [
        f"- Aniqlash (model): Sentinel-2 L2A, 10 m. T1 suratlari: {s1}. T2 suratlari: {s2}.",
        "- Vizual tekshiruv: Esri World Imagery Wayback (~0.5 m), 2023-08 va 2025-09 nashrlari. "
        "Model bu suratlardan foydalanmagan; ular faqat mustaqil ko'rish uchun.",
        "- Maydon va boshlanish oyi taxminiy (10 m piksellar, bulutli oylar).",
        "- Zonalar: OpenStreetMap; himoya kengliklari taxminiy, rasmiy chegaralar emas.",
        "- Ruxsatnoma reyestri: ma'lumot yo'q (ulanmagan).",
    ]


def build_pdf(alert: dict, data_dir: Path, is_mock: bool, audit: list[dict] | None = None, meta: dict | None = None) -> bytes:
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
        ("O'zgarish signali", f"{alert['confidence'] * 100:.0f}% (evristik ball, ehtimollik emas)"),
        ("Xavf balli", f"{alert['risk_score']:.0f} / 100"),
        ("Holat", STATUS_LABELS.get(alert.get("status", "new"), alert.get("status", "new"))),
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
        f"Xavf = 100 x signal {r['confidence']:.2f} x zona {r['zone_weight']:.2f} "
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

    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "Dalil manbalari", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    for line in _provenance(meta or {}):
        pdf.multi_cell(0, 5, _ascii(line), new_x="LMARGIN", new_y="NEXT")

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


# ---------------------------------------------------------------- area summary (district or whole city)

def _footer(pdf: FPDF, label: str) -> None:
    pdf.set_y(-12)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(140, 140, 140)
    pdf.cell(0, 5, _ascii(f"SiteSentinel - {label}"), align="L")
    pdf.cell(0, 5, f"{pdf.page_no()}", align="R")
    pdf.set_text_color(0, 0, 0)


class _SummaryPDF(FPDF):
    label = ""

    def footer(self) -> None:  # noqa: D401 - fpdf hook
        _footer(self, self.label)


def _table(pdf: FPDF, head: list[str], widths: list[float], rows: list[list[str]], align: list[str]) -> None:
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_fill_color(236, 240, 246)
    for h, w, a in zip(head, widths, align):
        pdf.cell(w, 6, _ascii(h), border=0, fill=True, align=a)
    pdf.ln()
    pdf.set_font("Helvetica", "", 8)
    for i, r in enumerate(rows):
        if pdf.get_y() > 275:
            pdf.add_page()
        fill = i % 2 == 1
        pdf.set_fill_color(248, 250, 252)
        for v, w, a in zip(r, widths, align):
            pdf.cell(w, 5.5, _ascii(str(v))[:60], border=0, fill=fill, align=a)
        pdf.ln()


def build_summary_pdf(items: list[dict], meta: dict, data_dir: Path, district: str | None, generated: str) -> bytes:
    """Area report for a district (or the whole city): totals, breakdowns, priority list with imagery."""
    is_mock = bool(meta.get("is_mock"))
    region = meta.get("region", "Toshkent")
    scope = f"{district} tumani" if district else f"{region} shahri"
    pdf = _SummaryPDF(format="A4")
    pdf.label = f"Hudud hisoboti: {scope}"
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(8, 145, 178)
    pdf.cell(0, 5, "SiteSentinel", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "B", 17)
    pdf.cell(0, 10, _ascii(f"Hudud hisoboti: {scope}"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(110, 110, 110)
    pdf.cell(0, 5, _ascii(f"Davr: {meta.get('period_t1', '-')} -> {meta.get('period_t2', '-')}   |   Tuzilgan: {generated}"),
             new_x="LMARGIN", new_y="NEXT")
    pdf.multi_cell(0, 4.5, _ascii(
        "Avtomatik sun'iy yo'ldosh monitoringi natijalari. Ro'yxatdagi ob'ektlar noqonuniy deb topilmagan: "
        "har biri joyida vakolatli inspektor tekshiruvini talab qiladi."
    ), new_x="LMARGIN", new_y="NEXT")
    if is_mock:
        pdf.set_text_color(200, 60, 60)
        pdf.cell(0, 6, "DEMO: sintetik ma'lumot", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(3)

    n = len(items)
    area_ha = sum(a["area_m2"] for a in items) / 10_000
    restricted = [a for a in items if a.get("zones")]
    high = [a for a in items if a["risk_score"] >= 60]
    by_status = {s: sum(a.get("status", "new") == s for a in items) for s in STATUS_LABELS}

    # KPI tiles
    tiles = [
        ("Ogohlantirishlar", f"{n}"),
        ("Maydon, ga", f"{area_ha:,.1f}"),
        ("Cheklangan zonada", f"{len(restricted)} ({(len(restricted) / n * 100) if n else 0:.0f}%)"),
        ("Yuqori xavf (>=60)", f"{len(high)}"),
    ]
    x0, y0, w = pdf.l_margin, pdf.get_y(), (pdf.w - pdf.l_margin - pdf.r_margin - 9) / 4
    for i, (k, v) in enumerate(tiles):
        x = x0 + i * (w + 3)
        pdf.set_fill_color(240, 249, 252)
        pdf.rect(x, y0, w, 18, style="F")
        pdf.set_xy(x + 3, y0 + 2.5)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(w - 6, 4, _ascii(k))
        pdf.set_xy(x + 3, y0 + 8)
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(w - 6, 7, _ascii(v))
    pdf.set_text_color(0, 0, 0)
    pdf.set_y(y0 + 22)

    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(0, 5, _ascii("Inspektor holati: " + ", ".join(f"{STATUS_LABELS[s]} {c}" for s, c in by_status.items())),
                   new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    if not district:
        acc: dict[str, list] = {}
        for a in items:
            r = acc.setdefault(a["district"], [0, 0.0, 0, 0, 0])
            r[0] += 1
            r[1] += a["area_m2"] / 10_000
            r[2] += bool(a.get("zones"))
            r[3] += a["risk_score"] >= 60
            r[4] += a.get("status") == "confirmed"
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 7, "Tumanlar kesimida", new_x="LMARGIN", new_y="NEXT")
        _table(pdf, ["Tuman", "Soni", "Maydon, ga", "Cheklangan zonada", "Yuqori xavf", "Tasdiqlangan"],
               [52, 20, 28, 34, 28, 28],
               [[d, r[0], f"{r[1]:.1f}", r[2], r[3], r[4]] for d, r in sorted(acc.items(), key=lambda kv: -kv[1][0])],
               ["L", "R", "R", "R", "R", "R"])
        pdf.ln(3)

    zc = {z: sum(z in a.get("zones", []) for a in items) for z in ZONE_LABELS}
    zc = {z: c for z, c in sorted(zc.items(), key=lambda kv: -kv[1]) if c}
    if zc:
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 7, "Cheklangan zonalar", new_x="LMARGIN", new_y="NEXT")
        _table(pdf, ["Zona", "Ob'ektlar"], [90, 25], [[ZONE_LABELS[z], c] for z, c in zc.items()], ["L", "R"])
        pdf.ln(3)

    top = sorted(items, key=lambda a: (-a["risk_score"], -a["area_m2"]))[:20]
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, _ascii(f"Birinchi navbatda tekshirish ({len(top)} ta)"), new_x="LMARGIN", new_y="NEXT")
    _table(pdf, ["ID", "Tuman", "Maydon, m2", "Xavf", "Zonalar", "Holat"], [30, 30, 24, 14, 60, 32],
           [[a["alert_id"], a["district"], f"{a['area_m2']:,.0f}", f"{a['risk_score']:.0f}",
             ", ".join(ZONE_LABELS.get(z, z).split(" ")[0] for z in a.get("zones", [])) or "-",
             STATUS_LABELS.get(a.get("status", "new"), "-")] for a in top],
           ["L", "L", "R", "R", "L", "L"])

    # imagery for the three highest-priority sites
    shown = [a for a in top if (data_dir / (a.get("chip_before") or "_")).is_file() and (data_dir / (a.get("chip_after") or "_")).is_file()][:3]
    if shown:
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 11)
        pdf.cell(0, 7, "Eng ustuvor ob'ektlar: oldin / keyin", new_x="LMARGIN", new_y="NEXT")
        for a in shown:
            if pdf.get_y() > 200:
                pdf.add_page()
            y = pdf.get_y() + 1
            pdf.set_font("Helvetica", "B", 9)
            pdf.text(10, y + 3, _ascii(f"{a['alert_id']}  |  {a['district']}  |  ~{a['area_m2']:,.0f} m2  |  xavf {a['risk_score']:.0f}"))
            pdf.image(str(data_dir / a["chip_before"]), x=10, y=y + 5, w=60)
            pdf.image(str(data_dir / a["chip_after"]), x=74, y=y + 5, w=60)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_xy(138, y + 6)
            pdf.multi_cell(62, 4, _ascii(
                f"Oldin (chap) va keyin (o'ng).\nTuri: {CHANGE_LABELS.get(a['change_type'], a['change_type'])}.\n"
                f"Boshlanish: ~{a.get('start_month') or '-'}.\n"
                f"Koordinata: {a['lat']:.5f}, {a['lon']:.5f}."
            ))
            pdf.set_y(y + 70)

    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "Usul va dalil manbalari", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8.5)
    for line in [
        "- Xavf balli = 100 x o'zgarish signali x zona og'irligi x maydon omili x ruxsatnoma omili. Bu ustuvorlik balli, ehtimollik emas.",
        *_provenance(meta),
        "- Model aniqligi alohida tekshiruv namunasida baholanadi (\"Model aniqligi\" sahifasi).",
    ]:
        pdf.multi_cell(0, 4.5, _ascii(line), new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())
