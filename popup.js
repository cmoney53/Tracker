/**
 * Drendot.io Ship Tracker - Popup Script
 * Handles popup UI interactions and grid coordinates display
 */

// DOM Elements
const elements = {
  connectionStatus: document.getElementById("connection-status"),
  visibleCount: document.getElementById("visible-count"),
  hiddenCount: document.getElementById("hidden-count"),
  totalCount: document.getElementById("total-count"),
  lastUpdateTime: document.getElementById("last-update-time"),
  visibleShips: document.getElementById("visible-ships"),
  hiddenShips: document.getElementById("hidden-ships"),
  refreshBtn: document.getElementById("refresh-btn"),
  updateMotdBtn: document.getElementById("update-motd-btn"),
  clearHistoryBtn: document.getElementById("clear-history-btn"),
  autoUpdateCheckbox: document.getElementById("auto-update"),
  showOverlayCheckbox: document.getElementById("show-overlay"),
  historyEnabledCheckbox: document.getElementById("history-enabled")
};

// Current state
let currentCoordinates = { visible: [], hidden: [], all: [] };
let currentSettings = null;

// Initialize popup
async function init() {
  setupEventListeners();
  await loadDashboard();
  connectToBackground();
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
}

// Connect to background script
function connectToBackground() {
  const port = chrome.runtime.connect({ name: "popup-background" });
  
  port.onMessage.addListener((message) => {
    handleBackgroundMessage(message);
  });
  
  port.onDisconnect.addListener(() => {
    setTimeout(connectToBackground, 1000);
  });
}

// Handle messages from background
function handleBackgroundMessage(message) {
  if (message.type === "COORDINATES_UPDATE") {
    updateCoordinatesDisplay(message.data);
  } else if (message.type === "DASHBOARD_DATA") {
    updateDashboard(message.data);
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
  
  // Update counts
  elements.visibleCount.textContent = coords.visible.length;
  elements.hiddenCount.textContent = coords.hidden.length;
  elements.totalCount.textContent = coords.all.length;
  
  // Update timestamp
  if (coords.timestamp) {
    const date = new Date(coords.timestamp);
    elements.lastUpdateTime.textContent = date.toLocaleTimeString();
  }
  
  // Update connection status
  if (coords.all.length > 0) {
    elements.connectionStatus.classList.add("connected");
    elements.connectionStatus.classList.remove("disconnected");
  } else {
    elements.connectionStatus.classList.remove("connected");
    elements.connectionStatus.classList.add("disconnected");
  }
  
  // Update mini grid
  updateMiniGrid(coords);
  
  // Update ship lists
  updateShipLists(coords);
}

// Update mini grid display
function updateMiniGrid(coords) {
  const visibleSet = new Set(coords.visible);
  const hiddenSet = new Set(coords.hidden);
  
  const cells = document.querySelectorAll(".mini-grid-row .mini-cell[data-cell]");
  cells.forEach(cell => {
    const cellId = cell.dataset.cell;
    cell.classList.remove("has-ship-visible", "has-ship-hidden");
    
    if (visibleSet.has(cellId)) {
      cell.classList.add("has-ship-visible");
      cell.textContent = cellId;
    } else if (hiddenSet.has(cellId)) {
      cell.classList.add("has-ship-hidden");
      cell.textContent = "?";
    } else {
      cell.textContent = "";
    }
  });
}

// Update ship lists
function updateShipLists(coords) {
  // Visible ships
  if (coords.visible.length === 0) {
    elements.visibleShips.innerHTML = '<div class="ship-list-empty">No visible ships detected</div>';
  } else {
    elements.visibleShips.innerHTML = coords.visible.sort().map(coord => 
      `<div class="ship-item visible">${coord}</div>`
    ).join("");
  }
  
  // Hidden ships
  if (coords.hidden.length === 0) {
    elements.hiddenShips.innerHTML = '<div class="ship-list-empty">No hidden ships detected</div>';
  } else {
    elements.hiddenShips.innerHTML = coords.hidden.sort().map(coord => 
      `<div class="ship-item hidden">${coord}</div>`
    ).join("");
  }
}

// Update settings display
function updateSettingsDisplay(settings) {
  elements.autoUpdateCheckbox.checked = settings.autoUpdateMOTD;
  elements.showOverlayCheckbox.checked = settings.showOverlay;
  elements.historyEnabledCheckbox.checked = settings.historyEnabled;
}

// Update history display
function updateHistoryDisplay(history) {
  // Could be enhanced to show history in grid format
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
      chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
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
  if (currentCoordinates.all.length === 0) {
    alert("No coordinates available to update MOTD");
    return;
  }
  
  sendMessageToContent({ type: "UPDATE_MOTD", coordinates: currentCoordinates });
  
  elements.updateMotdBtn.textContent = "Updated!";
  setTimeout(() => {
    elements.updateMotdBtn.textContent = "Update MOTD";
  }, 1500);
}

// Clear coordinate history
async function clearHistory() {
  if (confirm("Clear all coordinate history?")) {
    await sendMessage({ type: "CLEAR_HISTORY" });
  }
}

// Update a single setting
async function updateSetting(key, value) {
  const settings = { [key]: value };
  await sendMessage({ type: "UPDATE_SETTINGS", settings });
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", init);

