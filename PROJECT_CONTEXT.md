# Project Context — ESP32 Smart Streetlight Automation System

## Goal
A GPS-based astronomical sunrise/sunset streetlight controller on an ESP32, with a web dashboard hosted
by the ESP32 itself (no cloud, no external servers for dashboard). Users open the ESP32's IP in a browser on the same Wi-Fi network.

The system uses GPS coordinates from a hardware NEO-6M GPS module to query the **Sunrise-Sunset API** for accurate sunrise and sunset timings, automatically turning the streetlight relay ON at sunset and OFF at sunrise.

## Hardware (DO NOT CHANGE)
| Component | ESP32 Pin | Notes |
|---|---|---|
| GPS RX (ESP32 receives from GPS TX) | GPIO 16 | UART2, 9600 baud |
| GPS TX (ESP32 transmits to GPS RX) | GPIO 17 | UART2, 9600 baud |
| Relay IN1 | GPIO 23 | Active-HIGH: HIGH = ON, LOW = OFF |

- Board: ESP32 DevKit. GPS: NEO-6M (TinyGPSPlus library). Relay: 2-channel 5V module (channel 1 used). Load: LED prototype / Streetlight.
- **LDR removed:** Ambient light sensing and LDR hardware have been completely removed.
- No other hardware exists. Do not add sensors, displays, RTC modules, etc.

## Division of Responsibility
- ESP32 firmware does ALL the real work: GPS parsing, validity checks, Sunrise-Sunset API querying, day/night state determination, relay control, web serving.
- The webpage only DISPLAYS what the ESP32 reports and SENDS commands. It must never invent sunrise/sunset or pretend a command succeeded before the ESP32 confirms it.

## Hard Requirements Recap
- Timezone: IST, UTC+05:30 (fixed). `localTime`, `sunrise`, and `sunset` are reported in IST.
- Sunrise & Sunset Source: Retrieved via HTTPS from the open Sunrise-Sunset API (`api.sunrise-sunset.org`) using GPS latitude/longitude.
- Do not assume GPS is valid at startup. Cold start can take minutes. Show "Waiting for GPS fix", never fake values.
- Relay logic stays active-HIGH (GPIO 23 HIGH = Streetlight ON).
- No Wi-Fi credentials in frontend code or public GitHub files. Credentials reside exclusively in `secrets.h`.
- Frontend lives on the ESP32 (LittleFS). Total size kept lightweight (~60 KB or less), no external CDNs, no external fonts.
- Polling: frontend calls `GET /api/status` every 1–2 s.

## Streetlight Automation Logic (AUTO Mode)
- **Streetlight ON:** At sunset (or during night time between sunset and next sunrise).
- **Streetlight OFF:** At sunrise (or during day time between sunrise and sunset).
- If GPS fix is waiting / invalid: relay remains OFF, `autoReason = "WAITING_FOR_GPS"`.
- If GPS is acquired but Sunrise-Sunset API data is pending sync: relay remains OFF, `autoReason = "API_SYNC_PENDING"`.
- Once sunrise and sunset times are retrieved: streetlight turns ON at sunset and OFF at sunrise (`autoReason = "ASTRONOMICAL"`).
- Dwell time & hysteresis: Protects against rapid relay cycling.
- MANUAL mode: User commands turn the relay ON/OFF directly via `POST /api/light`.
