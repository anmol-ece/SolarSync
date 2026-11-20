# Frontend Guide — Person A

This document explains how to run, test, and package the frontend dashboard for the ESP32 Smart Streetlight system.

---

## 1. Overview & Architecture

The frontend is a lightweight, responsive single-page application built with **vanilla HTML5, CSS3, and modern JavaScript**.
- **Zero external dependencies**: No frameworks (React/Vue), no external fonts, no CDNs.
- **Inline SVG Icons**: Fully self-contained.
- **Size constraint**: Under 60 KB uncompressed, specifically designed to fit within ESP32 LittleFS flash storage.
- **Contract Version**: `API Contract v1.1` (`GET /api/status`, `POST /api/mode`, `POST /api/light`).

---

## 2. Directory Structure

```
sunlight_webpage/
├── frontend/
│   ├── index.html        # Clean semantic dashboard layout
│   ├── style.css         # Dark theme (navy/charcoal/cyan/amber/green/red)
│   ├── config.js         # API endpoints, polling intervals, timeouts
│   ├── script.js         # Polling loop, state machine, solar timeline, controls
│   └── demo.js           # Independent simulation demo mode
├── tools/
│   └── mock_server.py    # Python 3 standard library mock server
└── docs/
    └── FRONTEND_GUIDE.md # This guide
```

---

## 3. Local Development & Testing

### Option A: Testing with the Mock Server (Recommended)
You do not need an ESP32 to test the frontend.

1. Start the Python mock server:
   ```bash
   python tools/mock_server.py
   ```
2. Open your browser at:
   ```
   http://localhost:8000
   ```
3. Test different system states dynamically by visiting scenario URLs in another tab:
   - Cold start / GPS acquiring fix:
     `http://localhost:8000/scenario/gps_waiting`
   - Daytime with valid GPS and API sync:
     `http://localhost:8000/scenario/gps_ok_day`
   - Nighttime with streetlight active:
     `http://localhost:8000/scenario/gps_ok_night`
   - Offline / disconnected device:
     `http://localhost:8000/scenario/esp_offline`

---

### Option B: Built-in Simulation Demo Mode
You can view the dashboard with animated simulation data without running any backend:
- Open `frontend/index.html` directly in any web browser and append `?demo=1` to the URL:
  `file:///.../frontend/index.html?demo=1`
- Or click the **Demo** button in the top navigation bar.
- Demo mode displays an unmistakable yellow warning banner and will cycle through states every 6 seconds. Real mode code paths never read demo data.

---

### Option C: Connecting to a Real ESP32 on Wi-Fi
When testing against a real ESP32 board from your local dev machine (CORS is enabled):
1. Open `frontend/config.js`.
2. Change `apiBase`:
   ```javascript
   const CONFIG = {
     apiBase: "http://<ESP32_IP_ADDRESS>",
     ...
   };
   ```
3. Save and refresh `index.html`.
*(Note: Keep `apiBase: ""` when uploading directly to the ESP32 LittleFS partition so it uses relative paths).*

---

## 4. Size & Resource Check

To verify uncompressed file sizes:
```powershell
Get-ChildItem -Path frontend | Select-Object Name, Length
```
Target total size across all frontend files is well under 60 KB.

---

## 5. Instructions for Person B (LittleFS Flashing)

When deploying to the ESP32:
1. Ensure `frontend/config.js` has `apiBase: ""` (relative path).
2. Copy all files from `frontend/` into `firmware/smart_streetlight/data/`:
   - `index.html`
   - `style.css`
   - `config.js`
   - `script.js`
   - `demo.js`
3. Flash the LittleFS image using the Arduino IDE LittleFS upload tool or PlatformIO command `pio run --target uploadfs`.
4. Ensure ESP32 web server serves `index.html` at `/` with `text/html` and respective MIME types for `.css` and `.js`.

