/**
 * Drendot.io Ship Tracker - Injected Script
 * Runs in page context for advanced WebSocket and API interception
 * This file is loaded into the page itself, not as a content script
 */

(function() {
  "use strict";
  
  // Prevent multiple injections
  if (window._drendotShipTrackerInjected) {
    return;
  }
  window._drendotShipTrackerInjected = true;
  
  // Coordinate storage accessible from page
  window._shipCoordinates = {
    x: null,
    y: null,
    angle: null,
    timestamp: null
  };
  
  // Message handler for extension communication
  window.addEventListener("message", (event) => {
    // Only accept messages from same page
    if (event.source !== window) return;
    
    if (event.data.type === "DRENDOT_COORDS_UPDATE") {
      window._shipCoordinates = {
        ...event.data.coordinates,
        timestamp: Date.now()
      };
      
      // Notify extension
      window.postMessage({
        type: "DRENDOT_COORDS_FROM_PAGE",
        coordinates: window._shipCoordinates
      }, "*");
    }
  });
  
  // Intercept WebSocket at a deeper level
  const OriginalWebSocket = window.WebSocket;
  
  class DeepInterceptedWebSocket extends OriginalWebSocket {
    constructor(url, protocols) {
      super(url, protocols);
      this._drendotTracker = true;
      this._setupDeepListener();
    }
    
    _setupDeepListener() {
      // Override send to intercept outgoing messages
      const originalSend = this.send;
      this.send = function(data) {
        // Try to parse and send coordinates back
        try {
          if (typeof data === "string") {
            const parsed = JSON.parse(data);
            detectCoordinatesFromOutgoing(parsed);
          }
        } catch (e) {}
        return originalSend.apply(this, arguments);
      };
      
      // Intercept incoming messages using addEventListener
      this.addEventListener("message", (event) => {
        detectCoordinatesFromIncoming(event.data);
      });
    }
  }
  
  window.WebSocket = DeepInterceptedWebSocket;
  
  // Deep API intercept for fetch
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    const response = await originalFetch.apply(this, arguments);
    
    // Clone and intercept response
    const cloned = response.clone();
    cloned.text().then((text) => {
      try {
        const data = JSON.parse(text);
        const coords = extractCoordinates(data);
        if (coords) {
          updateCoordinates(coords);
        }
      } catch (e) {}
    }).catch(() => {});
    
    return response;
  };
  
  // Deep XMLHttpRequest intercept
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url) {
    this._drendotUrl = url;
    return originalXHROpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function(body) {
    this.addEventListener("load", function() {
      try {
        const data = JSON.parse(this.responseText);
        const coords = extractCoordinates(data);
        if (coords) {
          updateCoordinates(coords);
        }
      } catch (e) {}
    });
    return originalXHRSend.apply(this, arguments);
  };
  
  // Detect coordinates from outgoing WebSocket messages
  function detectCoordinatesFromOutgoing(data) {
    if (!data || typeof data !== "object") return;
    
    // Check for coordinate fields in outgoing messages
    const coords = extractCoordinates(data);
    if (coords) {
      updateCoordinates(coords);
      notifyExtension(coords);
    }
  }
  
  // Detect coordinates from incoming WebSocket messages
  function detectCoordinatesFromIncoming(data) {
    try {
      if (typeof data === "string") {
        const parsed = JSON.parse(data);
        const coords = extractCoordinates(parsed);
        if (coords) {
          updateCoordinates(coords);
          notifyExtension(coords);
        }
      } else if (data instanceof ArrayBuffer) {
        const decoder = new TextDecoder("utf-8");
        const decoded = decoder.decode(data);
        const parsed = JSON.parse(decoded);
        const coords = extractCoordinates(parsed);
        if (coords) {
          updateCoordinates(coords);
          notifyExtension(coords);
        }
      }
    } catch (e) {
      // Not JSON or parse failed
      // Try text-based coordinate detection
      const coords = extractCoordinatesFromText(data);
      if (coords) {
        updateCoordinates(coords);
        notifyExtension(coords);
      }
    }
  }
  
  // Extract coordinates from parsed data
  function extractCoordinates(obj) {
    if (!obj || typeof obj !== "object") return null;
    
    const coords = { x: null, y: null, angle: null };
    let found = false;
    
    // Direct field matching
    const fieldMappings = {
      x: ["x", "X", "posX", "positionX", "shipX", "pos", "px"],
      y: ["y", "Y", "posY", "positionY", "shipY", "py"],
      angle: ["angle", "Angle", "rotation", "dir", "direction", "heading"]
    };
    
    for (const [coordType, fieldNames] of Object.entries(fieldMappings)) {
      for (const fieldName of fieldNames) {
        if (obj[fieldName] !== undefined) {
          coords[coordType] = parseFloat(obj[fieldName]);
          found = true;
        }
      }
    }
    
    // Check nested objects
    for (const key of ["data", "payload", "state", "gameState", "player", "ship"]) {
      if (obj[key] && typeof obj[key] === "object") {
        const nested = extractCoordinates(obj[key]);
        if (nested.x !== null) coords.x = nested.x;
        if (nested.y !== null) coords.y = nested.y;
        if (nested.angle !== null) coords.angle = nested.angle;
        if (nested.x !== null) found = true;
      }
    }
    
    // Check for array data
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const nested = extractCoordinates(item);
        if (nested.x !== null) {
          coords.x = nested.x;
          coords.y = nested.y;
          coords.angle = nested.angle;
          found = true;
          break;
        }
      }
    }
    
    return found ? coords : null;
  }
  
  // Extract coordinates from text
  function extractCoordinatesFromText(text) {
    if (typeof text !== "string") return null;
    
    const coords = { x: null, y: null, angle: null };
    
    // Pattern matching for various coordinate formats
    const patterns = [
      // [x, y] or [x, y, angle]
      /\[(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)(?:\s*,\s*(-?\d+\.?\d*))?\]/,
      // x: 123.45, y: 678.90
      /x[:\s=]+(-?\d+\.?\d*).*?y[:\s=]+(-?\d+\.?\d*)/si,
      // Position: (123.45, 678.90)
      /pos(?:ition)?[:\s(]+(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/i,
      // Simple coordinate pairs
      /(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        coords.x = parseFloat(match[1]);
        coords.y = parseFloat(match[2]);
        if (match[3]) coords.angle = parseFloat(match[3]);
        return coords;
      }
    }
    
    return null;
  }
  
  // Update stored coordinates
  function updateCoordinates(newCoords) {
    window._shipCoordinates = {
      ...window._shipCoordinates,
      ...newCoords,
      timestamp: Date.now()
    };
  }
  
  // Notify extension of coordinates
  function notifyExtension(coords) {
    window.postMessage({
      type: "DRENDOT_COORDS_FROM_PAGE",
      coordinates: {
        ...coords,
        timestamp: Date.now()
      }
    }, "*");
  }
  
  // Expose API for page access
  window._drendotShipTrackerAPI = {
    getCoordinates: () => ({ ...window._shipCoordinates }),
    setCoordinates: (coords) => {
      updateCoordinates(coords);
      notifyExtension(coords);
    },
    forceUpdateMOTD: () => {
      window.postMessage({
        type: "DRENDOT_FORCE_UPDATE_MOTD",
        coordinates: window._shipCoordinates
      }, "*");
    }
  };
  
  console.log("[Drendot Ship Tracker] Injected script loaded");
})();

