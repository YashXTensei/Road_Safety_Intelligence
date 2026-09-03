const API_BASE = "https://road-safety-intelligence-backend-38aw.onrender.com";

// Camera Elements

const startCameraBtn = document.getElementById("startCamera");
const captureBtn = document.getElementById("captureBtn");

const video = document.getElementById("cameraPreview");
const canvas = document.getElementById("canvas");

const cameraOverlay = document.getElementById("cameraOverlay");
const status = document.getElementById("cameraStatus");
const modeBadge = document.getElementById("modeBadge");
const recIndicator = document.getElementById("recIndicator");

// Driving Mode Elements

const startDrivingBtn = document.getElementById("startDriving");
const stopDrivingBtn = document.getElementById("stopDriving");

const drivingStats = document.getElementById("drivingStats");

const gpsStatus = document.getElementById("gpsStatus");
const framesSent = document.getElementById("framesSent");
const hazardsFound = document.getElementById("hazardsFound");
const nextScan = document.getElementById("nextScan");

// Warning Elements

const warningBanner = document.getElementById("warningBanner");
const warnConfidence = document.getElementById("warnConfidence");
const warnTime = document.getElementById("warnTime");
const warnLocation = document.getElementById("warnLocation");
const dismissWarning = document.getElementById("dismissWarning");

// Variables

let stream = null;

let drivingMode = false;

let gpsWatch = null;

let currentLocation = null;

let frameTimer = null;

let sendingFrame = false;

let frameCount = 0;

let hazardCount = 0;

let warningTimer = null;

let lastVoiceTime = 0;

// Camera Start

async function startCamera() {
  if (stream) return true;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
      },

      audio: false,
    });

    video.srcObject = stream;

    cameraOverlay.style.display = "none";

    console.log("Camera Started");

    return true;
  } catch (error) {
    console.log(error);

    alert("Camera permission denied");

    return false;
  }
}

// Capture Image

function captureImage() {
  canvas.width = video.videoWidth;

  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, "image/jpeg");
  });
}

// Send Image Backend

function sendImage(blob, lat, lng) {
  const file = new File([blob], "captured-road.jpg", {
    type: "image/jpeg",
  });

  const formData = new FormData();

  formData.append("image", file);

  formData.append("lat", lat);

  formData.append("lng", lng);

  return fetch(`${API_BASE}/report-hazard`, {
    method: "POST",
    body: formData,
  }).then((res) => res.json());
}

// Voice Alert

function voiceAlert() {
  if (!("speechSynthesis" in window)) return;

  const now = Date.now();

  if (now - lastVoiceTime < 8000) return;

  lastVoiceTime = now;

  speechSynthesis.cancel();

  const speech = new SpeechSynthesisUtterance(
    "Warning. Pothole detected ahead. Please slow down.",
  );

  speech.lang = "en-US";

  speech.rate = 1;

  speechSynthesis.speak(speech);
}

// Warning Banner

function showWarning(confidence, location) {
  warnConfidence.innerHTML = `Confidence: ${Math.round((confidence || 0) * 100)}%`;

  warnTime.innerHTML = `Time: ${new Date().toLocaleTimeString()}`;

  warnLocation.innerHTML = `📍 ${location}`;

  // Un-hide first, then add "show" on the next frame so the CSS
  // transition/animation (defined on .warning-banner.show) actually runs.
  warningBanner.hidden = false;

  requestAnimationFrame(() => {
    warningBanner.classList.add("show");
  });

  voiceAlert();

  clearTimeout(warningTimer);

  warningTimer = setTimeout(() => {
    hideWarning();
  }, 6000);
}

function hideWarning() {
  warningBanner.classList.remove("show");
  // Wait for the slide-out transition before actually hiding the element.
  setTimeout(() => {
    warningBanner.hidden = true;
  }, 450);
}

dismissWarning?.addEventListener("click", () => {
  clearTimeout(warningTimer);
  hideWarning();
});

// Manual Camera

startCameraBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  const result = await startCamera();

  if (result) {
    status.innerHTML = "🟢 Camera Active";
  }
});

// Manual Capture

captureBtn?.addEventListener("click", (e) => {
  e.preventDefault();

  if (!stream) {
    alert("Start camera first");

    return;
  }

  const originalLabel = captureBtn.innerHTML;
  captureBtn.disabled = true;
  captureBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analysing...`;
  status.innerHTML = "🧠 Analysing captured frame...";

  const resetButton = () => {
    captureBtn.disabled = false;
    captureBtn.innerHTML = originalLabel;
  };

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      try {
        const image = await captureImage();
        const data = await sendImage(image, lat, lng);

        if (data.status === "success") {
          status.innerHTML = "⚠️ Pothole Detected";

          showWarning(
            data.data?.confidence || 0,
            `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          );
        } else {
          status.innerHTML = "✅ Road Safe";
        }
      } catch (error) {
        console.log(error);
        status.innerHTML = "🔴 Could not reach the server. Please try again.";
      } finally {
        resetButton();
      }
    },
    (error) => {
      console.log(error);
      status.innerHTML = "🔴 Couldn't get your location. Enable GPS and try again.";
      resetButton();
    },
  );
});

// GPS Tracking

let proximityTimer = null;

function startGPS() {
  const globalGpsStatus = document.getElementById("globalGpsStatus");
  
  gpsWatch = navigator.geolocation.watchPosition(
    (position) => {
      currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      const latStr = currentLocation.lat.toFixed(4);
      const lngStr = currentLocation.lng.toFixed(4);
      
      // Update Driving Mode Stats
      if(gpsStatus) gpsStatus.innerHTML = `🟢 ${latStr}, ${lngStr}`;
      
      // Update Top Nav Bar (Global)
      if(globalGpsStatus) {
        globalGpsStatus.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> 🟢 ${latStr}, ${lngStr}`;
        globalGpsStatus.style.color = "#4CAF50";
        globalGpsStatus.style.background = "rgba(76, 175, 80, 0.1)";
      }
    },
    (error) => {
      if(gpsStatus) gpsStatus.innerHTML = "🔴 No Signal";
      if(globalGpsStatus) {
        globalGpsStatus.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> 🔴 GPS Lost`;
        globalGpsStatus.style.color = "#f44336";
        globalGpsStatus.style.background = "rgba(244, 67, 54, 0.1)";
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );

  // Point 2 & 3: Check for existing hazards every 4 seconds (even if camera is not capturing)
  proximityTimer = setInterval(() => {
      if(!currentLocation) return;
      fetch(`${API_BASE}/check-warning?lat=${currentLocation.lat}&lng=${currentLocation.lng}`)
        .then(res => res.json())
        .then(data => {
            if(data.warning) {
                status.innerHTML = "🚨 EXISTING HAZARD AHEAD";
                const topHazard = data.hazards_nearby?.[0];
                showWarning(topHazard?.confidence ?? 0.9, "NEARBY EXISTING HAZARD");
            }
        }).catch(e => console.log(e));
  }, 4000);
}

function stopGPS() {
  if (gpsWatch) {
    navigator.geolocation.clearWatch(gpsWatch);

    gpsWatch = null;
  }
  if (proximityTimer) {
    clearInterval(proximityTimer);
    proximityTimer = null;
  }
}

// Driving Mode Capture

async function drivingCapture() {
  if (!drivingMode) return;

  if (!currentLocation || sendingFrame) {
    scheduleCapture();

    return;
  }

  sendingFrame = true;

  try {
    const image = await captureImage();

    const data = await sendImage(
      image,

      currentLocation.lat,

      currentLocation.lng,
    );

    frameCount++;

    framesSent.innerHTML = frameCount;

    if (data.status === "success") {
      hazardCount++;

      hazardsFound.innerHTML = hazardCount;

      status.innerHTML = "⚠️ Pothole Detected Ahead";

      showWarning(
        data.data?.confidence || 0,

        `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`,
      );
    } else {
      status.innerHTML = "✅ Road Clear - Monitoring";
    }
  } catch (error) {
    console.log(error);
    status.innerHTML = "🔴 Frame upload failed — retrying next scan.";
  }

  sendingFrame = false;

  scheduleCapture();
}

function scheduleCapture() {
  if (!drivingMode) return;

  clearTimeout(frameTimer);

  frameTimer = setTimeout(
    drivingCapture,

    4000,
  );
}

// Start Driving

startDrivingBtn?.addEventListener(
  "click",

  async () => {
    const started = await startCamera();

    if (!started) return;

    drivingMode = true;

    startDrivingBtn.hidden = true;

    stopDrivingBtn.hidden = false;

    drivingStats.hidden = false;

    status.innerHTML = "🚗 Driving Mode Active";

    if (modeBadge) modeBadge.textContent = "DRIVING MODE - LIVE";
    if (recIndicator) recIndicator.hidden = false;

    startGPS();

    scheduleCapture();
  },
);

// Stop Driving

stopDrivingBtn?.addEventListener(
  "click",

  () => {
    drivingMode = false;

    clearTimeout(frameTimer);

    stopGPS();

    startDrivingBtn.hidden = false;

    stopDrivingBtn.hidden = true;

    drivingStats.hidden = true;

    status.innerHTML = "🟢 Camera Active";

    if (modeBadge) modeBadge.textContent = "MANUAL MODE";
    if (recIndicator) recIndicator.hidden = true;
  },
);

// ================= MANUAL HAZARD REPORTING (Task 6) =================

const reportHazardBtn = document.getElementById("reportHazardBtn");
const reportModal = document.getElementById("reportModal");
const reportForm = document.getElementById("reportForm");
const cancelReportBtn = document.getElementById("cancelReportBtn");
const reportStatus = document.getElementById("reportStatus");

function openReportModal() {
  if (!reportModal) return;
  reportStatus.textContent = "";
  reportModal.hidden = false;
}

function closeReportModal() {
  if (!reportModal) return;
  reportModal.hidden = true;
}

reportHazardBtn?.addEventListener("click", openReportModal);
cancelReportBtn?.addEventListener("click", closeReportModal);

reportForm?.addEventListener("submit", (e) => {
  e.preventDefault();

  const submitBtn = reportForm.querySelector('button[type="submit"]');
  const hazardType = document.getElementById("reportType").value;
  const note = document.getElementById("reportNote").value;

  if (!navigator.geolocation) {
    reportStatus.textContent = "Geolocation isn't supported on this device.";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting...`;
  reportStatus.textContent = "Getting your current location...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const formData = new FormData();
      formData.append("lat", lat);
      formData.append("lng", lng);
      formData.append("hazard_type", hazardType);
      formData.append("note", note);

      try {
        const res = await fetch(`${API_BASE}/report-hazard-manual`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (res.ok && data.status === "success") {
          reportStatus.textContent = "✅ Hazard reported — thank you!";
          reportForm.reset();
          setTimeout(closeReportModal, 1200);
        } else {
          reportStatus.textContent = "🔴 Couldn't submit the report. Please try again.";
        }
      } catch (error) {
        console.log(error);
        reportStatus.textContent = "🔴 Couldn't reach the server. Please try again.";
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Submit Report";
      }
    },
    (error) => {
      console.log(error);
      reportStatus.textContent = "🔴 Couldn't get your location. Enable GPS and try again.";
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Submit Report";
    },
  );
});

// Auto-start GPS on load
document.addEventListener('DOMContentLoaded', () => { startGPS(); });
