#include "relay_controller.h"

RelayController::RelayController()
  : _mode(MODE_AUTO),
    _autoReason("WAITING_FOR_GPS"),
    _lastStateChangeMs(0) {}

void RelayController::begin() {
  // Safe initial state before anything else
  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, RELAY_STATE_OFF);
  _lastStateChangeMs = millis();
}

bool RelayController::isLightOn() const {
  // Read back actual hardware pin state
  return (digitalRead(PIN_RELAY) == RELAY_STATE_ON);
}

String RelayController::getAutoReason() const {
  if (_mode == MODE_MANUAL) return "";
  return _autoReason;
}

bool RelayController::setMode(const String& newMode) {
  if (newMode.equalsIgnoreCase("AUTO")) {
    _mode = MODE_AUTO;
    Serial.println(F("[RELAY] Switched to AUTO mode"));
    return true;
  } else if (newMode.equalsIgnoreCase("MANUAL")) {
    _mode = MODE_MANUAL;
    _autoReason = "";
    Serial.println(F("[RELAY] Switched to MANUAL mode (retaining current relay state)"));
    return true;
  }
  return false;
}

bool RelayController::setManualLight(bool on) {
  if (_mode != MODE_MANUAL) {
    Serial.println(F("[RELAY] Command rejected: Not in MANUAL mode"));
    return false;
  }
  applyRelay(on);
  Serial.printf("[RELAY] Manual command applied: %s\n", on ? "ON" : "OFF");
  return true;
}

void RelayController::updateAuto(bool isGpsValid, bool isSolarSynced, bool isDaytime) {
  if (_mode != MODE_AUTO) return;

  bool targetOn = false;

  if (!isGpsValid) {
    _autoReason = "WAITING_FOR_GPS";
    targetOn = false;
  } else if (!isSolarSynced) {
    _autoReason = "API_SYNC_PENDING";
    targetOn = false;
  } else {
    _autoReason = "ASTRONOMICAL";
    // Streetlight ON at sunset (nighttime), OFF at sunrise (daytime)
    targetOn = !isDaytime;
  }

  bool currentOn = isLightOn();
  if (targetOn != currentOn) {
    // Check dwell time to prevent relay chatter
    if (millis() - _lastStateChangeMs >= RELAY_DWELL_MS) {
      applyRelay(targetOn);
      _lastStateChangeMs = millis();
      Serial.printf("[RELAY AUTO] State changed to %s (Reason: %s)\n",
                    targetOn ? "ON" : "OFF", _autoReason.c_str());
    }
  }
}

void RelayController::applyRelay(bool on) {
  digitalWrite(PIN_RELAY, on ? RELAY_STATE_ON : RELAY_STATE_OFF);
}

