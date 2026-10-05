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
     * Clear route line
     */
    clearRoute() {
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
            this.routeLine = null;
        }
    }

    /**
     * Get map instance (for advanced operations)
     */
    getMap() {
        return this.map;
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

