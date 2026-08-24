const API_BASE = "http://127.0.0.1:8000";

// Camera Elements

const startCameraBtn = document.getElementById("startCamera");
const captureBtn = document.getElementById("captureBtn");

const video = document.getElementById("cameraPreview");
const canvas = document.getElementById("canvas");

const cameraOverlay = document.getElementById("cameraOverlay");
const status = document.getElementById("cameraStatus");

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
  warnConfidence.innerHTML = `Confidence: ${Math.round(confidence * 100)}%`;

  warnTime.innerHTML = `Time: ${new Date().toLocaleTimeString()}`;

  warnLocation.innerHTML = `📍 ${location}`;

  warningBanner.hidden = false;

  voiceAlert();

  clearTimeout(warningTimer);

  warningTimer = setTimeout(() => {
    warningBanner.hidden = true;
  }, 6000);
}

dismissWarning?.addEventListener("click", () => {
  warningBanner.hidden = true;
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

  navigator.geolocation.getCurrentPosition(async (position) => {
    const lat = position.coords.latitude;

    const lng = position.coords.longitude;

    const image = await captureImage();

    sendImage(image, lat, lng).then((data) => {
      console.log(data);

      if (data.status === "success") {
        status.innerHTML = "⚠️ Pothole Detected";

        showWarning(
          data.data?.[0]?.confidence || 0,

          `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        );
      } else {
        status.innerHTML = "✅ Road Safe";
      }
    });
  });
});

// GPS Tracking

let proximityTimer = null;

function startGPS() {
  gpsWatch = navigator.geolocation.watchPosition(
    (position) => {
      currentLocation = {
        lat: position.coords.latitude,

        lng: position.coords.longitude,
      };

      gpsStatus.innerHTML = "🟢 Connected";
    },

    (error) => {
      gpsStatus.innerHTML = "🔴 Error";
    },
  );

  // Point 2 & 3: Check for existing hazards every 4 seconds (even if camera is not capturing)
  proximityTimer = setInterval(() => {
      if(!currentLocation) return;
      fetch(`${API_BASE}/check-warning?lat=${currentLocation.lat}&lng=${currentLocation.lng}`)
        .then(res => res.json())
        .then(data => {
            if(data.warning) {
                status.innerHTML = "🚨 EXISTING HAZARD AHEAD";
                showWarning(0.95, "NEARBY EXISTING HAZARD");
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
        data.data?.[0]?.confidence || 0,

        `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`,
      );
    } else {
      status.innerHTML = "✅ Road Clear - Monitoring";
    }
  } catch (error) {
    console.log(error);
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
  },
);
