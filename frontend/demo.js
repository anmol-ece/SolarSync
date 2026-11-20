// SolarSync Demo Mode Simulator
// Clearly labeled sample data, never mixed with hardware communication.

const DemoSimulator = (function() {
  let isDemoActive = false;
  let scenarioIndex = 0;

  const scenarios = [
    {
      name: "Daytime (Streetlight OFF)",
      data: {
        wifiConnected: true,
        gpsValid: true,
        dateValid: true,
        timeValid: true,
        latitude: 12.9716,
        longitude: 77.5946,
        satellites: 9,
        gpsUtc: "08:45:12",
        localTime: "14:15:12",
        date: "2026-11-20",
        sunrise: "06:15",
        sunset: "17:55",
        isDaytime: true,
        lightOn: false,
        mode: "AUTO",
        autoReason: "ASTRONOMICAL",
        gpsFixAgeMs: 850,
        uptimeSeconds: 4120,
        firmwareVersion: "0.2.0"
      }
    },
    {
      name: "Nighttime (Streetlight ON)",
      data: {
        wifiConnected: true,
        gpsValid: true,
        dateValid: true,
        timeValid: true,
        latitude: 12.9716,
        longitude: 77.5946,
        satellites: 11,
        gpsUtc: "14:30:00",
        localTime: "20:00:00",
        date: "2026-11-20",
        sunrise: "06:15",
        sunset: "17:55",
        isDaytime: false,
        lightOn: true,
        mode: "AUTO",
        autoReason: "ASTRONOMICAL",
        gpsFixAgeMs: 420,
        uptimeSeconds: 6200,
        firmwareVersion: "0.2.0"
      }
    },
    {
      name: "GPS Fix Waiting (Cold Start)",
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
        firmwareVersion: "0.2.0"
      }
    },
    {
      name: "Manual Mode (Streetlight ON)",
      data: {
        wifiConnected: true,
        gpsValid: true,
        dateValid: true,
        timeValid: true,
        latitude: 12.9716,
        longitude: 77.5946,
        satellites: 8,
        gpsUtc: "09:00:00",
        localTime: "14:30:00",
        date: "2026-11-20",
        sunrise: "06:15",
        sunset: "17:55",
        isDaytime: true,
        lightOn: true,
        mode: "MANUAL",
        autoReason: null,
        gpsFixAgeMs: 910,
        uptimeSeconds: 7800,
        firmwareVersion: "0.2.0"
      }
    }
  ];

  function init() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("demo") === "1" || CONFIG.demoModeDefault) {
      enable();
    }
  }

  function enable() {
    isDemoActive = true;
    document.getElementById("demo-banner").classList.remove("hidden");
    document.getElementById("btn-toggle-demo").textContent = "Next Scenario";
  }

  function disable() {
    isDemoActive = false;
    document.getElementById("demo-banner").classList.add("hidden");
    document.getElementById("btn-toggle-demo").textContent = "Demo Mode";
  }

  function toggle() {
    if (!isDemoActive) {
      enable();
    } else {
      scenarioIndex = (scenarioIndex + 1) % scenarios.length;
    }
  }

  function getCurrentStatus() {
    const scenario = scenarios[scenarioIndex];
    return JSON.parse(JSON.stringify(scenario.data));
  }

  function setMode(mode) {
    scenarios[scenarioIndex].data.mode = mode;
    if (mode === "AUTO") {
      scenarios[scenarioIndex].data.autoReason = "ASTRONOMICAL";
      scenarios[scenarioIndex].data.lightOn = !scenarios[scenarioIndex].data.isDaytime;
    } else {
      scenarios[scenarioIndex].data.autoReason = null;
    }
    return { ok: true, mode: mode, lightOn: scenarios[scenarioIndex].data.lightOn };
  }

  function setLight(state) {
    if (scenarios[scenarioIndex].data.mode !== "MANUAL") {
      return { ok: false, error: "NOT_IN_MANUAL_MODE", message: "Streetlight can only be switched in MANUAL mode." };
    }
    const lightOn = (state === "ON");
    scenarios[scenarioIndex].data.lightOn = lightOn;
    return { ok: true, lightOn: lightOn };
  }

  return {
    init,
    enable,
    disable,
    toggle,
    isActive: () => isDemoActive,
    getCurrentStatus,
    setMode,
    setLight
  };
})();

