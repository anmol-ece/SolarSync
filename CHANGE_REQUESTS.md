# Change Requests between Person A and Person B

## [2026-11-20] Project Architecture Update : LDR removal and Sunrise-Sunset API integration
- Removed LDR sensor and GPIO 34 completely from hardware and firmware requirements.
- Replaced offline astronomical solar calculations with HTTP/HTTPS calls to the open Sunrise-Sunset API (`api.sunrise-sunset.org`) using GPS coordinates.
- Streetlight logic: ON at sunset, OFF at sunrise.
- API Contract updated to v1.1: removed `ldrValue`, `ambientStatus`, `ldrThreshold`; updated `autoReason`.
- Dashboard UI updated: removed ambient light / LDR monitoring cards and metrics; focused on GPS coordinates, current IST time, sunrise/sunset, streetlight state, and AUTO/MANUAL controls.
- Status: DONE
