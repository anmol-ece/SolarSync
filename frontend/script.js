/**
 * script.js - Core Dashboard Application (Person A)
 * Contract: API v1.1 | Polling: 1.5s | Failure threshold: 3
 */
(function() {
  'use strict';

  // State container
  const state = {
    connected: false,
    consecutiveFailures: 0,
    isCommandInFlight: false,
    lastStatus: null,
    pollTimer: null,
    countdownTimer: null
  };

  // DOM Elements Cache
  const el = {
    // Header & Alert
    demoBanner: document.getElementById('demo-banner'),
    btnExitDemo: document.getElementById('btn-exit-demo'),
    btnToggleDemo: document.getElementById('btn-toggle-demo'),
    espStatusDot: document.getElementById('esp-status-dot'),
    espStatusText: document.getElementById('esp-status-text'),
    topbarClock: document.getElementById('topbar-clock'),
    topbarDate: document.getElementById('topbar-date'),
    unreachableAlert: document.getElementById('unreachable-alert'),
    unreachableMessage: document.getElementById('unreachable-message'),
    wifiWarnAlert: document.getElementById('wifi-warn-alert'),

    // Overview Cards
    overviewGpsFix: document.getElementById('overview-gps-fix'),
    overviewSatellites: document.getElementById('overview-satellites'),
    overviewGpsSignalBadge: document.getElementById('overview-gps-signal-badge'),
    overviewLightState: document.getElementById('overview-light-state'),
    overviewRelayState: document.getElementById('overview-relay-state'),
    overviewDaynightBadge: document.getElementById('overview-daynight-badge'),
    lightBulbIcon: document.getElementById('light-bulb-icon'),
    overviewModeState: document.getElementById('overview-mode-state'),
    overviewAutoReason: document.getElementById('overview-auto-reason'),

    // GPS Telemetry
    gpsLockTag: document.getElementById('gps-lock-tag'),
    gpsLat: document.getElementById('gps-lat'),
    gpsLon: document.getElementById('gps-lon'),
    gpsSats: document.getElementById('gps-sats'),
    gpsFixAge: document.getElementById('gps-fix-age'),
    gpsDate: document.getElementById('gps-date'),
    gpsUtcTime: document.getElementById('gps-utc-time'),
    gpsLocalTime: document.getElementById('gps-local-time'),
    sysUptime: document.getElementById('sys-uptime'),
    gpsNoticeBox: document.getElementById('gps-notice'),
    gpsNoticeText: document.getElementById('gps-notice-text'),

    // Solar Timings & Timeline
    solarSunriseTime: document.getElementById('solar-sunrise-time'),
    solarSunsetTime: document.getElementById('solar-sunset-time'),
    solarApiTag: document.getElementById('solar-api-tag'),
    timelineSunriseLbl: document.getElementById('timeline-sunrise-lbl'),
    timelineSunsetLbl: document.getElementById('timeline-sunset-lbl'),
    timelineCountdown: document.getElementById('timeline-countdown'),
    timelineProgressBar: document.getElementById('timeline-progress-bar'),
    timelineCurrentMarker: document.getElementById('timeline-current-marker'),
    astronomicalStateText: document.getElementById('astronomical-state-text'),

    // Controls
    controlSpinner: document.getElementById('control-spinner'),
    btnModeAuto: document.getElementById('btn-mode-auto'),
    btnModeManual: document.getElementById('btn-mode-manual'),
    modeHintText: document.getElementById('mode-hint-text'),
    btnLightOn: document.getElementById('btn-light-on'),
    btnLightOff: document.getElementById('btn-light-off'),
    commandFeedback: document.getElementById('command-feedback'),

    // Footer
    footerFwVersion: document.getElementById('footer-fw-version'),
    footerPollTime: document.getElementById('footer-poll-time')
  };

  /**
   * Initialize Dashboard
   */
  function init() {
    setupEventListeners();

    // Check if demo mode requested
    DemoManager.init((demoData) => {
      renderStatus(demoData, true);
    });

    // If demo is not running, start regular polling
    if (!DemoManager.isActive()) {
      startPolling();
    }

    // Secondary timer for smooth UI countdown clock updates
    state.countdownTimer = setInterval(updateCountdown, 1000);
  }

  /**
   * Event listeners for interactive controls
   */
  function setupEventListeners() {
    // Mode toggle buttons
    el.btnModeAuto.addEventListener('click', () => handleModeChange('AUTO'));
    el.btnModeManual.addEventListener('click', () => handleModeChange('MANUAL'));

    // Manual light buttons
    el.btnLightOn.addEventListener('click', () => handleLightChange('ON'));
    el.btnLightOff.addEventListener('click', () => handleLightChange('OFF'));

    // Demo toggles
    el.btnToggleDemo.addEventListener('click', () => {
      if (DemoManager.isActive()) {
        DemoManager.stopDemo();
        startPolling();
      } else {
        stopPolling();
        DemoManager.startDemo((demoData) => {
          renderStatus(demoData, true);
        });
      }
    });

    if (el.btnExitDemo) {
      el.btnExitDemo.addEventListener('click', () => {
        DemoManager.stopDemo();
        startPolling();
      });
    }
  }

  /**
   * Polling Loop with AbortController timeout
   * Guard: skip if a fetch is already in-flight (no overlapping requests)
   */
  let _fetchInFlight = false;

  function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    fetchStatus();
    state.pollTimer = setInterval(fetchStatus, CONFIG.pollIntervalMs);
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  /**
   * Asynchronous fetch status — no overlapping requests
   */
  async function fetchStatus() {
    if (DemoManager.isActive()) return;
    if (_fetchInFlight) return; // prevent overlapping polls
    _fetchInFlight = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
    const endpoint = `${CONFIG.apiBase}/api/status`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Guard against non-JSON responses
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Non-JSON response from server');
      }

      const data = await response.json();
      onPollSuccess(data);
    } catch (err) {
      clearTimeout(timeoutId);
      onPollFailure(err);
    } finally {
      _fetchInFlight = false;
    }
  }

  /**
   * Successful poll handler
   */
  function onPollSuccess(data) {
    state.consecutiveFailures = 0;
    state.connected = true;
    state.lastStatus = data;

    // Remove unreachable alert
    el.unreachableAlert.classList.add('hidden');
    document.querySelectorAll('.detail-card, .overview-card').forEach(card => {
      card.classList.remove('data-stale');
    });

    // Handle wifiConnected:false (ESP32 says its own Wi-Fi dropped)
    if (el.wifiWarnAlert) {
      if (data.wifiConnected === false) {
        el.wifiWarnAlert.classList.remove('hidden');
      } else {
        el.wifiWarnAlert.classList.add('hidden');
      }
    }

    // Connection badge: show amber if wifi down, green if fully ok
    if (data.wifiConnected === false) {
      el.espStatusDot.className = 'status-dot connecting';
      el.espStatusText.textContent = 'WIFI DOWN';
    } else {
      el.espStatusDot.className = 'status-dot online';
      el.espStatusText.textContent = 'ONLINE';
    }

    renderStatus(data, false);
  }

  /**
   * Failed poll handler (handles 3-strike failure)
   */
  function onPollFailure(error) {
    state.consecutiveFailures++;

    if (state.consecutiveFailures >= CONFIG.maxConsecutiveFailures) {
      state.connected = false;
      el.espStatusDot.className = 'status-dot offline';
      el.espStatusText.textContent = 'UNREACHABLE';

      el.unreachableMessage.textContent = `ESP32 unreachable (${error.message || 'Connection timed out'}). Retrying...`;
      el.unreachableAlert.classList.remove('hidden');

      // Visual indicator for stale data
      document.querySelectorAll('.detail-card, .overview-card').forEach(card => {
        card.classList.add('data-stale');
      });
    } else {
      el.espStatusDot.className = 'status-dot connecting';
      el.espStatusText.textContent = 'RETRYING...';
    }

    el.footerPollTime.textContent = `Last poll failed: ${new Date().toLocaleTimeString()} (Error)`;
  }

  /**
   * Render state updates to DOM
   */
  function renderStatus(data, isDemo) {
    const isGpsValid = Boolean(data.gpsValid);
    const isDateValid = Boolean(data.dateValid);
    const isTimeValid = Boolean(data.timeValid);

    // 1. Top bar time & status
    if (isTimeValid && data.localTime) {
      el.topbarClock.textContent = data.localTime;
    } else {
      el.topbarClock.textContent = '--:--:--';
    }

    if (isDateValid && data.date) {
      el.topbarDate.textContent = data.date;
    } else {
      el.topbarDate.textContent = '----/--/--';
    }

    // 2. Overview: GPS Fix Card
    if (isGpsValid) {
      el.overviewGpsFix.textContent = 'FIX ACQUIRED';
      el.overviewGpsFix.style.color = 'var(--status-green)';
      el.overviewGpsSignalBadge.className = 'badge badge-success';
      el.overviewGpsSignalBadge.textContent = 'LOCKED';
      el.gpsLockTag.textContent = 'GPS LOCKED (3D)';
      el.gpsLockTag.className = 'telemetry-badge badge-success';
      el.gpsNoticeBox.style.display = 'none';
    } else {
      el.overviewGpsFix.textContent = 'Waiting for fix...';
      el.overviewGpsFix.style.color = 'var(--status-amber)';
      el.overviewGpsSignalBadge.className = 'badge badge-dim';
      el.overviewGpsSignalBadge.textContent = 'NO FIX';
      el.gpsLockTag.textContent = 'WAITING FOR GPS FIX';
      el.gpsLockTag.className = 'telemetry-badge badge-warning';
      el.gpsNoticeBox.style.display = 'flex';
      el.gpsNoticeText.textContent = 'Waiting for satellite locks. Cold start may take several minutes.';
    }
    el.overviewSatellites.textContent = (data.satellites !== null && data.satellites !== undefined) ? data.satellites : '--';

    // 3. Overview: Streetlight Output Card
    const isLightOn = Boolean(data.lightOn);
    el.overviewLightState.textContent = isLightOn ? 'ACTIVE (ON)' : 'INACTIVE (OFF)';
    el.overviewLightState.className = isLightOn ? 'overview-primary light-state-on' : 'overview-primary light-state-off';
    el.overviewRelayState.textContent = isLightOn ? 'HIGH (3.3V)' : 'LOW (0V)';

    if (isLightOn) {
      el.lightBulbIcon.classList.add('light-on');
    } else {
      el.lightBulbIcon.classList.remove('light-on');
    }

    if (data.isDaytime === true) {
      el.overviewDaynightBadge.className = 'badge badge-warning';
      el.overviewDaynightBadge.textContent = 'DAYTIME';
    } else if (data.isDaytime === false) {
      el.overviewDaynightBadge.className = 'badge badge-dim';
      el.overviewDaynightBadge.textContent = 'NIGHT';
    } else {
      el.overviewDaynightBadge.className = 'badge badge-dim';
      el.overviewDaynightBadge.textContent = '--';
    }

    // 4. Overview: Operating Mode Card
    const currentMode = data.mode || 'AUTO';
    el.overviewModeState.textContent = currentMode;
    el.overviewModeState.style.color = currentMode === 'AUTO' ? 'var(--accent-cyan)' : 'var(--status-amber)';
    el.overviewAutoReason.textContent = data.autoReason || (currentMode === 'MANUAL' ? 'Manual Override' : 'API Sync');

    // 5. GPS Details Table
    el.gpsLat.textContent = (isGpsValid && data.latitude !== null) ? Number(data.latitude).toFixed(4) + '°' : '--';
    el.gpsLon.textContent = (isGpsValid && data.longitude !== null) ? Number(data.longitude).toFixed(4) + '°' : '--';
    el.gpsSats.textContent = data.satellites !== null ? data.satellites : '--';
    el.gpsFixAge.textContent = data.gpsFixAgeMs !== null && data.gpsFixAgeMs !== undefined ? `${data.gpsFixAgeMs} ms` : '--';
    el.gpsDate.textContent = (isDateValid && data.date) ? data.date : '--';
    el.gpsUtcTime.textContent = (isTimeValid && data.gpsUtc) ? data.gpsUtc : '--';
    el.gpsLocalTime.textContent = (isTimeValid && data.localTime) ? `${data.localTime} (IST)` : '--';
    el.sysUptime.textContent = data.uptimeSeconds ? formatUptime(data.uptimeSeconds) : '--';

    // 6. Solar Timings (Sunrise-Sunset API)
    const hasSunrise = Boolean(data.sunrise);
    const hasSunset = Boolean(data.sunset);

    el.solarSunriseTime.textContent = hasSunrise ? data.sunrise : '--:--';
    el.solarSunsetTime.textContent = hasSunset ? data.sunset : '--:--';
    el.timelineSunriseLbl.textContent = hasSunrise ? data.sunrise : '--:--';
    el.timelineSunsetLbl.textContent = hasSunset ? data.sunset : '--:--';

    if (hasSunrise && hasSunset) {
      el.solarApiTag.className = 'badge badge-success';
      el.solarApiTag.textContent = 'API SYNCED';
    } else {
      el.solarApiTag.className = 'badge badge-dim';
      el.solarApiTag.textContent = isGpsValid ? 'FETCHING API...' : 'WAITING FOR GPS';
    }

    // Update solar timeline progress & marker
    updateSolarTimeline(data);

    // 7. Control Panel State & Buttons
    updateControlPanel(data);

    // 8. Footer metadata
    if (data.firmwareVersion) {
      el.footerFwVersion.textContent = `v${data.firmwareVersion}`;
    }
    el.footerPollTime.textContent = `Last update: ${new Date().toLocaleTimeString()} ${isDemo ? '(Demo Stream)' : ''}`;
  }

  /**
   * Helper: Calculate countdown and progress along solar day/night cycle
   */
  function updateSolarTimeline(data) {
    if (!data || !data.localTime || !data.sunrise || !data.sunset) {
      el.timelineCountdown.textContent = 'Next Event: --';
      el.astronomicalStateText.textContent = 'Solar cycle pending valid coordinates and API fetch';
      el.timelineProgressBar.style.width = '50%';
      el.timelineCurrentMarker.style.left = '50%';
      return;
    }

    const currentMins = timeToMinutes(data.localTime);
    const sunriseMins = timeToMinutes(data.sunrise);
    const sunsetMins = timeToMinutes(data.sunset);

    if (isNaN(currentMins) || isNaN(sunriseMins) || isNaN(sunsetMins)) return;

    let countdownText = '';
    let progressPercent = 50;

    if (currentMins >= sunriseMins && currentMins < sunsetMins) {
      // Daytime
      const minsUntilSunset = sunsetMins - currentMins;
      countdownText = `Sunset in ${formatMinutesToHours(minsUntilSunset)}`;
      const dayLength = sunsetMins - sunriseMins;
      progressPercent = Math.min(100, Math.max(0, ((currentMins - sunriseMins) / dayLength) * 100));
      el.astronomicalStateText.textContent = 'Daytime: Streetlight is held OFF by automation schedule';
    } else {
      // Nighttime
      let minsUntilSunrise = 0;
      if (currentMins >= sunsetMins) {
        minsUntilSunrise = (24 * 60 - currentMins) + sunriseMins;
      } else {
        minsUntilSunrise = sunriseMins - currentMins;
      }
      countdownText = `Sunrise in ${formatMinutesToHours(minsUntilSunrise)}`;
      progressPercent = currentMins >= sunsetMins ? 100 : 0;
      el.astronomicalStateText.textContent = 'Nighttime: Streetlight is held ON by automation schedule';
    }

    el.timelineCountdown.textContent = countdownText;
    el.timelineProgressBar.style.width = `${progressPercent}%`;
    el.timelineCurrentMarker.style.left = `${progressPercent}%`;
  }

  function updateCountdown() {
    if (state.lastStatus) {
      updateSolarTimeline(state.lastStatus);
    }
  }

  /**
   * Update Control Panel Buttons according to current Mode and State
   */
  function updateControlPanel(data) {
    if (state.isCommandInFlight) return; // Keep controls locked while command is sending

    const isManual = data.mode === 'MANUAL';

    // Mode Radios
    if (isManual) {
      el.btnModeManual.classList.add('active');
      el.btnModeManual.setAttribute('aria-checked', 'true');
      el.btnModeAuto.classList.remove('active');
      el.btnModeAuto.setAttribute('aria-checked', 'false');

      el.modeHintText.textContent = 'Manual override active. Operator can switch relay ON/OFF directly.';
      el.btnLightOn.disabled = false;
      el.btnLightOff.disabled = false;
    } else {
      el.btnModeAuto.classList.add('active');
      el.btnModeAuto.setAttribute('aria-checked', 'true');
      el.btnModeManual.classList.remove('active');
      el.btnModeManual.setAttribute('aria-checked', 'false');

      el.modeHintText.textContent = 'Automatic mode active. Relay switches at sunrise/sunset from API. Manual buttons locked.';
      el.btnLightOn.disabled = true;
      el.btnLightOff.disabled = true;
    }
  }

  /**
   * POST /api/mode command
   */
  async function handleModeChange(newMode) {
    if (DemoManager.isActive()) {
      showFeedback('Controls are simulated in Demo Mode.', 'feedback-success');
      return;
    }

    if (state.isCommandInFlight) return;
    setCommandLoading(true);

    try {
      const response = await fetch(`${CONFIG.apiBase}/api/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode })
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || result.error || 'Failed to switch mode');
      }

      showFeedback(`Mode switched to ${newMode}. Awaiting telemetry confirmation...`, 'feedback-success');
      // Trigger instant status refresh to confirm
      await fetchStatus();
    } catch (err) {
      showFeedback(`Error: ${err.message}`, 'feedback-error');
    } finally {
      setCommandLoading(false);
    }
  }

  /**
   * POST /api/light command
   */
  async function handleLightChange(newState) {
    if (DemoManager.isActive()) {
      showFeedback('Light toggle simulated in Demo Mode.', 'feedback-success');
      return;
    }

    if (state.isCommandInFlight) return;
    setCommandLoading(true);

    try {
      const response = await fetch(`${CONFIG.apiBase}/api/light`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState })
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || result.error || 'Failed to set light state');
      }

      showFeedback(`Command sent (${newState}). Verifying relay state...`, 'feedback-success');
      await fetchStatus();
    } catch (err) {
      showFeedback(`Command rejected: ${err.message}`, 'feedback-error');
    } finally {
      setCommandLoading(false);
    }
  }

  /**
   * Lock UI and display spinner while request in-flight
   */
  function setCommandLoading(isLoading) {
    state.isCommandInFlight = isLoading;
    if (isLoading) {
      el.controlSpinner.classList.remove('hidden');
      el.btnModeAuto.disabled = true;
      el.btnModeManual.disabled = true;
      el.btnLightOn.disabled = true;
      el.btnLightOff.disabled = true;
    } else {
      el.controlSpinner.classList.add('hidden');
      el.btnModeAuto.disabled = false;
      el.btnModeManual.disabled = false;
      if (state.lastStatus) {
        updateControlPanel(state.lastStatus);
      }
    }
  }

  function showFeedback(text, className) {
    el.commandFeedback.textContent = text;
    el.commandFeedback.className = `feedback-msg ${className}`;
    el.commandFeedback.classList.remove('hidden');

    setTimeout(() => {
      el.commandFeedback.classList.add('hidden');
    }, 5000);
  }

  // Utilities
  function timeToMinutes(timeStr) {
    if (!timeStr) return NaN;
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function formatMinutesToHours(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }

  function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  // Start app on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', init);
})();

