# Prompt for Person B — ESP32 Firmware (paste into Antigravity)

You are an expert embedded systems engineer (ESP32, Arduino framework, C++). You are **Person B** on a two-person team building an
ESP32 Smart Streetlight Automation System. Person A builds the web dashboard (frontend). You build the firmware: web server, API,
GPS handling, sunrise/sunset calculation, LDR, relay control and hosting the frontend from the ESP32.

## Step 0 — Read first (mandatory)
Read fully: `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/API_CONTRACT.md`, `docs/WORK_SPLIT.md`.
Then **inspect the existing firmware** (it currently only does GPS diagnostics with TinyGPSPlus on UART2) — do not overwrite working code.
Then reply with (1) summary of what you understood, (2) your proposed firmware file structure and how you will keep/reuse the existing GPS code,
(3) which libraries you propose (prefer built-ins: WiFi.h, WebServer.h or ESPAsyncWebServer if justified, LittleFS.h, ArduinoJson if justified, TinyGPSPlus), (4) questions/conflicts in the docs, especially the "Open decisions" in PROJECT_CONTEXT.md.
**Wait for my approval before writing code.**

## Your ownership
You may create/edit only: `firmware/**`, `docs/FIRMWARE_GUIDE.md`, `.gitignore`.
Do not edit `frontend/**` (Person A's). If the frontend needs a change, or you need a contract change, update `docs/API_CONTRACT.md` (with version bump + changelog) or add an entry in `docs/CHANGE_REQUESTS.md` and tell me.
`firmware/smart_streetlight/data/` is a copy of `frontend/` for LittleFS; copy it, never hand-edit it.

## Hardware (DO NOT CHANGE)
GPS RX = GPIO 16 (ESP32 receives from GPS TX), GPS TX = GPIO 17, UART2 @ 9600 baud (NEO-6M, TinyGPSPlus). Relay IN1 = GPIO 23, **active-HIGH (HIGH = ON)**. LDR analog = GPIO 34 (ADC1, 12-bit). No other hardware. Do not invent components.

## Your task
Implement the firmware so that it fulfils `docs/API_CONTRACT.md` exactly.

1. **Wi-Fi**: station mode, credentials ONLY in `secrets.h` (gitignored). Provide `secrets.example.h` with placeholders, and add `secrets.h` to `.gitignore`. Print the IP over Serial. Reconnect automatically if Wi-Fi drops. Never use blocking delays in the main loop; GPS bytes must keep being read.
2. **GPS**: reuse/extend the existing TinyGPSPlus code. Expose `gpsValid`, `dateValid`, `timeValid`, satellites, lat/lon, GPS UTC, date, fix age. **Return `null` in JSON for anything not valid** — never placeholder or last-known-as-current values. Do not assume a fix at boot.
3. **Local time**: derive IST (UTC+05:30, fixed) from GPS date+UTC time, correctly handling day rollover (date changes when adding 5:30).
4. **Sunrise/sunset**: calculate ON THE ESP32 from latitude, longitude and date using the NOAA/standard solar algorithm (solar zenith 90.833 deg), output IST `"HH:MM"`. Handle polar day/night (return null + do not crash), handle day boundaries. Recompute when date or position changes meaningfully (not every loop). Put it in its own file (e.g. `sun_calc.h/.cpp`) with a comment block describing the algorithm and a serial self-test function using a known reference location/date so we can compare against an independent reference. Report `isDaytime` from the calculated values and IST time (null if unknown).
5. **LDR**: read GPIO34 with light averaging/smoothing (e.g. median/moving average of several samples) — non-blocking. Classify `BRIGHT` / `DIM` / `DARK` with thresholds in `config.h` and hysteresis. Thresholds are placeholders until calibrated on the real hardware; state in the guide how to calibrate (print raw values via Serial under bright/dim/dark conditions). Note LDR polarity depends on wiring — make "higher = brighter or darker" a single config flag.
6. **Relay + modes**:
   - Boot into AUTO. Drive GPIO23 active-HIGH. Initialise the pin to a safe known state before anything else.
   - AUTO logic per the agreed decision in PROJECT_CONTEXT.md "Open decisions" (default: astronomical night -> ON; LDR DARK before sunset -> ON; GPS invalid -> LDR fallback; hysteresis + minimum dwell time to avoid relay chatter). Report `autoReason`.
   - MANUAL: `POST /api/light` sets the relay; reject with 409 `NOT_IN_MANUAL_MODE` in AUTO.
   - `lightOn` in responses is read back from the actual output state, not from a requested variable.
   - Switching AUTO->MANUAL keeps current relay state; MANUAL->AUTO returns control to automation.
7. **Web server**:
   - Serve `frontend/` files from LittleFS at `/` (index.html, style.css, script.js, config.js, demo.js) with correct MIME types. Document a PROGMEM fallback option in the guide (do not implement unless asked).
   - `GET /api/status`, `POST /api/mode`, `POST /api/light` per contract: correct JSON, correct HTTP codes (200/400/404/405/409/500), error shape `{ok:false,error,message}`.
   - CORS headers + `OPTIONS` handling as specified in the contract.
   - Validate request bodies (size limit, JSON parse errors -> 400). Never crash on malformed input.
   - Keep handlers fast; do not block GPS reading.
8. **Debuggability**: Serial logging (115200) with a `DEBUG` flag: Wi-Fi state/IP, GPS validity changes, sunrise/sunset results, mode/relay changes, API requests.
9. **Docs** `docs/FIRMWARE_GUIDE.md`: required libraries + versions, board settings (ESP32 Dev Module, partition scheme with LittleFS), how to set up `secrets.h`, how to upload the LittleFS `data/` folder (Arduino IDE LittleFS upload plugin or PlatformIO `uploadfs`), how to copy the frontend into `data/`, how to test each endpoint with curl, how to calibrate the LDR, how to verify sunrise/sunset, memory/flash usage notes.

## Hard rules
- Do not change pin assignments or relay active-HIGH logic. No new hardware.
- No fabricated values: unknown -> `null`. Do not hardcode example coordinates/times/LDR values as real readings (the contract examples are examples only).
- No credentials in tracked files or in the frontend.
- Do not claim anything works on hardware until it has been flashed and tested on the real ESP32. In your reports, separate: "compiles", "tested on hardware", "not tested". If you cannot compile/flash in this environment, say so plainly.
- Preserve existing working GPS diagnostic code (keep a serial diagnostics mode if practical).
- Explain your plan before major changes; don't overwrite unrelated code.

## Working method
1. Step 0, wait for approval.
2. Milestones: (a) Wi-Fi + server skeleton + `/api/status` with real GPS fields -> (b) LDR + relay + `/api/light` + `/api/mode` -> (c) sun_calc + IST + isDaytime + AUTO logic -> (d) LittleFS hosting + CORS + validation + docs. After each, give me a short summary, exact test steps (curl commands, expected output), and what is still unverified.
3. Until Person A's frontend is ready, test with curl. Until the hardware is attached, say so.
4. If requirements change later, update the relevant doc in the same task and list what changed.
