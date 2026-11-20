# SolarSync — ESP32 Smart Streetlight Automation System

[![Architecture](https://img.shields.io/badge/Architecture-ESP32%20DevKit-blue.svg)](#hardware-specifications)
[![Contract](https://img.shields.io/badge/API%20Contract-v1.1-brightgreen.svg)](docs/API_CONTRACT.md)
[![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20HTML5%2FCSS3%2FJS-orange.svg)](#web-dashboard)
[![Storage](https://img.shields.io/badge/Flash%20Size-%3C60KB%20(LittleFS)-blueviolet.svg)](#footprint--storage)

SolarSync is an intelligent, autonomous streetlight control system built on the ESP32. It uses a **NEO-6M GPS module** to determine precise real-world coordinates and time, synchronizes astronomical sunrise and sunset schedules via the **Sunrise-Sunset API**, and dynamically switches streetlight relays (Active-HIGH, GPIO 23) while hosting a self-contained local web dashboard directly from ESP32 LittleFS.

---

## 🌟 Key Features

- **GPS-Synchronized Timing**: Acquires latitude, longitude, and UTC time from satellite telemetry; converts UTC to Indian Standard Time (IST, UTC+05:30).
- **Sunrise-Sunset API Automation**: Automatically turns lights ON at sunset and OFF at sunrise based on live location.
- **Embedded Web Dashboard (<60 KB)**: Served directly from the ESP32’s flash storage (LittleFS). Built with 100% vanilla HTML5, CSS3, and JavaScript — zero external frameworks, CDNs, or remote fonts.
- **Bi-Directional Telemetry & Control**: Real-time status polling (~1.5s interval) with manual override controls (AUTO / MANUAL), connection health indicators, and stale data protection.
- **Zero-Hardware Simulation / Demo Mode**: Built-in interactive demo mode (`?demo=1`) and Python 3 mock server (`tools/mock_server.py`) for comprehensive local UI/UX testing without physical hardware.

---

## 🛠 Hardware Specifications

> **Important**: Pin mappings and relay logic are fixed. Do not modify.

| Component | ESP32 Pin | Interface / Parameters | Logic |
|---|---|---|---|
| **GPS RX** (ESP32 receives from GPS TX) | GPIO 16 | UART2, 9600 baud (NEO-6M) | NMEA Sentences |
| **GPS TX** (ESP32 transmits to GPS RX) | GPIO 17 | UART2, 9600 baud | NMEA Config |
| **Relay IN1** | GPIO 23 | Digital Output | **Active-HIGH** (HIGH = ON, LOW = OFF) |

*Note: Ambient LDR light sensing has been completely eliminated in favor of exact solar-timing API schedules.*

---

## 📐 Repository Structure

```text
SolarSync/
├── .gitignore                      # Excludes venv/, credentials, firmware/secrets.h
├── README.md                       # Main project overview and setup guide
├── AGENTS.md                       # Multi-agent collaboration rules & constraints
├── docs/
│   ├── PROJECT_CONTEXT.md          # Architectural context, requirements & state
│   ├── API_CONTRACT.md             # Shared v1.1 REST interface specification
│   ├── WORK_SPLIT.md               # Responsibility matrix (Person A vs Person B)
│   ├── CHANGE_REQUESTS.md          # Inter-team change communication log
│   └── FRONTEND_GUIDE.md           # Local frontend testing, mock server & LittleFS guide
├── frontend/                       # Self-contained dashboard (<60 KB for LittleFS)
│   ├── index.html                  # Semantic dashboard markup & accessible SVGs
│   ├── style.css                   # Dark industrial telemetry UI & CSS variables
│   ├── script.js                   # State machine, fetch polling, and control dispatch
│   ├── config.js                   # API endpoint configs and polling timing
│   └── demo.js                     # Offline simulation scenario runner
└── tools/
    └── mock_server.py              # Python 3 standard library ESP32 mock backend
```

---

## 🚀 Getting Started

### 1. Running the Web Dashboard Locally (Mock Server)

You do not need an ESP32 connected to run and test the frontend interface:

1. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Linux / macOS:
   source venv/bin/activate
   ```
2. Launch the mock server:
   ```bash
   python tools/mock_server.py
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

#### Interactive Simulation Scenarios:
Switch simulated hardware conditions dynamically by opening:
- `http://localhost:8000/scenario/gps_waiting` — GPS cold start / searching satellites
- `http://localhost:8000/scenario/gps_ok` — Valid GPS, daytime, light OFF
- `http://localhost:8000/scenario/gps_ok_night` — Valid GPS, nighttime, light ON
- `http://localhost:8000/scenario/command_fail` — Simulated server fault (HTTP 500)
- `http://localhost:8000/scenario/esp_offline` — Network disconnection / timeout test

---

## 📡 API Contract (v1.1 Summary)

The web dashboard and firmware communicate via simple, stateless JSON endpoints:

- **`GET /api/status`**: Returns current system state:
  ```json
  {
    "wifiConnected": true,
    "gpsValid": true,
    "dateValid": true,
    "timeValid": true,
    "latitude": 12.9716,
    "longitude": 77.5946,
    "satellites": 8,
    "gpsUtc": "10:30:00",
    "localTime": "16:00:00",
    "date": "2026-11-20",
    "sunrise": "06:14",
    "sunset": "17:52",
    "isDaytime": true,
    "lightOn": false,
    "mode": "AUTO",
    "autoReason": "ASTRONOMICAL_API",
    "uptimeSeconds": 3600,
    "firmwareVersion": "0.2.0"
  }
  ```
- **`POST /api/mode`**: Toggle mode (`{"mode": "AUTO"}` or `{"mode": "MANUAL"}`).
- **`POST /api/light`**: Switch relay in manual mode (`{"state": "ON"}` or `{"state": "OFF"}`). Returns HTTP 409 if in `AUTO`.

---

## 👥 Authors & Work Split

- **Person A**: Frontend UI/UX, simulation demo modes, mock test harness, frontend documentation.
- **Person B**: ESP32 C++ firmware, LittleFS web server, TinyGPSPlus driver, Sunrise-Sunset API integration, relay actuation.

---

## 📄 License
This project is open-source under the MIT License.
