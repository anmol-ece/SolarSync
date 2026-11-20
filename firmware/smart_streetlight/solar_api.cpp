#include "solar_api.h"

SolarApi::SolarApi()
  : _isSynced(false),
    _sunriseStr(""),
    _sunsetStr(""),
    _sunriseMinutes(-1),
    _sunsetMinutes(-1),
    _lastSyncLat(0.0),
    _lastSyncLng(0.0) {}

void SolarApi::begin() {
  _isSynced = false;
}

bool SolarApi::sync(double lat, double lng) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("[SOLAR API] Cannot sync: Wi-Fi not connected"));
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure(); // Skip certificate validation for open public API

  HTTPClient http;
  char url[180];
  snprintf(url, sizeof(url), "https://api.sunrise-sunset.org/json?lat=%.4f&lng=%.4f&date=today&formatted=0", lat, lng);

  Serial.print(F("[SOLAR API] Requesting: "));
  Serial.println(url);

  http.begin(client, url);
  http.setTimeout(8000);

  int httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    Serial.printf("[SOLAR API] HTTP error: %d - %s\n", httpCode, http.errorToString(httpCode).c_str());
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  DynamicJsonDocument doc(1536);
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    Serial.print(F("[SOLAR API] JSON parse failed: "));
    Serial.println(err.c_str());
    return false;
  }

  const char* status = doc["status"];
  if (!status || strcmp(status, "OK") != 0) {
    Serial.println(F("[SOLAR API] API status not OK"));
    return false;
  }

  const char* sunriseIso = doc["results"]["sunrise"];
  const char* sunsetIso = doc["results"]["sunset"];

  if (!sunriseIso || !sunsetIso) {
    Serial.println(F("[SOLAR API] Missing sunrise/sunset in payload"));
    return false;
  }

  _sunriseMinutes = parseIsoToIstMinutes(sunriseIso);
  _sunsetMinutes = parseIsoToIstMinutes(sunsetIso);

  if (_sunriseMinutes < 0 || _sunsetMinutes < 0) {
    Serial.println(F("[SOLAR API] Error converting timestamps to IST"));
    return false;
  }

  _sunriseStr = formatMinutesToHhMm(_sunriseMinutes);
  _sunsetStr = formatMinutesToHhMm(_sunsetMinutes);
  _lastSyncLat = lat;
  _lastSyncLng = lng;
  _isSynced = true;

  Serial.printf("[SOLAR API] Sync Success -> Sunrise (IST): %s, Sunset (IST): %s\n",
                _sunriseStr.c_str(), _sunsetStr.c_str());
  return true;
}

// Parses ISO 8601 UTC timestamp "YYYY-MM-DDTHH:MM:SS+00:00" and converts to IST total minutes of day (0-1439)
int SolarApi::parseIsoToIstMinutes(const char* isoTimestamp) {
  if (!isoTimestamp || strlen(isoTimestamp) < 16) return -1;

  const char* tPtr = strchr(isoTimestamp, 'T');
  if (!tPtr) return -1;
  tPtr++; // Point to HH

  int utcHour = (tPtr[0] - '0') * 10 + (tPtr[1] - '0');
  int utcMin = (tPtr[3] - '0') * 10 + (tPtr[4] - '0');

  // Add 5 hours 30 mins (330 mins) for IST
  int totalUtcMinutes = (utcHour * 60) + utcMin;
  int totalIstMinutes = (totalUtcMinutes + 330) % 1440;
  return totalIstMinutes;
}

String SolarApi::formatMinutesToHhMm(int totalMinutes) {
  int hr = (totalMinutes / 60) % 24;
  int mn = totalMinutes % 60;
  char buf[8];
  snprintf(buf, sizeof(buf), "%02d:%02d", hr, mn);
  return String(buf);
}

bool SolarApi::isDaytime(int currentIstMinutes) const {
  if (!_isSynced || _sunriseMinutes < 0 || _sunsetMinutes < 0 || currentIstMinutes < 0) {
    return false;
  }

  if (_sunriseMinutes < _sunsetMinutes) {
    // Normal day: e.g. Sunrise 06:15, Sunset 17:55
    return (currentIstMinutes >= _sunriseMinutes && currentIstMinutes < _sunsetMinutes);
  } else {
    // Polar / unusual boundary where sunset is earlier in clock time
    return (currentIstMinutes >= _sunriseMinutes || currentIstMinutes < _sunsetMinutes);
  }
}

