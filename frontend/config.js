/**
 * config.js - Configuration for Frontend Dashboard (Person A)
 */
const CONFIG = {
  // API base path: default "" (relative, same origin when hosted on ESP32 or mock server)
  // For local development against a live ESP32 at a known IP, e.g. "http://192.168.1.100"
  apiBase: "",

  // Polling interval in milliseconds
  pollIntervalMs: 1500,

  // HTTP fetch timeout in milliseconds
  requestTimeoutMs: 3000,

  // Consecutive failed polls before showing "ESP32 unreachable"
  maxConsecutiveFailures: 3,

  // Demo mode default state (off by default)
  demoModeDefault: false
};

// Freeze to prevent accidental runtime mutation
Object.freeze(CONFIG);

