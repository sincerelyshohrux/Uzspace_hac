def test_health(client):
    r = client.get("/api/health").json()
    assert r["status"] == "ok" and r["data_loaded"] and r["alerts"] == 30


def test_list_sorted_by_risk(client):
    items = client.get("/api/alerts").json()["items"]
    scores = [a["risk_score"] for a in items]
    assert scores == sorted(scores, reverse=True)


def test_filters(client):
    all_items = client.get("/api/alerts").json()["items"]
    d = all_items[0]["district"]
    r = client.get("/api/alerts", params={"district": d}).json()
    assert r["total"] > 0 and all(a["district"] == d for a in r["items"])
    r = client.get("/api/alerts", params={"min_risk": 50}).json()
    assert all(a["risk_score"] >= 50 for a in r["items"])
    r = client.get("/api/alerts", params={"zone": "any_restricted"}).json()
    assert all(a["zones"] for a in r["items"])
    r = client.get("/api/alerts", params={"q": "0001"}).json()
    assert r["total"] == 1
    a = all_items[0]
    bbox = f"{a['lon'] - 1e-4},{a['lat'] - 1e-4},{a['lon'] + 1e-4},{a['lat'] + 1e-4}"
    assert a["alert_id"] in [x["alert_id"] for x in client.get("/api/alerts", params={"bbox": bbox}).json()["items"]]
    assert client.get("/api/alerts", params={"bbox": "bad"}).status_code == 422


def test_404(client):
    assert client.get("/api/alerts/NOPE").status_code == 404
    assert client.patch("/api/alerts/NOPE", json={"status": "confirmed"}).status_code == 404


def test_patch_and_audit(client):
    aid = client.get("/api/alerts", params={"status": "new"}).json()["items"][0]["alert_id"]
    r = client.patch(f"/api/alerts/{aid}", json={"status": "in_review", "note": "test", "user": "pytest"})
    assert r.status_code == 200 and r.json()["status"] == "in_review" and r.json()["note"] == "test"
    audit = client.get(f"/api/alerts/{aid}/audit").json()
    assert audit[0]["new_status"] == "in_review" and audit[0]["old_status"] == "new" and audit[0]["user"] == "pytest"
    assert client.patch(f"/api/alerts/{aid}", json={"status": "bogus"}).status_code == 422
    insp = {i["user"]: i for i in client.get("/api/stats/inspectors").json()}
    assert insp["pytest"]["reviewed"] == 1


def test_pdf_csv_timeseries(client):
    aid = client.get("/api/alerts").json()["items"][0]["alert_id"]
    r = client.get(f"/api/alerts/{aid}/report.pdf")
    assert r.status_code == 200 and r.content.startswith(b"%PDF")
    csv = client.get("/api/export.csv").text
    assert csv.lstrip("﻿").startswith("alert_id,district")
    ts = client.get(f"/api/alerts/{aid}/timeseries").json()
    assert len(ts) == 36


def test_stats_consistent(client):
    s = client.get("/api/stats/summary").json()
    assert s["total"] == 30
    assert sum(d["count"] for d in client.get("/api/stats/districts").json()) == 30
    assert s["confirmed"] + s["false_positive"] + s["pending"] == 30


def test_layers_and_static(client):
    assert client.get("/api/layers/zones").json()["features"]
    assert len(client.get("/api/layers/districts").json()["features"]) == 12
    a = client.get("/api/alerts").json()["items"][0]
    assert client.get(f"/static/{a['chip_before']}").status_code == 200
    assert client.get("/static/test.db").status_code == 404
