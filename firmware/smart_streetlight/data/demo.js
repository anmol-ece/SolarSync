/**
 * demo.js - Simulation Demo Mode (Person A)
 * Isolated from real-mode code. Enabled via ?demo=1 or UI toggle.
 * Displays persistent DEMO banner + amber card tint.
 * Cycles 5 scenarios every 6 s.
 */

const DemoManager = (function() {
  let isDemoActive = false;
  let demoIntervalId = null;
  let scenarioIndex = 0;

  // Realistic simulation scenarios
  const SCENARIOS = [
    {
      name: "Waiting for GPS Fix",
      data: {
        wifiConnected: true,
        gpsValid: false,
        dateValid: false,
        timeValid: false,
        latitude: null,
        longitude: null,
        satellites: 2,
        gpsUtc: null,
        localTime: null,
        date: null,
        sunrise: null,
        sunset: null,
        isDaytime: null,
        lightOn: false,
        mode: "AUTO",
        autoReason: "WAITING_FOR_GPS",
        gpsFixAgeMs: null,
        uptimeSeconds: 45,
        firmwareVersion: "0.2.0-demo"
      }
    },
    {
      name: "Daytime - Auto Mode (API Synced)",
      data: {
        wifiConnected: true,
        gpsValid: true,
        dateValid: true,
        timeValid: true,
        latitude: 12.9716,
        longitude: 77.5946,
        satellites: 9,
        gpsUtc: "08:30:15",
        localTime: "14:00:15",
        date: "2026-11-20",
        sunrise: "06:14",
        sunset: "17:52",
        isDaytime: true,
        lightOn: false,
        mode: "AUTO",
        autoReason: "ASTRONOMICAL_API",
        gpsFixAgeMs: 420,
        uptimeSeconds: 1240,
        firmwareVersion: "0.2.0-demo"
      }
    },
    {
      name: "Sunset Transition - Streetlight Activates",
      data: {
        wifiConnected: true,
        gpsValid: true,
        dateValid: true,
        timeValid: true,
        latitude: 12.9716,
        longitude: 77.5946,
        satellites: 10,
        gpsUtc: "12:25:00",
        localTime: "17:55:00",
        date: "2026-11-20",
        sunrise: "06:14",
        sunset: "17:52",
        isDaytime: false,
        lightOn: true,
        mode: "AUTO",
        autoReason: "ASTRONOMICAL_API",
        gpsFixAgeMs: 210,
        uptimeSeconds: 3600,
        firmwareVersion: "0.2.0-demo"
      }
    },
    {
      name: "Night - Light Active",
      data: {
        wifiConnected: true,
        gpsValid: true,
        dateValid: true,
        timeValid: true,
        latitude: 12.9716,
        longitude: 77.5946,
        satellites: 8,
        gpsUtc: "16:00:00",
        localTime: "21:30:00",
        date: "2026-11-20",
        sunrise: "06:14",
        sunset: "17:52",
        isDaytime: false,
        lightOn: true,
        mode: "AUTO",
        autoReason: "ASTRONOMICAL_API",
        gpsFixAgeMs: 500,
        uptimeSeconds: 7200,
        firmwareVersion: "0.2.0-demo"
      }
    },
    {
      name: "Manual Mode Operator Control",
      data: {
        wifiConnected: true,
        gpsValid: true,
        dateValid: true,
        timeValid: true,
        latitude: 12.9716,
        longitude: 77.5946,
        satellites: 9,
        gpsUtc: "09:00:00",
        localTime: "14:30:00",
        date: "2026-11-20",
        sunrise: "06:14",
        sunset: "17:52",
        isDaytime: true,
        lightOn: true,
        mode: "MANUAL",
        autoReason: null,
        gpsFixAgeMs: 310,
        uptimeSeconds: 7600,
        firmwareVersion: "0.2.0-demo"
      }
    }
  ];

  function init(onDataCallback) {
    // Check URL parameters for ?demo=1 or demo=true
    const urlParams = new URLSearchParams(window.location.search);
    const hasDemoParam = urlParams.get('demo') === '1' || urlParams.get('demo') === 'true';

    if (hasDemoParam || CONFIG.demoModeDefault) {
      startDemo(onDataCallback);
    }
  }

  function startDemo(onDataCallback) {
    if (isDemoActive) return;
    isDemoActive = true;

    // Show Demo Warning Banner
    const banner = document.getElementById("demo-banner");
    if (banner) banner.classList.remove("hidden");

    // Add demo watermark class to body
    document.body.classList.add("demo-mode-active");

    const toggleBtnLabel = document.getElementById("demo-toggle-label");
    if (toggleBtnLabel) toggleBtnLabel.textContent = "Live Mode";

    // Immediately trigger first scenario
    deliverNextScenario(onDataCallback);

    // Cycle scenarios every 6 seconds in demo mode
    demoIntervalId = setInterval(() => {
      scenarioIndex = (scenarioIndex + 1) % SCENARIOS.length;
      deliverNextScenario(onDataCallback);
    }, 6000);
  }

  function stopDemo() {
    if (!isDemoActive) return;
    isDemoActive = false;

    if (demoIntervalId) {
      clearInterval(demoIntervalId);
      demoIntervalId = null;
    }

    const banner = document.getElementById("demo-banner");
    if (banner) banner.classList.add("hidden");
    document.body.classList.remove("demo-mode-active");

    const toggleBtnLabel = document.getElementById("demo-toggle-label");
    if (toggleBtnLabel) toggleBtnLabel.textContent = "Demo";
  }

  function deliverNextScenario(callback) {
    if (!isDemoActive) return;
    const scenario = SCENARIOS[scenarioIndex];
    // Clone to prevent any caller mutation
    const payload = JSON.parse(JSON.stringify(scenario.data));
    callback(payload);
  }

  function isActive() {
    return isDemoActive;
  }

  return {
    init,
    startDemo,
    stopDemo,
    isActive
  };
})();

