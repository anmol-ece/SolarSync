#ifndef SOLAR_API_H
#define SOLAR_API_H

#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

class SolarApi {
public:
  SolarApi();
  void begin();
  bool sync(double lat, double lng);

  bool isSynced() const { return _isSynced; }
  String getSunriseStr() const { return _sunriseStr; }
  String getSunsetStr() const { return _sunsetStr; }

  int getSunriseMinutes() const { return _sunriseMinutes; }
  int getSunsetMinutes() const { return _sunsetMinutes; }

  bool isDaytime(int currentIstMinutes) const;

private:
  bool _isSynced;
  String _sunriseStr;
  String _sunsetStr;
  int _sunriseMinutes;
  int _sunsetMinutes;
  double _lastSyncLat;
  double _lastSyncLng;

  int parseIsoToIstMinutes(const char* isoTimestamp);
  String formatMinutesToHhMm(int totalMinutes);
};

#endif // SOLAR_API_H

