#include "web_server.h"

AppWebServer::AppWebServer(GpsHandler& gps, SolarApi& solar, RelayController& relay)
  : _server(80), _gps(gps), _solar(solar), _relay(relay) {}

void AppWebServer::begin() {
  if (!LittleFS.begin(true)) {
    Serial.println(F("[WEB SERVER] LittleFS mount failed!"));
  } else {
    Serial.println(F("[WEB SERVER] LittleFS mounted successfully."));
  }

  setupRoutes();
  _server.begin();
  Serial.println(F("[WEB SERVER] HTTP server started on port 80"));
}

void AppWebServer::handleClient() {
  _server.handleClient();
}

void AppWebServer::setupRoutes() {
  // CORS Preflight
  _server.on("/api/status", HTTP_OPTIONS, [this]() { handleOptions(); });
  _server.on("/api/mode", HTTP_OPTIONS, [this]() { handleOptions(); });
  _server.on("/api/light", HTTP_OPTIONS, [this]() { handleOptions(); });

  // REST API Endpoints
  _server.on("/api/status", HTTP_GET, [this]() { handleGetStatus(); });
  _server.on("/api/mode", HTTP_POST, [this]() { handlePostMode(); });
  _server.on("/api/light", HTTP_POST, [this]() { handlePostLight(); });

  // Fallback to static files in LittleFS
  _server.onNotFound([this]() { handleNotFound(); });
}

void AppWebServer::sendCorsHeaders() {
  _server.sendHeader("Access-Control-Allow-Origin", "*");
  _server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  _server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void AppWebServer::handleOptions() {
  sendCorsHeaders();
  _server.send(204);
}

void AppWebServer::sendJsonError(int statusCode, const String& errorCode, const String& message) {
  sendCorsHeaders();
  DynamicJsonDocument doc(256);
  doc["ok"] = false;
  doc["error"] = errorCode;
  doc["message"] = message;

  String output;
  serializeJson(doc, output);
  _server.send(statusCode, "application/json", output);
}

void AppWebServer::handleGetStatus() {
  sendCorsHeaders();

  DynamicJsonDocument doc(1024);

  doc["wifiConnected"] = (WiFi.status() == WL_CONNECTED);
  doc["gpsValid"] = _gps.isLocationValid();
  doc["dateValid"] = _gps.isDateValid();
  doc["timeValid"] = _gps.isTimeValid();

  if (_gps.isLocationValid()) {
    doc["latitude"] = _gps.getLatitude();
    doc["longitude"] = _gps.getLongitude();
  } else {
    doc["latitude"] = nullptr;
    doc["longitude"] = nullptr;
  }

  doc["satellites"] = _gps.getSatellites();

  if (_gps.isTimeValid()) {
    doc["gpsUtc"] = _gps.getGpsUtcTime();
    doc["localTime"] = _gps.getLocalIstTime();
  } else {
    doc["gpsUtc"] = nullptr;
    doc["localTime"] = nullptr;
  }

  if (_gps.isDateValid()) {
    doc["date"] = _gps.getGpsDate();
  } else {
    doc["date"] = nullptr;
  }

  if (_solar.isSynced()) {
    doc["sunrise"] = _solar.getSunriseStr();
    doc["sunset"] = _solar.getSunsetStr();
    if (_gps.isTimeValid()) {
      doc["isDaytime"] = _solar.isDaytime(_gps.getIstTotalMinutes());
    } else {
      doc["isDaytime"] = nullptr;
    }
  } else {
    doc["sunrise"] = nullptr;
    doc["sunset"] = nullptr;
    doc["isDaytime"] = nullptr;
  }

  doc["lightOn"] = _relay.isLightOn();
  doc["mode"] = _relay.getModeStr();

  String reason = _relay.getAutoReason();
  if (reason.length() > 0) {
    doc["autoReason"] = reason;
  } else {
    doc["autoReason"] = nullptr;
  }

  if (_gps.isLocationValid()) {
    doc["gpsFixAgeMs"] = _gps.getFixAgeMs();
  } else {
    doc["gpsFixAgeMs"] = nullptr;
  }

  doc["uptimeSeconds"] = millis() / 1000;
  doc["firmwareVersion"] = FIRMWARE_VERSION;

  String output;
  serializeJson(doc, output);
  _server.send(200, "application/json", output);
}

void AppWebServer::handlePostMode() {
  sendCorsHeaders();

  if (!_server.hasArg("plain")) {
    sendJsonError(400, "BAD_REQUEST", "Missing request body");
    return;
  }

  DynamicJsonDocument doc(256);
  DeserializationError error = deserializeJson(doc, _server.arg("plain"));
  if (error) {
    sendJsonError(400, "BAD_REQUEST", "Malformed JSON payload");
    return;
  }

  const char* modeStr = doc["mode"];
  if (!modeStr) {
    sendJsonError(400, "BAD_REQUEST", "Missing 'mode' field");
    return;
  }

  String modeUpper = String(modeStr);
  modeUpper.toUpperCase();

  if (modeUpper != "AUTO" && modeUpper != "MANUAL") {
    sendJsonError(400, "INVALID_VALUE", "Mode must be 'AUTO' or 'MANUAL'");
    return;
  }

  _relay.setMode(modeUpper);

  DynamicJsonDocument res(256);
  res["ok"] = true;
  res["mode"] = _relay.getModeStr();
  res["lightOn"] = _relay.isLightOn();

  String output;
  serializeJson(res, output);
  _server.send(200, "application/json", output);
}

void AppWebServer::handlePostLight() {
  sendCorsHeaders();

  if (_relay.getMode() == MODE_AUTO) {
    sendJsonError(409, "NOT_IN_MANUAL_MODE", "Streetlight can only be switched in MANUAL mode.");
    return;
  }

  if (!_server.hasArg("plain")) {
    sendJsonError(400, "BAD_REQUEST", "Missing request body");
    return;
  }

  DynamicJsonDocument doc(256);
  DeserializationError error = deserializeJson(doc, _server.arg("plain"));
  if (error) {
    sendJsonError(400, "BAD_REQUEST", "Malformed JSON payload");
    return;
  }

  const char* stateStr = doc["state"];
  if (!stateStr) {
    sendJsonError(400, "BAD_REQUEST", "Missing 'state' field");
    return;
  }

  String stateUpper = String(stateStr);
  stateUpper.toUpperCase();

  if (stateUpper != "ON" && stateUpper != "OFF") {
    sendJsonError(400, "INVALID_VALUE", "State must be 'ON' or 'OFF'");
    return;
  }

  bool turnOn = (stateUpper == "ON");
  _relay.setManualLight(turnOn);

  DynamicJsonDocument res(256);
  res["ok"] = true;
  res["lightOn"] = _relay.isLightOn();

  String output;
  serializeJson(res, output);
  _server.send(200, "application/json", output);
}

void AppWebServer::handleNotFound() {
  if (handleFileRead(_server.uri())) {
    return;
  }
  sendJsonError(404, "NOT_FOUND", "Route not found");
}

bool AppWebServer::handleFileRead(String path) {
  if (path.endsWith("/")) {
    path += "index.html";
  }

  String contentType = getContentType(path);
  if (LittleFS.exists(path)) {
    File file = LittleFS.open(path, "r");
    _server.streamFile(file, contentType);
    file.close();
    return true;
  }

  return false;
}

String AppWebServer::getContentType(String filename) {
  if (filename.endsWith(".html")) return "text/html";
  if (filename.endsWith(".css")) return "text/css";
  if (filename.endsWith(".js")) return "application/javascript";
  if (filename.endsWith(".json")) return "application/json";
  if (filename.endsWith(".ico")) return "image/x-icon";
  if (filename.endsWith(".svg")) return "image/svg+xml";
  return "text/plain";
}

