#ifndef RELAY_CONTROLLER_H
#define RELAY_CONTROLLER_H

#include <Arduino.h>
#include "config.h"

enum OperatingMode {
  MODE_AUTO,
  MODE_MANUAL
};

class RelayController {
public:
  RelayController();
  void begin();

  bool isLightOn() const;
  OperatingMode getMode() const { return _mode; }
  String getModeStr() const { return (_mode == MODE_AUTO) ? "AUTO" : "MANUAL"; }
  String getAutoReason() const;

  bool setMode(const String& newMode);
  bool setManualLight(bool on);

  void updateAuto(bool isGpsValid, bool isSolarSynced, bool isDaytime);

private:
  OperatingMode _mode;
  String _autoReason;
  unsigned long _lastStateChangeMs;
  void applyRelay(bool on);
};

#endif // RELAY_CONTROLLER_H

