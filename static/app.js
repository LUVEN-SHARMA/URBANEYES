// URBAN-EYES — AI-Powered Multi-Infrastructure Defect Detection & Civic Governance Platform
// Pan-India Smart City & Rural Infrastructure Management

const API_ROOT = "/api";
let backendReady = false;
let currentRole = "Citizen";
let selectedCity = "all";

// Global app state
let state = {
  issues: [],
  tickets: [],
  activity: [],
  authorities: [],
  model: null,
  role: "Citizen",
  selectedReportFile: null,
  selectedScanFile: null,
  selectedResolveProofFile: null
};

let cameraStream = null;

// Maps instances
let miniMapInstance = null;
let mainMapInstance = null;
let reportMapInstance = null;
let reportMarker = null;
let mainMapMarkers = [];
let miniMapMarkers = [];
let heatmapCircles = [];
let isHeatmapActive = false;

// City preset coordinates across India
const INDIAN_CITIES = {
  all: { center: [22.5937, 78.9629], zoom: 5 },
  delhi: { center: [28.6139, 77.2090], zoom: 12 },
  ghaziabad: { center: [28.6692, 77.4538], zoom: 13 },
  noida: { center: [28.5355, 77.3910], zoom: 13 },
  mumbai: { center: [19.0760, 72.8777], zoom: 12 },
  pune: { center: [18.5204, 73.8567], zoom: 13 },
  bengaluru: { center: [12.9716, 77.5946], zoom: 12 },
  hyderabad: { center: [17.3850, 78.4867], zoom: 12 },
  chennai: { center: [13.0827, 80.2707], zoom: 12 },
  kolkata: { center: [22.5726, 88.3639], zoom: 12 },
  nhai: { center: [28.5900, 77.0600], zoom: 11 }
};

// Dashcam simulation state
let dashcamInterval = null;
let dashcamSimulationEvents = [];
let dashcamCurrentIndex = 0;
let currentDashcamData = null;

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

function getReporterId() {
  let id = localStorage.getItem("urban-eyes-reporter-id");
  if (!id) {
    id = "citizen-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
    localStorage.setItem("urban-eyes-reporter-id", id);
  }
  return id;
}

function apiHeaders(extra = {}) {
  return {
    "X-UE-Role": currentRole,
    "X-UE-Reporter-ID": getReporterId(),
    ...extra
  };
}

async function requestInference(file) {
  const form = new FormData();
  form.append("file", file, file.name || "evidence.bin");
  const response = await fetch(`${API_ROOT}/inference`, { method: "POST", headers: apiHeaders(), body: form });
  const body = await response.json().catch(() => ({ message: "The inference response could not be read." }));
  if (!response.ok) throw new Error(body.detail || body.message || `Inference failed (${response.status})`);
  return body;
}

function toast(msg, type = "info") {
  const t = qs("#toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = "toast"; }, 3200);
}

function esc(val) {
  return String(val ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function badgeSeverity(sev) {
  const s = String(sev || "Medium").toLowerCase();
  return `<span class="badge ${s}">${sev}</span>`;
}

function badgeStatus(status) {
  const s = String(status || "Not assigned");
  let cls = "status";
  if (s === "Completed") cls = "low";
  else if (s === "In progress") cls = "high";
  else if (s === "Assigned") cls = "medium";
  return `<span class="badge ${cls}">${s}</span>`;
}

// ==============================================================================
// Voice Audio Dispatch Announcement (Web Speech API) - Toggle Start/Stop
// ==============================================================================
let isSpeakingAnnouncement = false;
let currentUtterance = null;
let speechStartTimeout = null;

function resetSpeechButtonUI(btn, fallbackText) {
  if (!btn) return;
  const defaultHtml = btn.dataset.defaultHtml || fallbackText || "🔊 Voice IVR";
  btn.innerHTML = defaultHtml;
  btn.classList.remove("is-speaking");
  if (btn.dataset.defaultTitle) {
    btn.title = btn.dataset.defaultTitle;
  }
}

function setSpeechButtonActiveUI(btn, stopLabel, stopTitle) {
  if (!btn) return;
  if (!btn.dataset.defaultHtml) {
    btn.dataset.defaultHtml = btn.innerHTML;
  }
  if (!btn.dataset.defaultTitle) {
    btn.dataset.defaultTitle = btn.title || "";
  }
  btn.innerHTML = stopLabel || "⏹️ Stop IVR";
  btn.title = stopTitle || "Click to stop voice IVR announcement";
  btn.classList.add("is-speaking");
}

function stopAnnouncement() {
  if (speechStartTimeout) {
    clearTimeout(speechStartTimeout);
    speechStartTimeout = null;
  }

  isSpeakingAnnouncement = false;

  // Immediately silence the utterance object
  if (currentUtterance) {
    try {
      currentUtterance.volume = 0;
      currentUtterance.onstart = null;
      currentUtterance.onend = null;
      currentUtterance.onerror = null;
      currentUtterance.onpause = null;
      currentUtterance.onresume = null;
    } catch (_) {}
    currentUtterance = null;
  }
  window._currentUtterance = null;

  // Stop browser speech synthesis hardware queue
  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.pause();
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
      }
    } catch (e) {
      console.warn("Speech cancel error:", e);
    }
  }

  // Defensively reset known buttons in the DOM
  const topVoiceBtn = qs("#voiceAlertAudioBtn");
  if (topVoiceBtn) resetSpeechButtonUI(topVoiceBtn, "🔊 Voice IVR");
  const modalVoiceBtn = qs("#listenVoiceCallBtn");
  if (modalVoiceBtn) resetSpeechButtonUI(modalVoiceBtn, "🔊 Test Voice Call Audio");
}

function startAnnouncement(text, triggerBtn, stopLabel) {
  stopAnnouncement();

  speechStartTimeout = setTimeout(() => {
    if (!("speechSynthesis" in window)) {
      toast("Speech synthesis not supported in this browser.", "info");
      return;
    }

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (_) {}

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = "en-IN";
    utterance.volume = 1.0;

    currentUtterance = utterance;
    window._currentUtterance = utterance; // Prevent Chrome garbage collection bug
    isSpeakingAnnouncement = true;

    const btn = triggerBtn || qs("#voiceAlertAudioBtn");
    if (btn) {
      setSpeechButtonActiveUI(btn, stopLabel || "⏹️ Stop IVR");
    }

    utterance.onstart = () => {
      isSpeakingAnnouncement = true;
      if (btn) setSpeechButtonActiveUI(btn, stopLabel || "⏹️ Stop IVR");
    };

    utterance.onend = () => {
      stopAnnouncement();
    };

    utterance.onerror = () => {
      stopAnnouncement();
    };

    try {
      window.speechSynthesis.speak(utterance);
      toast("Voice IVR playing. Click again to stop.", "info");
    } catch (err) {
      console.error("Speech speak failed:", err);
      stopAnnouncement();
    }
  }, 40);
}

// Global toggle functions
window.toggleVoiceIvr = function(btn) {
  const triggerBtn = btn || qs("#voiceAlertAudioBtn");
  if (isSpeakingAnnouncement) {
    stopAnnouncement();
    toast("Voice IVR announcement stopped.", "info");
  } else {
    const text = "Urgent municipal alert from URBAN-EYES. High severity defect reported on arterial corridor. Immediate field crew dispatch mandated under safety SLA.";
    startAnnouncement(text, triggerBtn, "⏹️ Stop IVR");
  }
};

window.speakAnnouncement = function(text, triggerBtn, stopLabel) {
  if (isSpeakingAnnouncement) {
    stopAnnouncement();
    toast("Voice IVR announcement stopped.", "info");
  } else {
    startAnnouncement(text, triggerBtn, stopLabel);
  }
};

window.stopAnnouncement = stopAnnouncement;

window.addEventListener("beforeunload", () => {
  stopAnnouncement();
});

// ==============================================================================
// Bootstrap & Data Synchronization
// ==============================================================================
async function bootstrapBackend() {
  try {
    const res = await fetch(`${API_ROOT}/bootstrap?role=${encodeURIComponent(currentRole)}&reporter_id=${encodeURIComponent(getReporterId())}`, {
      headers: apiHeaders()
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.issues = data.issues || [];
    state.tickets = data.tickets || [];
    state.activity = data.activity || [];
    state.authorities = data.authorities || [];
    state.model = data.model;
    backendReady = true;

    const statusPill = qs("#apiStatus");
    if (statusPill) {
      statusPill.innerHTML = `<span></span> SQLite Connected • ${state.issues.length} Issues`;
      statusPill.classList.add("live");
    }

    renderAll();
  } catch (err) {
    console.error("Backend bootstrap failed:", err);
    toast("Backend connection error. Retrying...", "error");
  }
}

// ==============================================================================
// Navigation & Views
// ==============================================================================
function navigate(view) {
  qsa(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
  qsa(".view").forEach(v => v.classList.toggle("active", v.id === `view-${view}`));

  const meta = {
    dashboard: ["OPERATIONS", "Infrastructure Command"],
    report: ["GRIEVANCE PORTAL", "Report Defect"],
    scan: ["VISION AI", "AI Detection Studio"],
    dashcam: ["TELEMETRY", "Dashcam Studio"],
    issues: ["REGISTRY", "Issue Registry"],
    map: ["GIS", "Live Map"],
    maintenance: ["ANALYTICS", "Predictive Health"],
    modelhub: ["AI ARCHITECTURE", "Model Hub & Datasets"],
    administration: ["ADMINISTRATION", "Triage & Dispatch Desk"]
  };

  const [eyebrow, title] = meta[view] || ["URBAN OPERATIONS", "Civic Dashboard"];
  if (qs("#topbarEyebrow")) qs("#topbarEyebrow").textContent = eyebrow;
  if (qs("#topbarTitle")) qs("#topbarTitle").textContent = title;

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (view === "dashboard") setTimeout(initMiniMap, 100);
  if (view === "map") setTimeout(initMainMap, 100);
  if (view === "report") setTimeout(initReportMap, 120);
  if (view === "dashcam" && !dashcamSimulationEvents.length) loadDashcamRoute("route-delhi-ring");
  if (view === "maintenance") loadPredictiveAnalytics();

  setTimeout(() => {
    if (miniMapInstance) miniMapInstance.invalidateSize();
    if (mainMapInstance) mainMapInstance.invalidateSize();
    if (reportMapInstance) reportMapInstance.invalidateSize();
  }, 150);
}

function setupNav() {
  qsa(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (view) navigate(view);
    });
  });

  qsa("[data-view-link]").forEach(link => {
    link.addEventListener("click", () => {
      const view = link.dataset.viewLink;
      if (view) navigate(view);
    });
  });

  // Role toggle
  const roleBtn = qs("#roleToggleBtn");
  if (roleBtn) {
    roleBtn.addEventListener("click", () => {
      currentRole = (currentRole === "Citizen") ? "Administrator" : "Citizen";
      document.body.classList.toggle("admin-mode", currentRole === "Administrator");
      qs("#roleText").textContent = (currentRole === "Administrator") ? "Gov Admin Desk" : "Citizen Portal";
      qs("#roleBadge").classList.toggle("admin", currentRole === "Administrator");
      toast(`Switched to ${currentRole} Mode`, "info");
      navigate(currentRole === "Administrator" ? "administration" : "dashboard");
      bootstrapBackend();
    });
  }

  // Pan-India city filter
  const citySelect = qs("#panIndiaCityFilter");
  if (citySelect) {
    citySelect.addEventListener("change", (e) => {
      selectedCity = e.target.value;
      toast(`Filtered view: ${citySelect.options[citySelect.selectedIndex].text}`, "info");
      renderAll();
      if (mainMapInstance && INDIAN_CITIES[selectedCity]) {
        const { center, zoom } = INDIAN_CITIES[selectedCity];
        mainMapInstance.flyTo(center, zoom, { duration: 1.2 });
      }
    });
  }

  // Voice alert audio tester
  const voiceBtn = qs("#voiceAlertAudioBtn");
  if (voiceBtn) {
    voiceBtn.onclick = () => window.toggleVoiceIvr(voiceBtn);
  }

  // Top emergency dispatch shortcut
  const topDispatchBtn = qs("#adminTopDispatchBtn");
  if (topDispatchBtn) {
    topDispatchBtn.addEventListener("click", () => {
      const critIssue = state.issues.find(i => i.severity === "Critical") || state.issues[0];
      if (critIssue) openDispatchModal(critIssue.id);
      else toast("No critical issues found.", "info");
    });
  }
}

// ==============================================================================
// Rendering KPI Cards & Priority Feed
// ==============================================================================
function getFilteredIssues() {
  if (selectedCity === "all") return state.issues;
  return state.issues.filter(i => {
    const loc = (i.location || "").toLowerCase() + " " + (i.city || "").toLowerCase() + " " + (i.state || "").toLowerCase();
    const cityKey = selectedCity.toLowerCase();
    if (cityKey === "delhi") return loc.includes("delhi") || loc.includes("mcd") || loc.includes("ndmc");
    if (cityKey === "ghaziabad") return loc.includes("ghaziabad") || loc.includes("abesec") || loc.includes("nh-24");
    if (cityKey === "noida") return loc.includes("noida");
    if (cityKey === "mumbai") return loc.includes("mumbai") || loc.includes("bandra") || loc.includes("bmc");
    if (cityKey === "pune") return loc.includes("pune");
    if (cityKey === "bengaluru") return loc.includes("bengaluru") || loc.includes("bangalore") || loc.includes("bbmp");
    if (cityKey === "hyderabad") return loc.includes("hyderabad") || loc.includes("ghmc");
    if (cityKey === "chennai") return loc.includes("chennai") || loc.includes("gcc");
    if (cityKey === "kolkata") return loc.includes("kolkata") || loc.includes("kmc");
    if (cityKey === "nhai") return loc.includes("highway") || loc.includes("nh-") || loc.includes("nhai");
    return true;
  });
}

function renderKPIs() {
  const issues = getFilteredIssues();
  const openCount = issues.filter(i => i.status !== "Completed").length;
  const criticalCount = issues.filter(i => i.severity === "Critical" && i.status !== "Completed").length;
  const resolvedCount = issues.filter(i => i.status === "Completed").length;
  const cityHealth = Math.max(50, Math.min(98, 96 - (criticalCount * 4) - (openCount * 1.5)));

  const kpis = [
    { label: "Active Open Issues", val: openCount, note: `${criticalCount} Critical Hazards`, trend: criticalCount > 0 ? "danger" : "warn" },
    { label: "Critical Hazards", val: criticalCount, note: "Mandated SLA: 2–4h", trend: "danger" },
    { label: "Resolved with Proof", val: resolvedCount, note: "Before & After Verified", trend: "" },
    { label: "City Health Index", val: `${Math.round(cityHealth)}/100`, note: "Pan-India Composite", trend: "" }
  ];

  const grid = qs("#kpiGrid");
  if (grid) {
    grid.innerHTML = kpis.map(k => `
      <div class="kpi">
        <div class="kpi-top">
          <span class="kpi-label">${k.label}</span>
          <span class="trend ${k.trend}">${k.note}</span>
        </div>
        <div class="kpi-value">${k.val}</div>
        <div class="kpi-note">URBAN-EYES Active Data</div>
      </div>
    `).join("");
  }

  // Admin KPI grid
  const adminGrid = qs("#adminKpiGrid");
  if (adminGrid) {
    adminGrid.innerHTML = `
      <div class="kpi"><div class="kpi-top"><span class="kpi-label">Total Grievances</span><span class="trend">All</span></div><div class="kpi-value">${issues.length}</div><div class="kpi-note">Tracked in SQLite</div></div>
      <div class="kpi"><div class="kpi-top"><span class="kpi-label">Pending Triage</span><span class="trend warn">Action Needed</span></div><div class="kpi-value">${issues.filter(i => i.status === "Not assigned").length}</div><div class="kpi-note">Not yet assigned</div></div>
      <div class="kpi"><div class="kpi-top"><span class="kpi-label">In Field Repair</span><span class="trend">Dispatched</span></div><div class="kpi-value">${issues.filter(i => i.status === "In progress").length}</div><div class="kpi-note">Crews on site</div></div>
      <div class="kpi"><div class="kpi-top"><span class="kpi-label">Verified Closures</span><span class="trend">Photo Proof</span></div><div class="kpi-value">${resolvedCount}</div><div class="kpi-note">Closed with evidence</div></div>
    `;
  }
}

function renderPriorityList() {
  const list = qs("#priorityList");
  if (!list) return;
  const issues = getFilteredIssues()
    .filter(i => i.status !== "Completed")
    .sort((a, b) => (b.priority || 50) - (a.priority || 50))
    .slice(0, 5);

  const iconMap = {
    "Pothole": "🕳️", "Road crack": "⚡", "Streetlight": "💡",
    "Garbage": "🗑️", "Drainage": "🌊", "Footpath": "🚶",
    "Traffic signal": "🚦", "Road marking": "🛣️"
  };

  list.innerHTML = issues.map(i => `
    <div class="priority-item" onclick="openIssueModal('${i.id}')">
      <div class="priority-icon">${iconMap[i.category] || "⚠️"}</div>
      <div>
        <strong>${esc(i.title)}</strong>
        <span>${esc(i.location)} • Priority: ${i.priority || 80}</span>
      </div>
      <div>${badgeSeverity(i.severity)}</div>
    </div>
  `).join("") || `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:11px">No critical issues pending.</div>`;
}

// ==============================================================================
// Issues Table & Registry
// ==============================================================================
function renderIssueTable() {
  const tbody = qs("#issueTableBody");
  if (!tbody) return;

  const search = (qs("#issueSearchInput")?.value || "").toLowerCase();
  const statusFilter = qs("#issueStatusSelect")?.value || "all";
  const catFilter = qs("#issueCategorySelect")?.value || "all";
  const sevFilter = qs("#issueSeveritySelect")?.value || "all";

  const filtered = getFilteredIssues().filter(i => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (catFilter !== "all" && i.category !== catFilter) return false;
    if (sevFilter !== "all" && i.severity !== sevFilter) return false;
    if (search) {
      const text = `${i.id} ${i.title} ${i.location} ${i.category}`.toLowerCase();
      if (!text.includes(search)) return false;
    }
    return true;
  });

  tbody.innerHTML = filtered.map(i => `
    <tr>
      <td style="font-family:'Space Grotesk';font-weight:700;color:#2563eb">${esc(i.id)}</td>
      <td style="min-width:240px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="position:relative;width:52px;height:42px;flex-shrink:0;border-radius:6px;overflow:hidden;background:#0f172a;cursor:pointer;border:1px solid var(--line)" onclick="openIssueModal('${i.id}')" title="Click to inspect photo evidence">
            <img src="${i.evidenceUrl || '/static/sample_images/pothole_sample.jpg'}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='/static/sample_images/pothole_sample.jpg'" alt="${esc(i.category)}" />
            <span style="position:absolute;bottom:1px;right:2px;background:rgba(0,0,0,0.65);color:#fff;font-size:7px;padding:1px 3px;border-radius:3px">📷</span>
          </div>
          <div>
            <strong>${esc(i.title)}</strong>
            <div style="font-size:10px;color:#64748b;display:flex;gap:6px;align-items:center;margin-top:2px">
              <span style="font-weight:600">${esc(i.category)}</span>
              ${i.source ? `• <span style="color:#2563eb">${esc(i.source)}</span>` : ''}
            </div>
          </div>
        </div>
      </td>
      <td>${esc(i.location)}</td>
      <td>${badgeSeverity(i.severity)}</td>
      <td>${esc(i.assignedDepartment || i.owner || "Awaiting assignment")}</td>
      <td>${badgeStatus(i.status)}</td>
      <td>${esc(i.reported)}</td>
      <td style="white-space:nowrap">
        <button type="button" class="link-button" onclick="openIssueModal('${i.id}')" style="white-space:nowrap">Inspect Photo →</button>
        <button type="button" class="ghost-btn" onclick="deleteIssue('${i.id}')" style="padding:4px 8px;font-size:11px;color:#ef4444;border-color:#fca5a5;margin-left:4px" title="Delete this grievance">🗑️</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="8" style="text-align:center;padding:24px;color:#94a3b8">No grievances matching current filters.</td></tr>`;
}

// ==============================================================================
// Interactive Issue Modal & Before/After Proof
// ==============================================================================
window.openIssueModal = function(id) {
  const issue = state.issues.find(i => i.id === id);
  if (!issue) return;

  const modal = qs("#issueModal");
  const content = qs("#modalContent");
  if (!modal || !content) return;

  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${issue.lat},${issue.lng}`;

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">
      <div>
        <div class="tiny-label" style="color:#2563eb">${esc(issue.id)} • ${esc(issue.category)}</div>
        <h2 style="font:700 22px 'Space Grotesk';margin:4px 0">${esc(issue.title)}</h2>
        <div style="font-size:11px;color:#64748b">Reported: ${esc(issue.reported)} • Source: ${esc(issue.source || "Citizen")}</div>
      </div>
      <div style="display:flex;gap:6px">
        ${badgeSeverity(issue.severity)}
        ${badgeStatus(issue.status)}
      </div>
    </div>

    <!-- Before & After Comparison Section -->
    <div class="comparison-container">
      <div class="comp-card">
        <div class="comp-label">ORIGINAL REPORT EVIDENCE</div>
        <img src="${issue.evidenceUrl || '/static/sample_images/pothole_sample.jpg'}" alt="Original Defect" onerror="this.src='/static/sample_images/pothole_sample.jpg'" />
      </div>
      <div class="comp-card">
        <div class="comp-label ${issue.status === 'Completed' ? 'resolved' : ''}">
          ${issue.status === 'Completed' ? '✓ VERIFIED AFTER-REPAIR EVIDENCE' : '⏳ AWAITING WORK COMPLETION'}
        </div>
        <img src="${issue.resolutionEvidenceUrl || (issue.status === 'Completed' ? '/static/sample_images/resolved_proof_sample.jpg' : '/static/sample_images/pothole_sample.jpg')}" alt="Resolution Proof" onerror="this.src='/static/sample_images/resolved_proof_sample.jpg'" style="${issue.status !== 'Completed' ? 'filter:grayscale(1) opacity(0.35)' : ''}" />
      </div>
    </div>

    ${issue.resolutionNote ? `
      <div style="margin-top:12px;padding:12px;border-radius:10px;background:#ecfdf5;border:1px solid #a7f3d0;font-size:11px;line-height:1.5">
        <strong style="color:#065f46">Resolution Summary:</strong> ${esc(issue.resolutionNote)}<br/>
        <span style="font-size:10px;color:#047857">Verified By: ${esc(issue.resolvedBy || "Municipal Engineer")} • Cost: ${esc(issue.resolutionCost || "₹2,500")}</span>
      </div>
    ` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
      <div class="meta-card"><span>Location</span><b>${esc(issue.location)}</b></div>
      <div class="meta-card"><span>GPS Coordinates</span><b>${issue.lat}, ${issue.lng}</b> <a href="${mapsLink}" target="_blank" style="font-size:10px;color:#2563eb">Open Maps ↗</a></div>
      <div class="meta-card"><span>Assigned Authority</span><b>${esc(issue.assignedDepartment || issue.owner || "Not Assigned")}</b></div>
      <div class="meta-card"><span>Field Crew / Officer</span><b>${esc(issue.assignedOfficer || "Pending Assignment")}</b></div>
      <div class="meta-card"><span>Turnaround SLA</span><b>${esc(issue.sla || "24h")}</b></div>
      <div class="meta-card"><span>Dispatch Status</span><b>${esc(issue.dispatchStatus || "Awaiting Review")}</b></div>
    </div>

    <div style="margin-top:12px;font-size:11px;color:var(--muted);line-height:1.6">
      <strong>Incident Description:</strong><br/>
      ${esc(issue.description || "No additional description provided.")}
    </div>

    <!-- Actions Bar -->
    <div class="admin-actions-bar" style="margin-top:18px;border-top:1px solid var(--line);padding-top:14px;flex-wrap:wrap">
      <button type="button" class="accent-btn" onclick="openDispatchModal('${issue.id}')">🚨 Dispatch Multi-Channel Alerts</button>
      <button type="button" class="primary-btn" onclick="openResolveModal('${issue.id}')" style="background:#16a34a;border-color:#16a34a">✓ Resolve with Proof</button>
      <button type="button" class="ghost-btn" onclick="printWorkOrder('${issue.id}')">📄 Print Work Order</button>
      <button type="button" class="ghost-btn" onclick="zoomToIssueOnMap('${issue.id}')">📍 Show on Map</button>
      <button type="button" class="ghost-btn" onclick="deleteIssue('${issue.id}')" style="color:#ef4444;border-color:#fca5a5;margin-left:auto">🗑️ Delete Grievance</button>
    </div>
  `;

  modal.classList.remove("hidden");
};

window.deleteIssue = async function(id) {
  if (!confirm(`Are you sure you want to permanently delete grievance ${id}?`)) return;
  try {
    let res = await fetch(`${API_ROOT}/issues/${id}`, {
      method: "DELETE",
      headers: apiHeaders()
    });
    // Fallback to POST /issues/{id}/delete if DELETE method returned 405 Method Not Allowed
    if (res.status === 405) {
      const fallback = await fetch(`${API_ROOT}/issues/${id}/delete`, {
        method: "POST",
        headers: apiHeaders()
      });
      if (fallback.ok) res = fallback;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.message || "Failed to delete issue");
    toast(data.message || `Issue ${id} deleted successfully.`, "success");
    qs("#issueModal")?.classList.add("hidden");
    await bootstrapBackend();
    renderAll();
  } catch (err) {
    console.error("Delete issue failed:", err);
    toast(err.message || "Failed to delete grievance.", "error");
  }
};


// ==============================================================================
// Multi-Channel Emergency Alert Dispatch Modal
// ==============================================================================
window.openDispatchModal = function(id) {
  const issue = state.issues.find(i => i.id === id);
  if (!issue) return;

  const modal = qs("#dispatchAlertModal");
  if (!modal) return;

  qs("#dispatchIssueHeader").textContent = `Ticket ${issue.id} — ${issue.category} (${issue.severity} Severity)`;
  qs("#dispatchLocationHeader").textContent = `Location: ${issue.location} (GPS: ${issue.lat}, ${issue.lng})`;

  // Populate authorities dropdown
  const authSelect = qs("#dispatchAuthoritySelect");
  if (authSelect) {
    authSelect.innerHTML = state.authorities.map(a => `
      <option value="${a.id}" ${issue.contactId === a.id ? 'selected' : ''}>
        ${esc(a.name)} — ${esc(a.department)} (${esc(a.city)})
      </option>
    `).join("");
  }

  // Voice announcement button in modal
  const voiceBtn = qs("#listenVoiceCallBtn");
  if (voiceBtn) {
    voiceBtn.onclick = () => {
      if (isSpeakingAnnouncement) {
        stopAnnouncement();
        toast("Voice IVR announcement stopped.", "info");
      } else {
        const text = `URBAN-EYES Emergency Notification for Executive Engineer. Critical ${issue.category} reported at ${issue.location}. Priority score ${issue.priority || 95}. Turnaround deadline is ${issue.sla || "4 hours"}. Immediate containment required.`;
        startAnnouncement(text, voiceBtn, "⏹️ Stop Audio");
      }
    };
  }

  const confirmBtn = qs("#confirmDispatchBtn");
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const channels = [];
      if (qs("#chkEmail")?.checked) channels.push("email");
      if (qs("#chkSms")?.checked) channels.push("sms");
      if (qs("#chkWhatsapp")?.checked) channels.push("whatsapp");
      if (qs("#chkCall")?.checked) channels.push("call");

      if (!channels.length) {
        toast("Select at least one notification channel.", "error");
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.textContent = "Transmitting Alerts...";

      try {
        const payload = {
          channels,
          authority_id: authSelect.value,
          custom_note: qs("#dispatchCustomNote")?.value || ""
        };

        const res = await fetch(`${API_ROOT}/issues/${issue.id}/dispatch-alert`, {
          method: "POST",
          headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        toast(`Alerts dispatched via ${channels.join(", ").toUpperCase()}!`, "success");

        // If WhatsApp was selected, offer direct WhatsApp web link
        if (data.channels?.whatsapp?.whatsappUrl) {
          window.open(data.channels.whatsapp.whatsappUrl, "_blank");
        }

        modal.classList.add("hidden");
        stopAnnouncement();
        bootstrapBackend();
      } catch (err) {
        console.error("Alert dispatch failed:", err);
        toast("Failed to dispatch alert. Verify network connection.", "error");
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "🚨 Transmit Alerts Now";
      }
    };
  }

  modal.classList.remove("hidden");
};

// ==============================================================================
// Government Resolution with Photographic Proof Modal
// ==============================================================================
window.openResolveModal = function(id) {
  const issue = state.issues.find(i => i.id === id);
  if (!issue) return;

  const modal = qs("#resolveModal");
  if (!modal) return;

  qs("#resolveIssueId").value = issue.id;
  qs("#resolveNoteInput").value = `Repaired ${issue.category.toLowerCase()} with standard bitumen mix, cleared area, and compacted to road level. Road safety restored.`;

  // Demo proof button
  state.selectedResolveProofFile = null;
  const demoProofBtn = qs("#useDemoResolveProofBtn");
  if (demoProofBtn) {
    demoProofBtn.onclick = async () => {
      try {
        const res = await fetch("/static/sample_images/resolved_proof_sample.jpg");
        const blob = await res.blob();
        const file = new File([blob], "resolved_proof_sample.jpg", { type: "image/jpeg" });
        state.selectedResolveProofFile = file;
        toast("Loaded verified demonstration repair photo.", "info");
      } catch {
        toast("Could not load demo repair photo.", "error");
      }
    };
  }

  const form = qs("#resolveForm");
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving Resolution Proof...";

      try {
        const formData = new FormData();
        formData.append("resolution_note", qs("#resolveNoteInput").value);
        formData.append("resolved_by", qs("#resolvedByInput").value);
        formData.append("resolution_cost", qs("#resolveCostInput").value);

        const fileInput = qs("#resolveEvidenceInput");
        const file = fileInput?.files?.[0] || state.selectedResolveProofFile;
        if (file) {
          formData.append("evidence", file);
        }

        const res = await fetch(`${API_ROOT}/issues/${issue.id}/resolve`, {
          method: "POST",
          headers: apiHeaders(),
          body: formData
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast(`Grievance ${issue.id} successfully marked as Resolved with Proof!`, "success");
        modal.classList.add("hidden");
        qs("#issueModal")?.classList.add("hidden");
        bootstrapBackend();
      } catch (err) {
        console.error("Resolution failed:", err);
        toast("Resolution failed. Verify server status.", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirm Resolution & Close Ticket";
      }
    };
  }

  modal.classList.remove("hidden");
};

// ==============================================================================
// Official Work Order Generation & Print
// ==============================================================================
window.printWorkOrder = async function(id) {
  try {
    const res = await fetch(`${API_ROOT}/issues/${id}/work-order`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const wo = data.workOrderNumber;
    const issue = data.issue;
    const auth = data.authority;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
      <head>
        <title>Official Municipal Work Order — ${wo}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:30px;color:#111;line-height:1.5}
          .header{border-bottom:2px solid #000;padding-bottom:14px;display:flex;justify-content:space-between}
          .title{font-size:20px;font-weight:bold;text-transform:uppercase}
          .meta{margin:20px 0;border:1px solid #ccc;padding:15px;background:#f9f9f9}
          table{width:100%;border-collapse:collapse;margin:20px 0}
          th,td{border:1px solid #ddd;padding:10px;text-align:left}
          th{background:#f1f1f1}
          .barcode{font-family:monospace;font-size:24px;letter-spacing:4px;margin-top:10px}
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${auth.name}</div>
            <div>${auth.department} • ${auth.city}, ${auth.state}</div>
          </div>
          <div style="text-align:right">
            <div><strong>WORK ORDER:</strong> ${wo}</div>
            <div><strong>DATE:</strong> ${new Date().toLocaleDateString('en-IN')}</div>
          </div>
        </div>

        <div class="meta">
          <strong>DEFECT CATEGORY:</strong> ${issue.category} (Severity: ${issue.severity})<br/>
          <strong>LOCATION:</strong> ${issue.location} (GPS: ${issue.lat}, ${issue.lng})<br/>
          <strong>ASSIGNED CONTRACTOR:</strong> ${issue.contractor || "Zone Maintenance Crew"}<br/>
          <strong>MANDATED SLA:</strong> ${data.slaDeadline}<br/>
          <strong>AUTHORIZED BUDGET:</strong> ${data.estimatedCost}
        </div>

        <h3>Scope of Works & Bill of Materials</h3>
        <table>
          <thead><tr><th>Item #</th><th>Required Material / Plant</th><th>Compliance Standard</th></tr></thead>
          <tbody>
            ${data.materialsRequired.map((m, idx) => `<tr><td>0${idx+1}</td><td>${m}</td><td>IRC:SP:98-2020 Guidelines</td></tr>`).join("")}
          </tbody>
        </table>

        <div style="margin-top:40px;display:flex;justify-content:space-between">
          <div>
            <div>_____________________________</div>
            <div>Inspecting Junior Engineer</div>
          </div>
          <div>
            <div>_____________________________</div>
            <div>Superintending Engineer (PWD)</div>
          </div>
        </div>

        <div style="text-align:center;margin-top:40px" class="barcode">*${wo}*</div>
        <script>window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  } catch (err) {
    toast("Failed to generate work order.", "error");
  }
};

// ==============================================================================
// Live Maps: Mini Map & Main GIS Pan-India Map
// ==============================================================================
function initMiniMap() {
  const container = qs("#miniMap");
  if (!container || !window.L) return;

  if (miniMapInstance) {
    miniMapInstance.invalidateSize();
    refreshMiniMapMarkers();
    return;
  }

  miniMapInstance = L.map("miniMap", { zoomControl: false }).setView([28.6139, 77.2090], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(miniMapInstance);

  if (window.ResizeObserver && !container.__ro) {
    const ro = new ResizeObserver(() => {
      if (miniMapInstance) miniMapInstance.invalidateSize();
    });
    ro.observe(container);
    container.__ro = ro;
  }

  setTimeout(() => {
    if (miniMapInstance) miniMapInstance.invalidateSize();
  }, 100);
  setTimeout(() => {
    if (miniMapInstance) miniMapInstance.invalidateSize();
  }, 300);

  refreshMiniMapMarkers();
}

function refreshMiniMapMarkers() {
  if (!window.L) return;
  if (!miniMapInstance) {
    initMiniMap();
    return;
  }
  miniMapMarkers.forEach(m => miniMapInstance.removeLayer(m));
  miniMapMarkers = [];

  const issues = getFilteredIssues();
  const sevColors = { Critical: "#dc2626", High: "#f59e0b", Medium: "#0284c7", Low: "#16a34a" };

  issues.forEach(i => {
    if (!i.lat || !i.lng) return;
    const color = sevColors[i.severity] || "#0284c7";
    const marker = L.circleMarker([i.lat, i.lng], {
      radius: i.severity === "Critical" ? 9 : 6,
      fillColor: color,
      color: "#fff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(miniMapInstance);

    marker.bindPopup(`<b>${esc(i.title)}</b><br/>${esc(i.location)}<br/>${badgeSeverity(i.severity)}`);
    miniMapMarkers.push(marker);
  });
}

function initMainMap() {
  const container = qs("#mainMap");
  if (!container || !window.L) return;

  if (mainMapInstance) {
    mainMapInstance.invalidateSize();
    refreshMainMapMarkers();
    return;
  }

  mainMapInstance = L.map("mainMap", { zoomControl: true }).setView([22.5937, 78.9629], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors"
  }).addTo(mainMapInstance);

  if (window.ResizeObserver && !container.__ro) {
    const ro = new ResizeObserver(() => {
      if (mainMapInstance) mainMapInstance.invalidateSize();
    });
    ro.observe(container);
    container.__ro = ro;
  }

  setTimeout(() => {
    if (mainMapInstance) mainMapInstance.invalidateSize();
  }, 100);

  refreshMainMapMarkers();
  setupMainMapControls();
}

function refreshMainMapMarkers() {
  if (!mainMapInstance || !window.L) return;
  mainMapMarkers.forEach(m => mainMapInstance.removeLayer(m));
  mainMapMarkers = [];
  heatmapCircles.forEach(c => mainMapInstance.removeLayer(c));
  heatmapCircles = [];

  const sevFilter = qs("#mapSeverityFilterSelect")?.value || "all";
  const issues = getFilteredIssues().filter(i => {
    if (sevFilter !== "all" && i.severity !== sevFilter) return false;
    return true;
  });

  const sevColors = { Critical: "#dc2626", High: "#f59e0b", Medium: "#0284c7", Low: "#16a34a" };

  issues.forEach(i => {
    if (!i.lat || !i.lng) return;
    const color = sevColors[i.severity] || "#0284c7";
    const isCrit = i.severity === "Critical";

    const iconHtml = `
      <div style="background:${color};width:${isCrit ? '22px' : '16px'};height:${isCrit ? '22px' : '16px'};border-radius:50%;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.35);display:grid;place-items:center;color:#fff;font-size:10px;font-weight:bold" class="${isCrit ? 'pulse-beacon' : ''}">
      </div>
    `;

    const customIcon = L.divIcon({
      html: iconHtml,
      className: "ue-map-pin",
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    const marker = L.marker([i.lat, i.lng], { icon: customIcon }).addTo(mainMapInstance);

    const popupHtml = `
      <div style="font-family:'DM Sans',sans-serif;min-width:210px">
        <div style="border-radius:8px;overflow:hidden;max-height:100px;margin-bottom:6px">
          <img src="${i.evidenceUrl || '/static/sample_images/pothole_sample.jpg'}" style="width:100%;height:80px;object-fit:cover" onerror="this.src='/static/sample_images/pothole_sample.jpg'" />
        </div>
        <div style="font-size:9px;color:#2563eb;font-weight:bold">${esc(i.id)} • ${esc(i.category)}</div>
        <div style="font-weight:bold;font-size:12px;margin:2px 0">${esc(i.title)}</div>
        <div style="font-size:10px;color:#64748b">${esc(i.location)}</div>
        <div style="display:flex;gap:4px;margin:6px 0">
          ${badgeSeverity(i.severity)}
          ${badgeStatus(i.status)}
        </div>
        <button type="button" class="primary-btn" style="width:100%;padding:5px 8px;font-size:10px;margin-top:4px" onclick="openIssueModal('${i.id}')">Inspect Grievance →</button>
      </div>
    `;

    marker.bindPopup(popupHtml);
    mainMapMarkers.push(marker);

    // Heatmap density circles
    if (isHeatmapActive) {
      const circle = L.circle([i.lat, i.lng], {
        radius: isCrit ? 800 : 450,
        fillColor: color,
        fillOpacity: 0.28,
        stroke: false
      }).addTo(mainMapInstance);
      heatmapCircles.push(circle);
    }
  });
}

function setupMainMapControls() {
  // City jump shortcuts
  qsa("[data-city-jump]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.cityJump;
      if (INDIAN_CITIES[key] && mainMapInstance) {
        const { center, zoom } = INDIAN_CITIES[key];
        mainMapInstance.flyTo(center, zoom, { duration: 1.2 });
      }
    });
  });

  // Severity filter
  qs("#mapSeverityFilterSelect")?.addEventListener("change", refreshMainMapMarkers);

  // Address search
  qs("#mapAddressSearchBtn")?.addEventListener("click", async () => {
    const q = qs("#mapAddressSearchInput")?.value?.trim();
    if (!q) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ", India")}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        mainMapInstance.flyTo([lat, lon], 14, { duration: 1.2 });
        L.popup().setLatLng([lat, lon]).setContent(`<b>${esc(data[0].display_name)}</b>`).openOn(mainMapInstance);
      } else {
        toast("Location not found in India.", "info");
      }
    } catch {
      toast("Address lookup failed. Check internet access.", "error");
    }
  });

  // Locate me
  qs("#mapLocateUserBtn")?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      toast("Geolocation is not supported by your browser.", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      mainMapInstance.flyTo([latitude, longitude], 15);
      L.marker([latitude, longitude]).addTo(mainMapInstance).bindPopup("<b>You are here</b>").openPopup();
    }, () => toast("Unable to retrieve location.", "error"));
  });

  // Heatmap toggle
  qs("#mapHeatmapToggleBtn")?.addEventListener("click", () => {
    isHeatmapActive = !isHeatmapActive;
    qs("#mapHeatmapToggleBtn").classList.toggle("primary-btn", isHeatmapActive);
    refreshMainMapMarkers();
  });

  // Fullscreen
  qs("#mapFullscreenToggleBtn")?.addEventListener("click", () => {
    const el = qs("#mainMap");
    if (!document.fullscreenElement) el?.requestFullscreen();
    else document.exitFullscreen();
  });
}

window.zoomToIssueOnMap = function(id) {
  const issue = state.issues.find(i => i.id === id);
  if (!issue || !issue.lat || !issue.lng) return;
  navigate("map");
  setTimeout(() => {
    if (mainMapInstance) {
      mainMapInstance.flyTo([issue.lat, issue.lng], 16, { duration: 1.0 });
      const marker = mainMapMarkers.find(m => {
        const ll = m.getLatLng();
        return Math.abs(ll.lat - issue.lat) < 0.0001 && Math.abs(ll.lng - issue.lng) < 0.0001;
      });
      if (marker) marker.openPopup();
    }
  }, 200);
  qs("#issueModal")?.classList.add("hidden");
};

// ==============================================================================
// Citizen Report Form & Live Map Pinning
// ==============================================================================
function initReportMap() {
  const container = qs("#reportMap");
  if (!container || !window.L) return;

  if (reportMapInstance) {
    reportMapInstance.invalidateSize();
    return;
  }

  const defLat = 28.6342;
  const defLng = 77.4475;
  setReportCoords(defLat, defLng, "Ghaziabad (ABESEC NH-24 Bypass)");

  reportMapInstance = L.map("reportMap").setView([defLat, defLng], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(reportMapInstance);

  if (window.ResizeObserver && !container.__ro) {
    const ro = new ResizeObserver(() => {
      if (reportMapInstance) reportMapInstance.invalidateSize();
    });
    ro.observe(container);
    container.__ro = ro;
  }

  setTimeout(() => {
    if (reportMapInstance) reportMapInstance.invalidateSize();
  }, 100);

  reportMarker = L.marker([defLat, defLng], { draggable: true }).addTo(reportMapInstance);
  reportMarker.on("dragend", async () => {
    const ll = reportMarker.getLatLng();
    setReportCoords(ll.lat, ll.lng);
    reverseGeocode(ll.lat, ll.lng);
  });

  reportMapInstance.on("click", (e) => {
    reportMarker.setLatLng(e.latlng);
    setReportCoords(e.latlng.lat, e.latlng.lng);
    reverseGeocode(e.latlng.lat, e.latlng.lng);
  });

  // Report map search
  qs("#reportMapSearchBtn")?.addEventListener("click", async () => {
    const q = qs("#reportMapSearchInput")?.value?.trim();
    if (!q) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ", India")}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        reportMapInstance.flyTo([lat, lon], 15);
        reportMarker.setLatLng([lat, lon]);
        setReportCoords(lat, lon, data[0].display_name);
      }
    } catch {
      toast("Search lookup failed.", "error");
    }
  });

  // Report locate me
  qs("#reportLocateMeBtn")?.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      reportMapInstance.flyTo([latitude, longitude], 15);
      reportMarker.setLatLng([latitude, longitude]);
      setReportCoords(latitude, longitude, "My Current GPS Location");
      reverseGeocode(latitude, longitude);
    });
  });
}

function setReportCoords(lat, lng, addressHint = "") {
  if (qs("#reportLat")) qs("#reportLat").value = Number(lat).toFixed(6);
  if (qs("#reportLng")) qs("#reportLng").value = Number(lng).toFixed(6);
  if (addressHint && qs("#reportLocation")) qs("#reportLocation").value = addressHint;
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    if (data?.display_name && qs("#reportLocation")) {
      qs("#reportLocation").value = data.display_name;
    }
  } catch {}
}

// ==============================================================================
// Live Camera Capture (Smartphone & Laptop Webcams)
// ==============================================================================
async function startCamera() {
  const box = qs("#cameraPreviewBox");
  const video = qs("#cameraVideo");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast("Camera access is not supported by your browser.", "error");
    return;
  }
  try {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
    }).catch(() => navigator.mediaDevices.getUserMedia({ video: true }));

    video.srcObject = cameraStream;
    await video.play();
    box.style.display = "block";
    toast("Live camera active. Point towards road defect and click Capture.", "info");
  } catch (err) {
    console.error("Camera access failed:", err);
    toast("Could not access camera. Please allow camera permissions.", "error");
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  const box = qs("#cameraPreviewBox");
  if (box) box.style.display = "none";
  const video = qs("#cameraVideo");
  if (video) video.srcObject = null;
}

function captureSnapshot() {
  const video = qs("#cameraVideo");
  if (!video || !cameraStream) return;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const file = new File([blob], `live_capture_${Date.now()}.jpg`, { type: "image/jpeg" });
    state.selectedReportFile = file;

    const dataUrl = canvas.toDataURL("image/jpeg");
    qs("#reportPreviewImg").src = dataUrl;
    qs("#reportEvidencePreview").style.display = "block";
    qs("#reportFileName").textContent = file.name;

    stopCamera();
    toast("Live photo captured! Running AI Auto-Extraction...", "info");
    triggerAiAutoExtract();
  }, "image/jpeg", 0.92);
}

// Sample image quick pickers
function setupSamplePickers() {
  const sampleCategoryMap = {
    pothole: "Pothole",
    road_crack: "Road crack",
    garbage: "Garbage",
    streetlight: "Streetlight",
    drainage: "Drainage",
    footpath: "Footpath",
    traffic_signal: "Traffic signal"
  };

  qsa("[data-sample]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const sampleKey = btn.dataset.sample;
      const targetCat = sampleCategoryMap[sampleKey];
      if (targetCat && qs("#reportCategory")) {
        qs("#reportCategory").value = targetCat;
      }

      const url = `/static/sample_images/${sampleKey}_sample.jpg`;

      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], `${sampleKey}_sample.jpg`, { type: "image/jpeg" });
        state.selectedReportFile = file;

        try {
          const container = new DataTransfer();
          container.items.add(file);
          qs("#reportFileInput").files = container.files;
        } catch {}

        qs("#reportFileName").textContent = file.name;
        qs("#reportPreviewImg").src = url;
        qs("#reportEvidencePreview").style.display = "block";

        toast(`Loaded ${targetCat || sampleKey} test sample. Running AI Auto-Extraction...`, "info");
        triggerAiAutoExtract();
      } catch (err) {
        console.error("Failed to load sample:", err);
        toast("Failed to load sample image.", "error");
      }
    });
  });
}

// Trigger AI Auto-Extraction from image
async function triggerAiAutoExtract() {
  const file = state.selectedReportFile || qs("#reportFileInput")?.files?.[0];
  if (!file) {
    toast("Select or take a photo first.", "error");
    return;
  }

  const btn = qs("#aiAutoExtractBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "✨ Analyzing Full Image with AI...";
  }

  try {
    const form = new FormData();
    form.append("file", file);
    form.append("location_hint", qs("#reportLocation")?.value || "");
    form.append("category_hint", qs("#reportCategory")?.value || "");
    form.append("title_hint", qs("#reportTitle")?.value || "");

    const res = await fetch(`${API_ROOT}/ai-extract-report`, {
      method: "POST",
      body: form
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Autofill form
    if (qs("#reportTitle")) qs("#reportTitle").value = data.title;
    if (qs("#reportCategory")) qs("#reportCategory").value = data.category;
    if (qs("#reportSeverity")) qs("#reportSeverity").value = data.severity;
    if (qs("#reportDescription")) qs("#reportDescription").value = data.description;

    if (qs("#routedDeptName")) qs("#routedDeptName").textContent = data.suggestedDepartment;
    if (qs("#routedSla")) qs("#routedSla").textContent = data.sla;
    if (qs("#routedCost")) qs("#routedCost").textContent = data.estimatedCost;

    // If EXIF GPS present, update map
    if (data.exif?.hasExif && data.exif.lat && data.exif.lng) {
      setReportCoords(data.exif.lat, data.exif.lng, `EXIF GPS: ${data.exif.lat}, ${data.exif.lng}`);
      if (reportMapInstance && reportMarker) {
        reportMapInstance.flyTo([data.exif.lat, data.exif.lng], 15);
        reportMarker.setLatLng([data.exif.lat, data.exif.lng]);
      }
      toast("Extracted EXIF GPS coordinates from photo!", "success");
    }

    if (data.annotatedUrl) {
      qs("#reportPreviewImg").src = data.annotatedUrl;
      if (qs("#previewResolutionText")) {
        qs("#previewResolutionText").textContent = `✓ ${data.category} (${data.severity}) Detected • Complete Uncropped Frame`;
      }
    }

    toast(`AI successfully identified ${data.category} (${data.severity}) across complete frame!`, "success");
  } catch (err) {
    console.error("AI Auto-Extraction failed:", err);
    toast("AI extraction failed. Please fill manually.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "✨ Auto-Extract with AI";
    }
  }
}

function setupReportForm() {
  qs("#aiAutoExtractBtn")?.addEventListener("click", triggerAiAutoExtract);
  qs("#citizenCameraBtn")?.addEventListener("click", startCamera);
  qs("#closeCameraBtn")?.addEventListener("click", stopCamera);
  qs("#snapPhotoBtn")?.addEventListener("click", captureSnapshot);

  qs("#reportFileInput")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) {
      state.selectedReportFile = file;
      qs("#reportFileName").textContent = file.name;
      const reader = new FileReader();
      reader.onload = (ev) => {
        qs("#reportPreviewImg").src = ev.target.result;
        qs("#reportEvidencePreview").style.display = "block";
        const img = new Image();
        img.onload = () => {
          if (qs("#previewResolutionText")) {
            qs("#previewResolutionText").textContent = `${img.naturalWidth} × ${img.naturalHeight} px (Full Uncropped Frame)`;
          }
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);

      // Automatically trigger AI extraction across complete image on upload
      toast("Full image captured. Running AI defect detection...", "info");
      triggerAiAutoExtract();
    }
  });

  qs("#clearEvidenceBtn")?.addEventListener("click", () => {
    state.selectedReportFile = null;
    qs("#reportFileInput").value = "";
    qs("#reportFileName").textContent = "JPG, PNG, MP4 supported up to 50MB";
    qs("#reportEvidencePreview").style.display = "none";
    stopCamera();
  });

  // Submit report
  qs("#reportForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = qs("#submitReportBtn");
    btn.disabled = true;
    btn.textContent = "Submitting Grievance...";

    try {
      const payload = {
        title: qs("#reportTitle").value,
        category: qs("#reportCategory").value,
        severity: qs("#reportSeverity").value,
        location: qs("#reportLocation").value,
        description: qs("#reportDescription").value,
        lat: parseFloat(qs("#reportLat").value),
        lng: parseFloat(qs("#reportLng").value),
        sla: qs("#routedSla")?.textContent || "24h",
        estimatedCost: qs("#routedCost")?.textContent || "₹3,500"
      };

      const formData = new FormData();
      formData.append("issue", JSON.stringify(payload));
      const file = state.selectedReportFile || qs("#reportFileInput")?.files?.[0];
      if (file) formData.append("evidence", file);

      const res = await fetch(`${API_ROOT}/issues`, {
        method: "POST",
        headers: apiHeaders(),
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      toast(`Grievance submitted successfully! Ticket ID: ${data.issue.id}`, "success");

      // Reset form
      qs("#reportForm").reset();
      state.selectedReportFile = null;
      qs("#reportEvidencePreview").style.display = "none";
      stopCamera();
      await bootstrapBackend();
      navigate("issues");
    } catch (err) {
      console.error("Report submit failed:", err);
      toast(err.message || "Failed to submit grievance.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Submit Official Grievance";
    }
  });
}

// ==============================================================================
// AI Defect Scanner Studio
// ==============================================================================
function setupScanner() {
  qsa("[data-scan-sample]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const sampleKey = btn.dataset.scanSample;
      const url = `/static/sample_images/${sampleKey}_sample.jpg`;
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], `${sampleKey}_sample.jpg`, { type: "image/jpeg" });
        state.selectedScanFile = file;

        try {
          const container = new DataTransfer();
          container.items.add(file);
          qs("#scanFileInput").files = container.files;
        } catch {}

        qs("#scanFileName").textContent = file.name;
        qs("#scanOriginalImg").src = url;
        qs("#scanOriginalWrap").style.display = "grid";
        qs("#executeScanBtn").disabled = false;

        runScannerInference(file);
      } catch (err) {
        console.error("Scanner sample load failed:", err);
      }
    });
  });

  qs("#scanFileInput")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) {
      state.selectedScanFile = file;
      qs("#scanFileName").textContent = file.name;
      const reader = new FileReader();
      reader.onload = (ev) => {
        qs("#scanOriginalImg").src = ev.target.result;
        qs("#scanOriginalWrap").style.display = "grid";
        qs("#executeScanBtn").disabled = false;
      };
      reader.readAsDataURL(file);
    }
  });

  qs("#executeScanBtn")?.addEventListener("click", () => {
    const file = state.selectedScanFile || qs("#scanFileInput")?.files?.[0];
    if (file) runScannerInference(file);
    else toast("Please select or drop an image first.", "error");
  });
}

async function runScannerInference(file) {
  const btn = qs("#executeScanBtn");
  btn.disabled = true;
  btn.textContent = "Running Neural Network...";
  qs("#scanStatusBadge").textContent = "Analyzing...";

  try {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${API_ROOT}/inference`, {
      method: "POST",
      headers: apiHeaders(),
      body: form
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.detected) {
      qs("#scanResultPlaceholder").style.display = "none";
      qs("#scanResultOutput").style.display = "block";
      qs("#scanAnnotatedImg").src = data.annotatedUrl || qs("#scanOriginalImg").src;

      qs("#metaClass").textContent = data.category;
      qs("#metaConf").textContent = `${Math.round(data.confidence * 100)}%`;
      qs("#metaSev").textContent = data.severity;
      qs("#metaDept").textContent = data.owner || "Roads & Infrastructure / PWD";
      qs("#metaSla").textContent = data.severity === "Critical" ? "4h" : "24h";
      qs("#metaCost").textContent = "₹3,500";

      qs("#scanStatusBadge").textContent = "Defect Detected";
      qs("#scanStatusBadge").className = "status-pill live";

      // Transfer button
      qs("#scanTransferBtn").onclick = () => {
        navigate("report");
        if (qs("#reportCategory")) qs("#reportCategory").value = data.category;
        if (qs("#reportSeverity")) qs("#reportSeverity").value = data.severity;
        if (qs("#reportTitle")) qs("#reportTitle").value = `Verified ${data.category} detected via AI Vision`;
      };

      toast(`Identified ${data.category} (${data.severity})!`, "success");
    } else {
      toast("No road defect detected in frame.", "info");
      qs("#scanStatusBadge").textContent = "No Detections";
    }
  } catch (err) {
    console.error("Scanner failed:", err);
    toast("Inference failed.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Execute AI Defect Scan";
  }
}

// ==============================================================================
// Car Dashcam Inspection Studio
// ==============================================================================
function setupDashcam() {
  qsa("[data-route]").forEach(btn => {
    btn.addEventListener("click", () => {
      loadDashcamRoute(btn.dataset.route);
    });
  });

  qs("#playDashcamSimBtn")?.addEventListener("click", playDashcamRoute);

  qs("#uploadDashcamVideoBtn")?.addEventListener("click", () => {
    qs("#dashcamCustomInput")?.click();
  });

  qs("#dashcamCustomInput")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast("Processing dashcam video frames with YOLOv8...", "info");
    const form = new FormData();
    form.append("video", file);

    try {
      const res = await fetch(`${API_ROOT}/dashcam-inspect`, {
        method: "POST",
        body: form
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      currentDashcamData = data;
      dashcamSimulationEvents = data.events || [];
      renderDashcamEvents(data);
      toast(`Processed ${data.defectsCount} defects along drive!`, "success");
    } catch {
      toast("Video processing failed.", "error");
    }
  });

  // Batch log button
  qs("#batchLogDashcamBtn")?.addEventListener("click", async () => {
    if (!dashcamSimulationEvents.length) {
      toast("No defects detected along route to log.", "error");
      return;
    }

    const btn = qs("#batchLogDashcamBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Logging to Grievances...";
    }

    toast(`Logging ${dashcamSimulationEvents.length} detected defects with photo evidence...`, "info");
    const routeCity = currentDashcamData?.city || "Delhi NCR";
    const routeName = currentDashcamData?.routeName || "Vehicle Dashcam Survey";

    let successCount = 0;
    for (const ev of dashcamSimulationEvents) {
      const payload = {
        title: `Dashcam Flagged: ${ev.cat} (${ev.sev})`,
        category: ev.cat,
        severity: ev.sev,
        location: `${routeName} — Chainage Sec ${ev.sec} (${routeCity})`,
        city: routeCity,
        state: currentDashcamData?.state || "Delhi",
        description: ev.note || `Dashcam optical scan detected ${ev.cat} (${ev.sev}) at speed ${ev.speed} km/h.`,
        lat: ev.lat,
        lng: ev.lng,
        sla: ev.sev === "Critical" ? "4h" : "24h",
        estimatedCost: "₹3,500",
        evidenceUrl: ev.thumbnail || "",
        evidenceName: `dashcam_capture_sec_${ev.sec}.jpg`,
        source: "Dashcam drive scan"
      };

      const formData = new FormData();
      formData.append("issue", JSON.stringify(payload));

      try {
        const res = await fetch(`${API_ROOT}/issues`, {
          method: "POST",
          headers: apiHeaders(),
          body: formData
        });
        if (res.ok) successCount++;
        else {
          const errData = await res.json().catch(() => ({}));
          console.error("Issue creation error:", errData);
        }
      } catch (err) {
        console.error("Batch log network error:", err);
      }
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = "📥 Batch-Log All to Gov Queue";
    }

    // Reset filters so newly logged grievances are immediately visible in the table!
    selectedCity = "all";
    if (qs("#cityFilterSelect")) qs("#cityFilterSelect").value = "all";
    if (qs("#issueSearchInput")) qs("#issueSearchInput").value = "";
    if (qs("#issueStatusSelect")) qs("#issueStatusSelect").value = "all";
    if (qs("#issueCategorySelect")) qs("#issueCategorySelect").value = "all";
    if (qs("#issueSeveritySelect")) qs("#issueSeveritySelect").value = "all";

    toast(`Successfully logged ${successCount} grievances with photo evidence!`, "success");
    await bootstrapBackend();
    navigate("issues");
    renderIssueTable();
  });
}

async function loadDashcamRoute(routeId) {
  try {
    const form = new FormData();
    form.append("route_id", routeId);

    const res = await fetch(`${API_ROOT}/dashcam-inspect`, {
      method: "POST",
      body: form
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    currentDashcamData = data;
    dashcamSimulationEvents = data.events || [];
    renderDashcamEvents(data);
  } catch (err) {
    console.error("Route load failed:", err);
  }
}

function renderDashcamEvents(data) {
  if (qs("#dashcamRouteTitle")) qs("#dashcamRouteTitle").textContent = `${data.routeName} (${data.distanceKm || 5} km)`;
  if (qs("#dashcamDefectsFound")) qs("#dashcamDefectsFound").textContent = `${data.defectsCount} Defects Flagged`;
  if (qs("#hudHealth")) qs("#hudHealth").textContent = `${data.roadHealthScore}/100`;

  const track = qs("#dashcamTrack");
  if (track && dashcamSimulationEvents.length) {
    const maxSec = Math.max(...dashcamSimulationEvents.map(e => e.sec || 1), 15);
    track.innerHTML = dashcamSimulationEvents.map((ev, idx) => {
      const pct = Math.min(95, Math.max(5, (ev.sec / maxSec) * 100));
      return `<div class="timeline-pin" style="left:${pct}%" title="Sec ${ev.sec}: ${ev.cat} (${ev.sev})" onclick="event.stopPropagation();showDashcamFrame(${idx})"></div>`;
    }).join("");

    track.onclick = (e) => {
      const rect = track.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const targetIdx = Math.round(ratio * (dashcamSimulationEvents.length - 1));
      showDashcamFrame(targetIdx);
    };
  }

  const list = qs("#dashcamEventsList");
  if (!list) return;

  list.innerHTML = dashcamSimulationEvents.map((ev, idx) => `
    <div class="dashcam-event-item" id="dashcam-item-${idx}" style="display:flex;gap:10px;padding:8px;background:var(--panel-card);border:1px solid var(--line);border-radius:10px;align-items:center;cursor:pointer;transition:.15s;color:var(--ink)" onclick="showDashcamFrame(${idx})">
      <img src="${ev.thumbnail}" style="width:48px;height:40px;object-fit:cover;border-radius:6px" onerror="this.src='/static/sample_images/pothole_sample.jpg'" />
      <div style="flex:1">
        <div style="font-size:10px;font-weight:700">${ev.cat} (${ev.sev})</div>
        <div style="font-size:9px;color:var(--muted)">Sec ${ev.sec} • ${ev.speed} km/h • ${ev.lat}, ${ev.lng}</div>
      </div>
      <div>${badgeSeverity(ev.sev)}</div>
    </div>
  `).join("");

  if (dashcamSimulationEvents[0]) showDashcamFrame(0);
}

window.showDashcamFrame = function(idx) {
  const ev = dashcamSimulationEvents[idx];
  if (!ev) return;
  qs("#dashcamFrameImg").src = ev.thumbnail;
  if (qs("#hudSpeed")) qs("#hudSpeed").textContent = `${ev.speed} km/h`;
  if (qs("#hudGps")) qs("#hudGps").textContent = `${ev.lat}° N, ${ev.lng}° E`;

  qsa(".dashcam-event-item").forEach((el, i) => {
    el.style.borderColor = (i === idx) ? "var(--blue)" : "var(--line)";
    el.style.background = (i === idx) ? "var(--card-hover)" : "var(--panel-card)";
  });
};

function playDashcamRoute() {
  if (!dashcamSimulationEvents.length) return;
  clearInterval(dashcamInterval);
  dashcamCurrentIndex = 0;
  toast("Playing vehicle route inspection...", "info");

  dashcamInterval = setInterval(() => {
    if (dashcamCurrentIndex >= dashcamSimulationEvents.length) {
      clearInterval(dashcamInterval);
      toast("Route drive inspection completed.", "success");
      return;
    }
    showDashcamFrame(dashcamCurrentIndex);
    dashcamCurrentIndex++;
  }, 1600);
}

// ==============================================================================
// Predictive Analytics & Maintenance Hub
// ==============================================================================
async function loadPredictiveAnalytics() {
  try {
    const res = await fetch(`${API_ROOT}/analytics/predictive-maintenance`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (qs("#healthScoreDisplay")) qs("#healthScoreDisplay").textContent = `${data.overallCityHealth}/100`;

    // Predictive cards
    const cardList = qs("#predictiveCardsList");
    if (cardList) {
      cardList.innerHTML = (data.predictiveHotspots || []).map(p => `
        <div style="padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--panel-card);color:var(--ink)">
          <div style="display:flex;justify-content:space-between">
            <strong style="font-size:12px">${esc(p.corridor)}</strong>
            <span class="badge high">${p.probability} Risk</span>
          </div>
          <div style="font-size:10px;color:#dc2626;font-weight:bold;margin:4px 0">${esc(p.defectType)} • Due: ${esc(p.predictedFailureDate)}</div>
          <div style="font-size:10px;color:var(--muted)">${esc(p.recommendedAction)}</div>
          <div style="font-size:9px;color:#16a34a;margin-top:4px;font-weight:bold">Estimated Cost Savings: ${esc(p.costSaving)}</div>
        </div>
      `).join("");
    }

    // Zone list
    const zoneList = qs("#zoneHealthList");
    if (zoneList) {
      zoneList.innerHTML = (data.zoneBreakdown || []).map(z => `
        <div style="padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--panel-card);color:var(--ink)">
          <div style="display:flex;justify-content:space-between">
            <span style="font-weight:700;font-size:11px">${esc(z.zone)}</span>
            <span style="font-family:'Space Grotesk';font-weight:700">${z.health}/100</span>
          </div>
          <div style="font-size:9px;color:var(--muted);margin-top:4px">Pothole Risk: ${z.potholeRisk} • Monsoon Risk: ${z.monsoonRisk}</div>
        </div>
      `).join("");
    }
  } catch (err) {
    console.error("Predictive load failed:", err);
  }
}

// ==============================================================================
// Admin Triage Queue & Authorities List
// ==============================================================================
function renderAdminQueue() {
  const container = qs("#adminQueueContainer");
  if (!container) return;

  const statusFilter = qs("#adminFilterStatusSelect")?.value || "all";
  const issues = getFilteredIssues().filter(i => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    return true;
  });

  container.innerHTML = issues.map(i => `
    <div class="admin-issue-card">
      <div class="admin-card-head">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="position:relative;width:56px;height:46px;flex-shrink:0;border-radius:6px;overflow:hidden;background:#0f172a;cursor:pointer;border:1px solid var(--line)" onclick="openIssueModal('${i.id}')" title="Click to view full photo evidence">
            <img src="${i.evidenceUrl || '/static/sample_images/pothole_sample.jpg'}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='/static/sample_images/pothole_sample.jpg'" alt="${esc(i.category)}" />
            <span style="position:absolute;bottom:1px;right:2px;background:rgba(0,0,0,0.65);color:#fff;font-size:7px;padding:1px 3px;border-radius:3px">📷</span>
          </div>
          <div>
            <span style="font-family:'Space Grotesk';font-size:10px;font-weight:700;color:#2563eb">${esc(i.id)}</span>
            <h4 style="margin:2px 0;font:700 13px 'Space Grotesk'">${esc(i.title)}</h4>
            <div style="font-size:10px;color:var(--muted)">${esc(i.location)}</div>
          </div>
        </div>
        <div style="display:flex;gap:4px">
          ${badgeSeverity(i.severity)}
          ${badgeStatus(i.status)}
        </div>
      </div>

      <div style="font-size:10px;color:var(--muted);margin:8px 0;display:flex;flex-wrap:wrap;gap:8px">
        <span><strong>Assigned:</strong> ${esc(i.assignedDepartment || i.owner || "Unassigned")}</span>
        <span><strong>SLA:</strong> ${esc(i.sla || "24h")}</span>
        <span><strong>Dispatch:</strong> ${esc(i.dispatchStatus || "Pending")}</span>
      </div>

      <div class="admin-quick-status-row" style="margin:8px 0;display:flex;align-items:center;gap:8px;background:var(--panel);padding:6px 10px;border-radius:8px;border:1px solid var(--line);flex-wrap:wrap">
        <span style="font-size:10px;font-weight:700;color:var(--ink)">Quick Status Update:</span>
        <select class="admin-quick-select" style="font-size:10px;padding:4px 8px;border-radius:6px;border:1px solid var(--line);background:var(--input-bg);color:var(--ink);cursor:pointer" onchange="quickUpdateStatus('${i.id}', this.value)">
          <option value="Not assigned" ${i.status === 'Not assigned' ? 'selected' : ''}>Pending / Not assigned</option>
          <option value="Assigned" ${i.status === 'Assigned' ? 'selected' : ''}>Assigned</option>
          <option value="In progress" ${i.status === 'In progress' ? 'selected' : ''}>In progress</option>
          <option value="Completed" ${i.status === 'Completed' ? 'selected' : ''}>Completed / Resolved</option>
        </select>
      </div>

      <div class="admin-actions-bar">
        <button type="button" class="accent-btn" onclick="openDispatchModal('${i.id}')">🚨 Dispatch Alerts</button>
        <button type="button" class="primary-btn" onclick="openResolveModal('${i.id}')" style="background:#16a34a;border-color:#16a34a">✓ Resolve</button>
        <button type="button" class="ghost-btn" onclick="openIssueModal('${i.id}')">Details</button>
      </div>
    </div>
  `).join("") || `<div style="padding:20px;text-align:center;color:#94a3b8">No grievances in queue matching filter.</div>`;

  // Authorities directory
  const authContainer = qs("#authoritiesListContainer");
  if (authContainer) {
    authContainer.innerHTML = state.authorities.map(a => `
      <div style="padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--panel-card);color:var(--ink)">
        <strong style="font-size:11px">${esc(a.name)}</strong>
        <div style="font-size:9px;color:var(--blue);font-weight:700">${esc(a.city)} • ${esc(a.state)}</div>
        <div style="font-size:9px;color:var(--muted);margin-top:2px">Officer: ${esc(a.officer)}</div>
        <div style="font-size:9px;color:var(--muted)">📞 ${esc(a.phone)} • 💬 ${esc(a.whatsapp)}</div>
      </div>
    `).join("");
  }
}

window.quickUpdateStatus = async function(id, newStatus) {
  try {
    const issue = state.issues.find(i => i.id === id);
    const payload = {
      status: newStatus,
      assignedDepartment: issue?.assignedDepartment || issue?.owner || "Roads & Infrastructure / PWD"
    };
    const res = await fetch(`${API_ROOT}/issues/${id}`, {
      method: "PUT",
      headers: apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Update failed");
    }
    toast(`Ticket ${id} status updated to ${newStatus}`, "success");
    bootstrapBackend();
  } catch (err) {
    console.error("Status update failed:", err);
    toast(err.message || "Failed to update status", "error");
  }
};

function setupFilters() {
  qs("#issueSearchInput")?.addEventListener("input", renderIssueTable);
  qs("#issueStatusSelect")?.addEventListener("change", renderIssueTable);
  qs("#issueCategorySelect")?.addEventListener("change", renderIssueTable);
  qs("#issueSeveritySelect")?.addEventListener("change", renderIssueTable);
  qs("#adminFilterStatusSelect")?.addEventListener("change", renderAdminQueue);
}

// ==============================================================================
// Unified Render All
// ==============================================================================
function renderAll() {
  renderKPIs();
  renderPriorityList();
  renderIssueTable();
  renderAdminQueue();
  refreshMainMapMarkers();
  refreshMiniMapMarkers();
}

// Setup Modals
function setupModals() {
  qs("#issueModalCloseBtn")?.addEventListener("click", () => qs("#issueModal")?.classList.add("hidden"));
  qs("#dispatchModalCloseBtn")?.addEventListener("click", () => {
    stopAnnouncement();
    qs("#dispatchAlertModal")?.classList.add("hidden");
  });
  qs("#resolveModalCloseBtn")?.addEventListener("click", () => qs("#resolveModal")?.classList.add("hidden"));

  // Clear test issues button
  qs("#clearTestIssuesBtn")?.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to remove all test and dashcam simulation grievances? Baseline municipal data will be kept.")) return;
    toast("Clearing test grievances from database...", "info");
    try {
      const res = await fetch(`${API_ROOT}/issues/clear-test-data`, { method: "POST" });
      const data = await res.json();
      toast(data.message || "Cleared test complaints.", "success");
      await bootstrapBackend();
      renderAll();
    } catch {
      toast("Failed to clear test data.", "error");
    }
  });

  // Reset demo database button
  qs("#resetDemoDataBtn")?.addEventListener("click", async () => {
    if (!confirm("Reset database to clean initial demonstration state? All newly created reports will be cleared.")) return;
    toast("Resetting database to clean baseline...", "info");
    try {
      const res = await fetch(`${API_ROOT}/issues/reset-demo-db`, { method: "POST" });
      const data = await res.json();
      toast(data.message || "Database reset to baseline.", "success");
      await bootstrapBackend();
      renderAll();
    } catch {
      toast("Failed to reset database.", "error");
    }
  });

  // CSV export
  qs("#exportIssuesCsvBtn")?.addEventListener("click", () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      ["ID,Title,Category,Severity,Status,Location,Lat,Lng,Reported"]
      .concat(state.issues.map(i => `"${i.id}","${i.title}","${i.category}","${i.severity}","${i.status}","${i.location}",${i.lat},${i.lng},"${i.reported}"`))
      .join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `urban_eyes_export_${Date.now()}.csv`;
    link.click();
  });
}

// ==========================================
// Theme Management (Dark & Light Mode)
// ==========================================
function getStoredTheme() {
  try {
    const saved = localStorage.getItem("urban_eyes_theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch (e) {}
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function applyTheme(theme, save = true) {
  const isDark = theme === "dark";
  if (isDark) {
    document.documentElement.classList.add("dark-mode");
    document.body.classList.add("dark-mode");
  } else {
    document.documentElement.classList.remove("dark-mode");
    document.body.classList.remove("dark-mode");
  }

  // Update topbar button
  const topBtn = qs("#themeToggleBtn");
  if (topBtn) {
    const icon = topBtn.querySelector(".theme-icon");
    const text = topBtn.querySelector(".theme-text");
    if (icon) icon.textContent = isDark ? "☀️" : "🌙";
    if (text) text.textContent = isDark ? "Light Mode" : "Dark Mode";
    topBtn.setAttribute("title", isDark ? "Switch to Light Mode" : "Switch to Dark Mode");
  }

  // Update sidebar button
  const sideBtn = qs("#sidebarThemeToggleBtn");
  if (sideBtn) {
    sideBtn.textContent = isDark ? "☀️" : "🌙";
    sideBtn.setAttribute("title", isDark ? "Switch to Light Mode" : "Switch to Dark Mode");
  }

  // Update meta theme-color if present
  let meta = qs('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = isDark ? "#090e17" : "#f4f7fa";

  if (save) {
    try {
      localStorage.setItem("urban_eyes_theme", isDark ? "dark" : "light");
    } catch (e) {}
  }
}

function toggleTheme() {
  const isCurrentlyDark = document.body.classList.contains("dark-mode") || document.documentElement.classList.contains("dark-mode");
  const nextTheme = isCurrentlyDark ? "light" : "dark";
  applyTheme(nextTheme, true);
  toast(nextTheme === "dark" ? "Dark Mode activated" : "Light Mode activated", "info");
}

window.toggleTheme = toggleTheme;

function initTheme() {
  const initialTheme = getStoredTheme();
  applyTheme(initialTheme, false);

  // Listen for system preference changes if user hasn't explicitly set a preference
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      try {
        if (!localStorage.getItem("urban_eyes_theme")) {
          applyTheme(e.matches ? "dark" : "light", false);
        }
      } catch (err) {}
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handler);
    }
  }
}

// Initialization on DOM load
window.addEventListener("DOMContentLoaded", () => {
  initTheme();
  setupNav();
  setupFilters();
  setupReportForm();
  setupSamplePickers();
  setupScanner();
  setupDashcam();
  setupModals();

  // Initialize overview mini-map on page load
  initMiniMap();

  bootstrapBackend();
});

window.addEventListener("resize", () => {
  if (miniMapInstance) miniMapInstance.invalidateSize();
  if (mainMapInstance) mainMapInstance.invalidateSize();
  if (reportMapInstance) reportMapInstance.invalidateSize();
});

