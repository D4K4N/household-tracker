/**
 * Routes.js - House-to-House Route Recording Module
 * Records actual walking paths between households
 */

class RouteRecorder {
    constructor(mapManager, database) {
        this.map = mapManager;
        this.db = database;
        this.isRecording = false;
        this.isPaused = false;
        this.currentRoute = null;
        this.currentRoutePolyline = null;
        this.recordedCoordinates = [];
        this.startHousehold = null;
        this.totalDistance = 0;
        this.startTime = null;
        this.savedRoutes = [];
        this.routePolylines = new Map(); // routeId -> polyline
    }

    /**
     * Start recording a new route
     */
    startRecording(householdId = null) {
        if (this.isRecording) {
            console.log('Already recording a route');
            return false;
        }

        this.isRecording = true;
        this.isPaused = false;
        this.recordedCoordinates = [];
        this.totalDistance = 0;
        this.startTime = Date.now();
        this.startHousehold = householdId;

        console.log('Route recording started');
        return true;
    }

    /**
     * Add GPS point to current route
     */
    addPoint(latitude, longitude) {
        if (!this.isRecording || this.isPaused) {
            return;
        }

        const newPoint = [latitude, longitude];
        this.recordedCoordinates.push(newPoint);

        // Calculate distance from last point
        if (this.recordedCoordinates.length > 1) {
            const lastPoint = this.recordedCoordinates[this.recordedCoordinates.length - 2];
            const distance = this.calculateDistance(
                lastPoint[0], lastPoint[1],
                newPoint[0], newPoint[1]
            );
            this.totalDistance += distance;
        }

        // Update polyline on map
        this.updateCurrentRoutePolyline();

        console.log(`Route point added: ${this.recordedCoordinates.length} points, ${this.totalDistance.toFixed(1)}m`);
    }

    /**
     * Update the visual route line being recorded
     */
    updateCurrentRoutePolyline() {
        if (this.recordedCoordinates.length < 2) {
            return;
        }

        // Remove existing polyline
        if (this.currentRoutePolyline) {
            this.map.getMap().removeLayer(this.currentRoutePolyline);
        }

        // Draw new polyline
        this.currentRoutePolyline = L.polyline(this.recordedCoordinates, {
            color: '#FF6B00',
            weight: 5,
            opacity: 0.8,
            dashArray: '10, 5',
            className: 'recording-route'
        }).addTo(this.map.getMap());
    }

    /**
     * Pause route recording
     */
    pauseRecording() {
        if (!this.isRecording) {
            return false;
        }
        this.isPaused = true;
        console.log('Route recording paused');
        return true;
    }

    /**
     * Resume route recording
     */
    resumeRecording() {
        if (!this.isRecording) {
            return false;
        }
        this.isPaused = false;
        console.log('Route recording resumed');
        return true;
    }

    /**
     * Save current route to database
     */
    async saveRoute(destinationHouseholdId = null, routeName = '') {
        if (!this.isRecording) {
            throw new Error('No route is being recorded');
        }

        if (this.recordedCoordinates.length < 2) {
            throw new Error('Route must have at least 2 points');
        }

        const duration = Date.now() - this.startTime;

        const routeData = {
            name: routeName || `Route ${Date.now()}`,
            startHouseholdId: this.startHousehold,
            destinationHouseholdId: destinationHouseholdId,
            coordinates: this.recordedCoordinates,
            distance: this.totalDistance,
            duration: duration,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            const savedRoute = await this.db.addRoute(routeData);
            this.savedRoutes.push(savedRoute);
            
            // Convert recording polyline to permanent saved route
            if (this.currentRoutePolyline) {
                this.map.getMap().removeLayer(this.currentRoutePolyline);
            }
            
            this.drawSavedRoute(savedRoute);

            // Reset recording state
            this.isRecording = false;
            this.isPaused = false;
            this.currentRoute = null;
            this.currentRoutePolyline = null;
            this.recordedCoordinates = [];
            this.startHousehold = null;
            this.totalDistance = 0;

            console.log('Route saved:', savedRoute);
            return savedRoute;
        } catch (error) {
            console.error('Failed to save route:', error);
            throw error;
        }
    }

    /**
     * Cancel current recording
     */
    cancelRecording() {
        if (!this.isRecording) {
            return false;
        }

        // Remove visual polyline
        if (this.currentRoutePolyline) {
            this.map.getMap().removeLayer(this.currentRoutePolyline);
            this.currentRoutePolyline = null;
        }

        // Reset state
        this.isRecording = false;
        this.isPaused = false;
        this.recordedCoordinates = [];
        this.startHousehold = null;
        this.totalDistance = 0;

        console.log('Route recording cancelled');
        return true;
    }

    /**
     * Load all saved routes from database
     */
    async loadAllRoutes() {
        try {
            this.savedRoutes = await this.db.getAllRoutes();
            
            // Draw all saved routes on map
            this.savedRoutes.forEach(route => {
                this.drawSavedRoute(route);
            });

            console.log(`Loaded ${this.savedRoutes.length} routes`);
            return this.savedRoutes;
        } catch (error) {
            console.error('Failed to load routes:', error);
            return [];
        }
    }

    /**
     * Draw a saved route on the map
     */
    drawSavedRoute(route) {
        if (route.coordinates.length < 2) {
            return;
        }

        const polyline = L.polyline(route.coordinates, {
            color: '#4CAF50',
            weight: 3,
            opacity: 0.6,
            className: 'saved-route'
        }).addTo(this.map.getMap());

        // Add click handler for route info
        polyline.bindPopup(this.createRoutePopup(route));

        // Store reference
        this.routePolylines.set(route.id, polyline);
    }

    /**
     * Create popup content for saved route
     */
    createRoutePopup(route) {
        return `
            <div class="route-popup">
                <h4>${route.name || 'Route'}</h4>
                <p><strong>Distance:</strong> ${(route.distance).toFixed(0)}m</p>
                <p><strong>Created:</strong> ${new Date(route.createdAt).toLocaleDateString()}</p>
                <div class="popup-actions">
                    <button onclick="routeRecorder.editRoute(${route.id})" class="btn-edit">✏️ Edit</button>
                    <button onclick="routeRecorder.deleteRoute(${route.id})" class="btn-delete">🗑️ Delete</button>
                </div>
            </div>
        `;
    }

    /**
     * Delete a saved route
     */
    async deleteRoute(routeId) {
        if (!confirm('Delete this route?')) {
            return;
        }

        try {
            await this.db.deleteRoute(routeId);
            
            // Remove from map
            const polyline = this.routePolylines.get(routeId);
            if (polyline) {
                this.map.getMap().removeLayer(polyline);
                this.routePolylines.delete(routeId);
            }

            // Remove from memory
            this.savedRoutes = this.savedRoutes.filter(r => r.id !== routeId);

            console.log('Route deleted:', routeId);
        } catch (error) {
            console.error('Failed to delete route:', error);
            throw error;
        }
    }

    /**
     * Edit an existing route (re-record it)
     */
    async editRoute(routeId) {
        const route = this.savedRoutes.find(r => r.id === routeId);
        if (!route) {
            console.error('Route not found');
            return;
        }

        // Remove existing route from map
        const polyline = this.routePolylines.get(routeId);
        if (polyline) {
            this.map.getMap().removeLayer(polyline);
        }

        // Start new recording with same start/destination
        this.startRecording(route.startHouseholdId);
        
        // Store for saving
        this.editingRouteId = routeId;
        this.editingDestination = route.destinationHouseholdId;

        alert('Route editing started. Walk the new path and press "Save Route" when done.');
    }

    /**
     * Calculate distance between two points (meters)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Get current recording status
     */
    getRecordingStatus() {
        return {
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            pointCount: this.recordedCoordinates.length,
            distance: this.totalDistance,
            duration: this.startTime ? Date.now() - this.startTime : 0
        };
    }

    /**
     * Get formatted distance
     */
    getFormattedDistance() {
        if (this.totalDistance < 1000) {
            return `${Math.round(this.totalDistance)}m`;
        }
        return `${(this.totalDistance / 1000).toFixed(2)}km`;
    }

    /**
     * Get formatted duration
     */
    getFormattedDuration() {
        if (!this.startTime) return '0:00';
        
        const seconds = Math.floor((Date.now() - this.startTime) / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}
