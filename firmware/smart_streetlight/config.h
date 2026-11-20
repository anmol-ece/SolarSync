#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// Firmware Version
#define FIRMWARE_VERSION "0.2.0"

// Hardware Pin Definitions (DO NOT CHANGE)
#define PIN_GPS_RX        16    // ESP32 RX2 connects to GPS TX
#define PIN_GPS_TX        17    // ESP32 TX2 connects to GPS RX
#define PIN_RELAY         23    // Relay Channel 1 IN1 (Active-HIGH)

// Baud Rates
#define BAUD_SERIAL       115200
#define BAUD_GPS          9600

// Relay Logic (Active-HIGH: HIGH = ON, LOW = OFF)
#define RELAY_STATE_ON    HIGH
#define RELAY_STATE_OFF   LOW

// Automation Parameters
#define RELAY_DWELL_MS    30000UL   // 30 seconds minimum between automatic state changes (anti-chatter)
#define SOLAR_SYNC_INTERVAL_MS 21600000UL // Sync with Sunrise-Sunset API every 6 hours

// Sunrise-Sunset API Endpoint
#define SOLAR_API_HOST    "api.sunrise-sunset.org"

// Serial Diagnostics Toggle
#define ENABLE_GPS_SERIAL_DIAG false

#endif // CONFIG_H

