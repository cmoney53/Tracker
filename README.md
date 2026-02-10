# Drendot.io Ship Tracker Extension

A Chrome extension that tracks ship coordinates on drendot.io and displays them in the MOTD (Message of the Day).

## Features

- 🚢 **Real-time Ship Tracking** - Monitors WebSocket, API, and network traffic for ship coordinates
- 📍 **MOTD Integration** - Automatically updates the MOTD with current ship position
- 📊 **Coordinate History** - Tracks and stores coordinate history with CSV export
- 🎨 **Floating Overlay** - Shows coordinates in a stylish floating overlay on the game page
- ⚙️ **Customizable Settings** - Control update frequency, precision, and display options
- 📈 **Connection Status** - Visual indicator showing tracking status

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Chrome extension manifest (Manifest V3) |
| `content.js` | Content script for coordinate detection and MOTD manipulation |
| `background.js` | Background service worker for data management |
| `popup.html` | Extension popup UI |
| `popup.js` | Popup functionality and event handling |
| `injected.js` | Deep page injection for advanced interception |
| `styles.css` | Styling for popup and overlays |

## Installation

### Chrome / Edge / Brave

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the folder containing these files
6. The extension icon should appear in your toolbar

### Firefox (Manifest V3)

Firefox support for Manifest V3 extensions is limited. Consider using Chrome, Edge, or Brave for full functionality.

## Usage

1. **Open the Game**: Navigate to drendot.io
2. **Watch the Overlay**: A floating overlay showing ship coordinates will appear in the top-right
3. **Check MOTD**: The ship's current coordinates are displayed in the MOTD
4. **Open Popup**: Click the extension icon to:
   - View detailed coordinates
   - Adjust settings
   - See coordinate history
   - Export history as CSV
   - Manually update MOTD

## How It Works

### Coordinate Detection Methods

1. **WebSocket Interception**
   - Deep intercepts WebSocket messages sent between game client and server
   - Parses JSON and binary data for coordinate information
   - Real-time updates as ship moves

2. **API Monitoring**
   - Intercepts fetch() and XMLHttpRequest calls
   - Monitors API responses for ship position data
   - Captures REST API coordinate updates

3. **Network Request Analysis**
   - Monitors webRequest for game network traffic
   - Extracts coordinates from completed requests

4. **DOM Observation**
   - Watches for DOM changes that might indicate position updates
   - Detects coordinate displays rendered by the game

### MOTD Integration

The extension targets these MOTD elements on drendot.io:
- `#motd-edit-button` - Edit button
- `#motd-edit-text` - Edit textarea
- `#motd-save` - Save button
- `#motd-text` - Displayed MOTD text

Coordinates are formatted like:
```
[10:30:45] Ship Position: X:1234.56 Y:5678.90 Angle:45.2°
```

## Settings

| Setting | Description |
|---------|-------------|
| Auto-Update MOTD | Automatically update MOTD when coordinates change |
| Show Overlay | Display floating coordinate overlay |
| Track History | Store coordinate history (max 100 entries) |
| Coordinate Precision | Decimal places for coordinate display (0-4) |

## Privacy & Security

- All data is processed locally within the extension
- No data is sent to external servers
- Coordinates are only stored in Chrome's local storage
- Extension only runs on drendot.io domains

## Troubleshooting

### Coordinates not showing
- Make sure you're on drendot.io
- Check that the game is loaded and your ship is visible
- Try refreshing the page
- Open the popup to check connection status

### MOTD not updating
- Check if MOTD elements exist on the page
- Some game servers may restrict MOTD editing
- Try manually clicking "Update MOTD" in the popup

### Extension not loading
- Ensure Developer mode is enabled
- Check for JavaScript errors in the console (F12)
- Try removing and reloading the extension

## Development

To modify the extension:

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the **reload** button on the extension card
4. Test changes in the game

## License

MIT License - Feel free to modify and distribute.

## Contributing

Issues and pull requests are welcome!

