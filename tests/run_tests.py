#!/usr/bin/env python3
"""Standalone test runner for URBAN-EYES using standard python unittest and FastAPI TestClient."""
from __future__ import annotations
import io
import json
import shutil
import tempfile
import unittest
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from PIL import Image
import backend.main as main


class UrbanEyesApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.tmp_path = Path(self.tmp_dir)
        self.orig_db = main.DB_PATH
        self.orig_model = main.MODEL_PATH
        main.DB_PATH = self.tmp_path / "test.db"
        main.UPLOAD_DIR = self.tmp_path / "uploads"
        main.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        main.init_db()
        self.client = TestClient(main.app)

    def tearDown(self):
        main.DB_PATH = self.orig_db
        main.MODEL_PATH = self.orig_model
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_health_and_role_scoping(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["ok"])

        citizen = self.client.get("/api/bootstrap", params={"role": "Citizen", "reporter_id": "cid-1"}).json()
        admin = self.client.get("/api/bootstrap", params={"role": "Administrator", "reporter_id": "cid-1"}).json()
        self.assertEqual(citizen["issues"], [])
        self.assertGreaterEqual(len(admin["issues"]), 1)

    def test_report_creation_admin_assignment_and_citizen_refresh(self):
        payload = {
            "id": "UE-TEST-001", "category": "Pothole", "severity": "High",
            "title": "Test pothole", "description": "Test issue", "location": "Sector 1, Ghaziabad",
            "lat": 28.62, "lng": 77.37, "reported": "2026-10-11", "sla": "8h", "priority": 90,
            "contactId": "up-gnn", "evidenceName": "test.png"
        }
        image = Image.new("RGB", (40, 40), (120, 120, 120))
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        buffer.seek(0)

        response = self.client.post(
            "/api/issues",
            headers={"X-UE-Role": "Citizen", "X-UE-Reporter-ID": "cid-1"},
            data={"issue": json.dumps(payload)},
            files={"evidence": ("test.png", buffer.getvalue(), "image/png")}
        )
        self.assertEqual(response.status_code, 200, response.text)
        created = response.json()["issue"]
        self.assertEqual(created["status"], "Not assigned")
        self.assertTrue(created["evidenceUrl"].startswith("/uploads/"))

        citizen = self.client.get("/api/bootstrap", params={"role": "Citizen", "reporter_id": "cid-1"}).json()
        self.assertEqual(citizen["issues"][0]["id"], "UE-TEST-001")

        # Citizen cannot update status
        forbidden = self.client.put("/api/issues/UE-TEST-001", headers={"X-UE-Role": "Citizen"}, json={"status": "Completed"})
        self.assertEqual(forbidden.status_code, 403)

        # Admin assigns
        assign = self.client.put(
            "/api/issues/UE-TEST-001",
            headers={"X-UE-Role": "Administrator"},
            json={"status": "Assigned", "assignedDepartment": "Roads & Infrastructure / PWD", "assignedOfficer": "Field Team 1", "dispatchStatus": "Assigned"}
        )
        self.assertEqual(assign.status_code, 200, assign.text)

        updated_citizen = self.client.get("/api/bootstrap", params={"role": "Citizen", "reporter_id": "cid-1"}).json()
        self.assertEqual(updated_citizen["issues"][0]["status"], "Assigned")

    def test_assignment_requires_department(self):
        response = self.client.put("/api/issues/UE-26084", headers={"X-UE-Role": "Administrator"}, json={"status": "Assigned"})
        self.assertEqual(response.status_code, 400)

    def test_multi_channel_alert_dispatch(self):
        res = self.client.post(
            "/api/issues/UE-26091/dispatch-alert",
            headers={"X-UE-Role": "Administrator"},
            json={"channels": ["email", "sms", "whatsapp", "call"], "authority_id": "delhi-mcd", "custom_note": "Immediate fix requested"}
        )
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertTrue(data["ok"])
        self.assertIn("channels", data)
        self.assertIn("whatsapp", data["channels"])
        self.assertIn("whatsappUrl", data["channels"]["whatsapp"])
        self.assertIn("call", data["channels"])
        self.assertIn("announcementScript", data["channels"]["call"])

    def test_government_resolution_with_proof(self):
        image = Image.new("RGB", (60, 60), (30, 30, 30))
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        buffer.seek(0)

        res = self.client.post(
            "/api/issues/UE-26091/resolve",
            headers={"X-UE-Role": "Administrator"},
            data={"resolution_note": "Pothole filled with warm-mix asphalt and compacted.", "resolved_by": "Er. R. K. Sharma", "resolution_cost": "₹3,500"},
            files={"evidence": ("repair_proof.png", buffer.getvalue(), "image/png")}
        )
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertTrue(data["ok"])
        self.assertEqual(data["issue"]["status"], "Completed")
        self.assertTrue(data["issue"]["resolutionEvidenceUrl"].startswith("/uploads/"))

    def test_ai_extract_report(self):
        # Test AI report extraction on sample image with raw smartphone filename
        with open("static/sample_images/pothole_sample.jpg", "rb") as f:
            content = f.read()
        res = self.client.post(
            "/api/ai-extract-report",
            data={"location_hint": "Model Town, Delhi"},
            files={"file": ("IMG_20261012_183021.jpg", content, "image/jpeg")}
        )
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertTrue(data["ok"])
        self.assertEqual(data["category"], "Pothole")
        self.assertIn("title", data)
        self.assertIn("description", data)
        self.assertIn("estimatedCost", data)
        self.assertGreater(len(data["detections"]), 0)
        self.assertEqual(len(data["detections"][0]["box"]), 4)

        # Test with explicit category hint
        res_hint = self.client.post(
            "/api/ai-extract-report",
            data={"category_hint": "Garbage", "location_hint": "Connaught Place, New Delhi"},
            files={"file": ("garbage_upload.jpg", content, "image/jpeg")}
        )
        self.assertEqual(res_hint.status_code, 200, res_hint.text)
        data_hint = res_hint.json()
        self.assertTrue(data_hint["ok"])
        self.assertEqual(data_hint["category"], "Garbage")

    def test_dashcam_inspection(self):
        res = self.client.post("/api/dashcam-inspect", data={"route_id": "route-delhi-ring"})
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertTrue(data["ok"])
        self.assertGreaterEqual(len(data["events"]), 1)
        self.assertIn("roadHealthScore", data)

    def test_authorities_and_analytics(self):
        auths = self.client.get("/api/authorities").json()
        self.assertTrue(auths["ok"])
        self.assertGreaterEqual(auths["count"], 5)

        analytics = self.client.get("/api/analytics/predictive-maintenance").json()
        self.assertTrue(analytics["ok"])
        self.assertIn("overallCityHealth", analytics)
        self.assertIn("zoneBreakdown", analytics)

        bench = self.client.get("/api/ai/model-benchmark").json()
        self.assertTrue(bench["ok"])
        self.assertEqual(len(bench["comparisonBenchmark"]), 5)


if __name__ == "__main__":
    unittest.main()
