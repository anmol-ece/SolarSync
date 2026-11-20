#include <Arduino.h>
#include <WiFi.h>

#if __has_include("secrets.h")
  #include "secrets.h"
#else
  #include "secrets.example.h"
#endif

#include "config.h"
#include "gps_handler.h"
#include "solar_api.h"
#include "relay_controller.h"
#include "web_server.h"

// Hardware and Service Modules
GpsHandler gps;
SolarApi solar;
RelayController relay;
AppWebServer webServer(gps, solar, relay);

// Timing variables for non-blocking loop tasks
unsigned long lastSolarSyncAttempt = 0;
unsigned long lastRelayUpdate = 0;
unsigned long lastWifiCheck = 0;

void setup() {
  Serial.begin(BAUD_SERIAL);
  delay(100);

  Serial.println();
  Serial.println(F("=================================================="));
  Serial.println(F("   SOLARSYNC — Smart Streetlight Automation"));
  Serial.printf(F("   Firmware Version: %s\n"), FIRMWARE_VERSION);
  Serial.println(F("=================================================="));

  // 1. Initialise Relay to safe state immediately
  relay.begin();

  // 2. Initialise GPS UART2 receiver
  gps.begin();

  // 3. Initialise Solar API client
  solar.begin();

  // 4. Connect to Wi-Fi in Station Mode
  Serial.printf("[WIFI] Connecting to SSID: %s ...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Allow up to 10 seconds for initial connection during boot
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - wifiStart < 10000)) {
    delay(250);
    Serial.print(F("."));
    // Keep feeding GPS during boot delay
    gps.update();
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WIFI] Connected! Assigned IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println(F("[WIFI] Connection timeout. Continuing in background..."));
  }

  // 5. Initialise Web Server & LittleFS
  webServer.begin();

  Serial.println(F("[SYSTEM] Initialization complete. Entering main loop."));
}

void loop() {
  unsigned long now = millis();

  // 1. Continually parse incoming GPS bytes (Strictly non-blocking)
  gps.update();

  // 2. Handle incoming HTTP web client requests
  webServer.handleClient();

  // 3. Periodic Wi-Fi auto-reconnect check (every 10 seconds)
  if (now - lastWifiCheck >= 10000) {
    lastWifiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println(F("[WIFI] Disconnected. Attempting reconnection..."));
      WiFi.reconnect();
    }
  }

  // 4. Solar API Synchronization Task
  // Sync if:
  // - GPS location is valid
  // - Wi-Fi is connected
  // - AND (never synced before OR interval elapsed)
  if (gps.isLocationValid() && (WiFi.status() == WL_CONNECTED)) {
    bool needSync = (!solar.isSynced()) || (now - lastSolarSyncAttempt >= SOLAR_SYNC_INTERVAL_MS);
    if (needSync) {
      lastSolarSyncAttempt = now;
      solar.sync(gps.getLatitude(), gps.getLongitude());
    }
  }

  // 5. Automation Task (Evaluated every 1000 ms)
  if (now - lastRelayUpdate >= 1000) {
    lastRelayUpdate = now;

    bool gpsValid = gps.isLocationValid() && gps.isTimeValid();
    bool solarSynced = solar.isSynced();
    bool daytime = false;

    if (gpsValid && solarSynced) {
      daytime = solar.isDaytime(gps.getIstTotalMinutes());
    }

    relay.updateAuto(gpsValid, solarSynced, daytime);
  }
}

