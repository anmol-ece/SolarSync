#ifndef WEB_SERVER_H
#define WEB_SERVER_H

#include <Arduino.h>
#include <WebServer.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include "config.h"
#include "gps_handler.h"
#include "solar_api.h"
#include "relay_controller.h"

class AppWebServer {
public:
  AppWebServer(GpsHandler& gps, SolarApi& solar, RelayController& relay);
  void begin();
  void handleClient();

private:
  WebServer _server;
  GpsHandler& _gps;
  SolarApi& _solar;
  RelayController& _relay;

  void setupRoutes();
  void handleOptions();
  void handleGetStatus();
  void handlePostMode();
  void handlePostLight();
  void handleNotFound();

  bool handleFileRead(String path);
  String getContentType(String filename);
  void sendCorsHeaders();
  void sendJsonError(int statusCode, const String& errorCode, const String& message);
};

#endif // WEB_SERVER_H

