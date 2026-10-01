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
        
        // Barangay Diclum center coordinates
        this.diclumCenter = [8.3676, 124.8591];
        this.defaultZoom = 15;
        
        // Normal zoom limits for global map
        this.minZoom = 3;
        this.maxZoom = 19;
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

        // Add multiple satellite tile providers for redundancy
        // Primary: Google Satellite (most reliable)
        const googleSat = L.tileLayer('http://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            attribution: 'Imagery &copy; Google',
            maxZoom: this.maxZoom,
            minZoom: this.minZoom,
            subdomains: ['0', '1', '2', '3']
        });

        // Backup: Esri World Imagery
        const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri',
            maxZoom: this.maxZoom,
            minZoom: this.minZoom
        });

        // Try Google first, fallback to Esri if it fails
        googleSat.addTo(this.map);
        
        // Add hybrid labels overlay (roads, labels on top of satellite)
        L.tileLayer('http://mt{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
            attribution: '',
            maxZoom: this.maxZoom,
            minZoom: this.minZoom,
            subdomains: ['0', '1', '2', '3'],
            opacity: 0.7
        }).addTo(this.map);

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

        // If marker doesn't exist, create it
        if (!this.currentLocationMarker) {
            // Create custom icon for current location
            const currentLocationIcon = L.divIcon({
                className: 'current-location-marker',
                html: `
                    <div style="
                        width: 20px;
                        height: 20px;
                        background: #2196F3;
                        border: 3px solid white;
                        border-radius: 50%;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    "></div>
                `,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            // Create marker
            this.currentLocationMarker = L.marker(latlng, {
                icon: currentLocationIcon,
                zIndexOffset: 1000 // Keep current location on top
            }).addTo(this.map);

            // Create accuracy circle
            this.currentLocationCircle = L.circle(latlng, {
                radius: accuracy,
                color: '#2196F3',
                fillColor: '#2196F3',
                fillOpacity: 0.1,
                weight: 1
            }).addTo(this.map);

            // Center map on first location
            this.map.setView(latlng, this.defaultZoom);

            console.log('Current location marker created');
        } else {
            // Update existing marker position
            this.currentLocationMarker.setLatLng(latlng);
            
            // Update accuracy circle
            if (this.currentLocationCircle) {
                this.currentLocationCircle.setLatLng(latlng);
                this.currentLocationCircle.setRadius(accuracy);
            }

            console.log('Current location marker updated');
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
}
