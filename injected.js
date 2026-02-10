/**
 * Drendot.io Ship Tracker - Injected Script
 * Runs in page context for advanced WebSocket and API interception
 */

(function() {
  "use strict";
  
  if (window._drendotShipTrackerInjected) {
    return;
  }
  window._drendotShipTrackerInjected = true;
  
  // Grid configuration
  const GRID_CONFIG = {
    columns: ['a', 'b', 'c', 'd', 'e'],
    rows: ['1', '2', '3', '4', '5']
  };
  
  // Ship coordinates state
  window._shipCoordinates = {
    visible: [],
    hidden: [],
    all: [],
    timestamp: null
  };
  
  // Listen for extension messages
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === "DRENDOT_COORDS_UPDATE") {
      window._shipCoordinates = {
        ...event.data.coordinates,
        timestamp: Date.now()
      };
      
      window.postMessage({
        type: "DRENDOT_COORDS_FROM_PAGE",
        coordinates: window._shipCoordinates
      }, "*");
    }
  });
  
  // Intercept WebSocket
  const OriginalWebSocket = window.WebSocket;
  
  class InterceptedWebSocket extends OriginalWebSocket {
    constructor(url, protocols) {
      super(url, protocols);
      this._setupDeepListener();
    }
    
    _setupDeepListener() {
      const originalSend = this.send;
      this.send = function(data) {
        try {
          if (typeof data === "string") {
            const parsed = JSON.parse(data);
            detectCoordinatesFromOutgoing(parsed);
          }
        } catch (e) {}
        return originalSend.apply(this, arguments);
      };
      
      this.addEventListener("message", (event) => {
        detectCoordinatesFromIncoming(event.data);
      });
    }
  }
  
  window.WebSocket = InterceptedWebSocket;
  
  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function(input, init) {
    const response = await originalFetch.apply(this, arguments);
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
  
  // Intercept XMLHttpRequest
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
  
  // Detect coordinates from outgoing messages
  function detectCoordinatesFromOutgoing(data) {
    if (!data || typeof data !== "object") return;
    const coords = extractCoordinates(data);
    if (coords) {
      updateCoordinates(coords);
      notifyExtension(coords);
    }
  }
  
  // Detect coordinates from incoming messages
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
      const coords = extractCoordinatesFromText(data);
      if (coords) {
        updateCoordinates(coords);
        notifyExtension(coords);
      }
    }
  }
  
  // Convert numeric to grid
  function numericToGrid(x, y) {
    const colIndex = Math.floor(x);
    const rowIndex = Math.floor(y);
    
    if (colIndex < 0 || colIndex >= GRID_CONFIG.columns.length ||
        rowIndex < 0 || rowIndex >= GRID_CONFIG.rows.length) {
      return null;
    }
    
    return GRID_CONFIG.columns[colIndex] + GRID_CONFIG.rows[rowIndex];
  }
  
  // Extract coordinates from parsed data
  function extractCoordinates(obj) {
    if (!obj || typeof obj !== "object") return null;
    
    const result = {
      visible: [],
      hidden: [],
      all: [],
      timestamp: Date.now()
    };
    
    // Check for ship arrays
    const shipArrays = ["ships", "visibleShips", "hiddenShips", "allShips", "enemies", "targets"];
    
    for (const key of shipArrays) {
      if (obj[key] && Array.isArray(obj[key])) {
        for (const ship of obj[key]) {
          const gridPos = extractGridFromShip(ship);
          if (gridPos) {
            if (!result.all.includes(gridPos)) result.all.push(gridPos);
            if (ship.visible !== false && ship.hidden !== true) {
              if (!result.visible.includes(gridPos)) result.visible.push(gridPos);
            }
            if (ship.hidden === true || ship.visible === false) {
              if (!result.hidden.includes(gridPos)) result.hidden.push(gridPos);
            }
          }
        }
      }
    }
    
    // Check single ship
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
  
  // Extract grid from ship object
  function extractGridFromShip(ship) {
    if (!ship || typeof ship !== "object") return null;
    
    // Direct x,y
    if (ship.x !== undefined && ship.y !== undefined) {
      return numericToGrid(parseFloat(ship.x), parseFloat(ship.y));
    }
    
    // Position object
    if (ship.position && typeof ship.position === "object") {
      if (ship.position.x !== undefined && ship.position.y !== undefined) {
        return numericToGrid(parseFloat(ship.position.x), parseFloat(ship.position.y));
      }
    }
    
    // Grid string
    if (ship.grid || ship.positionGrid || ship.cell) {
      const gridStr = ship.grid || ship.positionGrid || ship.cell;
      if (typeof gridStr === "string" && /^[a-e][1-5]$/i.test(gridStr)) {
        return gridStr.toLowerCase();
      }
    }
    
    // Index-based
    if (ship.gridX !== undefined && ship.gridY !== undefined) {
      const col = GRID_CONFIG.columns[ship.gridX];
      const row = GRID_CONFIG.rows[ship.gridY];
      if (col && row) return col + row;
    }
    
    return null;
  }
  
  // Extract from text
  function extractCoordinatesFromText(text) {
    if (typeof text !== "string") return null;
    
    const result = {
      visible: [],
      hidden: [],
      all: [],
      timestamp: Date.now()
    };
    
    // Grid patterns like "a5", "c1"
    const gridPattern = /([a-e])([1-5])/gi;
    let match;
    
    while ((match = gridPattern.exec(text)) !== null) {
      const gridPos = match[1].toLowerCase() + match[2];
      if (!result.all.includes(gridPos)) result.all.push(gridPos);
    }
    
    if (result.all.length > 0 && result.visible.length === 0 && result.hidden.length === 0) {
      result.visible = [...result.all];
    }
    
    return result.all.length > 0 ? result : null;
  }
  
  // Update stored coordinates
  function updateCoordinates(newCoords) {
    window._shipCoordinates = {
      ...window._shipCoordinates,
      ...newCoords,
      timestamp: Date.now()
    };
  }
  
  // Notify extension
  function notifyExtension(coords) {
    window.postMessage({
      type: "DRENDOT_COORDS_FROM_PAGE",
      coordinates: {
        ...coords,
        timestamp: Date.now()
      }
    }, "*");
  }
  
  // Expose API
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
    },
    getGridConfig: () => ({ ...GRID_CONFIG })
  };
  
  console.log("[Drendot Ship Tracker] Injected script loaded");
})();

