from __future__ import annotations
import io
import json
from pathlib import Path
from fastapi.testclient import TestClient
from PIL import Image
import backend.main as main


def setup_client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "test.db")
    main.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    main.init_db()
    return TestClient(main.app)


def test_health_and_role_scoping(tmp_path, monkeypatch):
    with setup_client(tmp_path, monkeypatch) as client:
        assert client.get("/api/health").json()["ok"] is True
        citizen = client.get("/api/bootstrap", params={"role":"Citizen", "reporter_id":"cid-1"}).json()
        admin = client.get("/api/bootstrap", params={"role":"Administrator", "reporter_id":"cid-1"}).json()
        assert citizen["issues"] == []
        assert len(admin["issues"]) >= 1


def test_report_creation_admin_assignment_and_citizen_status_refresh(tmp_path, monkeypatch):
    with setup_client(tmp_path, monkeypatch) as client:
        payload = {
            "id": "UE-TEST-001", "category": "Pothole", "severity": "High",
            "title": "Test pothole", "description": "Test issue", "location": "Sector 1, Ghaziabad",
            "lat": 28.62, "lng": 77.37, "reported": "2026-10-11", "sla": "8h", "priority": 90,
            "contactId": "mcd-ccr", "evidenceName": "test.png"
        }
        image = Image.new("RGB", (40, 40), (120, 120, 120))
        buffer = io.BytesIO(); image.save(buffer, format="PNG"); buffer.seek(0)
        response = client.post("/api/issues", headers={"X-UE-Role":"Citizen", "X-UE-Reporter-ID":"cid-1"},
                               data={"issue": json.dumps(payload)}, files={"evidence": ("test.png", buffer.getvalue(), "image/png")})
        assert response.status_code == 200, response.text
        created = response.json()["issue"]
        assert created["status"] == "Not assigned"
        assert created["evidenceUrl"].startswith("/uploads/")
        citizen = client.get("/api/bootstrap", params={"role":"Citizen", "reporter_id":"cid-1"}).json()
        assert citizen["issues"][0]["id"] == "UE-TEST-001"
        assert client.put("/api/issues/UE-TEST-001", headers={"X-UE-Role":"Citizen"}, json={"status":"Completed"}).status_code == 403
        assign = client.put("/api/issues/UE-TEST-001", headers={"X-UE-Role":"Administrator"},
                            json={"status":"Assigned", "assignedDepartment":"Roads & Engineering", "assignedOfficer":"Field Team 1", "dispatchStatus":"Assigned"})
        assert assign.status_code == 200, assign.text
        updated_citizen = client.get("/api/bootstrap", params={"role":"Citizen", "reporter_id":"cid-1"}).json()
        assert updated_citizen["issues"][0]["status"] == "Assigned"
        assert client.get(created["evidenceUrl"]).status_code == 200


def test_assignment_requires_department(tmp_path, monkeypatch):
    with setup_client(tmp_path, monkeypatch) as client:
        response = client.put("/api/issues/UE-26084", headers={"X-UE-Role":"Administrator"}, json={"status":"Assigned"})
        assert response.status_code == 400


def test_frontend_assets_and_honest_manual_inference_fallback(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "MODEL_PATH", tmp_path / "no-trained-weights.pt")
    monkeypatch.setattr(main, "_yolo_model", None)
    monkeypatch.setattr(main, "_yolo_model_error", "")
    with setup_client(tmp_path, monkeypatch) as client:
        page = client.get("/")
        script = client.get("/static/app.js")
        assert page.status_code == 200 and "URBAN-EYES" in page.text
        assert script.status_code == 200 and "requestInference" in script.text

        image = Image.new("RGB", (32, 32), (40, 40, 40))
        buffer = io.BytesIO(); image.save(buffer, format="PNG"); buffer.seek(0)
        response = client.post("/api/inference", headers={"X-UE-Role":"Citizen"},
                               files={"file": ("sample.png", buffer.getvalue(), "image/png")})
        assert response.status_code == 200, response.text
        result = response.json()
        assert result["detected"] is False
        assert result["mode"] == "manual_fallback"
        assert "manual" in result["message"].lower() or "weights" in result["message"].lower()


def test_frontend_state_save_path_updates_the_citizen_status(tmp_path, monkeypatch):
    with setup_client(tmp_path, monkeypatch) as client:
        payload = {
            "id": "UE-STATE-001", "category": "Pothole", "severity": "High",
            "title": "Pothole from UI save flow", "description": "State endpoint integration test",
            "location": "Sector 2, Ghaziabad", "lat": 28.62, "lng": 77.37,
            "reported": "2026-10-11", "sla": "8h", "priority": 90
        }
        image = Image.new("RGB", (20, 20), (80, 80, 80))
        buffer = io.BytesIO(); image.save(buffer, format="PNG"); buffer.seek(0)
        created = client.post("/api/issues", headers={"X-UE-Role":"Citizen", "X-UE-Reporter-ID":"state-citizen"},
                              data={"issue": json.dumps(payload)}, files={"evidence": ("sample.png", buffer.getvalue(), "image/png")})
        assert created.status_code == 200, created.text

        admin_bootstrap = client.get("/api/bootstrap", params={"role":"Administrator"}).json()
        issues = admin_bootstrap["issues"]
        item = next(row for row in issues if row["id"] == "UE-STATE-001")
        item["status"] = "Assigned"
        item["assignedDepartment"] = "Roads & Engineering"
        item["assignedOfficer"] = "Team A"
        tickets = admin_bootstrap["tickets"]
        ticket = next(row for row in tickets if row["id"] == "UE-STATE-001")
        ticket["status"] = "Assigned"
        ticket["team"] = "Team A"
        saved = client.put("/api/state", headers={"X-UE-Role":"Administrator", "Content-Type":"application/json"},
                           json={"issues": issues, "tickets": tickets, "activity": admin_bootstrap["activity"]})
        assert saved.status_code == 200, saved.text
        citizen = client.get("/api/bootstrap", params={"role":"Citizen", "reporter_id":"state-citizen"}).json()
        assert citizen["issues"][0]["status"] == "Assigned"
        assert citizen["issues"][0]["assignedDepartment"] == "Roads & Engineering"
