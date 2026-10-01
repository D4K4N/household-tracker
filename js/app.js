/**
 * App.js - Main Application Controller
 * Coordinates GPS tracking, map display, database, households, and UI
 */

// Initialize modules
const gpsTracker = new GPSTracker();
const mapManager = new MapManager();
const database = new HouseholdDatabase();
let householdManager;

// UI Elements
let gpsStatusText;
let gpsAccuracy;
let gpsCoordinates;
let myLocationBtn;
let addHouseholdBtn;
let searchInput;
let searchResults;
let menuBtn;
let sideMenu;

// State
let currentCapturedLocation = null;

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
    searchInput = document.getElementById('searchInput');
    searchResults = document.getElementById('searchResults');
    menuBtn = document.getElementById('menuBtn');
    sideMenu = document.getElementById('sideMenu');

    // Initialize map
    mapManager.initialize('map');

    // Initialize database
    try {
        await database.init();
        
        // Initialize household manager
        householdManager = new HouseholdManager(mapManager, database);
        window.householdManager = householdManager; // Make globally accessible
        
        await householdManager.initialize();
        
        console.log('Database and households initialized');
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

    // Add household form
    document.getElementById('addHouseholdForm').addEventListener('submit', handleAddHousehold);

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

        // Enable Add Household button when GPS is active
        addHouseholdBtn.disabled = false;

        // Enable search
        searchInput.disabled = false;
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
