/**
 * Drendot.io Ship Tracker - Background Service Worker
 * Manages grid coordinate storage, history, and extension communication
 */

const STORAGE_KEYS = {
  COORDINATES: "drendot_ship_coords",
  COORD_HISTORY: "drendot_coord_history",
  SETTINGS: "drendot_tracker_settings",
  CONNECTION_STATUS: "drendot_connection_status"
};

const DEFAULT_SETTINGS = {
  autoUpdateMOTD: true,
  historyEnabled: true,
  maxHistoryItems: 100,
  showOverlay: true,
  alertOnCoordinateChange: false
};

const activePorts = new Set();

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("Drendot Ship Tracker installed:", details.reason);
  
  await chrome.storage.local.set({
    [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
    [STORAGE_KEYS.COORD_HISTORY]: [],
    [STORAGE_KEYS.CONNECTION_STATUS]: "disconnected"
  });
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("Drendot Ship Tracker startup");
  await chrome.storage.local.set({ [STORAGE_KEYS.CONNECTION_STATUS]: "disconnected" });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true;
});

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

function handlePopupConnection(port) {
  port.onMessage.addListener(async (message) => {
    const response = await handlePopupMessage(message);
    port.postMessage(response);
  });
}

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

async function handlePopupMessage(message) {
  switch (message.type) {
    case "GET_DASHBOARD":
      const [coords, history, settings] = await Promise.all([
        getStoredCoordinates(),
        getCoordinateHistory(),
        getSettings()
      ]);
      return { type: "DASHBOARD_DATA", data: { coordinates: coords, history, settings } };
    case "UPDATE_COORD_MANUAL":
      return await updateCoordinatesManual(message.coords);
    case "EXPORT_HISTORY":
      return await exportHistory();
    default:
      return { error: "Unknown message type" };
  }
}

async function handleCoordinateUpdate(data, sender) {
  const timestamp = Date.now();
  const coords = {
    visible: data.visible || [],
    hidden: data.hidden || [],
    all: data.all || [],
    timestamp
  };
  
  await chrome.storage.local.set({ [STORAGE_KEYS.COORDINATES]: coords });
  
  const settings = await getSettings();
  if (settings.historyEnabled) {
    await addToHistory(coords);
  }
  
  await chrome.storage.local.set({ [STORAGE_KEYS.CONNECTION_STATUS]: "connected" });
  
  broadcastToAll({ type: "COORDINATES_UPDATE", data: coords });
}

function broadcastToAll(message) {
  activePorts.forEach(port => {
    try {
      port.postMessage(message);
    } catch (e) {}
  });
}

async function storeCoordinates(coords) {
  await chrome.storage.local.set({ [STORAGE_KEYS.COORDINATES]: coords });
}

async function getStoredCoordinates() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.COORDINATES);
  return result[STORAGE_KEYS.COORDINATES] || { visible: [], hidden: [], all: [] };
}

async function addToHistory(coords) {
  const history = await getCoordinateHistory();
  
  // Check if same as last entry
  if (history.length > 0) {
    const last = history[history.length - 1];
    const lastVisible = (last.visible || []).sort().join(',');
    const currVisible = (coords.visible || []).sort().join(',');
    if (lastVisible === currVisible) {
      return;
    }
  }
  
  history.push(coords);
  
  const settings = await getSettings();
  while (history.length > settings.maxHistoryItems) {
    history.shift();
  }
  
  await chrome.storage.local.set({ [STORAGE_KEYS.COORD_HISTORY]: history });
}

async function getCoordinateHistory() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.COORD_HISTORY);
  return result[STORAGE_KEYS.COORD_HISTORY] || [];
}

async function clearHistory() {
  await chrome.storage.local.set({ [STORAGE_KEYS.COORD_HISTORY]: [] });
  return { success: true };
}

async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] || DEFAULT_SETTINGS;
}

async function updateSettings(newSettings) {
  const current = await getSettings();
  const updated = { ...current, ...newSettings };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
  
  notifyContentScript({ type: "SETTINGS_UPDATED", settings: updated });
  
  return { success: true, settings: updated };
}

async function updateCoordinatesManual(coords) {
  const timestamp = Date.now();
  const data = {
    visible: coords.visible || [],
    hidden: coords.hidden || [],
    all: coords.all || [],
    timestamp,
    manual: true
  };
  
  await handleCoordinateUpdate(data, null);
  notifyContentScript({ type: "UPDATE_COORDINATES", data });
  
  return { success: true, coordinates: data };
}

async function exportHistory() {
  const history = await getCoordinateHistory();
  
  let csv = "timestamp,visible,hidden,total\n";
  for (const coord of history) {
    const date = new Date(coord.timestamp).toISOString();
    const visible = (coord.visible || []).join(" ");
    const hidden = (coord.hidden || []).join(" ");
    const total = coord.all ? coord.all.length : 0;
    csv += `${date},"${visible}","${hidden}",${total}\n`;
  }
  
  return {
    type: "EXPORT_DATA",
    data: csv,
    filename: `ship_grid_${Date.now()}.csv`
  };
}

function notifyContentScript(message) {
  chrome.tabs.query({ url: "*://*.drendot.io/*" }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  });
}

async function cleanupHistory() {
  const history = await getCoordinateHistory();
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  const filtered = history.filter(coord => coord.timestamp > cutoff);
  
  if (filtered.length !== history.length) {
    await chrome.storage.local.set({ [STORAGE_KEYS.COORD_HISTORY]: filtered });
  }
}

async function initializeAlarms() {
  try {
    if (chrome.alarms) {
      await chrome.alarms.create("cleanup", { periodInMinutes: 60 });
      
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === "cleanup") {
          cleanupHistory();
        }
      });
      
      console.log("Alarms initialized");
    }
  } catch (e) {
    console.log("Alarms API not available:", e);
  }
}

initializeAlarms();

console.log("Drendot Ship Tracker background service worker loaded");
