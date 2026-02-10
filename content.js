/**
 * Drendot.io Ship Tracker - Content Script
 * Monitors WebSocket, API, and network for ship coordinates
 * Displays coordinates in the MOTD using grid format (A-E, 1-5)
 */

// Extension communication
let backgroundPort = null;

// Ship coordinates state (now using grid format)
let shipCoordinates = {
  visible: [],     // Array of visible ship grid positions like ['a5', 'c1']
  hidden: [],      // Array of hidden ship grid positions
  all: [],         // All ship positions combined
  timestamp: null
};

// Grid configuration
const GRID_CONFIG = {
  columns: ['a', 'b', 'c', 'd', 'e'],
  rows: ['1', '2', '3', '4', '5']
};

// Initialize communication with background script
function initBackgroundConnection() {
  backgroundPort = chrome.runtime.connect({ name: "content-background" });
  
  backgroundPort.onMessage.addListener((message) => {
    if (message.type === "UPDATE_COORDINATES") {
      updateShipCoordinates(message.data);
    } else if (message.type === "GET_COORDINATES") {
      backgroundPort.postMessage({
        type: "COORDINATES_UPDATE",
        data: shipCoordinates
      });
    }
  });
}

// Update ship coordinates and update MOTD
function updateShipCoordinates(coords) {
  shipCoordinates = {
    ...coords,
    timestamp: Date.now()
  };
  
  updateMOTDWithCoordinates();
  updateGridOverlay();
  notifyBackground();
}

// Notify background script of coordinate updates
function notifyBackground() {
  if (backgroundPort) {
    backgroundPort.postMessage({
      type: "COORDINATES_UPDATE",
      data: shipCoordinates
    });
  }
}

// Convert numeric coordinates to grid format (A-E, 1-5)
function numericToGrid(x, y) {
  const colIndex = Math.floor(x);
  const rowIndex = Math.floor(y);
  
  if (colIndex < 0 || colIndex >= GRID_CONFIG.columns.length ||
      rowIndex < 0 || rowIndex >= GRID_CONFIG.rows.length) {
    return null;
  }
  
  return GRID_CONFIG.columns[colIndex] + GRID_CONFIG.rows[rowIndex];
}

// Convert grid format to display string
function formatGridList(gridArray) {
  if (!gridArray || gridArray.length === 0) {
    return "None";
  }
  return gridArray.sort().join(", ");
}

// Update MOTD with current ship coordinates
function updateMOTDWithCoordinates() {
  const coordsText = formatCoordinatesForMOTD();
  
  const motdTextEl = document.getElementById("motd-text");
  const motdEditText = document.getElementById("motd-edit-text");
  
  if (motdTextEl) {
    motdTextEl.textContent = coordsText;
  }
  
  if (motdEditText) {
    motdEditText.value = coordsText;
  }
}

// Format coordinates for MOTD display
function formatCoordinatesForMOTD() {
  const time = new Date().toLocaleTimeString();
  
  let status = `[${time}] Ship Grid Status:\n`;
  status += `Visible: ${formatGridList(shipCoordinates.visible)}\n`;
  status += `Hidden: ${formatGridList(shipCoordinates.hidden)}\n`;
  status += `Total Ships: ${shipCoordinates.all.length}`;
  
  return status;
}

// Create or update the minimap grid overlay
function createGridOverlay() {
  if (document.getElementById("drendot-ship-grid-overlay")) {
    updateGridOverlay();
    return;
  }
  
  const overlay = document.createElement("div");
  overlay.id = "drendot-ship-grid-overlay";
  overlay.innerHTML = `
    <div class="grid-header">Ship Grid Tracker</div>
    <div class="grid-display">
      ${createGridHTML()}
    </div>
    <div class="grid-stats">
      <div class="stat-row">
        <span class="stat-label">Visible:</span>
        <span class="stat-value visible-count">0</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Hidden:</span>
        <span class="stat-value hidden-count">0</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Total:</span>
        <span class="stat-value total-count">0</span>
      </div>
    </div>
    <div class="grid-status" id="grid-status">Scanning...</div>
  `;
  
  document.body.appendChild(overlay);
  updateGridOverlay();
}

// Create HTML for the 5x5 grid
function createGridHTML() {
  let html = '<div class="grid-container">';
  
  // Header row
  html += '<div class="grid-row grid-header-row">';
  html += '<div class="grid-cell grid-corner"></div>';
  for (const col of GRID_CONFIG.columns) {
    html += `<div class="grid-cell grid-col-header">${col.toUpperCase()}</div>`;
  }
  html += '</div>';
  
  // Data rows (1-5, displayed top to bottom)
  for (let row = GRID_CONFIG.rows.length - 1; row >= 0; row--) {
    const rowNum = GRID_CONFIG.rows[row];
    html += '<div class="grid-row">';
    html += `<div class="grid-cell grid-row-header">${rowNum}</div>`;
    
    for (const col of GRID_CONFIG.columns) {
      const cellId = `${col}${rowNum}`;
      html += `<div class="grid-cell" data-cell="${cellId}" id="cell-${cellId}">${cellId}</div>`;
    }
    html += '</div>';
  }
  
  html += '</div>';
  return html;
}

// Update grid overlay display
function updateGridOverlay() {
  const overlay = document.getElementById("drendot-ship-grid-overlay");
  if (!overlay) return;
  
  // Update cell states
  const visibleSet = new Set(shipCoordinates.visible);
  const hiddenSet = new Set(shipCoordinates.hidden);
  
  GRID_CONFIG.columns.forEach(col => {
    GRID_CONFIG.rows.forEach(row => {
      const cellId = `${col}${row}`;
      const cellEl = document.getElementById(`cell-${cellId}`);
      if (cellEl) {
        cellEl.classList.remove("has-ship-visible", "has-ship-hidden");
        
        if (visibleSet.has(cellId)) {
          cellEl.classList.add("has-ship-visible");
        } else if (hiddenSet.has(cellId)) {
          cellEl.classList.add("has-ship-hidden");
        }
      }
    });
  });
  
  // Update stats
  const visibleCount = document.querySelector(".visible-count");
  const hiddenCount = document.querySelector(".hidden-count");
  const totalCount = document.querySelector(".total-count");
  
  if (visibleCount) visibleCount.textContent = shipCoordinates.visible.length;
  if (hiddenCount) hiddenCount.textContent = shipCoordinates.hidden.length;
  if (totalCount) totalCount.textContent = shipCoordinates.all.length;
  
  // Update status
  const statusEl = document.getElementById("grid-status");
  if (statusEl) {
    if (shipCoordinates.all.length > 0) {
      statusEl.textContent = "Tracking Active";
      statusEl.classList.add("tracking");
    } else {
      statusEl.textContent = "Scanning...";
      statusEl.classList.remove("tracking");
    }
  }
}

// WebSocket interception for coordinate monitoring
function setupWebSocketInterception() {
  const OriginalWebSocket = window.WebSocket;
  
  class InterceptedWebSocket extends OriginalWebSocket {
    constructor(url, protocols) {
      super(url, protocols);
      this._setupMessageListener();
    }
    
    _setupMessageListener() {
      const originalOnMessage = this.onmessage;
      this.addEventListener("message", (event) => {
        const coords = parseWebSocketMessage(event.data);
        if (coords) {
          updateShipCoordinates(coords);
        }
        if (originalOnMessage) {
          originalOnMessage.call(this, event);
        }
      });
    }
  }
  
  window.WebSocket = InterceptedWebSocket;
}

// Parse WebSocket message for ship coordinates
function parseWebSocketMessage(data) {
  try {
    if (typeof data === "string") {
      const parsed = JSON.parse(data);
      return extractCoordinatesFromJSON(parsed);
    } else if (data instanceof ArrayBuffer) {
      const decoder = new TextDecoder("utf-8");
      const decoded = decoder.decode(data);
      const parsed = JSON.parse(decoded);
      return extractCoordinatesFromJSON(parsed);
    }
  } catch (e) {
    return extractCoordinatesFromText(data);
  }
  return null;
}

// Extract coordinates from JSON object
function extractCoordinatesFromJSON(obj) {
  if (!obj || typeof obj !== "object") return null;
  
  const result = {
    visible: [],
    hidden: [],
    all: [],
    timestamp: Date.now()
  };
  
  // Check for ship array data
  const shipArrays = ["ships", "visibleShips", "hiddenShips", "allShips", "enemies", "targets"];
  
  for (const key of shipArrays) {
    if (obj[key] && Array.isArray(obj[key])) {
      for (const ship of obj[key]) {
        const gridPos = extractGridFromShip(ship);
        if (gridPos) {
          if (!result.all.includes(gridPos)) {
            result.all.push(gridPos);
          }
          if (ship.visible !== false && ship.hidden !== true) {
            result.visible.push(gridPos);
          }
          if (ship.hidden === true || ship.visible === false) {
            if (!result.hidden.includes(gridPos)) {
              result.hidden.push(gridPos);
            }
          }
        }
      }
    }
  }
  
  // Check for single ship data
  const singleShip = extractGridFromShip(obj);
  if (singleShip) {
    if (!result.all.includes(singleShip)) {
      result.all.push(singleShip);
      result.visible.push(singleShip);
    }
  }
  
  // Remove duplicates
  result.visible = [...new Set(result.visible)];
  result.hidden = [...new Set(result.hidden)];
  result.all = [...new Set(result.all)];
  
  return result.all.length > 0 ? result : null;
}

// Extract grid position from a ship object
function extractGridFromShip(ship) {
  if (!ship || typeof ship !== "object") return null;
  
  // Try direct x,y coordinates
  if (ship.x !== undefined && ship.y !== undefined) {
    return numericToGrid(parseFloat(ship.x), parseFloat(ship.y));
  }
  
  // Try position object
  if (ship.position && typeof ship.position === "object") {
    if (ship.position.x !== undefined && ship.position.y !== undefined) {
      return numericToGrid(parseFloat(ship.position.x), parseFloat(ship.position.y));
    }
  }
  
  // Try grid string directly
  if (ship.grid || ship.positionGrid || ship.cell) {
    const gridStr = ship.grid || ship.positionGrid || ship.cell;
    if (typeof gridStr === "string" && /^[a-e][1-5]$/i.test(gridStr)) {
      return gridStr.toLowerCase();
    }
  }
  
  // Try index-based
  if (ship.gridX !== undefined && ship.gridY !== undefined) {
    const col = GRID_CONFIG.columns[ship.gridX];
    const row = GRID_CONFIG.rows[ship.gridY];
    if (col && row) return col + row;
  }
  
  return null;
}

// Extract coordinates from plain text
function extractCoordinatesFromText(text) {
  if (typeof text !== "string") return null;
  
  const result = {
    visible: [],
    hidden: [],
    all: [],
    timestamp: Date.now()
  };
  
  // Look for grid coordinate patterns like "a5", "c1", etc.
  const gridPattern = /([a-e])([1-5])/gi;
  let match;
  
  while ((match = gridPattern.exec(text)) !== null) {
    const gridPos = match[1].toLowerCase() + match[2];
    if (!result.all.includes(gridPos)) {
      result.all.push(gridPos);
    }
  }
  
  // Check for visible/hidden indicators
  const visiblePattern = /visible[:\s]*([a-e][1-5](?:,\s*[a-e][1-5])*)/gi;
  const hiddenPattern = /hidden[:\s]*([a-e][1-5](?:,\s*[a-e][1-5])*)/gi;
  
  const visibleMatch = text.match(visiblePattern);
  if (visibleMatch) {
    visibleMatch.forEach(m => {
      const coords = m.match(/([a-e][1-5])/gi);
      if (coords) {
        coords.forEach(c => {
          const grid = c.toLowerCase();
          if (!result.visible.includes(grid)) {
            result.visible.push(grid);
          }
        });
      }
    });
  }
  
  const hiddenMatch = text.match(hiddenPattern);
  if (hiddenMatch) {
    hiddenMatch.forEach(m => {
      const coords = m.match(/([a-e][1-5])/gi);
      if (coords) {
        coords.forEach(c => {
          const grid = c.toLowerCase();
          if (!result.hidden.includes(grid)) {
            result.hidden.push(grid);
          }
        });
      }
    });
  }
  
  // If we found coordinates but no explicit visible/hidden, assume all are visible
  if (result.all.length > 0 && result.visible.length === 0 && result.hidden.length === 0) {
    result.visible = [...result.all];
  }
  
  return result.all.length > 0 ? result : null;
}

// API endpoint monitoring for coordinates
function setupAPIIntercept() {
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, arguments);
    const clonedResponse = response.clone();
    
    clonedResponse.text().then((text) => {
      try {
        const data = JSON.parse(text);
        const coords = extractCoordinatesFromJSON(data);
        if (coords) {
          updateShipCoordinates(coords);
        }
      } catch (e) {}
    }).catch(() => {});
    
    return response;
  };
  
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return originalXHROpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    this.addEventListener("load", function() {
      try {
        const data = JSON.parse(this.responseText);
        const coords = extractCoordinatesFromJSON(data);
        if (coords) {
          updateShipCoordinates(coords);
        }
      } catch (e) {}
    });
    return originalXHRSend.apply(this, arguments);
  };
}

// DOM observation for coordinate elements
function setupDOMObservation() {
  createGridOverlay();
  
  const motdContainer = document.querySelector("#motd-edit");
  if (motdContainer) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList" || mutation.type === "subtree") {
          updateMOTDWithCoordinates();
        }
      }
    });
    
    observer.observe(motdContainer, {
      childList: true,
      subtree: true
    });
  }
}

// Inject into page context for advanced interception
function injectScript() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected.js");
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
}

// Initialize everything when DOM is ready
function initialize() {
  initBackgroundConnection();
  setupWebSocketInterception();
  setupAPIIntercept();
  setupDOMObservation();
  updateMOTDWithCoordinates();
}

// Start when page is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

// Export functions for popup/background use
window.getShipCoordinates = function() {
  return { ...shipCoordinates };
};

window.forceUpdateMOTD = function() {
  updateMOTDWithCoordinates();
};

window.setShipCoordinates = function(coords) {
  updateShipCoordinates(coords);
};

window.getGridConfig = function() {
  return { ...GRID_CONFIG };
};

