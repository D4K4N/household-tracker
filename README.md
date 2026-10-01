# Household GPS Water Meter Tracker

A Progressive Web App (PWA) for water meter readers to track household locations using real-time GPS.

## Features

### ✅ Completed (Stages 1-7)

- **Stage 1: GPS Tracking**
  - Real-time GPS location tracking
  - Google satellite map view
  - Current location marker with accuracy circle
  - GPS status indicators
  - Smooth map controls (pan, zoom, pinch)

- **Stage 2: Household Management**
  - Add households with GPS coordinates
  - Permanent household markers on map
  - IndexedDB local storage (offline-capable)
  - GPS accuracy validation

- **Stage 3: Search**
  - Live search by surname, name, address, or meter number
  - Search results dropdown
  - Fly to household on selection

- **Stage 4: Edit & Delete**
  - Edit household information
  - Update location to current GPS
  - Delete with confirmation dialog

- **Stage 5: PWA & Offline**
  - Progressive Web App (installable)
  - Service worker caching
  - Works offline after first load
  - App manifest for mobile installation

- **Stage 6: Backup & Restore**
  - Export all data to JSON
  - Import data from JSON backup
  - Timestamped backup files

- **Stage 7: Navigation**
  - Navigate to household using Google Maps
  - Opens native maps app on mobile
  - One-tap navigation from household popup

## Installation & Setup

### 1. Generate Icons (One-time setup)
1. Open `assets/generate-icons.html` in a browser
2. Right-click each canvas and save as:
   - Save first canvas as `icon-192.png`
   - Save second canvas as `icon-512.png`
3. Place both PNG files in the `assets` folder

### 2. Start the Server
```bash
node server.js
```

### 3. Access the Application

**On Computer:**
```
http://localhost:8080
```

**On Phone (same WiFi):**
```
http://YOUR_COMPUTER_IP:8080
```

To find your IP:
```bash
ipconfig
```
Look for "IPv4 Address" (e.g., 192.168.X.X)

## Usage Guide

### Adding a Household

1. **Wait for GPS lock** (🟢 GPS Active)
2. **Walk to the household location**
3. **Press "+ ADD HOUSEHOLD"**
4. **Fill in the form:**
   - Surname* (required)
   - First Name* (required)
   - Address
   - Meter Number
   - Contact Number
   - Notes
5. **Press "Save Household"**
6. Red pin appears at the saved location

### Searching for a Household

1. **Type in the search bar** (surname, name, address, etc.)
2. **Tap a result** from the dropdown
3. Map flies to the household location

### Editing a Household

1. **Click the household marker** on the map
2. **Press "✏️ Edit"** in the popup
3. **Update information**
4. **Optional:** Check "Update location to current GPS"
5. **Press "Update Household"**

### Navigating to a Household

1. **Click the household marker**
2. **Press "🧭 Navigate"** in the popup
3. Google Maps opens with directions

### Backup & Restore

**Export:**
1. Open menu (☰)
2. Press "💾 Export Data"
3. JSON file downloads automatically

**Import:**
1. Open menu (☰)
2. Press "📥 Import Data"
3. Select your backup JSON file

## Testing Checklist

### ✅ Desktop Testing (http://localhost:8080)

- [ ] Map loads with satellite view
- [ ] GPS permission prompt appears
- [ ] GPS status shows (searching → active)
- [ ] Blue marker shows current location
- [ ] Map can be dragged/panned
- [ ] Zoom controls work
- [ ] "My Location" button centers map

### ✅ Add Household

- [ ] "Add Household" button enabled when GPS active
- [ ] Modal opens with captured GPS coordinates
- [ ] Form validates required fields
- [ ] Household saves successfully
- [ ] Red marker appears on map
- [ ] Marker persists after page reload

### ✅ Search

- [ ] Search bar accepts input
- [ ] Results appear as you type
- [ ] Clicking result flies to household
- [ ] Clicking outside closes results

### ✅ Household Popup

- [ ] Clicking marker opens popup
- [ ] Shows all household information
- [ ] Edit button works
- [ ] Navigate button opens maps
- [ ] Delete button prompts confirmation

### ✅ Edit Household

- [ ] Form pre-fills with current data
- [ ] Changes save successfully
- [ ] Marker updates position if location updated
- [ ] Popup content updates

### ✅ Delete Household

- [ ] Confirmation dialog appears
- [ ] Household deletes from database
- [ ] Marker removes from map
- [ ] Data persists after reload

### ✅ Menu

- [ ] Menu opens/closes
- [ ] "Show All Households" fits all markers
- [ ] "Household List" shows all saved households
- [ ] Clicking household in list flies to it

### ✅ Backup/Restore

- [ ] Export downloads JSON file
- [ ] JSON contains all household data
- [ ] Import restores households
- [ ] No duplicate households created

### ✅ Offline Support

- [ ] Service worker registers
- [ ] App loads after going offline
- [ ] IndexedDB works offline
- [ ] Can add/edit/delete households offline
- [ ] Search works offline

### ✅ PWA (Mobile)

- [ ] "Add to Home Screen" prompt appears
- [ ] App installs to home screen
- [ ] Opens in standalone mode (no browser UI)
- [ ] Icon shows on home screen

### 📱 Mobile Testing (http://192.168.X.X:8080)

- [ ] App loads on phone
- [ ] GPS permission works
- [ ] GPS tracks real location accurately
- [ ] Marker follows as you walk
- [ ] Touch gestures work (swipe, pinch)
- [ ] Add household captures real GPS
- [ ] Navigate opens Google Maps app
- [ ] PWA installation works

## Troubleshooting

### GPS Not Working on Phone (HTTP)

**Problem:** Modern browsers require HTTPS for GPS on mobile.

**Solutions:**
1. **Test on computer** with `http://localhost:8080` (localhost is trusted)
2. **Deploy to HTTPS** (GitHub Pages, Netlify, Vercel - all free)
3. Use Chrome flags (advanced, not recommended)

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solution:** 
Change port in `server.js`:
```javascript
const PORT = 8080; // Change to 3000, 5000, etc.
```

### Database Not Persisting

**Check:**
1. Not using incognito/private mode
2. Browser allows IndexedDB
3. Clear cache and reload

### Map Tiles Not Loading

**Check:**
1. Internet connection active
2. Not blocked by firewall
3. Map tiles load from Google

## File Structure

```
households-tracker/
├── index.html              # Main HTML
├── manifest.json           # PWA manifest
├── service-worker.js       # Offline support
├── server.js               # Local dev server
├── README.md              # This file
├── assets/
│   ├── generate-icons.html # Icon generator
│   ├── icon-192.png       # App icon 192x192
│   └── icon-512.png       # App icon 512x512
├── css/
│   └── style.css          # All styles
└── js/
    ├── app.js             # Main controller
    ├── gps.js             # GPS tracking
    ├── map.js             # Map management
    ├── database.js        # IndexedDB operations
    └── households.js      # Household CRUD

```

## Data Storage

### IndexedDB Structure
```javascript
{
  id: 1,                                    // Auto-increment
  surname: "Suzuki",
  firstName: "John",
  fullName: "John Suzuki",
  address: "Purok 3, Diclum",
  meterNumber: "WM-00123",
  contactNumber: "09123456789",
  notes: "Gate beside sari-sari store",
  latitude: 8.367890,
  longitude: 124.859123,
  gpsAccuracy: 7,                          // meters
  createdAt: "2026-10-01T10:30:00.000Z",
  updatedAt: "2026-10-01T10:30:00.000Z"
}
```

## Future Stages (Not Yet Implemented)

- **Stage 8:** Water meter reading input
- **Stage 9:** Billing calculation
- **Stage 10:** Bluetooth thermal printer
- **Stage 11:** Cloud synchronization

## Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Map:** Leaflet.js + Google Satellite Tiles
- **Storage:** IndexedDB
- **Offline:** Service Worker, PWA
- **GPS:** Browser Geolocation API
- **Server:** Node.js (development only)

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (iOS 11.3+)
- Opera: ✅ Full support

## License

Free to use for water meter reading purposes.

## Support

For issues or questions, check the console for error messages.
Common errors and solutions are in the Troubleshooting section above.

---

**Built for water meter readers in Barangay Diclum, Manolo Fortich, Bukidnon**
