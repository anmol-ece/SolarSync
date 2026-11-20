#!/usr/bin/env python3
"""
SolarSync Local Mock Server
Serves the frontend/ dashboard and implements the /api endpoints per API_CONTRACT.md (v1.1).
Used for testing the dashboard locally without physical ESP32 hardware.
"""

import sys
import os
import json
import time
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8000
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

# Simulated Hardware & Automation State
state = {
    "wifiConnected": True,
    "gpsValid": True,
    "dateValid": True,
    "timeValid": True,
    "latitude": 12.9716,
    "longitude": 77.5946,
    "satellites": 9,
    "sunrise": "06:15",
    "sunset": "17:55",
    "lightOn": False,
    "mode": "AUTO",
    "autoReason": "ASTRONOMICAL",
    "firmwareVersion": "0.2.0-mock",
    "boot_time": time.time()
}

class SolarSyncHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS headers per API contract
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/status":
            self.handle_get_status()
        else:
            # Serve static frontend files
            super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_length)

        try:
            payload = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
        except json.JSONDecodeError:
            self.send_json_error(400, "BAD_REQUEST", "Malformed JSON body")
            return

        if self.path == "/api/mode":
            self.handle_post_mode(payload)
        elif self.path == "/api/light":
            self.handle_post_light(payload)
        else:
            self.send_json_error(404, "NOT_FOUND", "Endpoint not found")

    def handle_get_status(self):
        # Calculate real-time UTC and IST clock
        now_utc = datetime.now(timezone.utc)
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        now_ist = now_utc.astimezone(ist_tz)

        # Determine day or night based on sunrise (06:15) and sunset (17:55)
        current_ist_minutes = now_ist.hour * 60 + now_ist.minute
        sunrise_minutes = 6 * 60 + 15  # 06:15
        sunset_minutes = 17 * 60 + 55  # 17:55
        is_daytime = (sunrise_minutes <= current_ist_minutes < sunset_minutes)

        # In AUTO mode, update relay automatically: ON at sunset (nighttime), OFF at sunrise (daytime)
        if state["mode"] == "AUTO":
            state["lightOn"] = not is_daytime
            state["autoReason"] = "ASTRONOMICAL"

        payload = {
            "wifiConnected": state["wifiConnected"],
            "gpsValid": state["gpsValid"],
            "dateValid": state["dateValid"],
            "timeValid": state["timeValid"],
            "latitude": state["latitude"] if state["gpsValid"] else None,
            "longitude": state["longitude"] if state["gpsValid"] else None,
            "satellites": state["satellites"] if state["gpsValid"] else 0,
            "gpsUtc": now_utc.strftime("%H:%M:%S") if state["timeValid"] else None,
            "localTime": now_ist.strftime("%H:%M:%S") if state["timeValid"] else None,
            "date": now_ist.strftime("%Y-%m-%d") if state["dateValid"] else None,
            "sunrise": state["sunrise"],
            "sunset": state["sunset"],
            "isDaytime": is_daytime,
            "lightOn": state["lightOn"],
            "mode": state["mode"],
            "autoReason": state["autoReason"] if state["mode"] == "AUTO" else None,
            "gpsFixAgeMs": 350 if state["gpsValid"] else None,
            "uptimeSeconds": int(time.time() - state["boot_time"]),
            "firmwareVersion": state["firmwareVersion"]
        }

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload, indent=2).encode("utf-8"))

    def handle_post_mode(self, payload):
        target_mode = payload.get("mode")
        if not target_mode:
            self.send_json_error(400, "BAD_REQUEST", "Missing 'mode' field")
            return

        target_mode = str(target_mode).upper()
        if target_mode not in ["AUTO", "MANUAL"]:
            self.send_json_error(400, "INVALID_VALUE", "Mode must be 'AUTO' or 'MANUAL'")
            return

        state["mode"] = target_mode
        if target_mode == "MANUAL":
            state["autoReason"] = None

        res = {
            "ok": True,
            "mode": state["mode"],
            "lightOn": state["lightOn"]
        }
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(res).encode("utf-8"))

    def handle_post_light(self, payload):
        if state["mode"] == "AUTO":
            self.send_json_error(409, "NOT_IN_MANUAL_MODE", "Streetlight can only be switched in MANUAL mode.")
            return

        target_state = payload.get("state")
        if not target_state:
            self.send_json_error(400, "BAD_REQUEST", "Missing 'state' field")
            return

        target_state = str(target_state).upper()
        if target_state not in ["ON", "OFF"]:
            self.send_json_error(400, "INVALID_VALUE", "State must be 'ON' or 'OFF'")
            return

        state["lightOn"] = (target_state == "ON")

        res = {
            "ok": True,
            "lightOn": state["lightOn"]
        }
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(res).encode("utf-8"))

    def send_json_error(self, code, error_name, message):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        payload = {"ok": False, "error": error_name, "message": message}
        self.wfile.write(json.dumps(payload).encode("utf-8"))

def run():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, SolarSyncHandler)
    print("==================================================")
    print("   SOLARSYNC LOCAL MOCK SERVER")
    print(f"   Dashboard URL: http://localhost:{PORT}")
    print("   Serving frontend from:", FRONTEND_DIR)
    print("   API Contract: v1.1 (/api/status, /api/mode, /api/light)")
    print("==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
        httpd.server_close()

if __name__ == "__main__":
    run()
