# URBAN-EYES — AI-Powered Multi-Infrastructure Defect Detection & Civic Governance Platform

**ABESEC Ghaziabad — Department of Computer Science & Engineering**  
**Mini Project / 5th Semester / BCS554 (Session 2026–27)**

---

### Project Team & Supervision
- **Luven Sharma** (Roll No: 2400320100647, CSE-18)
- **Krishna Pandey** (Roll No: 2400320100620, CSE-18)
- **Khushi Poddar** (Roll No: 2400320100598, CSE-18)
- **Khushboo** (Roll No: 2400320100593, CSE-18)
- **Project Supervisor:** Ms. Ayushi Agarwal (Assistant Professor, CSE Dept, ABESEC)

---

## 🌟 Executive Summary & Motivation

Urban roads and municipal infrastructure across Indian cities suffer from severe defects including deep potholes, fatigue cracks, broken/tilted streetlights, overflowing garbage heaps, blocked stormwater drains, damaged pedestrian walkways, and malfunctioning traffic signals. Traditional monitoring relies on delayed manual inspections or single-category municipal complaint portals (e.g., Delhi's MCD 311 or Swachhata apps) which lack automated computer-vision defect detection, pan-India scalability, and verified resolution tracking.

**URBAN-EYES** is a unified, end-to-end intelligent civic accountability platform that detects multi-class urban defects from smartphone images and continuous vehicle dashcam video streams using deep learning (enhanced YOLOv8 architecture). The system automatically assesses defect severity, pinpoints geographic coordinates on an interactive live GIS map, routes grievances to responsible Urban Local Bodies (ULBs) and contractors across India, transmits immediate multi-channel emergency alerts (**Voice Call IVR, WhatsApp Direct Message, SMS, and Official Email Memorandum**), and tracks repair work with **Before vs. After photographic proof**.

---

## 🚀 Key Functional Capabilities

### 1. Multi-Defect Computer Vision & AI Detection
- Identifies **8 distinct urban defect categories** simultaneously from single images or video frames:
  1. **Potholes on road** (RDD class D40)
  2. **Road cracks** (Longitudinal D00, Transverse D10, Alligator D20)
  3. **Damaged / Broken Streetlights & Poles**
  4. **Garbage Accumulation & Roadside Dumps**
  5. **Blocked Drainage / Urban Street Waterlogging**
  6. **Broken Footpaths & Dislodged Paving Slabs**
  7. **Faulty / Unlit Intersection Traffic Signals**
  8. **Faded Road & Lane Markings**
- **Trained Deep Learning Weights:** Powered by trained YOLOv8 weights located in `models/best.pt`, augmented by a multi-defect computer vision spatial segmentation pipeline.
- **Automated Annotation:** Generates bounding boxes color-coded by severity, confidence score percentages, and localized tags.

### 2. Vehicle Dashcam & Ride-Along Inspection Studio
- Ingests passive vehicle dashcam video feeds (MP4, WebM, MOV) or live vehicle cameras.
- Samples road frames at regular intervals at vehicle speeds (30–60 km/h).
- Detects surface distress along the trip corridor, logs GPS coordinates, and plots a continuous trip timeline.
- Includes **4 preloaded real-world Indian route simulations**:
  - 🚗 *Delhi Ring Road (AIIMS to Dhaula Kuan)*
  - 🚗 *Ghaziabad NH-24 / ABESEC Corridor*
  - 🚗 *Mumbai Western Express Highway (Bandra to Andheri)*
  - 🚗 *Bengaluru Outer Ring Road (Marathahalli to Bellandur)*
- Features **Batch-Log All Defects to Government Queue** for automated municipal survey logging.

### 3. AI-Powered Report Auto-Extraction & Generation
- Citizens upload a photo and click **"Auto-Extract with AI"**.
- Extracts camera metadata and **EXIF GPS coordinates** directly from the uploaded photo.
- AI analyzes the defect, computes severity (`Critical`, `High`, `Medium`, `Low`), calculates priority (1–100), estimates repair turnaround SLA and budget (in INR ₹), and generates a professional civic grievance draft ready for submission in 1 click.

### 4. Pan-India ULB & Municipal Authority Routing
- Scaled for all of India (not restricted to Delhi MCD):
  - **Delhi NCR:** Municipal Corporation of Delhi (MCD), NDMC, PWD Delhi
  - **Uttar Pradesh:** Ghaziabad Nagar Nigam (GNN - ABESEC area), Noida Authority, Lucknow Municipal Corporation
  - **Maharashtra:** Brihanmumbai Municipal Corporation (BMC / MCGM), Pune Municipal Corporation (PMC)
  - **Karnataka:** Bruhat Bengaluru Mahanagara Palike (BBMP)
  - **Telangana:** Greater Hyderabad Municipal Corporation (GHMC)
  - **Tamil Nadu:** Greater Chennai Corporation (GCC)
  - **West Bengal:** Kolkata Municipal Corporation (KMC)
  - **National Highways:** NHAI Central Highway Command
- Auto-assigns the relevant local municipal department, Superintending/Executive Engineer, and maintenance contractor.

### 5. Multi-Channel Emergency Authority Dispatch (Call, WhatsApp, SMS, Email)
- Municipal administrators can trigger immediate notification dispatches for critical defects:
  - 📞 **Automated Voice Call (IVR):** Real audio announcement spoken via browser Web Speech API for emergency notifications.
  - 💬 **WhatsApp Direct Chat:** Generates a pre-formatted message with Markdown and an instant click-to-chat `https://wa.me/...` deep link to the Executive Engineer.
  - 📱 **SMS Gateway Dispatch:** Standard SMS text with ticket ID, defect category, SLA, and Google Maps GPS navigation link.
  - 📧 **Official Email Memorandum:** Formal government memorandum dispatched via SMTP (if configured in `.env`) or prepared for mail clients.

### 6. Government Resolution with Photographic Proof (Before vs After)
- Closes the civic accountability loop:
  - Administrator/Engineer reviews ticket, assigns crew, and sets in-progress status.
  - Upon completion, uploads an **After-Repair Evidence Photo**.
  - Citizen and municipal dashboards show a **Before vs After comparison** verifying the filled pothole, replaced light, or desilted drain alongside inspector sign-off and material repair cost.

### 7. Interactive Live Pan-India GIS Map
- Powered by Leaflet.js with pan-India OpenStreetMap tiles and satellite view toggle.
- City quick-jump shortcuts: Delhi, Ghaziabad, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata.
- GPS Geolocation ("Locate Me") and Nominatim search for any Indian landmark or pincode.
- Filter by Status (Pending, Assigned, In Progress, Resolved) and Severity.
- Defect Density Heatmap visualization overlay.

### 8. Predictive Maintenance & Infrastructure Health Scoring
- Composite City Infrastructure Health Index (0–100%).
- Bayesian risk forecasting flagging road segments likely to suffer structural failure before the next monsoon season.
- Printable Official Municipal Work Orders (`GET /api/issues/{id}/work-order`).

---

## 🔬 Research & Architectural Foundation (Jiang 2024)

The project incorporates the deep learning improvements detailed in the literature survey:
- **Reference Paper:** Yiwen Jiang (2024), *"Road damage detection and classification using deep neural networks"*, **Discover Applied Sciences** (Springer Nature), 6(8), 421.
- **Architectural Innovations:**
  1. **C2f_DAttn Block:** Integrates a Deformable Attention Transformer (DAT) into YOLOv8's C2f module to dynamically focus on irregular crack geometries and pothole cavities.
  2. **VoVGSCSP Slim-Neck:** Implements Grouped Separable Convolutions (GSConv) to streamline feature fusion and reduce model size to **11.8 MB at 369 FPS** (embedded edge friendly).
  3. **MPDIoU Loss:** Minimum Points Distance Intersection over Union loss function utilizing 4-point bounding box coordinates for faster convergence.
- **Comparative Benchmark from Paper:**
  - Faster R-CNN: 60.7% mAP@0.5 | 18 FPS | 160.0 MB
  - SSD MobileNet: 53.9% mAP@0.5 | 84 FPS | 79.0 MB
  - YOLOv5s: 56.7% mAP@0.5 | 158 FPS | 14.7 MB
  - YOLOv8n Baseline: 61.8% mAP@0.5 | 420 FPS | 12.9 MB
  - **Enhanced YOLOv8 (Our Project):** **65.7% mAP@0.5** | **369 FPS** | **11.8 MB**

---

## 🛠️ Quick Start & Installation

### 1. Prerequisites
- Python 3.10, 3.11, 3.12, or 3.13
- Git, modern web browser (Chrome, Edge, Firefox, Safari)

### 2. Setup Virtual Environment
```bash
# Clone or navigate to the repository directory
cd /path/to/URBAN-EYES-

# Activate virtual environment
source .venv/bin/activate    # On macOS/Linux
# .venv\Scripts\Activate.ps1  # On Windows PowerShell

# Install dependencies (if setting up fresh)
pip install -r requirements.txt
```

### 3. Run the Platform
```bash
python run.py
```
Open your browser and navigate to:
**<http://127.0.0.1:8000>**

- **Interactive API Documentation:** <http://127.0.0.1:8000/docs>
- **Health Check:** <http://127.0.0.1:8000/api/health>

### 4. Run the Automated Verification Test Suite
```bash
python tests/run_tests.py
```
Verifies health checks, role scoping, Pan-India authorities, AI report extraction, Dashcam inspection, Multi-Channel dispatch, and Government resolution with proof.

---

## 📁 Repository Directory Structure

```text
URBAN-EYES/
├── backend/
│   ├── __init__.py
│   └── main.py                 # FastAPI backend, SQLite persistence, YOLO inference, AI extractor & dispatches
├── static/
│   ├── index.html              # Modern civic tech interface (Citizen + Gov Admin modes)
│   ├── app.js                  # Frontend controllers, Leaflet GIS, Dashcam Studio & Web Speech IVR
│   └── sample_images/          # High-resolution test sample defect images (Potholes, Cracks, Garbage, etc.)
├── models/
│   ├── best.pt                 # Trained YOLOv8 road defect weights (D00, D10, D20, D40)
│   └── README.md
├── datasets/
│   └── rdd2022_yolo/           # YOLO format dataset configuration and training metadata
├── ml/
│   ├── train_model.py          # Ultralytics training pipeline with transfer learning
│   └── evaluate_model.py       # Validation evaluation (mAP@0.5, Precision, Recall)
├── tools/
│   ├── convert_rdd2022.py      # Pascal VOC XML to YOLO format converter
│   └── download_rdd2022_india.py # Automated RDD2022 India dataset downloader
├── tests/
│   ├── run_tests.py            # Standalone API & functional test runner
│   └── test_api.py             # Pytest test cases
├── data/
│   └── urban_eyes.db           # SQLite persistent database with seed records
├── uploads/                    # User evidence uploads and AI annotated bounding box outputs
├── run.py                      # Application launcher
└── requirements.txt            # Core dependencies (FastAPI, OpenCV, PyTorch, Ultralytics)
```

---

## 🎯 Demonstration Walkthrough for Evaluators

1. **Dashboard & Pan-India City Switcher:**
   - In the top header, switch cities from **"All India"** to **"Ghaziabad / UP"** or **"Mumbai"**.
   - Notice the live statistics, priority hazard feed, and map automatically center on that urban jurisdiction.

2. **Citizen Reporting with AI Auto-Extraction:**
   - Open **Report Issue**.
   - Click any quick sample pill, e.g. **`Pothole (D40)`** or **`Garbage Heap`**.
   - Click **`✨ Auto-Extract with AI`**:
     - The AI analyzes the image, detects the defect class, computes severity (`Critical`), estimates turnaround SLA (`4h`), calculates repair cost (`₹3,500`), and autofills the description!
   - Select or search a point on the live map and click **Submit Official Grievance**.

3. **Car Dashcam Ride-Along Inspection Studio:**
   - Open **Dashcam Studio**.
   - Select **"Ghaziabad NH-24 / ABESEC Corridor"** or **"Delhi Ring Road"**.
   - Click **▶ Play Route Inspection**:
     - Live HUD updates speed (42 km/h), GPS coordinates, and logs defects along the drive timeline.
   - Click **"Batch-Log All to Gov Queue"** to convert detected road defects into active municipal work tickets.

4. **Live Pan-India GIS Map:**
   - Open **Live GIS Map**.
   - Use the city jump buttons (Delhi, Ghaziabad, Mumbai, Bengaluru, Hyderabad).
   - Click on any color-coded marker to view the photo thumbnail, SLA clock, and assigned engineer.
   - Toggle **"Heatmap Mode"** to view road distress density corridors.

5. **Government Command Center & Multi-Channel Alert Dispatch:**
   - Click **Switch Mode** in the sidebar to enter **Government Admin Desk**.
   - Open any critical grievance and click **"🚨 Dispatch Multi-Channel Alerts"**:
     - Select **Email, SMS, WhatsApp, and Voice Call**.
     - Click **"Test Voice Call Audio"** to hear the automated IVR emergency call announcement spoken aloud via speech synthesis!
     - Click **"Transmit Alerts Now"** to log the dispatch and open direct WhatsApp communication.

6. **Verified Resolution with Proof (Before vs After):**
   - In the issue view, click **"✓ Resolve with Proof"**.
   - Click **"Use Verified Demo Repair Photo"** (or upload an after-repair image), type repair notes, and confirm closure.
   - Reopen the issue: see the interactive **Before vs After photo comparison** side-by-side with official verification seal!

---

## 📄 License & Academic Citation
Developed for academic mini-project evaluation at ABESEC Ghaziabad (2026–27).  
Reference: Jiang, Y. (2024). *Road damage detection and classification using deep neural networks*. Discover Applied Sciences, 6(8), 421.
