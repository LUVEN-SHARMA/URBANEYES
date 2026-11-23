# URBAN-EYES

**AI Urban Infrastructure Defect Detection & Civic Governance Platform**  
ABESEC Ghaziabad • Department of Computer Science & Engineering (Session 2026–27)

---

### Project Team
- **Luven Sharma** (Roll No: 2400320100647, CSE-18)
- **Krishna Pandey** (Roll No: 2400320100620, CSE-18)
- **Khushi Poddar** (Roll No: 2400320100598, CSE-18)
- **Khushboo** (Roll No: 2400320100593, CSE-18)
- **Supervisor:** Ms. Ayushi Agarwal (Assistant Professor, CSE Dept)

---

## 🌟 Executive Summary

URBAN-EYES is an end-to-end civic accountability platform that detects multi-class urban infrastructure defects using enhanced YOLOv8 deep learning. The system provides real-time GIS mapping, automated routing to municipal authorities, emergency multi-channel alerts (Call, WhatsApp, SMS, Email), and verified resolution tracking with photographic proof.

---

## 🚀 Key Capabilities

### 1. Multi-Defect AI Detection
Detects 8 urban defect categories (potholes, cracks, streetlights, garbage heaps, waterlogging, footpaths, signals, markings) with bounding boxes and severity metrics using `models/best.pt`.

### 2. Dashcam Inspection Studio
Processes continuous vehicle ride-along footage, flags defects along trip timelines, and logs incidents to the municipal queue.

### 3. AI Report Auto-Extraction
Extracts GPS metadata from uploaded photos, auto-classifies defect severity, and computes turnaround SLA and budget estimates.

### 4. Pan-India Authority Routing
Auto-routes complaints to local municipal bodies across India (MCD, GNN, BMC, BBMP, GHMC, GCC, KMC, NHAI).

### 5. Multi-Channel Emergency Dispatch
Transmits urgent notifications to executive engineers via Voice Call IVR, WhatsApp direct chat, SMS, and official email memo.

### 6. Verified Resolution Proof
Enforces civic accountability by requiring after-repair photographic evidence for ticket closure.

### 7. Interactive Live GIS Map
Full-screen Leaflet map with city shortcuts, severity filters, and heatmaps.

### 8. Predictive Infrastructure Health
Risk forecasting that models road failure probability before the monsoon season.

---

## 🔬 Model Architecture & Benchmark

Based on Jiang (2024), *Discover Applied Sciences*, 6(8), 421:
- **C2f_DAttn:** Deformable attention module for irregular crack geometries.
- **VoVGSCSP Slim-Neck:** Separable convolutions reducing model size to 11.8 MB at 369 FPS.
- **MPDIoU Loss:** Geometric bounding box regression for faster convergence.

| Model | Precision | Recall | mAP@0.5 | Speed | Size |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Faster R-CNN | 64.8% | 53.4% | 60.7% | 18 fps | 160 MB |
| SSD MobileNet | 56.7% | 51.3% | 53.9% | 84 fps | 79 MB |
| YOLOv5s | 59.4% | 54.1% | 56.7% | 158 fps | 14.7 MB |
| YOLOv8n Baseline | 65.4% | 56.9% | 61.8% | 420 fps | 12.9 MB |
| **Enhanced YOLOv8 (Ours)** | **68.8%** | **59.9%** | **65.7%** | **369 fps** | **11.8 MB** |

---

## 🛠️ Quick Start

```bash
# 1. Activate environment & install requirements
source .venv/bin/activate
pip install -r requirements.txt

# 2. Run application
python run.py

# 3. Run verification tests
python tests/run_tests.py
```
- App: <http://127.0.0.1:8000>
- API Docs: <http://127.0.0.1:8000/docs>
- Health: <http://127.0.0.1:8000/api/health>

---

## 📁 Project Structure

```text
URBAN-EYES/
├── backend/main.py      # FastAPI backend, DB, YOLO inference & dispatches
├── static/              # Web interface (index.html, app.js, samples)
├── models/best.pt       # Trained YOLOv8 defect detection weights
├── datasets/            # RDD2022 dataset metadata
├── ml/                  # Training and evaluation scripts
├── tools/               # Dataset downloaders & converters
├── tests/run_tests.py   # Test suite
└── run.py               # Server runner
```

---

## 🎯 Evaluator Walkthrough

1. **Overview & Jurisdiction:** Switch cities in topbar to update live stats and map.
2. **Citizen Report:** Click **Report Issue** → select a sample defect → click **✨ Auto-Extract with AI** → submit grievance.
3. **Dashcam Studio:** Select a route drive → click **▶ Play Route Inspection** → batch-log flagged defects.
4. **Live GIS Map:** Open map, filter by severity, and inspect color-coded defect markers.
5. **Admin Dispatch:** Switch to **Government Admin Desk** → click **🚨 Emergency Alert** to trigger Voice IVR, WhatsApp, SMS, or Email.
6. **Resolution Proof:** Click **✓ Resolve with Proof** → attach after-repair photo to verify completion.

---

## 📄 Citation & License
Academic Mini-Project (ABESEC Ghaziabad, 2026–27).  
Reference: Jiang, Y. (2024). *Road damage detection and classification using deep neural networks*. Discover Applied Sciences, 6(8), 421.
