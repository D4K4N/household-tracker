/**
 * Map.js - Leaflet Map Module
 * Handles map initialization and marker management
 */

class MapManager {
    constructor() {
        this.map = null;
        this.currentLocationMarker = null;
        this.currentLocationCircle = null;
        this.isInitialized = false;
        this.gpsPath = null; // Track GPS path
        this.pathCoordinates = []; // Store GPS coordinates for path
        this.routeLine = null; // Line to selected household
        this.offlineNotificationShown = false; // Track offline notification
        this.currentHeading = 0; // Store device heading/direction
        
        // Barangay Diclum center coordinates
        this.diclumCenter = [8.3676, 124.8591];
        this.defaultZoom = 18; // Increased from 15 for closer view
        
        // Increased zoom limits for closer viewing
        this.minZoom = 3;
        this.maxZoom = 22; // Increased from 19 to allow very close zoom
    }

    /**
     * Initialize the Leaflet map
     */
    initialize(containerId = 'map') {
        if (this.isInitialized) {
            console.log('Map already initialized');
            return;
        }

        // Create map centered on Diclum (full interactivity like Google Maps)
        this.map = L.map(containerId, {
            zoomControl: false,
            attributionControl: true,
            minZoom: this.minZoom,
            maxZoom: this.maxZoom,
            
            // Touch gestures (pinch zoom, rotate)
            touchZoom: true,
            doubleClickZoom: true,
            scrollWheelZoom: true,
            boxZoom: true,
            
            // Smooth animations
            zoomAnimation: true,
            fadeAnimation: true,
            markerZoomAnimation: true,
            
            // Enable dragging/panning
            dragging: true,
            
            // Inertia (momentum scrolling like Google Maps)
            inertia: true,
            inertiaDeceleration: 3000,
            inertiaMaxSpeed: 1500,
            
            // Bounce effect when reaching edges
            worldCopyJump: true,
            
            // Tap interactions
            tap: true,
            tapTolerance: 15
        }).setView(this.diclumCenter, this.defaultZoom);

        // Add rotation capability
        this.mapRotation = 0; // Current map rotation in degrees
        this.enableMapRotation();

        // Define base layers with higher quality tiles
        this.streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 22,
            maxNativeZoom: 19,
            minZoom: 3,
            crossOrigin: true
        });
        
        // Google Satellite - High quality
        this.googleSatLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google',
            maxZoom: 22,
            maxNativeZoom: 20,
            minZoom: 3,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        });
        
        // Google Hybrid (Satellite + Labels) - BEST FOR FIELD WORK
        this.googleHybridLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google',
            maxZoom: 22,
            maxNativeZoom: 20,
            minZoom: 3,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        });
        
        // Esri Satellite (backup)
        this.esriSatLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri',
            maxZoom: 22,
            maxNativeZoom: 19,
            minZoom: 3,
            crossOrigin: true
        });
        
        // Start with Google Hybrid (best for navigation)
        this.currentLayer = this.googleHybridLayer;
        this.googleHybridLayer.addTo(this.map);
        
        // Store reference for layer control
        this.baseLayers = {
            'Google Hybrid': this.googleHybridLayer,
            'Google Satellite': this.googleSatLayer,
            'Street Map': this.streetLayer,
            'Esri Satellite': this.esriSatLayer
        };
        
        // Add layer control
        L.control.layers(this.baseLayers, null, {
            position: 'topright'
        }).addTo(this.map);
        
        // Detect when tiles fail to load (offline)
        this.streetLayer.on('tileerror', () => this.showOfflineNotification());
        this.googleSatLayer.on('tileerror', () => this.showOfflineNotification());
        this.googleHybridLayer.on('tileerror', () => this.showOfflineNotification());
        this.esriSatLayer.on('tileerror', () => this.showOfflineNotification());
        
        // Detect when tiles load successfully
        this.streetLayer.on('load', () => this.hideOfflineNotification());
        this.googleSatLayer.on('load', () => this.hideOfflineNotification());
        this.googleHybridLayer.on('load', () => this.hideOfflineNotification());
        this.esriSatLayer.on('load', () => this.hideOfflineNotification());

        // Add zoom control to bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);
        
        // Add rotation controls
        this.addRotationControls();
        
        // Enhanced zoom functionality
        this.enhanceZoomControls();

        this.isInitialized = true;
        console.log('Map initialized - Barangay Diclum, Manolo Fortich');
    }

    /**
     * Update or create current location marker
     */
    updateCurrentLocation(latitude, longitude, accuracy) {
        if (!this.isInitialized) {
            console.error('Map not initialized');
            return;
        }

        const latlng = [latitude, longitude];

        // Add to GPS path
        this.pathCoordinates.push(latlng);
        
        // Keep only last 100 points to avoid memory issues
        if (this.pathCoordinates.length > 100) {
            this.pathCoordinates.shift();
        }

        // Draw GPS path (shows where you've walked)
        if (this.gpsPath) {
            this.map.removeLayer(this.gpsPath);
        }
        
        if (this.pathCoordinates.length > 1) {
            this.gpsPath = L.polyline(this.pathCoordinates, {
                color: '#2196F3',
                weight: 3,
                opacity: 0.6,
                dashArray: '5, 5'
            }).addTo(this.map);
        }

        // If marker doesn't exist, create it
        if (!this.currentLocationMarker) {
            // Create custom directional arrow icon
            const arrowIcon = L.divIcon({
                className: 'current-location-arrow',
                html: `
                    <div style="
                        width: 40px;
                        height: 40px;
                        position: relative;
                        transform: rotate(${this.currentHeading}deg);
                        transition: transform 0.3s ease;
                    ">
                        <svg width="40" height="40" viewBox="0 0 40 40" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                            <!-- Arrow pointer -->
                            <path d="M 20 5 L 28 25 L 20 20 L 12 25 Z" 
                                  fill="#2196F3" 
                                  stroke="white" 
                                  stroke-width="2"/>
                            <!-- Center dot -->
                            <circle cx="20" cy="20" r="4" 
                                    fill="white" 
                                    stroke="#2196F3" 
                                    stroke-width="2"/>
                        </svg>
                    </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });

            // Create marker
            this.currentLocationMarker = L.marker(latlng, {
                icon: arrowIcon,
                zIndexOffset: 1000,
                rotationAngle: this.currentHeading
            }).addTo(this.map);

            // Create accuracy circle (thinner, more subtle)
            this.currentLocationCircle = L.circle(latlng, {
                radius: accuracy,
                color: '#2196F3',
                fillColor: '#2196F3',
                fillOpacity: 0.08,
                weight: 1,
                opacity: 0.4
            }).addTo(this.map);

            // Center map on first location with closer zoom
            this.map.setView(latlng, this.defaultZoom);

            console.log('Current location arrow marker created');
        } else {
            // Update existing marker position and rotation
            this.currentLocationMarker.setLatLng(latlng);
            
            // Update arrow rotation
            const arrowIcon = L.divIcon({
                className: 'current-location-arrow',
                html: `
                    <div style="
                        width: 40px;
                        height: 40px;
                        position: relative;
                        transform: rotate(${this.currentHeading}deg);
                        transition: transform 0.3s ease;
                    ">
                        <svg width="40" height="40" viewBox="0 0 40 40" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                            <path d="M 20 5 L 28 25 L 20 20 L 12 25 Z" 
                                  fill="#2196F3" 
                                  stroke="white" 
                                  stroke-width="2"/>
                            <circle cx="20" cy="20" r="4" 
                                    fill="white" 
                                    stroke="#2196F3" 
                                    stroke-width="2"/>
                        </svg>
                    </div>
                `,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });
            this.currentLocationMarker.setIcon(arrowIcon);
            
            // Update accuracy circle
            if (this.currentLocationCircle) {
                this.currentLocationCircle.setLatLng(latlng);
                this.currentLocationCircle.setRadius(accuracy);
            }

            console.log('Current location arrow updated');
        }
    }

    /**
     * Update heading/direction of arrow
     */
    updateHeading(heading) {
        this.currentHeading = heading;
        if (this.currentLocationMarker) {
            const latlng = this.currentLocationMarker.getLatLng();
            this.updateCurrentLocation(latlng.lat, latlng.lng, 
                this.currentLocationCircle ? this.currentLocationCircle.getRadius() : 10);
        }
    }

    /**
     * Center map on current location
     */
    centerOnCurrentLocation() {
        if (this.currentLocationMarker) {
            const latlng = this.currentLocationMarker.getLatLng();
            this.map.flyTo(latlng, this.defaultZoom, {
                duration: 0.5
            });
            console.log('Map centered on current location');
        } else {
            console.log('No current location to center on');
        }
    }

    /**
     * Fly to specific coordinates
     */
    flyTo(latitude, longitude, zoom = null) {
        if (!this.isInitialized) {
            console.error('Map not initialized');
            return;
        }

        this.map.flyTo([latitude, longitude], zoom || this.defaultZoom, {
            duration: 1
        });
    }

    /**
     * Draw route line from current location to household
     */
    drawRouteToHousehold(householdLat, householdLng) {
        // Remove existing route
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
        }

        // Get current location
        if (!this.currentLocationMarker) {
            console.log('No current location available');
            return;
        }

        const currentLatLng = this.currentLocationMarker.getLatLng();
        const householdLatLng = [householdLat, householdLng];

        // Draw straight line route
        this.routeLine = L.polyline([
            [currentLatLng.lat, currentLatLng.lng],
            householdLatLng
        ], {
            color: '#FF4444',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 10'
        }).addTo(this.map);

        // Calculate distance
        const distance = this.map.distance(currentLatLng, householdLatLng);
        const distanceText = distance < 1000 
            ? `${Math.round(distance)}m away` 
            : `${(distance / 1000).toFixed(2)}km away`;

        // Show route info
        console.log(`Route drawn: ${distanceText}`);

        // Fit map to show both points
        this.map.fitBounds([
            [currentLatLng.lat, currentLatLng.lng],
            householdLatLng
        ], { padding: [50, 50] });

        return distanceText;
    }

    /**
     * Draw routes between households and their meter locations
     */
    async drawHouseToMeterRoutes(households, meterLocations, database) {
        // Clear any existing house-to-meter routes
        this.clearHouseToMeterRoutes();
        
        // Initialize storage for house-to-meter routes
        if (!this.houseToMeterRoutes) {
            this.houseToMeterRoutes = [];
        }

        const drawnRoutes = [];

        for (const household of households) {
            try {
                // Get meters for this household
                const householdMeters = await database.getWaterMetersByHousehold(household.id);
                
                // Draw routes to actual meter locations
                for (const meter of householdMeters) {
                    if (meter.waterMeterLocationId) {
                        const meterLocation = meterLocations.find(loc => loc.id === meter.waterMeterLocationId);
                        if (meterLocation) {
                            const route = this.drawSingleHouseToMeterRoute(household, meterLocation, meter);
                            if (route) {
                                this.houseToMeterRoutes.push(route);
                                drawnRoutes.push({
                                    household: household,
                                    meterLocation: meterLocation,
                                    meter: meter,
                                    distance: route.distance,
                                    line: route.line
                                });
                            }
                        }
                    }
                }

                // If no meters found by household ID, try matching by name
                if (householdMeters.length === 0) {
                    const allMeters = await database.getAllWaterMeters();
                    const nameMatchingMeters = allMeters.filter(meter => 
                        meter.ownerName && 
                        meter.ownerName.toLowerCase().includes(household.surname.toLowerCase())
                    );

                    for (const meter of nameMatchingMeters) {
                        if (meter.waterMeterLocationId) {
                            const meterLocation = meterLocations.find(loc => loc.id === meter.waterMeterLocationId);
                            if (meterLocation) {
                                const route = this.drawSingleHouseToMeterRoute(household, meterLocation, meter);
                                if (route) {
                                    this.houseToMeterRoutes.push(route);
                                    drawnRoutes.push({
                                        household: household,
                                        meterLocation: meterLocation,
                                        meter: meter,
                                        distance: route.distance,
                                        line: route.line
                                    });
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error drawing route for household:', household.fullName, error);
            }
        }

        console.log(`Drew ${drawnRoutes.length} house-to-meter routes`);
        return drawnRoutes;
    }

    /**
     * Draw a single route line between house and meter location
     */
    drawSingleHouseToMeterRoute(household, meterLocation, meter = null) {
        const houseLatLng = [household.latitude, household.longitude];
        const meterLatLng = [meterLocation.latitude, meterLocation.longitude];

        // Calculate distance
        const distance = this.calculateDistance(
            household.latitude, household.longitude,
            meterLocation.latitude, meterLocation.longitude
        );

        // Draw the route line
        const routeLine = L.polyline([houseLatLng, meterLatLng], {
            color: '#2196F3',        // Blue color to distinguish from GPS route
            weight: 3,
            opacity: 0.8,
            dashArray: '8, 5'        // Dashed line
        }).addTo(this.map);

        // Add distance label at midpoint
        const midLat = (household.latitude + meterLocation.latitude) / 2;
        const midLng = (household.longitude + meterLocation.longitude) / 2;
        
        const distanceText = distance < 1000 
            ? `${Math.round(distance)}m` 
            : `${(distance / 1000).toFixed(2)}km`;

        const meterInfo = meter ? ` (${meter.meterNumber})` : '';

        const distanceLabel = L.marker([midLat, midLng], {
            icon: L.divIcon({
                className: 'distance-label',
                html: `<div style="
                    background: rgba(33, 150, 243, 0.9);
                    border: 2px solid white;
                    border-radius: 15px;
                    padding: 3px 10px;
                    font-size: 11px;
                    font-weight: bold;
                    color: white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                    white-space: nowrap;
                    text-align: center;
                ">${distanceText}${meterInfo}</div>`,
                iconSize: [80, 24],
                iconAnchor: [40, 12]
            })
        }).addTo(this.map);

        return {
            line: routeLine,
            label: distanceLabel,
            distance: distanceText,
            distanceMeters: distance
        };
    }

    /**
     * Calculate distance between two points in meters
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI/180; // φ, λ in radians
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lng2-lng1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // Distance in meters
    }

    /**
     * Clear all house-to-meter routes
     */
    clearHouseToMeterRoutes() {
        if (this.houseToMeterRoutes) {
            this.houseToMeterRoutes.forEach(route => {
                if (route.line) this.map.removeLayer(route.line);
                if (route.label) this.map.removeLayer(route.label);
            });
            this.houseToMeterRoutes = [];
        }
    }

    /**
     * Clear route line
     */
    clearRoute() {
        // Clear GPS to household route
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
            this.routeLine = null;
        }
        
        // Clear house to meter routes
        this.clearHouseToMeterRoutes();
    }

    /**
     * Get map instance (for advanced operations)
     */
    getMap() {
        return this.map;
    }

    /**
     * Enable map rotation functionality
     */
    enableMapRotation() {
        this.mapRotation = 0;
        this.isRotating = false;
        this.rotationStartX = 0;
        this.rotationStartAngle = 0;
        
        // Add rotation event listeners
        const mapContainer = this.map.getContainer();
        
        // Two-finger rotation for touch devices
        let touches = [];
        let initialAngle = 0;
        
        mapContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                touches = Array.from(e.touches);
                initialAngle = this.getTouchAngle(touches[0], touches[1]);
                this.rotationStartAngle = this.mapRotation;
            }
        });
        
        mapContainer.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && touches.length === 2) {
                e.preventDefault();
                const currentAngle = this.getTouchAngle(e.touches[0], e.touches[1]);
                const angleDiff = currentAngle - initialAngle;
                this.rotateMap(this.rotationStartAngle + angleDiff);
            }
        });
        
        // Keyboard rotation (Shift + Arrow keys)
        document.addEventListener('keydown', (e) => {
            if (e.shiftKey) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.rotateMap(this.mapRotation - 15);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.rotateMap(this.mapRotation + 15);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.resetRotation();
                }
            }
        });
    }
    
    /**
     * Calculate angle between two touch points
     */
    getTouchAngle(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.atan2(dy, dx) * 180 / Math.PI;
    }
    
    /**
     * Rotate the map to specified angle
     */
    rotateMap(angle) {
        // Normalize angle to 0-360 range
        this.mapRotation = ((angle % 360) + 360) % 360;
        
        // Apply CSS transform to map container
        const mapPane = this.map.getPane('mapPane');
        if (mapPane) {
            mapPane.style.transform = `rotate(${this.mapRotation}deg)`;
            mapPane.style.transformOrigin = 'center center';
        }
        
        // Update compass display
        this.updateCompass();
        
        console.log(`Map rotated to ${this.mapRotation.toFixed(1)}°`);
    }
    
    /**
     * Reset map rotation to north
     */
    resetRotation() {
        this.rotateMap(0);
    }
    
    /**
     * Add rotation controls to map
     */
    addRotationControls() {
        // Create rotation control
        const RotationControl = L.Control.extend({
            options: {
                position: 'topright'
            },
            
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'leaflet-bar rotation-control');
                
                // Compass button (shows current rotation, click to reset)
                this.compassButton = L.DomUtil.create('a', 'compass-button', container);
                this.compassButton.href = '#';
                this.compassButton.title = 'Reset rotation (Shift + ↑)';
                this.compassButton.innerHTML = `
                    <div style="
                        width: 30px;
                        height: 30px;
                        position: relative;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 16px;
                    ">
                        <span style="transform: rotate(0deg); transition: transform 0.3s ease;">🧭</span>
                    </div>
                `;
                
                // Rotate left button
                this.leftButton = L.DomUtil.create('a', 'rotate-left-button', container);
                this.leftButton.href = '#';
                this.leftButton.title = 'Rotate left (Shift + ←)';
                this.leftButton.innerHTML = '↶';
                this.leftButton.style.cssText = `
                    display: block;
                    width: 30px;
                    height: 30px;
                    line-height: 30px;
                    text-align: center;
                    font-size: 18px;
                    text-decoration: none;
                    color: #333;
                    border-top: 1px solid #ccc;
                `;
                
                // Rotate right button
                this.rightButton = L.DomUtil.create('a', 'rotate-right-button', container);
                this.rightButton.href = '#';
                this.rightButton.title = 'Rotate right (Shift + →)';
                this.rightButton.innerHTML = '↷';
                this.rightButton.style.cssText = `
                    display: block;
                    width: 30px;
                    height: 30px;
                    line-height: 30px;
                    text-align: center;
                    font-size: 18px;
                    text-decoration: none;
                    color: #333;
                    border-top: 1px solid #ccc;
                `;
                
                // Prevent map events on control
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                
                return container;
            }
        });
        
        this.rotationControl = new RotationControl();
        this.rotationControl.addTo(this.map);
        
        // Bind events
        const mapManager = this;
        
        this.rotationControl.compassButton.onclick = function(e) {
            e.preventDefault();
            mapManager.resetRotation();
        };
        
        this.rotationControl.leftButton.onclick = function(e) {
            e.preventDefault();
            mapManager.rotateMap(mapManager.mapRotation - 15);
        };
        
        this.rotationControl.rightButton.onclick = function(e) {
            e.preventDefault();
            mapManager.rotateMap(mapManager.mapRotation + 15);
        };
    }
    
    /**
     * Update compass display
     */
    updateCompass() {
        if (this.rotationControl && this.rotationControl.compassButton) {
            const compass = this.rotationControl.compassButton.querySelector('span');
            if (compass) {
                compass.style.transform = `rotate(${-this.mapRotation}deg)`;
            }
        }
    }
    
    /**
     * Enhanced zoom controls with smooth animations
     */
    enhanceZoomControls() {
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Don't interfere if user is typing
            if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea') {
                return;
            }
            
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                this.smoothZoomIn();
            } else if (e.key === '-') {
                e.preventDefault();
                this.smoothZoomOut();
            } else if (e.key === '0') {
                e.preventDefault();
                this.resetToDefaultView();
            }
        });
        
        // Enhanced scroll wheel zoom with momentum
        this.map.getContainer().addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.5 : 0.5;
                const targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.map.getZoom() + delta));
                
                this.map.setZoom(targetZoom, {
                    animate: true,
                    duration: 0.25
                });
            }
        }, { passive: false });
        
        console.log('Enhanced zoom controls enabled (Keyboard: +/- to zoom, 0 to reset, Ctrl+scroll for fine zoom)');
        
        // Show help tooltip on first load
        this.showMapControlsHelp();
    }
    
    /**
     * Smooth zoom in
     */
    smoothZoomIn() {
        const currentZoom = this.map.getZoom();
        const targetZoom = Math.min(this.maxZoom, currentZoom + 1);
        
        this.map.setZoom(targetZoom, {
            animate: true,
            duration: 0.3
        });
    }
    
    /**
     * Smooth zoom out
     */
    smoothZoomOut() {
        const currentZoom = this.map.getZoom();
        const targetZoom = Math.max(this.minZoom, currentZoom - 1);
        
        this.map.setZoom(targetZoom, {
            animate: true,
            duration: 0.3
        });
    }
    
    /**
     * Reset to default view
     */
    resetToDefaultView() {
        this.resetRotation();
        this.map.setView(this.diclumCenter, this.defaultZoom, {
            animate: true,
            duration: 0.5
        });
        console.log('Reset to default view (Diclum center)');
    }
    
    /**
     * Show map controls help (first time only)
     */
    showMapControlsHelp() {
        // Check if help was already shown
        if (localStorage.getItem('mapControlsHelpShown')) {
            return;
        }
        
        setTimeout(() => {
            const helpText = `🗺️ Enhanced Map Controls:

🔄 Rotation:
• Two fingers: Rotate on touch devices
• Shift + ← →: Rotate with keyboard
• Shift + ↑: Reset rotation
• 🧭 button: Reset rotation

🔍 Zoom:
• + / -: Zoom in/out
• 0: Reset to center
• Ctrl + scroll: Fine zoom control

Tap OK to dismiss this help.`;

            if (confirm(helpText)) {
                localStorage.setItem('mapControlsHelpShown', 'true');
            }
        }, 2000); // Show after 2 seconds
    }

    /**
     * Check if map is initialized
     */
    isMapInitialized() {
        return this.isInitialized;
    }

    /**
     * Get current location coordinates
     */
    getCurrentLocationCoordinates() {
        if (this.currentLocationMarker) {
            const latlng = this.currentLocationMarker.getLatLng();
            return {
                latitude: latlng.lat,
                longitude: latlng.lng
            };
        }
        return null;
    }

    /**
     * Show offline map notification
     */
    showOfflineNotification() {
        if (this.offlineNotificationShown) return;
        
        this.offlineNotificationShown = true;
        
        // Create notification element if it doesn't exist
        if (!document.getElementById('mapOfflineNotice')) {
            const notice = document.createElement('div');
            notice.id = 'mapOfflineNotice';
            notice.style.cssText = `
                position: fixed;
                top: 60px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255, 152, 0, 0.95);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                z-index: 10000;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                max-width: 90%;
                text-align: center;
            `;
            notice.innerHTML = `
                <strong>📡 Map Offline Mode</strong><br>
                <small>Map tiles unavailable. GPS and all features still work!<br>
                Connect to internet once to cache map tiles for this area.</small>
            `;
            document.body.appendChild(notice);
        }
    }

    /**
     * Hide offline map notification
     */
    hideOfflineNotification() {
        const notice = document.getElementById('mapOfflineNotice');
        if (notice) {
            notice.remove();
            this.offlineNotificationShown = false;
        }
    }
}

