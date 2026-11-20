# SolarSync — ESP32 Firmware Guide & Documentation

This guide provides instructions for configuring, flashing, and testing the SolarSync ESP32 Smart Streetlight Automation firmware.

---

## 1. Hardware Connections (DO NOT CHANGE)

| Component | Pin | ESP32 Pin | Logic / Baud |
|---|---|---|---|
| **NEO-6M GPS** | TX | **GPIO 16** (RX2) | 9600 baud, NMEA sentences |
| **NEO-6M GPS** | RX | **GPIO 17** (TX2) | 9600 baud |
| **NEO-6M GPS** | VCC / GND | 3.3V or 5V / GND | Standard power |
| **5V Relay Module (IN1)**| IN1 | **GPIO 23** | **Active-HIGH** (HIGH = ON, LOW = OFF) |
| **5V Relay Module** | VCC / GND | 5V / GND | Module power |
| **LDR Sensor** | — | — | **REMOVED** (No ambient light sensor) |

> **IMPORTANT:** Relay IN1 is strictly active-HIGH. At startup, GPIO 23 is immediately driven LOW to ensure the streetlight stays in a safe OFF state during boot.

---

## 2. Required Libraries

Install the following libraries via the Arduino IDE Library Manager or PlatformIO:

1. **`TinyGPSPlus`** by Mikal Hart (v1.0.3+)
2. **`ArduinoJson`** by Benoit Blanchon (v6.21.x or v7.x)
3. **Core Built-in Libraries** (included with the ESP32 Arduino Core):
   - `WiFi.h`
   - `WebServer.h`
   - `LittleFS.h`
   - `HTTPClient.h`
   - `WiFiClientSecure.h`

---

## 3. Wi-Fi Configuration (`secrets.h`)

Wi-Fi credentials are kept strictly isolated from version control:
1. Navigate to `firmware/smart_streetlight/`.
2. Copy `secrets.example.h` to `secrets.h`:
   ```bash
   cp firmware/smart_streetlight/secrets.example.h firmware/smart_streetlight/secrets.h
   ```
3. Edit `secrets.h` and enter your Wi-Fi SSID and password:
   ```cpp
   #define WIFI_SSID "YourNetworkName"
   #define WIFI_PASSWORD "YourNetworkPassword"
   ```
4. `secrets.h` is already included in `.gitignore`.

---

## 4. Arduino IDE Setup & LittleFS Upload

### Board Settings
* **Board:** "ESP32 Dev Module" (or your specific ESP32 board)
* **Partition Scheme:** "Default 4MB with spiffs" or "No OTA (2MB APP/2MB SPIFFS)"
* **Upload Speed:** 921600 (or 115200)
* **Flash Frequency:** 80MHz
* **Core Debug Level:** None (or Info)

### Uploading the Web Dashboard (LittleFS)
The static web dashboard files are stored in `firmware/smart_streetlight/data/`:
* `index.html`
* `style.css`
* `script.js`
* `config.js`
* `demo.js`

**To upload via Arduino IDE:**
1. Install the [Arduino ESP32 LittleFS Filesystem Uploader](https://github.com/lorol/arduino-esp32littlefs-plugin).
2. Open `firmware/smart_streetlight/smart_streetlight.ino`.
3. Select **Tools > ESP32 LittleFS Data Upload**.
4. The dashboard will be written to the flash filesystem.

**To upload via PlatformIO:**
```bash
pio run -t uploadfs
```

---

## 5. Automation Architecture & Sunrise-Sunset API

* **GPS Module:** Continuously reads coordinates and UTC date/time on UART2 (GPIO 16/17).
* **IST Conversion:** Converts UTC to Indian Standard Time (UTC+05:30) with automatic calendar rollover.
* **Sunrise-Sunset API:**
  * Once a valid GPS fix is acquired and Wi-Fi connects, the ESP32 makes an HTTPS request to:
    `https://api.sunrise-sunset.org/json?lat=<LAT>&lng=<LNG>&date=today&formatted=0`
  * Parses sunrise and sunset UTC timestamps, converts them to IST, and determines if the current time is daytime or nighttime.
  * Re-syncs every 6 hours automatically.
* **Relay Automation (AUTO Mode):**
  * **Daytime:** Streetlight OFF.
  * **Nighttime (Sunset to Sunrise):** Streetlight ON.
  * **Anti-chatter Dwell Time:** Enforces a 30-second minimum dwell time (`RELAY_DWELL_MS`) between transitions.
  * **Fallback / Waiting:** If GPS fix is pending, light remains OFF (`autoReason = "WAITING_FOR_GPS"`). If API sync is pending, light remains OFF (`autoReason = "API_SYNC_PENDING"`).

---

## 6. Testing the API with cURL

Once the ESP32 is powered and connected to Wi-Fi, open the IP address printed in the Serial Monitor (115200 baud).

### 1. Check System Status
```bash
curl http://<ESP32_IP>/api/status
```
**Example Response:**
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
  "sunrise": "06:15",
  "sunset": "17:55",
  "isDaytime": true,
  "lightOn": false,
  "mode": "AUTO",
  "autoReason": "ASTRONOMICAL",
  "gpsFixAgeMs": 420,
  "uptimeSeconds": 240,
  "firmwareVersion": "0.2.0"
}
```

### 2. Switch to MANUAL Mode
```bash
curl -X POST http://<ESP32_IP>/api/mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"MANUAL"}'
```
**Response:**
```json
{"ok":true,"mode":"MANUAL","lightOn":false}
```

### 3. Turn Streetlight ON (in MANUAL mode)
```bash
curl -X POST http://<ESP32_IP>/api/light \
  -H "Content-Type: application/json" \
  -d '{"state":"ON"}'
```
**Response:**
```json
{"ok":true,"lightOn":true}
```

### 4. Attempting Manual Control while in AUTO Mode (Error 409)
```bash
curl -X POST http://<ESP32_IP>/api/mode -H "Content-Type: application/json" -d '{"mode":"AUTO"}'
curl -X POST http://<ESP32_IP>/api/light -H "Content-Type: application/json" -d '{"state":"ON"}'
```
**Response (HTTP 409 Conflict):**
```json
{
  "ok": false,
  "error": "NOT_IN_MANUAL_MODE",
  "message": "Streetlight can only be switched in MANUAL mode."
}
```

---

## 7. Status & Testing Notice

* **Firmware & Frontend Code:** Implemented and aligned with `API_CONTRACT.md` v1.1.
* **Hardware Integration Status:** **Untested on physical hardware** until flashed to the physical ESP32 and connected to the NEO-6M GPS and relay module.

