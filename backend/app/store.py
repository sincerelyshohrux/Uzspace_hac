"""Data layer.

Pipeline outputs (alerts.geojson etc.) are read-only and kept in memory.
Inspector changes (status, comment, audit log) are stored in SQLite.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

HIGH_RISK = 60.0
RESTRICTED_ZONES = {"canal", "river", "power_line", "railway", "park", "cemetery", "farmland"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, data_dir: Path, db_path: Path):
        self.data_dir = data_dir
        self.db_path = db_path
        self._lock = threading.Lock()
        self.reload()
        self._init_db()

    def _read_json(self, name: str, default: Any) -> Any:
        p = self.data_dir / name
        if not p.exists():
            return default
        return json.loads(p.read_text(encoding="utf-8"))

    def reload(self) -> None:
        fc = self._read_json("alerts.geojson", {"type": "FeatureCollection", "features": []})
        self.alerts: dict[str, dict] = {}
        for f in fc.get("features", []):
            props = dict(f["properties"])
            props["geometry"] = f["geometry"]
            self.alerts[props["alert_id"]] = props
        self.timeseries: dict[str, list[dict]] = self._read_json("timeseries.json", {})
        self.metrics: dict = self._read_json("metrics.json", {})
        self.meta: dict = self._read_json("meta.json", {})
        self.zones: dict = self._read_json("zones.geojson", {"type": "FeatureCollection", "features": []})
        self.districts: dict = self._read_json("districts.geojson", {"type": "FeatureCollection", "features": []})

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _init_db(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as c:
            c.executescript(
                """
                CREATE TABLE IF NOT EXISTS alert_status (
                    alert_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    note TEXT,
                    updated_at TEXT NOT NULL,
                    user TEXT
                );
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    alert_id TEXT NOT NULL,
                    old_status TEXT,
                    new_status TEXT NOT NULL,
                    note TEXT,
                    user TEXT NOT NULL,
                    ts TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_audit_alert ON audit_log(alert_id);
                """
            )
            empty = c.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0] == 0
        if empty and self.meta.get("is_mock"):
            self._seed_demo_activity()

    def _seed_demo_activity(self) -> None:
        """Demo mode only: pre-fill a few inspector actions so statistics are not empty."""
        rows = self._read_json("demo_activity.json", [])
        with self._lock, self._conn() as c:
            for r in rows:
                if r["alert_id"] not in self.alerts:
                    continue
                c.execute(
                    "INSERT INTO audit_log(alert_id, old_status, new_status, note, user, ts) VALUES(?,?,?,?,?,?)",
                    (r["alert_id"], r["old_status"], r["new_status"], r["note"], r["user"], r["ts"]),
                )
                c.execute(
                    "INSERT INTO alert_status(alert_id, status, note, updated_at, user) VALUES(?,?,?,?,?) "
                    "ON CONFLICT(alert_id) DO UPDATE SET status=excluded.status, note=excluded.note, "
                    "updated_at=excluded.updated_at, user=excluded.user",
                    (r["alert_id"], r["new_status"], r["note"], r["ts"], r["user"]),
                )

    def reset_activity(self) -> None:
        with self._lock, self._conn() as c:
            c.execute("DELETE FROM audit_log")
            c.execute("DELETE FROM alert_status")
        if self.meta.get("is_mock"):
            self._seed_demo_activity()

    # ---- Labelled demo activity (users "demo.*"), so empty workflow screens can be shown and then removed
    DEMO_PREFIX = "demo."

    def demo_count(self) -> int:
        with self._conn() as c:
            return c.execute("SELECT COUNT(*) FROM audit_log WHERE user LIKE 'demo.%'").fetchone()[0]

    def demo_seed(self, rows: list[dict]) -> int:
        """Insert demo audit rows (oldest first). Only users starting with "demo." are accepted."""
        n = 0
        with self._lock, self._conn() as c:
            for r in sorted(rows, key=lambda r: r["ts"]):
                if r["alert_id"] not in self.alerts or not str(r["user"]).startswith(self.DEMO_PREFIX):
                    continue
                cur = c.execute("SELECT status FROM alert_status WHERE alert_id=?", (r["alert_id"],)).fetchone()
                c.execute(
                    "INSERT INTO audit_log(alert_id, old_status, new_status, note, user, ts) VALUES(?,?,?,?,?,?)",
                    (r["alert_id"], cur["status"] if cur else "new", r["new_status"], r.get("note"), r["user"], r["ts"]),
                )
                c.execute(
                    "INSERT INTO alert_status(alert_id, status, note, updated_at, user) VALUES(?,?,?,?,?) "
                    "ON CONFLICT(alert_id) DO UPDATE SET status=excluded.status, note=excluded.note, "
                    "updated_at=excluded.updated_at, user=excluded.user",
                    (r["alert_id"], r["new_status"], r.get("note"), r["ts"], r["user"]),
                )
                n += 1
        return n

    def demo_clear(self) -> int:
        """Remove demo rows; each touched alert falls back to its last real action (or "new")."""
        with self._lock, self._conn() as c:
            ids = [r[0] for r in c.execute("SELECT DISTINCT alert_id FROM audit_log WHERE user LIKE 'demo.%'")]
            n = c.execute("DELETE FROM audit_log WHERE user LIKE 'demo.%'").rowcount
            for aid in ids:
                last = c.execute(
                    "SELECT new_status, note, ts, user FROM audit_log WHERE alert_id=? ORDER BY id DESC LIMIT 1", (aid,)
                ).fetchone()
                if last is None:
                    c.execute("DELETE FROM alert_status WHERE alert_id=?", (aid,))
                else:
                    c.execute(
                        "UPDATE alert_status SET status=?, note=?, updated_at=?, user=? WHERE alert_id=?",
                        (last["new_status"], last["note"], last["ts"], last["user"], aid),
                    )
        return n

    def _statuses(self) -> dict[str, sqlite3.Row]:
        with self._conn() as c:
            return {r["alert_id"]: r for r in c.execute("SELECT * FROM alert_status")}

    def _merge(self, a: dict, st: Optional[sqlite3.Row]) -> dict:
        out = dict(a)
        if st is not None:
            out["status"] = st["status"]
            out["note"] = st["note"]
            out["updated_at"] = st["updated_at"]
        else:
            out.setdefault("status", "new")
        return out

    def all_alerts(self) -> list[dict]:
        st = self._statuses()
        return [self._merge(a, st.get(k)) for k, a in self.alerts.items()]

    def get(self, alert_id: str) -> Optional[dict]:
        a = self.alerts.get(alert_id)
        if a is None:
            return None
        with self._conn() as c:
            st = c.execute("SELECT * FROM alert_status WHERE alert_id=?", (alert_id,)).fetchone()
        return self._merge(a, st)

    def update(self, alert_id: str, status: str, note: Optional[str], user: str) -> Optional[dict]:
        current = self.get(alert_id)
        if current is None:
            return None
        ts = _now()
        with self._lock, self._conn() as c:
            c.execute(
                "INSERT INTO alert_status(alert_id, status, note, updated_at, user) VALUES(?,?,?,?,?) "
                "ON CONFLICT(alert_id) DO UPDATE SET status=excluded.status, note=excluded.note, "
                "updated_at=excluded.updated_at, user=excluded.user",
                (alert_id, status, note, ts, user),
            )
            c.execute(
                "INSERT INTO audit_log(alert_id, old_status, new_status, note, user, ts) VALUES(?,?,?,?,?,?)",
                (alert_id, current.get("status"), status, note, user, ts),
            )
        return self.get(alert_id)

    def audit(self, alert_id: str) -> list[dict]:
        with self._conn() as c:
            rows = c.execute(
                "SELECT * FROM audit_log WHERE alert_id=? ORDER BY id DESC", (alert_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def inspectors(self) -> list[dict]:
        with self._conn() as c:
            rows = c.execute(
                """
                SELECT user,
                       COUNT(DISTINCT alert_id) AS reviewed,
                       SUM(new_status = 'confirmed') AS confirmed,
                       SUM(new_status = 'false_positive') AS false_positive,
                       MAX(ts) AS last_action
                FROM audit_log GROUP BY user ORDER BY reviewed DESC, user
                """
            ).fetchall()
        return [dict(r) for r in rows]

    def query(
        self,
        district: Optional[str] = None,
        zone: Optional[str] = None,
        min_risk: float = 0.0,
        status: Optional[str] = None,
        change_type: Optional[str] = None,
        bbox: Optional[tuple[float, float, float, float]] = None,
        q: Optional[str] = None,
        sort: str = "-risk_score",
    ) -> list[dict]:
        items = self.all_alerts()

        def ok(a: dict) -> bool:
            if district and a["district"] != district:
                return False
            if zone:
                if zone == "any_restricted":
                    if not RESTRICTED_ZONES.intersection(a.get("zones", [])):
                        return False
                elif zone not in a.get("zones", []):
                    return False
            if a["risk_score"] < min_risk:
                return False
            if status and a.get("status") != status:
                return False
            if change_type and a["change_type"] != change_type:
                return False
            if bbox:
                w, s, e, n = bbox
                if not (w <= a["lon"] <= e and s <= a["lat"] <= n):
                    return False
            if q and q.lower() not in a["alert_id"].lower() and q.lower() not in a["district"].lower():
                return False
            return True

        items = [a for a in items if ok(a)]
        key = sort.lstrip("-")
        if items and key in items[0]:
            items.sort(key=lambda a: (a.get(key) is None, a.get(key)), reverse=sort.startswith("-"))
        return items

    @staticmethod
    def is_restricted(a: dict) -> bool:
        return bool(RESTRICTED_ZONES.intersection(a.get("zones", [])))
