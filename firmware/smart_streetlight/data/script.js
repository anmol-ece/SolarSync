// SolarSync Client Logic
// Communicates with ESP32 WebServer via REST API according to API_CONTRACT.md v1.1

(function() {
  let consecutiveFailures = 0;
  let isRequestInFlight = false;
  let pollTimer = null;
  let currentStatus = null;

  // DOM Elements
  const elConnPill = document.getElementById("connection-pill");
  const elConnDot = document.getElementById("connection-dot");
  const elConnText = document.getElementById("connection-text");
  const elHeaderTime = document.getElementById("header-time");
  const elOfflineBanner = document.getElementById("offline-banner");

  // Overview Cards
  const elCardGpsBadge = document.getElementById("card-gps-badge");
  const elCardGpsSub = document.getElementById("card-gps-sub");
  const elCardLightState = document.getElementById("card-light-state");
  const elCardLightSub = document.getElementById("card-light-sub");
  const elLightIconWrap = document.getElementById("light-icon-wrap");
  const elCardModeBadge = document.getElementById("card-mode-badge");
  const elCardModeReason = document.getElementById("card-mode-reason");

  // GPS Metrics
  const elGpsLat = document.getElementById("gps-lat");
  const elGpsLon = document.getElementById("gps-lon");
  const elGpsSats = document.getElementById("gps-sats");
  const elGpsAge = document.getElementById("gps-age");
  const elGpsDate = document.getElementById("gps-date");
  const elGpsUtc = document.getElementById("gps-utc");
  const elGpsLocal = document.getElementById("gps-local");

  // Solar Metrics
  const elValSunrise = document.getElementById("val-sunrise");
  const elValSunset = document.getElementById("val-sunset");
  const elSolarStateText = document.getElementById("solar-state-text");
  const elSolarStateIcon = document.getElementById("solar-state-icon");

  // Controls
  const btnModeAuto = document.getElementById("btn-mode-auto");
  const btnModeManual = document.getElementById("btn-mode-manual");
  const btnLightOn = document.getElementById("btn-light-on");
  const btnLightOff = document.getElementById("btn-light-off");
  const elControlFeedback = document.getElementById("control-feedback");
  const elManualDesc = document.getElementById("manual-desc");

  // Footer
  const elFootFwVer = document.getElementById("foot-fw-ver");
  const elFootUptime = document.getElementById("foot-uptime");

  // Demo buttons
  const btnToggleDemo = document.getElementById("btn-toggle-demo");
  const btnExitDemo = document.getElementById("btn-exit-demo");

  // Initialize
  document.addEventListener("DOMContentLoaded", () => {
    DemoSimulator.init();
    bindEvents();
    startPolling();
  });

  function bindEvents() {
    btnToggleDemo.addEventListener("click", () => {
      DemoSimulator.toggle();
      triggerImmediatePoll();
    });

    btnExitDemo.addEventListener("click", () => {
      DemoSimulator.disable();
      triggerImmediatePoll();
    });

    btnModeAuto.addEventListener("click", () => handleModeChange("AUTO"));
    btnModeManual.addEventListener("click", () => handleModeChange("MANUAL"));

    btnLightOn.addEventListener("click", () => handleLightChange("ON"));
    btnLightOff.addEventListener("click", () => handleLightChange("OFF"));
  }

  function startPolling() {
    pollStatus();
    pollTimer = setInterval(pollStatus, CONFIG.pollInterval);
  }

  function triggerImmediatePoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollStatus();
    pollTimer = setInterval(pollStatus, CONFIG.pollInterval);
  }

  async function pollStatus() {
    if (isRequestInFlight) return;

    if (DemoSimulator.isActive()) {
      const demoData = DemoSimulator.getCurrentStatus();
      handleStatusSuccess(demoData);
      return;
    }

    isRequestInFlight = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.requestTimeout);

    try {
      const response = await fetch(`${CONFIG.apiBase}/api/status`, {
        signal: controller.signal,
        headers: { "Accept": "application/json" }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      consecutiveFailures = 0;
      handleStatusSuccess(data);
    } catch (err) {
      clearTimeout(timeoutId);
      consecutiveFailures++;
      handleStatusFailure(err);
    } finally {
      isRequestInFlight = false;
    }
  }

  function handleStatusSuccess(data) {
    currentStatus = data;

    // Connection Pill
    elConnDot.className = "status-dot dot-online";
    elConnText.textContent = data.wifiConnected ? "Connected" : "Wi-Fi Disconnected";
    elOfflineBanner.classList.add("hidden");

    // Header Clock (Local IST from ESP32 when available)
    if (data.timeValid && data.localTime) {
      elHeaderTime.textContent = data.localTime;
    } else {
      elHeaderTime.textContent = "--:--:--";
    }

    // 1. GPS Overview & Telemetry
    if (data.gpsValid && data.latitude != null && data.longitude != null) {
      elCardGpsBadge.textContent = "Fix Acquired";
      elCardGpsBadge.style.color = "var(--accent-green)";
      elCardGpsSub.textContent = `Sats: ${data.satellites ?? 0} | ${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`;

      elGpsLat.textContent = data.latitude.toFixed(6) + "°";
      elGpsLon.textContent = data.longitude.toFixed(6) + "°";
    } else {
      elCardGpsBadge.textContent = "Waiting for Fix";
      elCardGpsBadge.style.color = "var(--accent-amber)";
      elCardGpsSub.textContent = `Sats: ${data.satellites ?? 0} | Seeking satellites...`;

      elGpsLat.textContent = "--";
      elGpsLon.textContent = "--";
    }

    elGpsSats.textContent = data.satellites != null ? String(data.satellites) : "--";
    elGpsAge.textContent = data.gpsFixAgeMs != null ? `${data.gpsFixAgeMs} ms` : "--";
    elGpsDate.textContent = data.dateValid && data.date ? data.date : "--";
    elGpsUtc.textContent = data.timeValid && data.gpsUtc ? data.gpsUtc : "--";
    elGpsLocal.textContent = data.timeValid && data.localTime ? data.localTime : "--";

    // 2. Streetlight Status
    if (data.lightOn) {
      elCardLightState.textContent = "ON";
      elCardLightState.className = "overview-primary light-state on";
      elCardLightSub.textContent = "Relay GPIO 23: HIGH (Active)";
      elLightIconWrap.classList.add("active");
    } else {
      elCardLightState.textContent = "OFF";
      elCardLightState.className = "overview-primary light-state off";
      elCardLightSub.textContent = "Relay GPIO 23: LOW (Inactive)";
      elLightIconWrap.classList.remove("active");
    }

    // 3. Operating Mode
    const isAuto = (data.mode === "AUTO");
    elCardModeBadge.textContent = data.mode;
    elCardModeBadge.style.color = isAuto ? "var(--accent-cyan)" : "var(--accent-amber)";

    if (isAuto) {
      elCardModeReason.textContent = data.autoReason ? `Trigger: ${data.autoReason}` : "Astronomical Automation";
      btnModeAuto.classList.add("active");
      btnModeManual.classList.remove("active");

      btnLightOn.disabled = true;
      btnLightOff.disabled = true;
      elManualDesc.textContent = "Disabled in AUTO mode (switch to MANUAL to control)";
    } else {
      elCardModeReason.textContent = "Manual User Override";
      btnModeAuto.classList.remove("active");
      btnModeManual.classList.add("active");

      btnLightOn.disabled = false;
      btnLightOff.disabled = false;
      elManualDesc.textContent = "Direct relay switching active";
    }

    // 4. Solar Schedule
    elValSunrise.textContent = data.sunrise ?? "--:--";
    elValSunset.textContent = data.sunset ?? "--:--";

    if (data.isDaytime === true) {
      elSolarStateIcon.textContent = "☀️";
      elSolarStateText.textContent = "Daylight Period — Automation Target: Streetlight OFF";
    } else if (data.isDaytime === false) {
      elSolarStateIcon.textContent = "🌙";
      elSolarStateText.textContent = "Night Period — Automation Target: Streetlight ON";
    } else {
      elSolarStateIcon.textContent = "⏳";
      elSolarStateText.textContent = "Waiting for GPS Fix & Sunrise-Sunset API Sync";
    }

    // 5. Footer info
    elFootFwVer.textContent = data.firmwareVersion ?? "0.2.0";
    elFootUptime.textContent = formatUptime(data.uptimeSeconds ?? 0);
  }

  function handleStatusFailure(err) {
    if (consecutiveFailures >= CONFIG.failureThreshold) {
      elConnDot.className = "status-dot dot-offline";
      elConnText.textContent = "ESP32 Offline";
      elOfflineBanner.classList.remove("hidden");
    } else {
      elConnDot.className = "status-dot dot-amber";
      elConnText.textContent = "Reconnecting...";
    }
  }

  // Handle Mode Change (AUTO / MANUAL)
  async function handleModeChange(targetMode) {
    lockControls(true);
    showFeedback("Applying mode change...", "neutral");

    if (DemoSimulator.isActive()) {
      const res = DemoSimulator.setMode(targetMode);
      lockControls(false);
      showFeedback(`Mode changed to ${targetMode}`, "success");
      triggerImmediatePoll();
      return;
    }

    try {
      const res = await fetch(`${CONFIG.apiBase}/api/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: targetMode })
      });

      const body = await res.json();
      if (res.ok && body.ok) {
        showFeedback(`Mode set to ${targetMode}. Awaiting confirmation...`, "success");
        setTimeout(triggerImmediatePoll, 300);
      } else {
        showFeedback(body.message || `Error setting mode (${body.error})`, "error");
      }
    } catch (e) {
      showFeedback("Network error sending mode change.", "error");
    } finally {
      lockControls(false);
    }
  }

  // Handle Light Change (ON / OFF)
  async function handleLightChange(targetState) {
    lockControls(true);
    showFeedback(`Turning streetlight ${targetState}...`, "neutral");

    if (DemoSimulator.isActive()) {
      const res = DemoSimulator.setLight(targetState);
      lockControls(false);
      if (res.ok) {
        showFeedback(`Streetlight turned ${targetState}`, "success");
        triggerImmediatePoll();
      } else {
        showFeedback(res.message, "error");
      }
      return;
    }

    try {
      const res = await fetch(`${CONFIG.apiBase}/api/light`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: targetState })
      });

      const body = await res.json();
      if (res.ok && body.ok) {
        showFeedback(`Streetlight switched ${targetState}. Verifying GPIO state...`, "success");
        setTimeout(triggerImmediatePoll, 300);
      } else {
        showFeedback(body.message || `Command rejected: ${body.error}`, "error");
      }
    } catch (e) {
      showFeedback("Network error switching streetlight.", "error");
    } finally {
      lockControls(false);
    }
  }

  function lockControls(locked) {
    btnModeAuto.disabled = locked;
    btnModeManual.disabled = locked;
    if (locked) {
      btnLightOn.disabled = true;
      btnLightOff.disabled = true;
    } else if (currentStatus && currentStatus.mode === "MANUAL") {
      btnLightOn.disabled = false;
      btnLightOff.disabled = false;
    }
  }

  function showFeedback(msg, type) {
    elControlFeedback.textContent = msg;
    elControlFeedback.className = `feedback-msg ${type}`;
    elControlFeedback.classList.remove("hidden");

    setTimeout(() => {
      elControlFeedback.classList.add("hidden");
    }, 4500);
  }

  function formatUptime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  }
})();
