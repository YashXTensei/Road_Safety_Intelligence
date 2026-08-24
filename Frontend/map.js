const hazardIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/564/564619.png",

  iconSize: [40, 40],
});

const userIcon = L.divIcon({
  className: "user-location-marker",

  html: '<div class="user-location-dot"><div class="pulse"></div><div class="core"></div></div>',

  iconSize: [16, 16],

  iconAnchor: [8, 8],
});

// Create Map

const map = L.map("map").setView([28.6139, 77.209], 12);

const hazardPoints = [];

// Map Layer

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// Load Hazards

fetch("http://127.0.0.1:8000/hazards")
  .then((response) => response.json())

  .then((result) => {
    const countBox = document.getElementById("hazardCount");

    if (countBox) {
      countBox.innerHTML = `⚠️ Hazards Detected: ${result.total}`;
    }

    console.log("Hazard Data:", result);

    result.data.forEach((hazard) => {
      if (hazard.latitude === 0 || hazard.longitude === 0) {
        return;
      }

      hazardPoints.push([hazard.latitude, hazard.longitude]);

      const marker = L.marker([hazard.latitude, hazard.longitude], {
        icon: hazardIcon,
      }).addTo(map);

      marker.bindPopup(`

      <div>

        <h3>
        ⚠️ Pothole Detected
        </h3>

        <p>
        Confidence:
        ${(hazard.confidence * 100).toFixed(1)}%
        </p>

        <p>
        Time:
        ${hazard.timestamp}
        </p>

      </div>

    `);
    });

    if (hazardPoints.length > 0) {
      map.fitBounds(hazardPoints);
    }
  })

  .catch((error) => {
    console.log("Hazard Fetch Error:", error);
  });

// User Location
let userMarker = null;
let globalUserLat = 0;
let globalUserLng = 0;

function updateUserLocation(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  globalUserLat = lat;
  globalUserLng = lng;

  if (!userMarker) {
    userMarker = L.marker([lat, lng], {
      icon: userIcon,
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindPopup("🔵 Your Location");

    console.log("User Location:", lat, lng);
  } else {
    userMarker.setLatLng([lat, lng]);
  }
}

function locationError(error) {
  console.log("Location Error:", error);
}

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    updateUserLocation,

    locationError,

    {
      enableHighAccuracy: true,
      timeout: 8000,
    },
  );

  navigator.geolocation.watchPosition(
    updateUserLocation,

    locationError,

    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 8000,
    },
  );
} else {
  console.log("Geolocation not supported");
}

console.log("Map Loaded");

// Point 1: Custom Destination + Route Logic (Hiding Default UI)
let routingControl = null;

// Recenter Button Logic
document.getElementById('recenterBtn').addEventListener('click', () => {
    if (globalUserLat !== 0) {
        map.setView([globalUserLat, globalUserLng], 15);
    } else {
        alert("Waiting for your GPS location...");
    }
});

// Custom Search Box Logic
document.getElementById('routeBtn').addEventListener('click', () => {
    const dest = document.getElementById('destInput').value;
    
    if (!dest) {
        return alert("Please enter a destination!");
    }
    if (globalUserLat === 0) {
        return alert("Waiting for your GPS location...");
    }

    // 1. Fetch Coordinates for the entered city/place using Nominatim API
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${dest}`)
    .then(res => res.json())
    .then(data => {
        if (data.length === 0) {
            return alert("Location not found! Try a different name.");
        }
        
        const destLat = data[0].lat;
        const destLng = data[0].lon;

        if (routingControl) {
            map.removeControl(routingControl);
        }

        // 2. Draw Route but HIDE the white box (show: false)
        routingControl = L.Routing.control({
            waypoints: [
                L.latLng(globalUserLat, globalUserLng),
                L.latLng(destLat, destLng)
            ],
            show: false, // THIS HIDES THE CLUNKY WHITE BOX
            addWaypoints: false,
            routeWhileDragging: false,
            lineOptions: {
                styles: [{color: '#2196F3', opacity: 0.8, weight: 6}]
            },
            createMarker: function(i, wp, nWps) {
                if (i === nWps - 1) { 
                    // Only show a marker at the final destination
                    return L.marker(wp.latLng).bindPopup("📍 Destination: " + dest);
                }
                return null; 
            }
        }).addTo(map);

        // 3. Zoom map to fit the entire route
        const bounds = new L.featureGroup([
            L.marker([globalUserLat, globalUserLng]), 
            L.marker([destLat, destLng])
        ]);
        map.fitBounds(bounds.getBounds(), {padding: [50, 50]});
    })
    .catch(err => {
        console.log(err);
        alert("Error finding route.");
    });
});
