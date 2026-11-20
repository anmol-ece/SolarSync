#include "gps_handler.h"

GpsHandler::GpsHandler() : _gpsSerial(2), _lastDiagMs(0) {}

void GpsHandler::begin() {
  // Start HardwareSerial2 on GPIO 16 (RX) and GPIO 17 (TX) at 9600 baud
  _gpsSerial.begin(BAUD_GPS, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
}

void GpsHandler::update() {
  // Non-blocking feed of GPS stream into TinyGPSPlus parser
  while (_gpsSerial.available() > 0) {
    _gps.encode(_gpsSerial.read());
  }

  if (ENABLE_GPS_SERIAL_DIAG) {
    if (millis() - _lastDiagMs >= 5000) {
      _lastDiagMs = millis();
      printDiagnostics();
    }
  }
}

bool GpsHandler::isLocationValid() {
  return _gps.location.isValid() && _gps.location.age() < 10000;
}

bool GpsHandler::isDateValid() {
  return _gps.date.isValid();
}

bool GpsHandler::isTimeValid() {
  return _gps.time.isValid();
}

double GpsHandler::getLatitude() {
  return _gps.location.isValid() ? _gps.location.lat() : 0.0;
}

double GpsHandler::getLongitude() {
  return _gps.location.isValid() ? _gps.location.lng() : 0.0;
}

uint32_t GpsHandler::getSatellites() {
  return _gps.satellites.isValid() ? _gps.satellites.value() : 0;
}

uint32_t GpsHandler::getFixAgeMs() {
  return _gps.location.isValid() ? _gps.location.age() : 0;
}

String GpsHandler::getGpsUtcTime() {
  if (!_gps.time.isValid()) return "";
  char buf[12];
  snprintf(buf, sizeof(buf), "%02d:%02d:%02d", _gps.time.hour(), _gps.time.minute(), _gps.time.second());
  return String(buf);
}

String GpsHandler::getLocalIstTime() {
  if (!_gps.time.isValid()) return "";
  int y, m, d, hr, mn, sc;
  computeIst(y, m, d, hr, mn, sc);
  char buf[12];
  snprintf(buf, sizeof(buf), "%02d:%02d:%02d", hr, mn, sc);
  return String(buf);
}

String GpsHandler::getGpsDate() {
  if (!_gps.date.isValid()) return "";
  int y, m, d, hr, mn, sc;
  computeIst(y, m, d, hr, mn, sc);
  char buf[16];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02d", y, m, d);
  return String(buf);
}

int GpsHandler::getIstHour() {
  if (!_gps.time.isValid()) return -1;
  int y, m, d, hr, mn, sc;
  computeIst(y, m, d, hr, mn, sc);
  return hr;
}

int GpsHandler::getIstMinute() {
  if (!_gps.time.isValid()) return -1;
  int y, m, d, hr, mn, sc;
  computeIst(y, m, d, hr, mn, sc);
  return mn;
}

int GpsHandler::getIstSecond() {
  return _gps.time.isValid() ? _gps.time.second() : -1;
}

int GpsHandler::getIstTotalMinutes() {
  if (!_gps.time.isValid()) return -1;
  int hr = getIstHour();
  int mn = getIstMinute();
  return (hr * 60) + mn;
}

void GpsHandler::computeIst(int &istYear, int &istMonth, int &istDay, int &istHour, int &istMin, int &istSec) {
  int utcYear = _gps.date.isValid() ? _gps.date.year() : 2026;
  int utcMonth = _gps.date.isValid() ? _gps.date.month() : 1;
  int utcDay = _gps.date.isValid() ? _gps.date.day() : 1;
  int utcHour = _gps.time.hour();
  int utcMin = _gps.time.minute();
  istSec = _gps.time.second();

  // Add 5 hours and 30 minutes for Indian Standard Time (IST)
  int totalMin = utcMin + 30;
  istMin = totalMin % 60;
  int carryHour = totalMin / 60;

  int totalHour = utcHour + 5 + carryHour;
  istHour = totalHour % 24;
  int carryDay = totalHour / 24;

  istDay = utcDay + carryDay;
  istMonth = utcMonth;
  istYear = utcYear;

  int dim = daysInMonth(istYear, istMonth);
  if (istDay > dim) {
    istDay -= dim;
    istMonth++;
    if (istMonth > 12) {
      istMonth = 1;
      istYear++;
    }
  }
}

int GpsHandler::daysInMonth(int year, int month) {
  switch (month) {
    case 1: case 3: case 5: case 7: case 8: case 10: case 12: return 31;
    case 4: case 6: case 9: case 11: return 30;
    case 2: return isLeapYear(year) ? 29 : 28;
    default: return 30;
  }
}

bool GpsHandler::isLeapYear(int year) {
  return (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
}

void GpsHandler::printDiagnostics() {
  Serial.print(F("[GPS DIAG] Valid: "));
  Serial.print(_gps.location.isValid() ? "YES" : "NO");
  Serial.print(F(" | Sats: "));
  Serial.print(_gps.satellites.value());
  Serial.print(F(" | Lat: "));
  Serial.print(_gps.location.lat(), 6);
  Serial.print(F(" | Lon: "));
  Serial.print(_gps.location.lng(), 6);
  Serial.print(F(" | UTC: "));
  Serial.print(getGpsUtcTime());
  Serial.print(F(" | IST: "));
  Serial.println(getLocalIstTime());
}

