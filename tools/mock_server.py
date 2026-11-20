#!/usr/bin/env python3
"""
tools/mock_server.py - Mock ESP32 Web Server for Person A (Frontend Testing)
MOCK SERVER — not the ESP32.

Fulfills API Contract v1.1:
  - Serves static files from ../frontend/
  - Implements GET /api/status, POST /api/mode, POST /api/light
  - Full CORS headers + OPTIONS 204 handling
  - Switchable test scenarios via GET /scenario/<name>:
      gps_waiting   : cold start, no satellite fix
      gps_ok        : GPS fixed, daytime, API synced, light OFF (AUTO)
      gps_ok_night  : GPS fixed, nighttime, API synced, light ON (AUTO)
      command_fail  : POST /api/light always returns 500 INTERNAL_ERROR
      esp_offline   : /api/status closes connection immediately (simulates timeout)
"""

import sys
import os
import json
import time
import socket
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.parse

PORT = 8000
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

# Mutable server state (shared across requests)
server_state = {
    "scenario": "gps_ok",   # active scenario name
    "mode": "AUTO",         # current relay mode
    "lightOn": False,       # current relay state
    "uptime_start": time.time()
}


class MockESP32Handler(SimpleHTTPRequestHandler):
    """HTTP handler that mimics the ESP32 firmware API."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    # ------------------------------------------------------------------ CORS
    def _add_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        """Preflight — always 204 with CORS headers."""
        self.send_response(204)
        self._add_cors_headers()
        self.end_headers()

    # ------------------------------------------------------------------ GET
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/status":
            self._handle_status()
        elif path.startswith("/scenario/"):
            self._switch_scenario(path.replace("/scenario/", "").strip("/"))
        else:
            # Serve frontend static files
            super().do_GET()

    # ------------------------------------------------------------------ POST
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)

        try:
            body = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            self._json(400, {"ok": False, "error": "BAD_REQUEST",
                             "message": "Malformed JSON body"})
            return

        if parsed.path == "/api/mode":
            self._handle_mode(body)
        elif parsed.path == "/api/light":
            self._handle_light(body)
        else:
            self._json(404, {"ok": False, "error": "NOT_FOUND",
                             "message": "Route not found"})

    # ============================================================ API handlers

    def _handle_status(self):
        scenario = server_state["scenario"]
        uptime = int(time.time() - server_state["uptime_start"])

        # --- esp_offline: drop connection so the client fetch times out ---
        if scenario == "esp_offline":
            # Close the socket without sending anything -> client gets
            # a network error / abort (better than sleeping 3.5 s).
            self.connection.close()
            return

        # --- build payload per scenario ---
        if scenario == "gps_waiting":
            payload = {
                "wifiConnected": True,
                "gpsValid": False,
                "dateValid": False,
                "timeValid": False,
                "latitude": None,
                "longitude": None,
                "satellites": 2,
                "gpsUtc": None,
                "localTime": None,
                "date": None,
                "sunrise": None,
                "sunset": None,
                "isDaytime": None,
                "lightOn": False,
                "mode": server_state["mode"],
                "autoReason": "WAITING_FOR_GPS",
                "gpsFixAgeMs": None,
                "uptimeSeconds": uptime,
                "firmwareVersion": "0.2.0-mock"
            }

        elif scenario == "gps_ok_night":
            auto = server_state["mode"] == "AUTO"
            payload = {
                "wifiConnected": True,
                "gpsValid": True,
                "dateValid": True,
                "timeValid": True,
                "latitude": 12.9716,
                "longitude": 77.5946,
                "satellites": 9,
                "gpsUtc": "15:30:00",
                "localTime": "21:00:00",
                "date": "2026-11-20",
                "sunrise": "06:14",
                "sunset": "17:52",
                "isDaytime": False,
                "lightOn": True if auto else server_state["lightOn"],
                "mode": server_state["mode"],
                "autoReason": "ASTRONOMICAL_API" if auto else None,
                "gpsFixAgeMs": 140,
                "uptimeSeconds": uptime,
                "firmwareVersion": "0.2.0-mock"
            }

        else:  # default: gps_ok (daytime)
            auto = server_state["mode"] == "AUTO"
            payload = {
                "wifiConnected": True,
                "gpsValid": True,
                "dateValid": True,
                "timeValid": True,
                "latitude": 12.9716,
                "longitude": 77.5946,
                "satellites": 8,
                "gpsUtc": "08:30:00",
                "localTime": "14:00:00",
                "date": "2026-11-20",
                "sunrise": "06:14",
                "sunset": "17:52",
                "isDaytime": True,
                "lightOn": False if auto else server_state["lightOn"],
                "mode": server_state["mode"],
                "autoReason": "ASTRONOMICAL_API" if auto else None,
                "gpsFixAgeMs": 280,
                "uptimeSeconds": uptime,
                "firmwareVersion": "0.2.0-mock"
            }

        # Keep in-memory lightOn consistent
        server_state["lightOn"] = payload["lightOn"]
        self._json(200, payload)

    def _handle_mode(self, body):
        new_mode = body.get("mode")
        if new_mode not in ("AUTO", "MANUAL"):
            self._json(400, {"ok": False, "error": "INVALID_VALUE",
                             "message": "mode must be AUTO or MANUAL"})
            return
        server_state["mode"] = new_mode
        self._json(200, {"ok": True, "mode": server_state["mode"],
                         "lightOn": server_state["lightOn"]})

    def _handle_light(self, body):
        # command_fail scenario: reject every POST /api/light with 500
        if server_state["scenario"] == "command_fail":
            self._json(500, {"ok": False, "error": "INTERNAL_ERROR",
                             "message": "Simulated firmware fault (command_fail scenario)"})
            return

        if server_state["mode"] == "AUTO":
            self._json(409, {"ok": False, "error": "NOT_IN_MANUAL_MODE",
                             "message": "Cannot control light directly while in AUTO mode"})
            return

        new_state = body.get("state")
        if new_state not in ("ON", "OFF"):
            self._json(400, {"ok": False, "error": "INVALID_VALUE",
                             "message": "state must be ON or OFF"})
            return

        server_state["lightOn"] = (new_state == "ON")
        self._json(200, {"ok": True, "lightOn": server_state["lightOn"]})

    def _switch_scenario(self, name):
        server_state["scenario"] = name
        print(f"  [SCENARIO] Switched to: {name}")
        self._json(200, {"ok": True, "active_scenario": name})

    # ---------------------------------------------------------------- helpers
    def _json(self, code, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self._add_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        # Suppress noisy static-file access logs; show only API calls
        if "/api/" in args[0] or "/scenario/" in args[0]:
            print(f"  [MOCK] {self.address_string()} {args[0].split()[0]:6s} "
                  f"{args[0].split()[1]}  -> {args[1]}")


def main():
    banner = "=" * 62
    print(banner)
    print("  MOCK SERVER — NOT THE REAL ESP32 HARDWARE")
    print(f"  Frontend dir : {FRONTEND_DIR}")
    print(f"  Dashboard    : http://localhost:{PORT}/")
    print(f"  Demo URL     : http://localhost:{PORT}/?demo=1")
    print()
    print("  Switch scenario by visiting:")
    for s in ("gps_waiting", "gps_ok", "gps_ok_night",
              "command_fail", "esp_offline"):
        print(f"    http://localhost:{PORT}/scenario/{s}")
    print(banner)

    httpd = HTTPServer(("0.0.0.0", PORT), MockESP32Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Shutting down mock server.")
        httpd.server_close()


if __name__ == "__main__":
    main()
