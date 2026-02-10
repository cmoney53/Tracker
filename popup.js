/**
 * Drendot.io Ship Tracker - Popup Script
 * Handles popup UI interactions and coordinates display
 */

// DOM Elements
const elements = {
  // Status
  connectionStatus: document.getElementById("connection-status"),
  
  // Coordinates
  coordX: document.getElementById("coord-x"),
  coordY: document.getElementById("coord-y"),
  coordAngle: document.getElementById("coord-angle"),
  lastUpdateTime: document.getElementById("last-update-time"),
  
  // Buttons
  refreshBtn: document.getElementById("refresh-btn"),
  updateMotdBtn: document.getElementById("update-motd-btn"),
  clearHistoryBtn: document.getElementById("clear-history-btn"),
  exportBtn: document.getElementById("export-btn"),
  
  // Settings
  autoUpdateCheckbox: document.getElementById("auto-update"),
  showOverlayCheckbox: document.getElementById("show-overlay"),
  historyEnabledCheckbox: document.getElementById("history-enabled"),
  precisionSelect: document.getElementById("precision"),
  
  // History
  historyList: document.getElementById("history-list")
};

// Current state
let currentCoordinates = { x: null, y: null, angle: null };
let currentSettings = null;

// Initialize popup
async function init() {
  setupEventListeners();
  await loadDashboard();
  connectToBackground();
  
  // Set up periodic refresh
  setInterval(loadDashboard, 1000);
}

// Set up event listeners
function setupEventListeners() {
  elements.refreshBtn.addEventListener("click", () => {
    loadDashboard();
    forceRefreshCoordinates();
  });
  
  elements.updateMotdBtn.addEventListener("click", () => {
    updateMOTD();
  });
  
  elements.clearHistoryBtn.addEventListener("click", () => {
    clearHistory();
  });
  
  elements.exportBtn.addEventListener("click", () => {
    exportHistory();
  });
  
  // Settings changes
  elements.autoUpdateCheckbox.addEventListener("change", (e) => {
    updateSetting("autoUpdateMOTD", e.target.checked);
  });
  
  elements.showOverlayCheckbox.addEventListener("change", (e) => {
    updateSetting("showOverlay", e.target.checked);
    sendMessageToContent({ type: "TOGGLE_OVERLAY", show: e.target.checked });
  });
  
  elements.historyEnabledCheckbox.addEventListener("change", (e) => {
    updateSetting("historyEnabled", e.target.checked);
  });
  
  elements.precisionSelect.addEventListener("change", (e) => {
    updateSetting("coordinatePrecision", parseInt(e.target.value));
  });
}

// Connect to background script
function connectToBackground() {
  const port = chrome.runtime.connect({ name: "popup-background" });
  
  port.onMessage.addListener((message) => {
    handleBackgroundMessage(message);
  });
  
  port.onDisconnect.addListener(() => {
    // Try to reconnect
    setTimeout(connectToBackground, 1000);
  });
}

// Handle messages from background
function handleBackgroundMessage(message) {
  if (message.type === "COORDINATES_UPDATE") {
    updateCoordinatesDisplay(message.data);
  } else if (message.type === "DASHBOARD_DATA") {
    updateDashboard(message.data);
  } else if (message.type === "EXPORT_DATA") {
    downloadExport(message.data, message.filename);
  }
}

// Load dashboard data
async function loadDashboard() {
  try {
    const response = await sendMessage({ type: "GET_DASHBOARD" });
    if (response && response.type === "DASHBOARD_DATA") {
      updateDashboard(response.data);
    }
  } catch (error) {
    console.error("Failed to load dashboard:", error);
  }
}

// Update dashboard with data
function updateDashboard(data) {
  if (data.coordinates) {
    updateCoordinatesDisplay(data.coordinates);
  }
  
  if (data.settings) {
    currentSettings = data.settings;
    updateSettingsDisplay(data.settings);
  }
  
  if (data.history) {
    updateHistoryDisplay(data.history);
  }
}

// Update coordinates display
function updateCoordinatesDisplay(coords) {
  currentCoordinates = coords;
  
  // Update coordinate values
  elements.coordX.textContent = coords.x !== null ? formatCoordinate(coords.x) : "--";
  elements.coordY.textContent = coords.y !== null ? formatCoordinate(coords.y) : "--";
  elements.coordAngle.textContent = coords.angle !== null ? formatCoordinate(coords.angle) + "°" : "--";
  
  // Update timestamp
  if (coords.timestamp) {
    const date = new Date(coords.timestamp);
    elements.lastUpdateTime.textContent = date.toLocaleTimeString();
  }
  
  // Update connection status
  if (coords.x !== null) {
    elements.connectionStatus.classList.add("connected");
    elements.connectionStatus.classList.remove("disconnected");
    elements.connectionStatus.title = "Connected - Tracking Active";
  } else {
    elements.connectionStatus.classList.remove("connected");
    elements.connectionStatus.classList.add("disconnected");
    elements.connectionStatus.title = "Disconnected - Waiting for coordinates";
  }
}

// Format coordinate for display
function formatCoordinate(value, precision = null) {
  const prec = precision !== null ? precision : (currentSettings?.coordinatePrecision || 2);
  return value.toFixed(prec);
}

// Update settings display
function updateSettingsDisplay(settings) {
  elements.autoUpdateCheckbox.checked = settings.autoUpdateMOTD;
  elements.showOverlayCheckbox.checked = settings.showOverlay;
  elements.historyEnabledCheckbox.checked = settings.historyEnabled;
  elements.precisionSelect.value = settings.coordinatePrecision;
}

// Update history list display
function updateHistoryDisplay(history) {
  if (!history || history.length === 0) {
    elements.historyList.innerHTML = '<div class="history-empty">No history yet</div>';
    return;
  }
  
  // Show last 10 entries
  const recentHistory = history.slice(-10).reverse();
  
  const html = recentHistory.map((coord, index) => `
    <div class="history-item" data-index="${history.length - 10 + index}">
      <span class="history-time">${formatTime(coord.timestamp)}</span>
      <span class="history-coords">X:${formatCoordinate(coord.x)} Y:${formatCoordinate(coord.y)}</span>
      ${coord.angle !== null ? `<span class="history-angle">∠${formatCoordinate(coord.angle)}°</span>` : ''}
    </div>
  `).join("");
  
  elements.historyList.innerHTML = html;
}

// Format timestamp for display
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

// Send message to background script
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// Send message to content script
function sendMessageToContent(message) {
  chrome.tabs.query({ active: true, url: "*://*.drendot.io/*" }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {
        // Content script might not be loaded
      });
    }
  });
}

// Force refresh coordinates from page
async function forceRefreshCoordinates() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, url: "*://*.drendot.io/*" });
    if (tab) {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_COORDINATES" });
      if (response) {
        updateCoordinatesDisplay(response);
      }
    }
  } catch (error) {
    console.error("Failed to force refresh:", error);
  }
}

// Update MOTD on the page
async function updateMOTD() {
  if (currentCoordinates.x === null) {
    alert("No coordinates available to update MOTD");
    return;
  }
  
  sendMessageToContent({ type: "UPDATE_MOTD", coordinates: currentCoordinates });
  
  // Visual feedback
  elements.updateMotdBtn.textContent = "✓ Updated!";
  setTimeout(() => {
    elements.updateMotdBtn.textContent = "📝 Update MOTD";
  }, 1500);
}

// Clear coordinate history
async function clearHistory() {
  if (confirm("Are you sure you want to clear all coordinate history?")) {
    await sendMessage({ type: "CLEAR_HISTORY" });
    updateHistoryDisplay([]);
  }
}

// Export history as CSV
async function exportHistory() {
  try {
    const response = await sendMessage({ type: "EXPORT_HISTORY" });
    if (response && response.type === "EXPORT_DATA") {
      downloadExport(response.data, response.filename);
    }
  } catch (error) {
    console.error("Failed to export history:", error);
  }
}

// Download exported data
function downloadExport(data, filename) {
  const blob = new Blob([data], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Update a single setting
async function updateSetting(key, value) {
  const settings = { [key]: value };
  await sendMessage({ type: "UPDATE_SETTINGS", settings });
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", init);

// Export functions for testing
window.popupAPI = {
  refresh: loadDashboard,
  updateMOTD,
  clearHistory,
  exportHistory,
  getCoordinates: () => currentCoordinates,
  getSettings: () => currentSettings
};

