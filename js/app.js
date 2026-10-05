/**
 * App.js - Main Application Controller
 * Coordinates GPS tracking, map display, database, households, and UI
 */

// Initialize modules
const gpsTracker = new GPSTracker();
const mapManager = new MapManager();
const database = new HouseholdDatabase();
let householdManager;
let routeRecorder; // Route recording system
let meterLocationManager; // Water meter location management
let waterMeterManager; // Individual water meter management
let meterReadingManager; // Meter reading workflow
let billingManager; // Billing calculation system
let printerService; // Bill printing service

// UI Elements
let gpsStatusText;
let gpsAccuracy;
let gpsCoordinates;
let myLocationBtn;
let addHouseholdBtn;
let addMeterLocationBtn; // New button for meter locations
let searchInput;
let searchResults;
let menuBtn;
let sideMenu;

// Route UI Elements
let startRouteBtn;
let routeControls;
let pauseRouteBtn;
let resumeRouteBtn;
let saveRouteBtn;
let cancelRouteBtn;
let recordingStatus;
let routeDistance;
let routeDuration;

// State
let currentCapturedLocation = null;
let routeUpdateInterval = null;

/**
 * Initialize the application
 */
async function initializeApp() {
    console.log('Initializing Household Tracker...');

    // Get UI elements
    gpsStatusText = document.getElementById('gpsStatusText');
    gpsAccuracy = document.getElementById('gpsAccuracy');
    gpsCoordinates = document.getElementById('gpsCoordinates');
    myLocationBtn = document.getElementById('myLocationBtn');
    addHouseholdBtn = document.getElementById('addHouseholdBtn');
    addMeterLocationBtn = document.getElementById('addMeterLocationBtn'); // New
    searchInput = document.getElementById('searchInput');
    searchResults = document.getElementById('searchResults');
    menuBtn = document.getElementById('menuBtn');
    sideMenu = document.getElementById('sideMenu');

    // Route UI elements
    startRouteBtn = document.getElementById('startRouteBtn');
    routeControls = document.getElementById('routeControls');
    pauseRouteBtn = document.getElementById('pauseRouteBtn');
    resumeRouteBtn = document.getElementById('resumeRouteBtn');
    saveRouteBtn = document.getElementById('saveRouteBtn');
    cancelRouteBtn = document.getElementById('cancelRouteBtn');
    recordingStatus = document.getElementById('recordingStatus');
    routeDistance = document.getElementById('routeDistance');
    routeDuration = document.getElementById('routeDuration');

    // Initialize map
    mapManager.initialize('map');

    // Initialize database
    try {
        await database.init();
        
        // Initialize household manager
        householdManager = new HouseholdManager(mapManager, database);
        window.householdManager = householdManager;
        
        // Initialize water meter location manager
        meterLocationManager = new WaterMeterLocationManager(mapManager, database);
        window.meterLocationManager = meterLocationManager;
        
        // Initialize water meter manager
        waterMeterManager = new WaterMeterManager(mapManager, database);
        window.waterMeterManager = waterMeterManager;
        
        // Initialize meter reading manager
        meterReadingManager = new MeterReadingManager(database, null);
        window.meterReadingManager = meterReadingManager;
        
        // Initialize billing manager
        billingManager = new BillingManager(database);
        window.billingManager = billingManager;
        await billingManager.initialize();
        
        // Initialize printer service
        printerService = new PrinterService(database);
        window.printerService = printerService;
        
        // Initialize route recorder
        routeRecorder = new RouteRecorder(mapManager, database);
        window.routeRecorder = routeRecorder;
        
        await householdManager.initialize();
        await meterLocationManager.initialize();
        await waterMeterManager.initialize();
        await routeRecorder.loadAllRoutes();
        
        console.log('Database, households, meter locations, water meters, and routes initialized');
    } catch (error) {
        console.error('Failed to initialize database:', error);
        alert('Failed to initialize database. Some features may not work.');
    }

    // Setup GPS callbacks
    setupGPSCallbacks();

    // Setup UI event listeners
    setupEventListeners();

    // Start GPS tracking
    gpsTracker.startTracking();

    console.log('Application initialized');
}

/**
 * Setup GPS tracker callbacks
 */
function setupGPSCallbacks() {
    // Handle position updates
    gpsTracker.onPositionUpdate((position) => {
        // Update map marker
        mapManager.updateCurrentLocation(
            position.latitude,
            position.longitude,
            position.accuracy
        );

        // Store current location for household creation
        currentCapturedLocation = position;

        // If recording route, add point
        if (routeRecorder && routeRecorder.isRecording && !routeRecorder.isPaused) {
            routeRecorder.addPoint(position.latitude, position.longitude);
        }

        // Update UI
        updateGPSUI();
    });

    // Handle status changes
    gpsTracker.onStatusChange((status, message) => {
        updateStatusDisplay(status, message);
    });

    // Handle errors
    gpsTracker.onError((error) => {
        console.error('GPS Error:', error);
    });
}

/**
 * Setup UI event listeners
 */
function setupEventListeners() {
    // My Location button
    myLocationBtn.addEventListener('click', () => {
        mapManager.centerOnCurrentLocation();
    });

    // Add Household button
    addHouseholdBtn.addEventListener('click', () => {
        openAddHouseholdModal();
    });

    // Add Meter Location button
    addMeterLocationBtn.addEventListener('click', () => {
        openAddMeterLocationModal();
    });

    // Search input
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim()) {
            handleSearch();
        }
    });

    // Click outside search results to close
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('active');
        }
    });

    // Menu button
    menuBtn.addEventListener('click', () => {
        sideMenu.classList.add('active');
    });

    // Route recording buttons
    startRouteBtn.addEventListener('click', handleStartRoute);
    pauseRouteBtn.addEventListener('click', handlePauseRoute);
    resumeRouteBtn.addEventListener('click', handleResumeRoute);
    saveRouteBtn.addEventListener('click', handleSaveRoute);
    cancelRouteBtn.addEventListener('click', handleCancelRoute);

    // Add household form
    document.getElementById('addHouseholdForm').addEventListener('submit', handleAddHousehold);

    // Add meter location form
    document.getElementById('addMeterLocationForm').addEventListener('submit', handleAddMeterLocation);

    // Add water meter form
    document.getElementById('addWaterMeterForm').addEventListener('submit', handleAddWaterMeter);

    // Edit household form
    document.getElementById('editHouseholdForm').addEventListener('submit', handleEditHousehold);

    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

/**
 * Handle search input
 */
async function handleSearch() {
    const query = searchInput.value.trim();
    
    if (!query) {
        searchResults.classList.remove('active');
        return;
    }

    try {
        const results = await householdManager.searchHouseholds(query);
        displaySearchResults(results);
    } catch (error) {
        console.error('Search error:', error);
    }
}

/**
 * Display search results
 */
function displaySearchResults(results) {
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="no-results">No households found</div>';
        searchResults.classList.add('active');
        return;
    }

    const html = results.map(household => `
        <div class="search-result-item" onclick="selectSearchResult(${household.id})">
            <div class="search-result-name">${household.fullName}</div>
            <div class="search-result-details">
                ${household.address ? household.address : 'No address'}
                ${household.meterNumber ? ' • ' + household.meterNumber : ''}
            </div>
        </div>
    `).join('');

    searchResults.innerHTML = html;
    searchResults.classList.add('active');
}

/**
 * Select search result
 */
function selectSearchResult(id) {
    householdManager.flyToHousehold(id);
    searchResults.classList.remove('active');
    searchInput.value = '';
}

/**
 * Open add household modal
 */
function openAddHouseholdModal() {
    if (!currentCapturedLocation) {
        alert('Waiting for GPS location...\nPlease wait for GPS to lock on your position.');
        return;
    }

    // Check GPS accuracy
    const accuracy = gpsTracker.getAccuracy();
    if (accuracy > 50) {
        const proceed = confirm(
            `GPS accuracy is low: ±${Math.round(accuracy)}m\n\n` +
            'For best results, wait for better GPS signal or go outside.\n\n' +
            'Save anyway?'
        );
        if (!proceed) return;
    }

    // Clear form
    document.getElementById('addHouseholdForm').reset();

    // Display captured location
    document.getElementById('capturedLocation').textContent = 
        `Latitude: ${currentCapturedLocation.latitude.toFixed(6)}, Longitude: ${currentCapturedLocation.longitude.toFixed(6)}`;
    document.getElementById('capturedAccuracy').textContent = 
        `Accuracy: ±${Math.round(currentCapturedLocation.accuracy)}m`;

    // Show modal
    document.getElementById('addHouseholdModal').classList.add('active');
}

/**
 * Close add household modal
 */
function closeAddHouseholdModal() {
    document.getElementById('addHouseholdModal').classList.remove('active');
}

/**
 * Handle add household form submission
 */
async function handleAddHousehold(e) {
    e.preventDefault();

    const formData = {
        surname: document.getElementById('surname').value.trim(),
        firstName: document.getElementById('firstName').value.trim(),
        address: document.getElementById('address').value.trim(),
        meterNumber: document.getElementById('meterNumber').value.trim(),
        contactNumber: document.getElementById('contactNumber').value.trim(),
        notes: document.getElementById('notes').value.trim(),
        latitude: currentCapturedLocation.latitude,
        longitude: currentCapturedLocation.longitude,
        gpsAccuracy: currentCapturedLocation.accuracy
    };

    try {
        await householdManager.addHousehold(formData);
        closeAddHouseholdModal();
        alert(`Household added: ${formData.firstName} ${formData.surname}`);
    } catch (error) {
        alert('Failed to add household: ' + error.message);
    }
}

/**
 * Show edit household modal
 */
function showEditHouseholdModal(household) {
    // Populate form
    document.getElementById('editHouseholdId').value = household.id;
    document.getElementById('editSurname').value = household.surname;
    document.getElementById('editFirstName').value = household.firstName;
    document.getElementById('editAddress').value = household.address || '';
    document.getElementById('editMeterNumber').value = household.meterNumber || '';
    document.getElementById('editContactNumber').value = household.contactNumber || '';
    document.getElementById('editNotes').value = household.notes || '';
    document.getElementById('updateLocation').checked = false;

    // Display saved location
    document.getElementById('editSavedLocation').textContent = 
        `Latitude: ${household.latitude.toFixed(6)}, Longitude: ${household.longitude.toFixed(6)}`;
    document.getElementById('editSavedAccuracy').textContent = 
        `Accuracy: ±${Math.round(household.gpsAccuracy || 0)}m`;

    // Show modal
    document.getElementById('editHouseholdModal').classList.add('active');
}
window.showEditHouseholdModal = showEditHouseholdModal;

/**
 * Close edit household modal
 */
function closeEditHouseholdModal() {
    document.getElementById('editHouseholdModal').classList.remove('active');
}

/**
 * Handle edit household form submission
 */
async function handleEditHousehold(e) {
    e.preventDefault();

    const id = parseInt(document.getElementById('editHouseholdId').value);
    const updateLocationChecked = document.getElementById('updateLocation').checked;

    const updates = {
        surname: document.getElementById('editSurname').value.trim(),
        firstName: document.getElementById('editFirstName').value.trim(),
        address: document.getElementById('editAddress').value.trim(),
        meterNumber: document.getElementById('editMeterNumber').value.trim(),
        contactNumber: document.getElementById('editContactNumber').value.trim(),
        notes: document.getElementById('editNotes').value.trim()
    };

    // Update location if requested
    if (updateLocationChecked && currentCapturedLocation) {
        updates.latitude = currentCapturedLocation.latitude;
        updates.longitude = currentCapturedLocation.longitude;
        updates.gpsAccuracy = currentCapturedLocation.accuracy;
    }

    try {
        await householdManager.updateHousehold(id, updates);
        closeEditHouseholdModal();
        alert('Household updated successfully!');
    } catch (error) {
        alert('Failed to update household: ' + error.message);
    }
}

/**
 * Update GPS information in UI
 */
function updateGPSUI() {
    const position = gpsTracker.getCurrentPosition();
    const accuracy = gpsTracker.getAccuracy();

    // Update accuracy display
    if (accuracy !== null) {
        gpsAccuracy.textContent = gpsTracker.getFormattedAccuracy();

        // Enable buttons when GPS is active
        if (!routeRecorder || !routeRecorder.isRecording) {
            addHouseholdBtn.disabled = false;
            addMeterLocationBtn.disabled = false;
        }

        // Enable search
        searchInput.disabled = false;

        // Show start route button
        updateStartRouteButton();
    }

    // Update coordinates display
    if (position) {
        gpsCoordinates.textContent = gpsTracker.getFormattedCoordinates();
    }
}

/**
 * Update status display
 */
function updateStatusDisplay(status, message) {
    // Remove all status classes
    gpsStatusText.className = 'status-text';

    let indicator = '';
    
    switch (status) {
        case 'searching':
            gpsStatusText.classList.add('status-searching');
            indicator = '🟡';
            break;
        case 'active':
            gpsStatusText.classList.add('status-active');
            indicator = '🟢';
            break;
        case 'error':
            gpsStatusText.classList.add('status-error');
            indicator = '🔴';
            addHouseholdBtn.disabled = true;
            break;
        default:
            indicator = '⚪';
    }

    gpsStatusText.innerHTML = `
        <span class="status-indicator">${indicator}</span>
        <span>${message}</span>
    `;
}

/**
 * Close side menu
 */
function closeSideMenu() {
    sideMenu.classList.remove('active');
}

/**
 * Show all households on map
 */
function showAllHouseholds() {
    // Hide water meter locations when viewing households
    meterLocationManager.hide();
    householdManager.showAllHouseholds();
    closeSideMenu();
}

/**
 * Show households list modal
 */
function showHouseholdsList() {
    const households = householdManager.getAllHouseholds();
    const listContainer = document.getElementById('householdsList');

    if (households.length === 0) {
        listContainer.innerHTML = '<div class="no-results">No households saved yet</div>';
    } else {
        const html = households.map(h => `
            <div class="household-item" onclick="selectHouseholdFromList(${h.id})">
                <div class="household-item-name">${h.fullName}</div>
                <div class="household-item-details">
                    ${h.address ? '📍 ' + h.address : ''}
                    ${h.meterNumber ? '<br>🔢 ' + h.meterNumber : ''}
                    ${h.contactNumber ? '<br>📞 ' + h.contactNumber : ''}
                </div>
            </div>
        `).join('');
        listContainer.innerHTML = html;
    }

    document.getElementById('householdsListModal').classList.add('active');
    closeSideMenu();
}

/**
 * Select household from list
 */
function selectHouseholdFromList(id) {
    householdManager.flyToHousehold(id);
    closeHouseholdsListModal();
}

/**
 * Close households list modal
 */
function closeHouseholdsListModal() {
    document.getElementById('householdsListModal').classList.remove('active');
}

/**
 * Export data to JSON
 */
async function exportData() {
    try {
        const jsonData = await householdManager.exportData();
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `households-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert('Data exported successfully!');
        closeSideMenu();
    } catch (error) {
        alert('Export failed: ' + error.message);
    }
}

/**
 * Import data from JSON
 */
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const count = await householdManager.importData(text);
            alert(`Successfully imported ${count} households!`);
            closeSideMenu();
        } catch (error) {
            alert('Import failed: ' + error.message);
        }
    };

    input.click();
}

/**
 * Show about dialog
 */
function showAbout() {
    alert(
        'Household GPS Water Meter Tracker\n\n' +
        'Version 1.0\n\n' +
        'Features:\n' +
        '• Real-time GPS tracking\n' +
        '• Save household locations\n' +
        '• Search by surname\n' +
        '• Navigate to households\n' +
        '• Offline support\n' +
        '• Data backup/restore\n\n' +
        'Built for water meter readers in Barangay Diclum'
    );
    closeSideMenu();
}

/**
 * Close all modals
 */
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    sideMenu.classList.remove('active');
}

/**
 * Handle window load
 */
window.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    registerServiceWorker();
});

// ========== ROUTE RECORDING HANDLERS ==========

/**
 * Start route recording
 */
function handleStartRoute() {
    if (!routeRecorder.startRecording()) {
        return;
    }

    // Hide start button, show controls
    startRouteBtn.classList.add('hidden');
    routeControls.classList.remove('hidden');
    addHouseholdBtn.disabled = true; // Disable while recording
    addMeterLocationBtn.disabled = true; // Disable while recording

    // Start updating route stats
    routeUpdateInterval = setInterval(updateRouteStats, 1000);

    console.log('Route recording started');
}

/**
 * Pause route recording
 */
function handlePauseRoute() {
    routeRecorder.pauseRecording();
    pauseRouteBtn.classList.add('hidden');
    resumeRouteBtn.classList.remove('hidden');
    recordingStatus.textContent = '⏸ PAUSED';
}

/**
 * Resume route recording
 */
function handleResumeRoute() {
    routeRecorder.resumeRecording();
    resumeRouteBtn.classList.add('hidden');
    pauseRouteBtn.classList.remove('hidden');
    recordingStatus.textContent = '● RECORDING';
}

/**
 * Save current route
 */
async function handleSaveRoute() {
    try {
        const routeName = prompt('Route name (optional):') || `Route ${Date.now()}`;
        await routeRecorder.saveRoute(null, routeName);
        
        // Reset UI
        routeControls.classList.add('hidden');
        startRouteBtn.classList.remove('hidden');
        addHouseholdBtn.disabled = false;
        addMeterLocationBtn.disabled = false;
        
        if (routeUpdateInterval) {
            clearInterval(routeUpdateInterval);
            routeUpdateInterval = null;
        }

        alert('Route saved successfully!');
    } catch (error) {
        alert('Failed to save route: ' + error.message);
    }
}

/**
 * Cancel route recording
 */
function handleCancelRoute() {
    if (!confirm('Cancel route recording? All progress will be lost.')) {
        return;
    }

    routeRecorder.cancelRecording();
    
    // Reset UI
    routeControls.classList.add('hidden');
    startRouteBtn.classList.remove('hidden');
    addHouseholdBtn.disabled = false;
    
    if (routeUpdateInterval) {
        clearInterval(routeUpdateInterval);
        routeUpdateInterval = null;
    }
}

/**
 * Update route statistics display
 */
function updateRouteStats() {
    if (!routeRecorder.isRecording) {
        return;
    }

    routeDistance.textContent = routeRecorder.getFormattedDistance();
    routeDuration.textContent = routeRecorder.getFormattedDuration();
}

/**
 * Show start route button when GPS is active and not recording
 */
function updateStartRouteButton() {
    if (gpsTracker.getCurrentPosition() && !routeRecorder.isRecording) {
        startRouteBtn.classList.remove('hidden');
    } else {
        startRouteBtn.classList.add('hidden');
    }
}

// ========== END ROUTE HANDLERS ==========

// ========== WATER METER LOCATION HANDLERS ==========

/**
 * Open add meter location modal
 */
function openAddMeterLocationModal() {
    if (!currentCapturedLocation) {
        alert('Waiting for GPS location...\nPlease wait for GPS to lock on your position.');
        return;
    }

    // Check GPS accuracy
    const accuracy = gpsTracker.getAccuracy();
    if (accuracy > 50) {
        const proceed = confirm(
            `GPS accuracy is low: ±${Math.round(accuracy)}m\n\n` +
            'For best results, wait for better GPS signal or go outside.\n\n' +
            'Save anyway?'
        );
        if (!proceed) return;
    }

    // Clear form
    document.getElementById('addMeterLocationForm').reset();

    // Display captured location
    document.getElementById('meterLocationCaptured').textContent = 
        `Latitude: ${currentCapturedLocation.latitude.toFixed(6)}, Longitude: ${currentCapturedLocation.longitude.toFixed(6)}`;
    document.getElementById('meterLocationAccuracy').textContent = 
        `Accuracy: ±${Math.round(currentCapturedLocation.accuracy)}m`;

    // Show modal
    document.getElementById('addMeterLocationModal').classList.add('active');
}

/**
 * Close add meter location modal
 */
function closeAddMeterLocationModal() {
    document.getElementById('addMeterLocationModal').classList.remove('active');
}

/**
 * Handle add meter location form submission
 */
async function handleAddMeterLocation(e) {
    e.preventDefault();

    const formData = {
        label: document.getElementById('meterLocationLabel').value.trim(),
        notes: document.getElementById('meterLocationNotes').value.trim(),
        latitude: currentCapturedLocation.latitude,
        longitude: currentCapturedLocation.longitude,
        gpsAccuracy: currentCapturedLocation.accuracy
    };

    try {
        await meterLocationManager.addWaterMeterLocation(formData);
        closeAddMeterLocationModal();
        alert(`Meter location added: ${formData.label}\n\nYou can now add water meters to this location.`);
    } catch (error) {
        alert('Failed to add meter location: ' + error.message);
    }
}

/**
 * Show all meter locations on map
 */
function showAllMeterLocations() {
    // Show water meter locations
    meterLocationManager.show();
    meterLocationManager.showAllLocations();
    closeSideMenu();
}

/**
 * Show meter locations list modal
 */
async function showMeterLocationsList() {
    const locationsWithCounts = await meterLocationManager.getAllLocationsWithMeterCounts();
    const listContainer = document.getElementById('meterLocationsList');

    if (locationsWithCounts.length === 0) {
        listContainer.innerHTML = '<div class="no-results">No meter locations saved yet</div>';
    } else {
        const html = locationsWithCounts.map(loc => `
            <div class="meter-location-item" onclick="selectMeterLocationFromList(${loc.id})">
                <div class="meter-location-item-header">
                    <div class="meter-location-item-title">📍 ${loc.label}</div>
                    <div class="meter-location-item-badge">${loc.meterCount} meter${loc.meterCount !== 1 ? 's' : ''}</div>
                </div>
                <div class="meter-location-item-details">
                    ${loc.notes ? loc.notes + '<br>' : ''}
                    GPS: ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)} (±${Math.round(loc.gpsAccuracy || 0)}m)
                </div>
            </div>
        `).join('');
        listContainer.innerHTML = html;
    }

    document.getElementById('meterLocationsListModal').classList.add('active');
    closeSideMenu();
}

/**
 * Select meter location from list
 */
function selectMeterLocationFromList(id) {
    meterLocationManager.flyToLocation(id);
    closeMeterLocationsListModal();
}

/**
 * Close meter locations list modal
 */
function closeMeterLocationsListModal() {
    document.getElementById('meterLocationsListModal').classList.remove('active');
}

/**
 * Show all meters (placeholder for Phase 5)
 */
function showAllMeters() {
    alert('All Water Meters view\n\nTo be implemented in Phase 5: Water Meter Management');
    closeSideMenu();
}

/**
 * Show database statistics
 */
async function showDatabaseStats() {
    try {
        const stats = await database.getDatabaseStatistics();
        
        if (stats) {
            document.getElementById('statHouseholds').textContent = stats.householdCount;
            document.getElementById('statLocations').textContent = stats.locationCount;
            document.getElementById('statMeters').textContent = stats.meterCount;
            document.getElementById('statBilling').textContent = stats.billingRecordCount;
            document.getElementById('statRoutes').textContent = stats.routeCount;
            document.getElementById('statVersion').textContent = `v${stats.databaseVersion}`;
        } else {
            alert('Failed to load database statistics');
            return;
        }

        document.getElementById('databaseStatsModal').classList.add('active');
        closeSideMenu();
    } catch (error) {
        alert('Error loading statistics: ' + error.message);
    }
}

/**
 * Close database statistics modal
 */
function closeDatabaseStatsModal() {
    document.getElementById('databaseStatsModal').classList.remove('active');
}

// ========== END WATER METER LOCATION HANDLERS ==========

// ========== WATER METER HANDLERS ==========

/**
 * Open add water meter modal
 */
async function openAddWaterMeterModal(householdId = null, locationId = null) {
    try {
        // Populate household dropdown
        const households = await database.getAllHouseholds();
        const householdSelect = document.getElementById('waterMeterHousehold');
        householdSelect.innerHTML = '<option value="">-- Select Household --</option>';
        
        households.forEach(h => {
            const option = document.createElement('option');
            option.value = h.id;
            option.textContent = `${h.fullName} - ${h.address || 'No address'}`;
            if (householdId && h.id === householdId) {
                option.selected = true;
            }
            householdSelect.appendChild(option);
        });

        // Populate meter location dropdown
        const locations = await database.getAllWaterMeterLocations();
        const locationSelect = document.getElementById('waterMeterLocation');
        locationSelect.innerHTML = '<option value="">-- No grouped location --</option>';
        
        locations.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.id;
            option.textContent = loc.label;
            if (locationId && loc.id === locationId) {
                option.selected = true;
            }
            locationSelect.appendChild(option);
        });

        // Clear form
        document.getElementById('addWaterMeterForm').reset();
        
        // Re-select if pre-filled
        if (householdId) {
            householdSelect.value = householdId;
        }
        if (locationId) {
            locationSelect.value = locationId;
        }

        // Show modal
        document.getElementById('addWaterMeterModal').classList.add('active');
        closeSideMenu();
    } catch (error) {
        alert('Failed to open add meter modal: ' + error.message);
    }
}

/**
 * Close add water meter modal
 */
function closeAddWaterMeterModal() {
    document.getElementById('addWaterMeterModal').classList.remove('active');
}

/**
 * Handle add water meter form submission
 */
async function handleAddWaterMeter(e) {
    e.preventDefault();

    const meterNumber = document.getElementById('waterMeterNumber').value.trim();
    const ownerName = document.getElementById('waterMeterOwner').value.trim();
    const householdId = parseInt(document.getElementById('waterMeterHousehold').value) || null;
    const locationIdValue = document.getElementById('waterMeterLocation').value;
    const waterMeterLocationId = locationIdValue ? parseInt(locationIdValue) : null;
    const status = document.getElementById('waterMeterStatus').value;
    const notes = document.getElementById('waterMeterNotes').value.trim();

    // Get coordinates from household or location
    let latitude = null;
    let longitude = null;

    if (householdId) {
        const household = await database.getHousehold(householdId);
        latitude = household.latitude;
        longitude = household.longitude;
    } else if (waterMeterLocationId) {
        const location = await database.getWaterMeterLocation(waterMeterLocationId);
        latitude = location.latitude;
        longitude = location.longitude;
    }

    const formData = {
        meterNumber,
        ownerName,
        householdId,
        waterMeterLocationId,
        latitude,
        longitude,
        status,
        notes
    };

    try {
        await waterMeterManager.addWaterMeter(formData);
        closeAddWaterMeterModal();
        alert(`Water meter added: ${meterNumber}\n\nOwner: ${ownerName}\nStatus: ${waterMeterManager.formatStatus(status)}`);
    } catch (error) {
        alert('Failed to add water meter: ' + error.message);
    }
}

/**
 * Show all water meters list
 */
async function showAllWaterMeters() {
    // Show water meter locations when viewing meters
    meterLocationManager.show();
    
    try {
        const metersWithDetails = await waterMeterManager.getAllMetersWithDetails();
        const listContainer = document.getElementById('waterMetersList');

        if (metersWithDetails.length === 0) {
            listContainer.innerHTML = '<div class="no-results">No water meters added yet</div>';
        } else {
            // Add search functionality
            const searchInput = document.getElementById('meterSearchInput');
            searchInput.value = '';
            
            const renderMeters = (meters) => {
                const html = meters.map(meter => {
                    const statusClass = meter.status;
                    const lastReading = meter.previousReading > 0 
                        ? `Last Reading: ${meter.previousReading}` 
                        : 'No readings yet';
                    
                    return `
                        <div class="water-meter-item status-${statusClass}" onclick="showWaterMeterDetail(${meter.id})">
                            <div class="water-meter-item-header">
                                <div class="water-meter-item-title">
                                    💧 ${meter.ownerName}
                                </div>
                                <div class="water-meter-item-status ${statusClass}">
                                    ${waterMeterManager.formatStatus(meter.status)}
                                </div>
                            </div>
                            <div class="water-meter-item-details">
                                <div><strong>Meter #:</strong> ${meter.meterNumber}</div>
                                <div><strong>Household:</strong> ${meter.householdName}</div>
                                <div><strong>Location:</strong> ${meter.locationLabel}</div>
                                <div><strong>${lastReading}</strong></div>
                            </div>
                            ${meter.notes ? `<div class="water-meter-item-meta">${meter.notes}</div>` : ''}
                        </div>
                    `;
                }).join('');
                
                listContainer.innerHTML = html || '<div class="no-results">No meters match your search</div>';
            };

            // Initial render
            renderMeters(metersWithDetails);

            // Search handler
            searchInput.oninput = (e) => {
                const query = e.target.value.toLowerCase().trim();
                if (!query) {
                    renderMeters(metersWithDetails);
                } else {
                    const filtered = metersWithDetails.filter(m => 
                        m.ownerName.toLowerCase().includes(query) ||
                        m.meterNumber.toLowerCase().includes(query) ||
                        m.householdName.toLowerCase().includes(query) ||
                        m.locationLabel.toLowerCase().includes(query)
                    );
                    renderMeters(filtered);
                }
            };
        }

        document.getElementById('waterMetersListModal').classList.add('active');
        closeSideMenu();
    } catch (error) {
        alert('Error loading water meters: ' + error.message);
    }
}

/**
 * Close water meters list modal
 */
function closeWaterMetersListModal() {
    document.getElementById('waterMetersListModal').classList.remove('active');
}

/**
 * Show water meter detail
 */
async function showWaterMeterDetail(meterId) {
    try {
        const details = await waterMeterManager.getMeterWithDetails(meterId);
        
        if (!details) {
            alert('Meter not found');
            return;
        }

        const { meter, household, location, latestBilling } = details;

        const householdInfo = household 
            ? `<strong>${household.fullName}</strong><br>${household.address || 'No address'}`
            : '<em>No household linked</em>';

        const locationInfo = location
            ? `<strong>${location.label}</strong><br>GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
            : '<em>No grouped location</em>';

        const billingInfo = latestBilling
            ? `
                <div class="meter-detail-item">
                    <div class="meter-detail-label">Previous Reading</div>
                    <div class="meter-detail-value large">${latestBilling.previousReading}</div>
                </div>
                <div class="meter-detail-item">
                    <div class="meter-detail-label">Current Reading</div>
                    <div class="meter-detail-value large">${latestBilling.currentReading}</div>
                </div>
                <div class="meter-detail-item">
                    <div class="meter-detail-label">Last Usage</div>
                    <div class="meter-detail-value">${latestBilling.usage} m³</div>
                </div>
                <div class="meter-detail-item">
                    <div class="meter-detail-label">Last Reading Date</div>
                    <div class="meter-detail-value">${new Date(latestBilling.createdAt).toLocaleDateString()}</div>
                </div>
            `
            : '<div class="alert alert-info">No billing records yet. Start by recording a meter reading.</div>';

        const content = `
            <div class="meter-detail-section">
                <h3>Meter Information</h3>
                <div class="meter-detail-grid">
                    <div class="meter-detail-item">
                        <div class="meter-detail-label">Meter Number</div>
                        <div class="meter-detail-value">${meter.meterNumber}</div>
                    </div>
                    <div class="meter-detail-item">
                        <div class="meter-detail-label">Owner</div>
                        <div class="meter-detail-value">${meter.ownerName}</div>
                    </div>
                    <div class="meter-detail-item">
                        <div class="meter-detail-label">Status</div>
                        <div class="meter-detail-value">
                            <span class="meter-badge ${meter.status}">${waterMeterManager.formatStatus(meter.status)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="meter-detail-section">
                <h3>Linked Household</h3>
                <div style="padding: 12px; background: #f8f8f8; border-radius: 6px;">
                    ${householdInfo}
                </div>
            </div>

            <div class="meter-detail-section">
                <h3>Physical Location</h3>
                <div style="padding: 12px; background: #f8f8f8; border-radius: 6px;">
                    ${locationInfo}
                </div>
            </div>

            ${latestBilling ? '<div class="meter-detail-section"><h3>Latest Reading</h3><div class="meter-detail-grid">' + billingInfo + '</div></div>' : billingInfo}

            ${meter.notes ? `
                <div class="meter-detail-section">
                    <h3>Notes</h3>
                    <div style="padding: 12px; background: #f8f8f8; border-radius: 6px;">
                        ${meter.notes}
                    </div>
                </div>
            ` : ''}

            <div class="meter-detail-actions">
                <button class="btn-primary" onclick="startMeterReading(${meter.id})">
                    📊 Start Reading
                </button>
                <button class="btn-secondary" onclick="viewMeterBillingHistory(${meter.id})">
                    📋 Billing History
                </button>
                <button class="btn-secondary" onclick="editWaterMeter(${meter.id})">
                    ✏️ Edit
                </button>
                <button class="btn-delete" onclick="confirmDeleteWaterMeter(${meter.id})">
                    🗑️ Delete
                </button>
            </div>
        `;

        document.getElementById('waterMeterDetailContent').innerHTML = content;
        closeWaterMetersListModal();
        document.getElementById('waterMeterDetailModal').classList.add('active');
    } catch (error) {
        alert('Error loading meter details: ' + error.message);
    }
}

/**
 * Close water meter detail modal
 */
function closeWaterMeterDetailModal() {
    document.getElementById('waterMeterDetailModal').classList.remove('active');
}

/**
 * Start meter reading (Phase 6)
 */
async function startMeterReading(meterId) {
    closeWaterMeterDetailModal();
    
    try {
        // Start reading workflow
        const readingData = await meterReadingManager.startReading(meterId);
        
        if (!readingData) {
            alert('Failed to start reading');
            return;
        }

        // Populate modal with meter info
        document.getElementById('readingMeterNumber').textContent = readingData.meter.meterNumber;
        document.getElementById('readingOwner').textContent = readingData.meter.ownerName;
        document.getElementById('readingAddress').textContent = readingData.household?.address || 'No address';
        
        // Show billing period
        const billingPeriod = meterReadingManager.getCurrentBillingPeriod();
        document.getElementById('readingPeriod').textContent = meterReadingManager.formatBillingPeriod(billingPeriod);
        
        // Show previous reading
        document.getElementById('readingPrevious').textContent = meterReadingManager.formatReading(readingData.previousReading);
        
        if (readingData.previousBillingDate) {
            const lastDate = new Date(readingData.previousBillingDate);
            document.getElementById('readingPreviousDate').textContent = `Last reading: ${lastDate.toLocaleDateString()}`;
            
            const daysSince = meterReadingManager.getDaysSinceLastReading();
            if (daysSince) {
                document.getElementById('readingDaysSince').textContent = `${daysSince} days ago`;
            }
        } else {
            document.getElementById('readingPreviousDate').textContent = 'First reading';
            document.getElementById('readingDaysSince').textContent = '';
        }

        // Clear form
        document.getElementById('currentReadingInput').value = '';
        document.getElementById('usageDisplay').classList.add('hidden');
        document.getElementById('calculateUsageBtn').classList.remove('hidden');
        document.getElementById('proceedToBillingBtn').classList.add('hidden');
        document.getElementById('readingWarning').classList.add('hidden');
        document.getElementById('readingSuspicious').classList.add('hidden');

        // Remove usage classes
        const usageDisplay = document.getElementById('usageDisplay');
        usageDisplay.classList.remove('zero-usage', 'high-usage');

        // Show modal
        document.getElementById('meterReadingModal').classList.add('active');
        
        // Focus input
        setTimeout(() => {
            document.getElementById('currentReadingInput').focus();
        }, 100);
    } catch (error) {
        alert('Error starting meter reading: ' + error.message);
    }
}

/**
 * Close meter reading modal
 */
function closeMeterReadingModal() {
    document.getElementById('meterReadingModal').classList.remove('active');
    meterReadingManager.clearCurrentReading();
}

/**
 * Calculate usage from entered reading
 */
function calculateUsage() {
    const currentReadingInput = document.getElementById('currentReadingInput');
    const currentReading = parseFloat(currentReadingInput.value);

    if (isNaN(currentReading) || currentReading < 0) {
        alert('Please enter a valid reading');
        currentReadingInput.focus();
        return;
    }

    try {
        // Set current reading and calculate usage
        const result = meterReadingManager.setCurrentReading(currentReading);
        
        // Display usage
        const usageDisplay = document.getElementById('usageDisplay');
        const usageValue = document.getElementById('usageValue');
        
        usageValue.textContent = `${meterReadingManager.formatReading(result.usage)} m³`;
        usageDisplay.classList.remove('hidden', 'zero-usage', 'high-usage');

        // Show average daily usage if available
        const avgDaily = meterReadingManager.getAverageDailyUsage();
        if (avgDaily) {
            document.getElementById('usageAvgDaily').textContent = `Average: ${avgDaily} m³/day`;
        } else {
            document.getElementById('usageAvgDaily').textContent = '';
        }

        // Check for zero usage
        if (result.usage === 0) {
            usageDisplay.classList.add('zero-usage');
        }

        // Check for suspicious readings
        const suspicious = meterReadingManager.isSuspiciousReading();
        const suspiciousDiv = document.getElementById('readingSuspicious');
        
        if (suspicious.suspicious) {
            suspiciousDiv.textContent = '⚠️ ' + suspicious.reason;
            suspiciousDiv.classList.remove('hidden');
            
            if (result.usage > 100) {
                usageDisplay.classList.add('high-usage');
            }
        } else {
            suspiciousDiv.classList.add('hidden');
        }

        // Hide calculate button, show proceed button
        document.getElementById('calculateUsageBtn').classList.add('hidden');
        document.getElementById('proceedToBillingBtn').classList.remove('hidden');
        
        console.log('Usage calculated:', result);
    } catch (error) {
        const warningDiv = document.getElementById('readingWarning');
        warningDiv.textContent = error.message;
        warningDiv.classList.remove('hidden');
        currentReadingInput.focus();
    }
}

/**
 * Proceed to billing (Phase 7)
 */
async function proceedToBilling() {
    try {
        const readingData = meterReadingManager.prepareForSave();
        
        // Calculate bill
        const bill = await billingManager.calculateBill(readingData);
        
        if (!bill) {
            alert('Failed to calculate bill');
            return;
        }

        // Close reading modal
        closeMeterReadingModal();

        // Display bill review
        showBillingReview(bill);
    } catch (error) {
        alert('Error calculating bill: ' + error.message);
    }
}

/**
 * Show billing review modal
 */
function showBillingReview(bill) {
    const summary = billingManager.getBillSummary();
    const breakdown = billingManager.getChargeBreakdown();

    // Account Information
    document.getElementById('billAccountName').textContent = summary.fullName;
    document.getElementById('billMeterNumber').textContent = summary.meterNumber;
    document.getElementById('billAddress').textContent = summary.address;
    document.getElementById('billPeriod').textContent = meterReadingManager.formatBillingPeriod(bill.billingPeriod);
    document.getElementById('billReadingDate').textContent = summary.readingDate;

    // Meter Readings
    document.getElementById('billPreviousReading').textContent = summary.previousReading;
    document.getElementById('billCurrentReading').textContent = summary.currentReading;
    document.getElementById('billUsage').textContent = summary.usage;

    // Charge Breakdown
    document.getElementById('billMinimumCharge').textContent = breakdown.minimumCharge.formatted;
    document.getElementById('billUsageChargeLabel').textContent = breakdown.usageCharge.label;
    document.getElementById('billUsageCharge').textContent = breakdown.usageCharge.formatted;
    document.getElementById('billCurrentAmount').textContent = breakdown.currentBill.formatted;
    document.getElementById('billArrears').textContent = breakdown.arrears.formatted;
    document.getElementById('billTotalDue').textContent = breakdown.totalDue.formatted;

    // Payment Information
    document.getElementById('billDueDate').textContent = summary.dueDate;
    document.getElementById('billDisconnectionDate').textContent = summary.disconnectionDate;
    
    const daysUntilDueEl = document.getElementById('billDaysUntilDue');
    if (summary.overdue) {
        daysUntilDueEl.textContent = 'OVERDUE!';
        daysUntilDueEl.classList.add('overdue');
    } else if (summary.daysUntilDue <= 3) {
        daysUntilDueEl.textContent = `${summary.daysUntilDue} days remaining`;
        daysUntilDueEl.style.color = '#FF9800';
    } else {
        daysUntilDueEl.textContent = `${summary.daysUntilDue} days`;
        daysUntilDueEl.classList.remove('overdue');
    }

    // Hide print button until saved
    document.getElementById('printBillBtn').classList.add('hidden');

    // Show modal
    document.getElementById('billingReviewModal').classList.add('active');
}

/**
 * Close billing review modal
 */
function closeBillingReviewModal() {
    document.getElementById('billingReviewModal').classList.remove('active');
}

/**
 * Confirm and save bill
 */
async function confirmAndSaveBill() {
    try {
        const confirmed = confirm(
            'Save this billing record?\n\n' +
            'This will create a permanent billing record for this meter.\n\n' +
            'Continue?'
        );

        if (!confirmed) {
            return;
        }

        // Save billing record
        const savedBill = await billingManager.saveBillingRecord();
        
        if (!savedBill) {
            alert('Failed to save billing record');
            return;
        }

        // Store the saved bill ID for printing
        window.lastSavedBillId = savedBill.id;

        // Show success message
        const summary = billingManager.getBillSummary();
        alert(
            `✅ Bill Saved Successfully!\n\n` +
            `Meter: ${summary.meterNumber}\n` +
            `Owner: ${summary.ownerName}\n` +
            `Period: ${meterReadingManager.formatBillingPeriod(savedBill.billingPeriod)}\n\n` +
            `Total Due: ${summary.totalDue}\n` +
            `Due Date: ${summary.dueDate}\n\n` +
            `Bill ID: ${savedBill.id}`
        );

        // Show print button
        document.getElementById('printBillBtn').classList.remove('hidden');

        // Clear managers
        meterReadingManager.clearCurrentReading();
        billingManager.clearCurrentBill();

        // Close modal after short delay
        setTimeout(() => {
            closeBillingReviewModal();
        }, 500);
    } catch (error) {
        alert('Error saving bill: ' + error.message);
    }
}

/**
 * Print bill (Phase 8)
 */
async function printBill() {
    try {
        // Get the saved billing record ID
        const billingRecordId = window.lastSavedBillId;
        
        if (!billingRecordId) {
            alert('⚠️ No billing record found. Please save the bill first.');
            return;
        }
        
        // Generate and display the print preview
        await printerService.printBill(billingRecordId);
        
        // Close the billing review modal
        closeBillingReviewModal();
        
    } catch (error) {
        console.error('Failed to print bill:', error);
        alert('❌ Failed to generate bill print: ' + error.message);
    }
}

/**
 * View meter billing history (Phase 7)
 */
async function viewMeterBillingHistory(meterId) {
    closeWaterMeterDetailModal();
    
    try {
        const billingRecords = await database.getBillingRecordsByMeter(meterId);
        const meter = await database.getWaterMeter(meterId);
        
        if (billingRecords.length === 0) {
            alert(`No billing history for meter ${meter.meterNumber}\n\nStart by recording a meter reading to create the first bill.`);
            return;
        }

        // Format billing history
        let historyText = `📋 Billing History\n`;
        historyText += `Meter: ${meter.meterNumber}\n`;
        historyText += `Owner: ${meter.ownerName}\n`;
        historyText += `\n`;
        historyText += `Total Records: ${billingRecords.length}\n`;
        historyText += `\n`;
        historyText += `Recent Bills:\n`;
        historyText += `─────────────────\n`;

        billingRecords.slice(0, 5).forEach((bill, index) => {
            const date = new Date(bill.createdAt).toLocaleDateString();
            historyText += `\n${index + 1}. ${meterReadingManager.formatBillingPeriod(bill.billingPeriod)}\n`;
            historyText += `   Date: ${date}\n`;
            historyText += `   Reading: ${bill.previousReading} → ${bill.currentReading} (${bill.usage} m³)\n`;
            historyText += `   Bill: ${billingManager.formatCurrency(bill.currentBill)}\n`;
            historyText += `   Total Due: ${billingManager.formatCurrency(bill.totalDue)}\n`;
        });

        if (billingRecords.length > 5) {
            historyText += `\n... and ${billingRecords.length - 5} more records`;
        }

        alert(historyText);
    } catch (error) {
        alert('Error loading billing history: ' + error.message);
    }
}

/**
 * Edit water meter (placeholder)
 */
function editWaterMeter(meterId) {
    alert(`Edit Water Meter ID: ${meterId}\n\nEdit functionality to be implemented\n\nWill allow changing:\n- Owner name\n- Meter number\n- Status\n- Linked household\n- Location\n- Notes`);
}

/**
 * Confirm delete water meter
 */
async function confirmDeleteWaterMeter(meterId) {
    const meter = waterMeterManager.getMeter(meterId);
    if (!meter) return;

    if (confirm(`Delete water meter: ${meter.meterNumber}?\n\nOwner: ${meter.ownerName}\n\nThis will fail if there are billing records.`)) {
        try {
            await waterMeterManager.deleteWaterMeter(meterId);
            closeWaterMeterDetailModal();
            alert('Water meter deleted successfully!');
        } catch (error) {
            alert('Failed to delete water meter: ' + error.message);
        }
    }
}

// ========== END WATER METER HANDLERS ==========

/**
 * Register service worker for PWA support
 */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker registered:', registration);

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker available, prompt user to refresh
                        if (confirm('New version available! Reload to update?')) {
                            window.location.reload();
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
}

/**
 * Handle window unload - cleanup
 */
window.addEventListener('beforeunload', () => {
    gpsTracker.stopTracking();
});

/**
 * Handle online/offline status
 */
window.addEventListener('online', () => {
    console.log('App is online');
});

window.addEventListener('offline', () => {
    console.log('App is offline - IndexedDB still works!');
});


// Setup compass heading callback
if (gpsTracker.callbacks) {
    gpsTracker.callbacks.onHeadingUpdate = (heading) => {
        if (mapManager && mapManager.updateHeading) {
            mapManager.updateHeading(heading);
        }
    };
}
