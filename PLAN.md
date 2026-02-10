# Chrome Extension for Drendot.io Ship Coordinates Tracker

## Project Overview
Create a Chrome extension that:
1. Tracks ship coordinates on drendot.io through WebSocket, API, and other methods
2. Displays ship coordinates in the MOTD (Message of the Day)

## Files to Create

### 1. manifest.json
Chrome extension manifest file with:
- Manifest V3 format
- Permissions: activeTab, scripting, storage, webRequest
- Host permissions for drendot.io
- Content scripts injection
- Background service worker

### 2. content.js
Content script that:
- Intercepts/monitors WebSocket connections for ship coordinates
- Makes API calls to fetch ship position data
- Manipulates MOTD elements on the page
- Sends coordinates to background script for processing
- Handles UI updates for coordinate display

### 3. background.js
Background service worker that:
- Receives ship coordinates from content script
- Coordinates with popup (if needed)
- Manages storage of coordinate history
- Handles communication between different parts of extension

### 4. popup.html
Optional popup UI for:
- Viewing current ship coordinates
- Setting coordinate tracking preferences
- Manual MOTD update options
- Connection status indicator

### 5. popup.js
Popup functionality:
- Display current tracked coordinates
- Save/load user preferences
- Control tracking behavior

### 6. styles.css
Styling for:
- Injected coordinate display overlay
- Popup UI
- MOTD coordinate styling

## Technical Approach

### Coordinate Discovery Methods:
1. **WebSocket Monitoring**: Intercept WebSocket messages sent/received
2. **API Endpoints**: Query game API for ship positions
3. **DOM Scraping**: Extract coordinates from page elements
4. **Game Memory**: If accessible, read from game state
5. **Network Requests**: Monitor XHR/fetch for coordinate data

### MOTD Integration:
- Target the existing MOTD elements shown in the code:
  - `#motd-edit-button` - Edit button
  - `#motd-edit-text` - Edit text area
  - `#motd-save` - Save button
  - `#motd-text` - Displayed MOTD text
- Inject coordinate display into MOTD
- Auto-update when coordinates change

## Implementation Steps

1. Create project structure and manifest.json
2. Implement content.js with WebSocket/API interceptors
3. Create background.js for data management
4. Build popup UI for user interaction
5. Add styling for coordinate display
6. Test and refine coordinate detection methods

## Browser Support
- Chrome (Manifest V3)
- Edge (Chromium-based)
- Other Chromium browsers

