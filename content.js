/**
 * Drendot.io Ship Tracker - Content Script
 * Monitors WebSocket, API, and network for ship coordinates
 * Displays coordinates in the MOTD
 */

// Extension communication
let backgroundPort = null;

// Ship coordinates state
let shipCoordinates = {
  x: null,
  y: null,
  angle: null,
  timestamp: null
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

// Update MOTD with current ship coordinates
function updateMOTDWithCoordinates() {
  const coordsText = formatCoordinatesForMOTD();
  
  // Try to update MOTD text element
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
  const { x, y, angle } = shipCoordinates;
  const time = new Date().toLocaleTimeString();
  
  if (x !== null && y !== null) {
    if (angle !== null) {
      return `[${time}] Ship Position: X:${x.toFixed(2)} Y:${y.toFixed(2)} Angle:${angle.toFixed(1)}°`;
    }
    return `[${time}] Ship Position: X:${x.toFixed(2)} Y:${y.toFixed(2)}`;
  }
  return `[${time}] Waiting for ship coordinates...`;
}

// WebSocket interception for coordinate monitoring
function setupWebSocketInterception() {
  // Override WebSocket constructor to intercept messages
  const OriginalWebSocket = window.WebSocket;
  
  class InterceptedWebSocket extends OriginalWebSocket {
    constructor(url, protocols) {
      super(url, protocols);
      this._setupMessageListener();
    }
    
    _setupMessageListener() {
      const originalOnMessage = this.onmessage;
      this.addEventListener("message", (event) => {
        // Parse and extract coordinates from WebSocket message
        const coords = parseWebSocketMessage(event.data);
        if (coords) {
          updateShipCoordinates(coords);
        }
        // Call original handler
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
    // Try parsing as JSON
    if (typeof data === "string") {
      const parsed = JSON.parse(data);
      return extractCoordinatesFromJSON(parsed);
    } else if (data instanceof ArrayBuffer) {
      // Handle binary data
      const decoder = new TextDecoder("utf-8");
      const decoded = decoder.decode(data);
      const parsed = JSON.parse(decoded);
      return extractCoordinatesFromJSON(parsed);
    }
  } catch (e) {
    // Not JSON, might be custom protocol
    return extractCoordinatesFromText(data);
  }
  return null;
}

// Extract coordinates from JSON object
function extractCoordinatesFromJSON(obj) {
  // Common coordinate field names in game protocols
  const coordFields = [
    "x", "X", "positionX", "posX", "shipX",
    "y", "Y", "positionY", "posY", "shipY",
    "angle", "Angle", "rotation", "rotationAngle",
    "pos", "position", "coords", "coordinates"
  ];
  
  // Check if object contains coordinate data
  let hasCoords = false;
  const coords = { x: null, y: null, angle: null };
  
  for (const field of coordFields) {
    if (obj[field] !== undefined) {
      if (field === "x" || field === "X" || field.includes("X") || field.includes("x")) {
        coords.x = parseFloat(obj[field]);
        hasCoords = true;
      }
      if (field === "y" || field === "Y" || field.includes("Y") || field.includes("y")) {
        coords.y = parseFloat(obj[field]);
        hasCoords = true;
      }
      if (field === "angle" || field === "Angle" || field.includes("Angle") || field.includes("angle")) {
        coords.angle = parseFloat(obj[field]);
      }
    }
  }
  
  // Check nested objects
  if (obj.data && typeof obj.data === "object") {
    const nestedCoords = extractCoordinatesFromJSON(obj.data);
    if (nestedCoords.x !== null) coords.x = nestedCoords.x;
    if (nestedCoords.y !== null) coords.y = nestedCoords.y;
    if (nestedCoords.angle !== null) coords.angle = nestedCoords.angle;
  }
  
  // Check for position/coords object
  if (obj.position || obj.pos || obj.coords || obj.coordinates) {
    const posObj = obj.position || obj.pos || obj.coords || obj.coordinates;
    if (posObj.x !== undefined) coords.x = parseFloat(posObj.x);
    if (posObj.y !== undefined) coords.y = parseFloat(posObj.y);
    if (posObj.angle !== undefined) coords.angle = parseFloat(posObj.angle);
  }
  
  return hasCoords ? coords : null;
}

// Extract coordinates from plain text
function extractCoordinatesFromText(text) {
  // Look for coordinate patterns in text
  const coordPatterns = [
    /x[:\s=]+([-\d.]+)/i,
    /y[:\s=]+([-\d.]+)/i,
    /pos[:\s=]+<?([-\d.,\s]+)>?/i,
    /\[([-\d.]+)[,\s]+([-\d.]+)(?:[,\s]+([-\d.]+))?\]/
  ];
  
  const coords = { x: null, y: null, angle: null };
  
  for (const pattern of coordPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match.length >= 3) {
        coords.x = parseFloat(match[1]);
        coords.y = parseFloat(match[2]);
        if (match[3]) coords.angle = parseFloat(match[3]);
      }
      break;
    }
  }
  
  return coords.x !== null ? coords : null;
}

// API endpoint monitoring for coordinates
function setupAPIIntercept() {
  // Override fetch to intercept API responses
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const clonedResponse = response.clone();
    
    clonedResponse.text().then((text) => {
      try {
        const data = JSON.parse(text);
        const coords = extractCoordinatesFromJSON(data);
        if (coords) {
          updateShipCoordinates(coords);
        }
      } catch (e) {
        // Not JSON response
      }
    });
    
    return response;
  };
  
  // Override XMLHttpRequest
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
      } catch (e) {
        // Not JSON response
      }
    });
    return originalXHRSend.apply(this, arguments);
  };
}

// DOM observation for coordinate elements
function setupDOMObservation() {
  // Create a coordinate display overlay
  createCoordinateOverlay();
  
  // Observe MOTD element changes
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

// Create floating coordinate display overlay
function createCoordinateOverlay() {
  // Check if overlay already exists
  if (document.getElementById("drendot-ship-tracker-overlay")) {
    return;
  }
  
  const overlay = document.createElement("div");
  overlay.id = "drendot-ship-tracker-overlay";
  overlay.innerHTML = `
    <div class="tracker-header">🚢 Ship Tracker</div>
    <div class="tracker-coords">
      <div class="tracker-row">
        <span class="tracker-label">X:</span>
        <span class="tracker-value" id="tracker-x">--</span>
      </div>
      <div class="tracker-row">
        <span class="tracker-label">Y:</span>
        <span class="tracker-value" id="tracker-y">--</span>
      </div>
      <div class="tracker-row">
        <span class="tracker-label">∠:</span>
        <span class="tracker-value" id="tracker-angle">--</span>
      </div>
    </div>
    <div class="tracker-status" id="tracker-status">Monitoring...</div>
  `;
  
  // Add styles
  overlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #00ff00;
    padding: 10px 15px;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    z-index: 999999;
    border: 1px solid #00ff00;
    box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
  `;
  
  document.body.appendChild(overlay);
  updateOverlayDisplay();
}

// Update overlay display with current coordinates
function updateOverlayDisplay() {
  const overlay = document.getElementById("drendot-ship-tracker-overlay");
  if (!overlay) return;
  
  const xEl = document.getElementById("tracker-x");
  const yEl = document.getElementById("tracker-y");
  const angleEl = document.getElementById("tracker-angle");
  const statusEl = document.getElementById("tracker-status");
  
  if (xEl) {
    xEl.textContent = shipCoordinates.x !== null ? shipCoordinates.x.toFixed(2) : "--";
  }
  if (yEl) {
    yEl.textContent = shipCoordinates.y !== null ? shipCoordinates.y.toFixed(2) : "--";
  }
  if (angleEl) {
    angleEl.textContent = shipCoordinates.angle !== null ? shipCoordinates.angle.toFixed(1) + "°" : "--";
  }
  if (statusEl) {
    statusEl.textContent = shipCoordinates.x !== null ? "Tracking Active" : "Waiting...";
    statusEl.style.color = shipCoordinates.x !== null ? "#00ff00" : "#ffaa00";
  }
}

// Override update function to also update overlay
const originalUpdateMOTD = updateMOTDWithCoordinates;
updateMOTDWithCoordinates = function() {
  originalUpdateMOTD();
  updateOverlayDisplay();
};

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

