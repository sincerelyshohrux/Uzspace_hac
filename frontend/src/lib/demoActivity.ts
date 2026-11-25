// Labelled demo workflow: a few inspector actions by "demo.*" users, so empty workflow screens can be
// shown in a presentation. It never touches model metrics, and it can be removed in one click.
import type { Alert, Status } from "@/api/types";

export interface DemoRow { alert_id: string; new_status: Status; note: string | null; user: string; ts: string }

const USERS = ["demo.aziza", "demo.bekzod", "demo.dilnoza", "demo.jasur"];
const NOTES: Partial<Record<Status, string[]>> = {
  in_review: ["[DEMO] Joyga chiqish rejalashtirildi", "[DEMO] Kadastr ma'lumoti so'raldi"],
  confirmed: ["[DEMO] Joyida tekshirildi: ruxsatnoma topilmadi", "[DEMO] Hokimiyatga xat yuborildi"],
  false_positive: ["[DEMO] Ruxsatnoma mavjud", "[DEMO] Mavsumiy o'zgarish (dala)"],
};

/** Deterministic: the same alerts always get the same demo story. */
export function buildDemoActivity(alerts: Alert[], now = Date.now()): DemoRow[] {
  const top = [...alerts].sort((a, b) => b.risk_score - a.risk_score);
  const rows: DemoRow[] = [];
  const day = 86_400_000;
  const midnight = new Date(now);
  midnight.setUTCHours(0, 0, 0, 0);
  // h is Tashkent working time (UTC+5); minutes vary a little so entries look hand-made
  const at = (daysAgo: number, h: number) =>
    new Date(midnight.getTime() - daysAgo * day + (h - 5) * 3_600_000 + ((daysAgo * 17 + h * 7) % 50) * 60_000).toISOString().replace(/\.\d+Z$/, "Z");
  const push = (a: Alert, s: Status, u: number, daysAgo: number, h: number, n: number) =>
    rows.push({ alert_id: a.alert_id, new_status: s, note: NOTES[s]?.[n % (NOTES[s]?.length ?? 1)] ?? null, user: USERS[u % USERS.length], ts: at(daysAgo, h) });

  // 6 highest: reviewed, then confirmed on site
  top.slice(0, 6).forEach((a, i) => {
    push(a, "in_review", i, 20 - i * 2, 9 + i, i);
    push(a, "confirmed", i, 16 - i * 2, 15, i);
  });
  // next 10: currently being reviewed
  top.slice(6, 16).forEach((a, i) => push(a, "in_review", i + 1, 9 - (i % 8), 10 + (i % 6), i));
  // 4 mid-risk ones closed as false positives
  top.filter((a) => a.risk_score < 60).slice(0, 4).forEach((a, i) => {
    push(a, "in_review", i + 2, 12 - i, 11, i);
    push(a, "false_positive", i + 2, 10 - i, 16, i);
  });
  return rows.sort((a, b) => a.ts.localeCompare(b.ts));
}

export const isDemoUser = (u: string | null | undefined) => !!u && u.startsWith("demo.");
