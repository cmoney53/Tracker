/**
 * Drendot.io Ship Tracker - Background Service Worker
 * Manages coordinate storage, history, and extension communication
 */

// Storage keys
const STORAGE_KEYS = {
  COORDINATES: "drendot_ship_coords",
  COORD_HISTORY: "drendot_coord_history",
  SETTINGS: "drendot_tracker_settings",
  CONNECTION_STATUS: "drendot_connection_status"
};

// Default settings
const DEFAULT_SETTINGS = {
  autoUpdateMOTD: true,
  updateInterval: 1000,
  historyEnabled: true,
  maxHistoryItems: 100,
  showOverlay: true,
  coordinatePrecision: 2,
  alertOnCoordinateChange: false
};

// Store active connections
const activePorts = new Set();

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("Drendot Ship Tracker installed:", details.reason);
  
  // Initialize default settings
  await chrome.storage.local.set({
    [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
    [STORAGE_KEYS.COORD_HISTORY]: [],
    [STORAGE_KEYS.CONNECTION_STATUS]: "disconnected"
  });
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log("Drendot Ship Tracker startup");
  await chrome.storage.local.set({ [STORAGE_KEYS.CONNECTION_STATUS]: "disconnected" });
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep message channel open for async response
});

// Handle port connections (for persistent connections)
chrome.runtime.onConnect.addListener((port) => {
  activePorts.add(port);
  
  port.onDisconnect.addListener(() => {
    activePorts.delete(port);
  });
  
  if (port.name === "content-background") {
    handleContentConnection(port);
  } else if (port.name === "popup-background") {
    handlePopupConnection(port);
  }
});

// Handle content script connections
function handleContentConnection(port) {
  port.onMessage.addListener(async (message) => {
    if (message.type === "COORDINATES_UPDATE") {
      await handleCoordinateUpdate(message.data, port.sender);
    } else if (message.type === "GET_COORDINATES") {
      const coords = await getStoredCoordinates();
      port.postMessage({ type: "COORDINATES_UPDATE", data: coords });
    }
  });
}

// Handle popup connections
function handlePopupConnection(port) {
  port.onMessage.addListener(async (message) => {
    const response = await handlePopupMessage(message);
    port.postMessage(response);
  });
}

// Main message handler
async function handleMessage(message, sender) {
  switch (message.type) {
    case "GET_COORDINATES":
      return await getStoredCoordinates();
      
    case "GET_COORD_HISTORY":
      return await getCoordinateHistory();
      
    case "GET_SETTINGS":
      return await getSettings();
      
    case "UPDATE_SETTINGS":
      return await updateSettings(message.settings);
      
    case "CLEAR_HISTORY":
      return await clearHistory();
      
    case "PING":
      return { type: "PONG", timestamp: Date.now() };
      
    default:
      return { error: "Unknown message type" };
  }
}

// Popup message handler
async function handlePopupMessage(message) {
  switch (message.type) {
    case "GET_DASHBOARD":
      const [coords, history, settings] = await Promise.all([
        getStoredCoordinates(),
        getCoordinateHistory(),
        getSettings()
      ]);
      return {
        type: "DASHBOARD_DATA",
        data: { coordinates: coords, history, settings }
      };
      
    case "UPDATE_COORD_MANUAL":
      return await updateCoordinatesManual(message.coords);
      
    case "EXPORT_HISTORY":
      return await exportHistory();
      
    default:
      return { error: "Unknown message type" };
  }
}

// Handle coordinate updates from content script
async function handleCoordinateUpdate(data, sender) {
  const timestamp = Date.now();
  const coords = {
    x: data.x,
    y: data.y,
    angle: data.angle,
    timestamp
  };
  
  // Store current coordinates
  await chrome.storage.local.set({ [STORAGE_KEYS.COORDINATES]: coords });
  
  // Get settings
  const settings = await getSettings();
  
  // Add to history if enabled
  if (settings.historyEnabled) {
    await addToHistory(coords);
  }
  
  // Update connection status
  await chrome.storage.local.set({ [STORAGE_KEYS.CONNECTION_STATUS]: "connected" });
  
  // Broadcast to all connected ports
  broadcastToAll({ type: "COORDINATES_UPDATE", data: coords });
}

// Broadcast message to all connected ports
function broadcastToAll(message) {
  activePorts.forEach(port => {
    try {
      port.postMessage(message);
    } catch (e) {
      // Port might be disconnected
    }
  });
}

// Store coordinates
async function storeCoordinates(coords) {
  await chrome.storage.local.set({ [STORAGE_KEYS.COORDINATES]: coords });
}

// Get stored coordinates
async function getStoredCoordinates() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.COORDINATES);
  return result[STORAGE_KEYS.COORDINATES] || { x: null, y: null, angle: null };
}

// Add coordinate to history
async function addToHistory(coords) {
  const history = await getCoordinateHistory();
  
  // Don't add if same as last coordinate (within precision)
  if (history.length > 0) {
    const last = history[history.length - 1];
    const precision = (await getSettings()).coordinatePrecision;
    if (last.x.toFixed(precision) === coords.x.toFixed(precision) &&
        last.y.toFixed(precision) === coords.y.toFixed(precision)) {
      return; // Skip duplicate
    }
  }
  
  // Add new coordinate
  history.push(coords);
  
  // Limit history size
  const settings = await getSettings();
  while (history.length > settings.maxHistoryItems) {
    history.shift();
  }
  
  await chrome.storage.local.set({ [STORAGE_KEYS.COORD_HISTORY]: history });
}

// Get coordinate history
async function getCoordinateHistory() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.COORD_HISTORY);
  return result[STORAGE_KEYS.COORD_HISTORY] || [];
}

// Clear history
async function clearHistory() {
  await chrome.storage.local.set({ [STORAGE_KEYS.COORD_HISTORY]: [] });
  return { success: true };
}

// Get settings
async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
}

// Update settings
async function updateSettings(newSettings) {
  const current = await getSettings();
  const updated = { ...current, ...newSettings };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
  
  // Notify content script of settings change
  notifyContentScript({ type: "SETTINGS_UPDATED", settings: updated });
  
  return { success: true, settings: updated };
}

// Update coordinates manually
async function updateCoordinatesManual(coords) {
  const timestamp = Date.now();
  const data = {
    ...coords,
    timestamp,
    manual: true
  };
  
  await handleCoordinateUpdate(data, null);
  
  // Try to notify content script to update MOTD
  notifyContentScript({
    type: "UPDATE_COORDINATES",
    data: data
  });
  
  return { success: true, coordinates: data };
}

// Export history as CSV
async function exportHistory() {
  const history = await getCoordinateHistory();
  const settings = await getSettings();
  const precision = settings.coordinatePrecision;
  
  let csv = "timestamp,x,y,angle\n";
  for (const coord of history) {
    const date = new Date(coord.timestamp).toISOString();
    csv += `${date},${coord.x.toFixed(precision)},${coord.y.toFixed(precision)},${coord.angle || ""}\n`;
  }
  
  return {
    type: "EXPORT_DATA",
    data: csv,
    filename: `ship_coordinates_${Date.now()}.csv`
  };
}

// Notify all content scripts
function notifyContentScript(message) {
  chrome.tabs.query({ url: "*://*.drendot.io/*" }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Tab might not have content script loaded
      });
    }
  });
}

// Cleanup old history entries (older than 24 hours)
async function cleanupHistory() {
  const history = await getCoordinateHistory();
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  
  const filtered = history.filter(coord => coord.timestamp > cutoff);
  
  if (filtered.length !== history.length) {
    await chrome.storage.local.set({ [STORAGE_KEYS.COORD_HISTORY]: filtered });
  }
}

// Initialize alarms for periodic tasks
async function initializeAlarms() {
  try {
    if (chrome.alarms) {
      await chrome.alarms.create("cleanup", { periodInMinutes: 60 });
      await chrome.alarms.create("heartbeat", { periodInMinutes: 5 });
      
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === "cleanup") {
          cleanupHistory();
        } else if (alarm.name === "heartbeat") {
          broadcastToAll({ type: "HEARTBEAT" });
        }
      });
      
      console.log("Alarms initialized");
    }
  } catch (e) {
    console.log("Alarms API not available:", e);
  }
}

// Call initializeAlarms when service worker starts
initializeAlarms();

console.log("Drendot Ship Tracker background service worker loaded");

