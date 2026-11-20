# API Contract — Frontend <-> ESP32  (v1.1)

SOURCE OF TRUTH. Both people code against this file. Status: UPDATED (v1.1 - LDR removed, Sunrise-Sunset API).

## General
- Base URL: same origin as the page (page is served by the ESP32). Frontend uses relative paths: `/api/status`.
- All API bodies are JSON, `Content-Type: application/json`. Responses always JSON (including errors).
- CORS: firmware sends `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`,
  `Access-Control-Allow-Headers: Content-Type` and answers `OPTIONS` with 204.
- No authentication (local network prototype only).
- Times are strings: `"HH:MM:SS"` or `"HH:MM"` (24 h). Date is `"YYYY-MM-DD"`.
- Enum values are UPPERCASE strings.
- **If a value is not known/valid, send `null`. Never send a fake/placeholder number.**

## GET /api/status  -> 200
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
  "gpsFixAgeMs": 1200,
  "uptimeSeconds": 3600,
  "firmwareVersion": "0.2.0"
}
```
(Example values only — NOT real readings.)

| Field | Type | Required | Meaning |
|---|---|---|---|
| wifiConnected | bool | yes | ESP32 Wi-Fi state |
| gpsValid | bool | yes | TinyGPSPlus location.isValid() |
| dateValid | bool | yes | date.isValid() |
| timeValid | bool | yes | time.isValid() |
| latitude / longitude | number\|null | yes | decimal degrees; null unless gpsValid |
| satellites | int\|null | yes | satellites in use; null if unknown |
| gpsUtc | string\|null | yes | GPS UTC time; null unless timeValid |
| localTime | string\|null | yes | IST (UTC+05:30) derived from GPS UTC; null unless timeValid |
| date | string\|null | yes | GPS date; null unless dateValid |
| sunrise / sunset | string\|null | yes | IST "HH:MM" fetched via Sunrise-Sunset API; null unless GPS fix and API sync succeed |
| isDaytime | bool\|null | yes | Current day/night determination; null if sunrise/sunset/time unknown |
| lightOn | bool | yes | ACTUAL relay state (GPIO 23). HIGH = true (ON) |
| mode | string | yes | `AUTO` \| `MANUAL` |
| autoReason | string\|null | no | `ASTRONOMICAL` \| `WAITING_FOR_GPS` \| `API_SYNC_PENDING` \| `API_ERROR`; null in MANUAL |
| gpsFixAgeMs | int\|null | no | ms since last valid location update |
| uptimeSeconds | int | no | System uptime in seconds |
| firmwareVersion | string | no | Firmware release version (e.g. "0.2.0") |

Frontend rule: if `gpsValid`/`dateValid`/`timeValid` is false, show placeholders ("--") and "Waiting for GPS fix"; do not render null as 0.

## POST /api/mode
Request: `{ "mode": "AUTO" }` or `{ "mode": "MANUAL" }`

Success 200: `{ "ok": true, "mode": "MANUAL", "lightOn": false }`
- Switching to MANUAL keeps the current relay state (no sudden flip).
- Switching to AUTO hands control back to automation immediately.

## POST /api/light
Request: `{ "state": "ON" }` or `{ "state": "OFF" }`

Success 200: `{ "ok": true, "lightOn": true }` — `lightOn` is read back from the relay GPIO state AFTER applying the command.
Only allowed in MANUAL mode.

## Errors (all endpoints)
Shape: `{ "ok": false, "error": "ERROR_CODE", "message": "Human readable text" }`

| HTTP | error | When |
|---|---|---|
| 400 | BAD_REQUEST | Body is not valid JSON / missing field |
| 400 | INVALID_VALUE | e.g. mode not AUTO/MANUAL, state not ON/OFF |
| 404 | NOT_FOUND | Unknown route |
| 405 | METHOD_NOT_ALLOWED | Wrong HTTP verb |
| 409 | NOT_IN_MANUAL_MODE | POST /api/light while mode = AUTO |
| 500 | INTERNAL_ERROR | Unexpected firmware fault |

## Changelog
- v1.1 — Removed all LDR fields (`ldrValue`, `ambientStatus`, `ldrThreshold`). Updated sunrise/sunset source to external Sunrise-Sunset API. Updated `autoReason` enum. Bumped firmware version to 0.2.0.
- v1.0 — Initial contract specification.
