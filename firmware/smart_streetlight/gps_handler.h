#ifndef GPS_HANDLER_H
#define GPS_HANDLER_H

#include <Arduino.h>
#include <TinyGPSPlus.h>
#include "config.h"

class GpsHandler {
public:
  GpsHandler();
  void begin();
  void update();

  bool isLocationValid();
  bool isDateValid();
  bool isTimeValid();

  double getLatitude();
  double getLongitude();
  uint32_t getSatellites();
  uint32_t getFixAgeMs();

  String getGpsUtcTime();
  String getLocalIstTime();
  String getGpsDate();

  int getIstHour();
  int getIstMinute();
  int getIstSecond();
  int getIstTotalMinutes();

  void printDiagnostics();

private:
  TinyGPSPlus _gps;
  HardwareSerial _gpsSerial;
  unsigned long _lastDiagMs;

  void computeIst(int &istYear, int &istMonth, int &istDay, int &istHour, int &istMin, int &istSec);
  static int daysInMonth(int year, int month);
  static bool isLeapYear(int year);
};

#endif // GPS_HANDLER_H

