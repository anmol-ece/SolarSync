# Work Split — Two People

| | Person A — Frontend | Person B — Firmware |
|---|---|---|
| Owns | Dashboard UI, demo mode, mock server, frontend docs | ESP32 web server, API, GPS, sunrise/sunset, LDR, relay, hosting |
| Tools | Browser, `python3 tools/mock_server.py` | Arduino IDE / PlatformIO, ESP32, curl |
| Needs hardware? | No (until final integration) | Yes |

## Repository layout
```
smart-streetlight/
  AGENTS.md                       (shared, both read)
  docs/
    PROJECT_CONTEXT.md            (shared)
    API_CONTRACT.md               (shared, source of truth)
    WORK_SPLIT.md                 (this file)
    CHANGE_REQUESTS.md            (either person appends requests for the other)
    FRONTEND_GUIDE.md             (A writes: run/test locally, demo mode)
    FIRMWARE_GUIDE.md             (B writes: libraries, flashing, LittleFS upload, hosting)
  frontend/                       (A)  index.html style.css script.js config.js demo.js
  tools/mock_server.py            (A)
  firmware/smart_streetlight/     (B)  smart_streetlight.ino, config.h, secrets.example.h, secrets.h (gitignored)
  firmware/smart_streetlight/data (B)  copy of frontend/ for LittleFS upload (copy only, never edit by hand)
  .gitignore                      (B adds secrets.h)
```

## File ownership (do not edit the other person's files)
- Person A: `frontend/**`, `tools/**`, `docs/FRONTEND_GUIDE.md`
- Person B: `firmware/**`, `docs/FIRMWARE_GUIDE.md`, `.gitignore`
- Shared (agree before editing): `docs/API_CONTRACT.md`, `docs/PROJECT_CONTEXT.md`, `AGENTS.md`
- `firmware/.../data/` is a COPY of `frontend/`. Person B refreshes it when A delivers a new frontend version.

## Milestones
| # | Person A | Person B | Sync point |
|---|---|---|---|
| 0 | Read docs, propose frontend structure | Read docs, inspect existing .ino, propose firmware structure | Both confirm the contract + open decisions in PROJECT_CONTEXT.md |
| 1 | Static layout of all sections, responsive, design polish | Wi-Fi + web server skeleton; GET /api/status returns real GPS fields (null when invalid) | |
| 2 | fetch polling, status mapping, disconnected/error states, demo mode | LDR classification, relay driver (active-HIGH), POST /api/light, POST /api/mode | |
| 3 | Mock server + control panel flows (loading/error/confirm) | Sunrise/sunset calc (NOAA algorithm), IST conversion, isDaytime, AUTO logic | Verify B's sunrise/sunset against an online reference for the GPS coordinates |
| 4 | Docs, size check, cleanup | LittleFS hosting, CORS, size/memory check, docs | |
| 5 | **Integration together on real hardware** | | Test checklist below |

## Integration test checklist (only mark as passed after really testing on the ESP32)
- [ ] Page loads from http://<esp-ip>/ (LittleFS)
- [ ] /api/status polls every ~1.5 s with no page reload
- [ ] GPS cold start: UI shows "Waiting for GPS fix", no fake numbers
- [ ] GPS fix acquired: lat/lon/date/time/satellites correct; local time = UTC + 5:30
- [ ] Sunrise/sunset match an independent reference (+/- 2 min)
- [ ] Covering/uncovering the LDR changes value and BRIGHT/DIM/DARK
- [ ] AUTO mode: manual buttons disabled; relay follows automation
- [ ] MANUAL mode: ON/OFF actually switches relay GPIO23 (LED), UI waits for confirmation
- [ ] POST /api/light in AUTO returns 409 and UI shows the error
- [ ] Unplug/power off ESP32: UI shows unreachable within ~5 s and recovers when it returns
- [ ] No Wi-Fi credentials anywhere in the Git history
