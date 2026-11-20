// SolarSync Frontend Configuration
const CONFIG = {
  apiBase: "",             // Empty string = same origin (ESP32 serving). Override with "http://192.168.x.x" for local dev
  pollInterval: 1500,      // Polling frequency in ms
  requestTimeout: 3000,    // Timeout per fetch request in ms
  failureThreshold: 3,     // Consecutive failed polls before marking ESP32 offline
  demoModeDefault: false   // True to start in simulation demo mode
};

