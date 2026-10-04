/**
 * WaterMeterLocations.js - Water Meter Location Management
 * Manages physical locations where water meters are grouped
 */

class WaterMeterLocationManager {
    constructor(mapManager, database) {
        this.map = mapManager;
        this.db = database;
        this.locations = [];
        this.markers = new Map(); // locationId -> marker
        this.meterCluster = null; // Cluster group for meter locations
    }

    /**
     * Initialize - load all meter locations from database
     */
    async initialize() {
        try {
            // Create marker cluster group for meter locations
            this.meterCluster = L.markerClusterGroup({
                maxClusterRadius: 50,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
                iconCreateFunction: function(cluster) {
                    return L.divIcon({
                        html: '<div class="meter-location-cluster">' + cluster.getChildCount() + '</div>',
                        className: 'meter-cluster-icon',
                        iconSize: [40, 40]
                    });
                }
            });
            
            this.map.getMap().addLayer(this.meterCluster);

            this.locations = await this.db.getAllWaterMeterLocations();
            await this.renderAllMarkers();
            
            console.log(`Loaded ${this.locations.length} water meter locations with clustering`);
        } catch (error) {
            console.error('Failed to load water meter locations:', error);
        }
    }

    /**
     * Add new water meter location
     */
    async addWaterMeterLocation(locationData) {
        try {
            const location = await this.db.addWaterMeterLocation(locationData);
            this.locations.push(location);
            await this.createMarker(location);
            return location;
        } catch (error) {
            console.error('Failed to add water meter location:', error);
            throw error;
        }
    }

    /**
     * Update water meter location
     */
    async updateWaterMeterLocation(id, updates) {
        try {
            const location = await this.db.updateWaterMeterLocation(id, updates);
            
            // Update in memory
            const index = this.locations.findIndex(l => l.id === id);
            if (index !== -1) {
                this.locations[index] = location;
            }

            // Update marker
            await this.updateMarker(location);
            
            return location;
        } catch (error) {
            console.error('Failed to update water meter location:', error);
            throw error;
        }
    }

    /**
     * Delete water meter location
     */
    async deleteWaterMeterLocation(id) {
        try {
            // Check if location has meters
            const meters = await this.db.getWaterMetersByLocation(id);
            if (meters.length > 0) {
                throw new Error(`Cannot delete location with ${meters.length} meter(s). Remove meters first.`);
            }

            await this.db.deleteWaterMeterLocation(id);
            
            // Remove from memory
            this.locations = this.locations.filter(l => l.id !== id);
            
            // Remove marker
            this.removeMarker(id);
            
            return true;
        } catch (error) {
            console.error('Failed to delete water meter location:', error);
            throw error;
        }
    }

    /**
     * Create marker for water meter location
     */
    async createMarker(location) {
        // Get meter count at this location
        const meters = await this.db.getWaterMetersByLocation(location.id);
        const meterCount = meters.length;

        const marker = L.marker([location.latitude, location.longitude], {
            icon: this.createMeterLocationIcon(meterCount),
            title: location.label
        });

        // Bind popup with options to keep it open
        const popupContent = await this.createPopupContent(location, meters);
        marker.bindPopup(popupContent, {
            closeButton: true,
            autoClose: false,
            closeOnClick: false,
            closeOnEscapeKey: true,
            className: 'meter-location-popup'
        });

        // Add click handler
        marker.on('click', () => {
            this.selectLocation(location);
        });

        // Add to cluster group
        this.meterCluster.addLayer(marker);

        // Store reference
        this.markers.set(location.id, marker);

        return marker;
    }

    /**
     * Create custom icon for meter location marker
     */
    createMeterLocationIcon(meterCount) {
        const hasMeters = meterCount > 0;
        const displayCount = meterCount > 0 ? meterCount : '📍';

        return L.divIcon({
            className: 'meter-location-marker-wrapper',
            html: `
                <div class="meter-location-marker ${hasMeters ? 'has-meters' : ''}">
                    ${displayCount}
                </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            popupAnchor: [0, -18]
        });
    }

    /**
     * Create popup content for marker
     */
    async createPopupContent(location, meters = null) {
        if (!meters) {
            meters = await this.db.getWaterMetersByLocation(location.id);
        }

        const meterCount = meters.length;
        const metersList = meters.length > 0
            ? meters.map(m => `<li>${m.ownerName} - ${m.meterNumber}</li>`).join('')
            : '<li style="color: #999;">No meters at this location yet</li>';

        return `
            <div class="meter-location-popup">
                <h3>📍 ${location.label}</h3>
                <p><strong>Meters at this location: ${meterCount}</strong></p>
                <ul style="margin: 8px 0; padding-left: 20px; font-size: 13px;">
                    ${metersList}
                </ul>
                ${location.notes ? `<p style="font-size: 12px; color: #666;">📝 ${location.notes}</p>` : ''}
                <p style="font-size: 11px; color: #666;">
                    GPS: ±${Math.round(location.gpsAccuracy || 0)}m<br>
                    Added: ${new Date(location.createdAt).toLocaleDateString()}
                </p>
                <div class="popup-actions">
                    <button onclick="meterLocationManager.editLocation(${location.id})" class="btn-edit">✏️ Edit</button>
                    <button onclick="meterLocationManager.addMeterToLocation(${location.id})" class="btn-primary">➕ Add Meter</button>
                    <button onclick="meterLocationManager.confirmDeleteLocation(${location.id})" class="btn-delete">🗑️ Delete</button>
                </div>
            </div>
        `;
    }

    /**
     * Update marker
     */
    async updateMarker(location) {
        // Remove old marker
        this.removeMarker(location.id);
        
        // Create new marker with updated data
        await this.createMarker(location);
    }

    /**
     * Remove marker from map
     */
    removeMarker(id) {
        const marker = this.markers.get(id);
        if (marker) {
            this.meterCluster.removeLayer(marker);
            this.markers.delete(id);
        }
    }

    /**
     * Render all meter location markers
     */
    async renderAllMarkers() {
        // Clear existing markers
        this.markers.forEach(marker => this.meterCluster.removeLayer(marker));
        this.markers.clear();

        // Create new markers
        for (const location of this.locations) {
            await this.createMarker(location);
        }
    }

    /**
     * Select location and fly to it
     */
    selectLocation(location) {
        this.map.getMap().flyTo([location.latitude, location.longitude], 18, {
            duration: 0.5
        });
        
        const marker = this.markers.get(location.id);
        if (marker) {
            marker.openPopup();
        }
        
        console.log(`Selected location: ${location.label}`);
    }

    /**
     * Fly to location by ID
     */
    flyToLocation(id) {
        const location = this.locations.find(l => l.id === id);
        if (location) {
            this.selectLocation(location);
        }
    }

    /**
     * Show all meter locations on map
     */
    showAllLocations() {
        if (this.locations.length === 0) {
            alert('No meter locations saved yet!');
            return;
        }

        const bounds = [];
        this.locations.forEach(l => {
            bounds.push([l.latitude, l.longitude]);
        });

        this.map.getMap().fitBounds(bounds, { padding: [50, 50] });
    }

    /**
     * Edit location
     */
    editLocation(id) {
        const location = this.locations.find(l => l.id === id);
        if (!location) return;

        // TODO: Open edit modal
        alert(`Edit location: ${location.label}\n\nEdit modal to be implemented`);
    }

    /**
     * Add meter to location
     */
    addMeterToLocation(locationId) {
        const location = this.locations.find(l => l.id === locationId);
        if (!location) return;

        // Open add water meter modal with this location pre-selected
        if (window.openAddWaterMeterModal) {
            window.openAddWaterMeterModal(null, locationId);
        }
    }

    /**
     * Confirm delete location
     */
    confirmDeleteLocation(id) {
        const location = this.locations.find(l => l.id === id);
        if (!location) return;

        if (confirm(`Delete meter location: ${location.label}?\n\nThis will fail if there are meters at this location.`)) {
            this.deleteWaterMeterLocation(id)
                .then(() => {
                    alert('Meter location deleted successfully!');
                })
                .catch(error => {
                    alert('Failed to delete location: ' + error.message);
                });
        }
    }

    /**
     * Get location by ID
     */
    getLocation(id) {
        return this.locations.find(l => l.id === id);
    }

    /**
     * Get all locations
     */
    getAllLocations() {
        return this.locations;
    }

    /**
     * Get location with meter count
     */
    async getLocationWithMeterCount(id) {
        const location = this.getLocation(id);
        if (!location) return null;

        const meters = await this.db.getWaterMetersByLocation(id);
        return {
            ...location,
            meterCount: meters.length,
            meters: meters
        };
    }

    /**
     * Get all locations with meter counts
     */
    async getAllLocationsWithMeterCounts() {
        const locationsWithCounts = await Promise.all(
            this.locations.map(async (location) => {
                const meters = await this.db.getWaterMetersByLocation(location.id);
                return {
                    ...location,
                    meterCount: meters.length,
                    meters: meters
                };
            })
        );
        return locationsWithCounts;
    }
}
