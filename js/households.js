/**
 * Households.js - Household Management Module
 * Manages household markers, UI interactions, and CRUD operations
 */

class HouseholdManager {
    constructor(mapManager, database) {
        this.map = mapManager;
        this.db = database;
        this.households = [];
        this.markers = new Map(); // householdId -> marker
        this.selectedHousehold = null;
        this.markerCluster = null; // Cluster group for performance
    }

    /**
     * Initialize - load all households from database
     */
    async initialize(showMarkersOnInit = false) {
        try {
            // Create marker cluster group (fixes lag!)
            this.markerCluster = L.markerClusterGroup({
                maxClusterRadius: 50,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true
            });
            
            // Don't add to map immediately if clean mode is enabled
            if (showMarkersOnInit) {
                this.map.getMap().addLayer(this.markerCluster);
                this.isVisible = true;
            } else {
                this.isVisible = false; // Track visibility state
            }

            // Load households from database
            this.households = await this.db.getAllHouseholds();
            
            // Deduplicate by ID (in case of database issues)
            const uniqueHouseholds = new Map();
            this.households.forEach(h => uniqueHouseholds.set(h.id, h));
            this.households = Array.from(uniqueHouseholds.values());
            
            // Only render markers if we're showing them
            if (showMarkersOnInit) {
                this.renderAllMarkers();
            }
            
            console.log(`Loaded ${this.households.length} households ${showMarkersOnInit ? 'with clustering' : '(hidden in clean mode)'}`);
        } catch (error) {
            console.error('Failed to load households:', error);
        }
    }

    /**
     * Show household markers on map
     */
    show() {
        if (!this.isVisible && this.markerCluster) {
            this.map.getMap().addLayer(this.markerCluster);
            this.isVisible = true;
            
            // Render markers if not already rendered
            if (this.markers.size === 0 && this.households.length > 0) {
                this.renderAllMarkers();
            }
            
            console.log('Household markers shown');
        }
    }

    /**
     * Hide household markers from map
     */
    hide() {
        if (this.isVisible && this.markerCluster) {
            this.map.getMap().removeLayer(this.markerCluster);
            this.isVisible = false;
            console.log('Household markers hidden');
        }
    }

    /**
     * Clear all markers and hide from map
     */
    clearMap() {
        this.hide();
        // Clear existing markers from cluster
        this.markers.forEach(marker => {
            this.markerCluster.removeLayer(marker);
        });
        this.markers.clear();
    }

    /**
     * Add new household
     */
    async addHousehold(householdData) {
        try {
            const household = await this.db.addHousehold(householdData);
            this.households.push(household);
            this.createMarker(household);
            return household;
        } catch (error) {
            console.error('Failed to add household:', error);
            throw error;
        }
    }

    /**
     * Update household
     */
    async updateHousehold(id, updates) {
        try {
            const household = await this.db.updateHousehold(id, updates);
            
            // Update in memory
            const index = this.households.findIndex(h => h.id === id);
            if (index !== -1) {
                this.households[index] = household;
            }

            // Update marker
            this.updateMarker(household);
            
            return household;
        } catch (error) {
            console.error('Failed to update household:', error);
            throw error;
        }
    }

    /**
     * Delete household
     */
    async deleteHousehold(id) {
        try {
            await this.db.deleteHousehold(id);
            
            // Remove from memory
            this.households = this.households.filter(h => h.id !== id);
            
            // Remove marker
            this.removeMarker(id);
            
            return true;
        } catch (error) {
            console.error('Failed to delete household:', error);
            throw error;
        }
    }

    /**
     * Search households
     */
    async searchHouseholds(query) {
        try {
            return await this.db.searchHouseholds(query);
        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    }

    /**
     * Create marker for household
     */
    createMarker(household) {
        // Check if marker already exists, remove it first
        if (this.markers.has(household.id)) {
            this.removeMarker(household.id);
        }
        
        const marker = L.marker([household.latitude, household.longitude], {
            icon: this.createHouseholdIcon(),
            title: household.fullName
        });

        // Bind popup with options to keep it open
        const popupContent = this.createPopupContent(household);
        marker.bindPopup(popupContent, {
            closeButton: true,
            autoClose: false,  // Don't close when another popup opens
            closeOnClick: false,  // Don't close when clicking on map
            closeOnEscapeKey: true,  // Allow closing with ESC key
            className: 'household-popup'
        });

        // Add click handler
        marker.on('click', () => {
            this.selectHousehold(household);
        });

        // Add to cluster group instead of directly to map
        this.markerCluster.addLayer(marker);

        // Store reference
        this.markers.set(household.id, marker);

        return marker;
    }

    /**
     * Create custom icon for household marker
     */
    createHouseholdIcon() {
        return L.divIcon({
            className: 'household-marker',
            html: `
                <div style="
                    width: 30px;
                    height: 30px;
                    background: #ff4444;
                    border: 3px solid white;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <span style="
                        transform: rotate(45deg);
                        color: white;
                        font-size: 16px;
                        font-weight: bold;
                    ">📍</span>
                </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 30],
            popupAnchor: [0, -30]
        });
    }

    /**
     * Create popup content for marker
     */
    createPopupContent(household) {
        return `
            <div class="household-popup">
                <h3>${household.surname}</h3>
                <p><strong>${household.fullName}</strong></p>
                ${household.address ? `<p>📍 ${household.address}</p>` : ''}
                ${household.meterNumber ? `<p>🔢 Meter: ${household.meterNumber}</p>` : ''}
                ${household.contactNumber ? `<p>📞 ${household.contactNumber}</p>` : ''}
                ${household.notes ? `<p>📝 ${household.notes}</p>` : ''}
                <p style="font-size: 11px; color: #666;">
                    GPS: ±${Math.round(household.gpsAccuracy || 0)}m<br>
                    Added: ${new Date(household.createdAt).toLocaleDateString()}
                </p>
                <div class="popup-actions">
                    <button onclick="householdManager.editHousehold(${household.id})" class="btn-edit">✏️ Edit</button>
                    <button onclick="householdManager.navigateToHousehold(${household.id})" class="btn-navigate">🧭 Navigate</button>
                    <button onclick="householdManager.confirmDeleteHousehold(${household.id})" class="btn-delete">🗑️ Delete</button>
                </div>
            </div>
        `;
    }

    /**
     * Update marker position and popup
     */
    updateMarker(household) {
        const marker = this.markers.get(household.id);
        if (marker) {
            marker.setLatLng([household.latitude, household.longitude]);
            marker.setPopupContent(this.createPopupContent(household));
        }
    }

    /**
     * Remove marker from map
     */
    removeMarker(id) {
        const marker = this.markers.get(id);
        if (marker) {
            this.markerCluster.removeLayer(marker);
            this.markers.delete(id);
        }
    }

    /**
     * Render all household markers
     */
    renderAllMarkers() {
        // Clear existing markers from cluster
        this.markers.forEach(marker => {
            this.markerCluster.removeLayer(marker);
        });
        this.markers.clear();

        // Create new markers
        this.households.forEach(household => {
            this.createMarker(household);
        });
    }

    /**
     * Select household and fly to location
     */
    selectHousehold(household) {
        this.selectedHousehold = household;
        
        const marker = this.markers.get(household.id);
        if (!marker) return;
        
        // First, make sure marker is visible (uncluster if needed)
        this.markerCluster.zoomToShowLayer(marker, () => {
            // After marker is visible, draw route
            const distance = this.map.drawRouteToHousehold(household.latitude, household.longitude);
            
            // Wait for map animation to complete, then open popup
            setTimeout(() => {
                marker.openPopup();
            }, 800); // Increased delay to ensure map finished moving
            
            console.log(`Selected: ${household.fullName} - ${distance}`);
        });
    }

    /**
     * Fly to household by ID
     */
    flyToHousehold(id) {
        const household = this.households.find(h => h.id === id);
        if (household) {
            this.selectHousehold(household);
        }
    }

    /**
     * Show all households on map
     */
    showAllHouseholds() {
        if (this.households.length === 0) {
            alert('No households saved yet!');
            return;
        }

        // Show all markers
        this.show();
        this.renderAllMarkers();

        const bounds = [];
        this.households.forEach(h => {
            bounds.push([h.latitude, h.longitude]);
        });

        this.map.getMap().fitBounds(bounds, { padding: [50, 50] });
    }

    /**
     * Show only specific households and their related meter locations
     */
    async showSpecificHouseholds(householdIds) {
        // Clear existing markers first
        this.clearMap();
        
        // Show the cluster layer
        this.show();
        
        // Create markers only for specified households
        const householdsToShow = this.households.filter(h => householdIds.includes(h.id));
        householdsToShow.forEach(household => {
            this.createMarker(household);
        });
        
        console.log(`Showing ${householdsToShow.length} specific households`);
        return householdsToShow;
    }

    /**
     * Search households and show results on clean map
     */
    async searchAndShow(query) {
        try {
            // Search for households
            const results = await this.searchHouseholds(query);
            
            if (results.length === 0) {
                return { households: [], meters: [], meterLocations: [] };
            }
            
            // Show households on map
            const householdIds = results.map(h => h.id);
            await this.showSpecificHouseholds(householdIds);
            
            // Get related water meters for each household
            const allMeters = [];
            const meterLocationIds = new Set();
            
            for (const household of results) {
                // Get meters by household ID
                const householdMeters = await this.db.getWaterMetersByHousehold(household.id);
                allMeters.push(...householdMeters);
                
                // Also search by owner name matching surname
                const allSystemMeters = await this.db.getAllWaterMeters();
                const nameMatchingMeters = allSystemMeters.filter(meter => 
                    meter.ownerName && meter.ownerName.toLowerCase().includes(query.toLowerCase())
                );
                allMeters.push(...nameMatchingMeters);
                
                // Collect meter location IDs
                [...householdMeters, ...nameMatchingMeters].forEach(meter => {
                    if (meter.waterMeterLocationId) {
                        meterLocationIds.add(meter.waterMeterLocationId);
                    }
                });
            }
            
            // Remove duplicates
            const uniqueMeters = allMeters.filter((meter, index, self) => 
                index === self.findIndex(m => m.id === meter.id)
            );
            
            // Show meter locations if any found
            const meterLocations = [];
            if (meterLocationIds.size > 0 && window.meterLocationManager) {
                const shownLocations = await window.meterLocationManager.showSpecificMeters(Array.from(meterLocationIds));
                meterLocations.push(...shownLocations);
            }
            
            // Fit map to show both households and meter locations
            setTimeout(async () => {
                this.fitMapToSearchResults(results, meterLocations);
                
                // Draw house-to-meter routes
                if (meterLocations.length > 0) {
                    try {
                        await this.map.drawHouseToMeterRoutes(results, meterLocations, this.db);
                    } catch (error) {
                        console.error('Error drawing house-to-meter routes:', error);
                    }
                }
            }, 500);
            
            console.log(`Search results: ${results.length} households, ${uniqueMeters.length} meters, ${meterLocations.length} meter locations`);
            
            return { 
                households: results, 
                meters: uniqueMeters, 
                meterLocations: meterLocations 
            };
        } catch (error) {
            console.error('Search and show error:', error);
            return { households: [], meters: [], meterLocations: [] };
        }
    }

    /**
     * Fit map to show both household and meter locations
     */
    fitMapToSearchResults(households, meterLocations) {
        const bounds = [];
        
        // Add household coordinates
        households.forEach(h => {
            bounds.push([h.latitude, h.longitude]);
        });
        
        // Add meter location coordinates
        meterLocations.forEach(l => {
            bounds.push([l.latitude, l.longitude]);
        });
        
        if (bounds.length > 0) {
            this.map.getMap().fitBounds(bounds, { 
                padding: [50, 50],
                maxZoom: 18
            });
        }
    }

    /**
     * Navigate to household using external maps app
     */
    navigateToHousehold(id) {
        const household = this.households.find(h => h.id === id);
        if (!household) return;

        const lat = household.latitude;
        const lng = household.longitude;
        const label = encodeURIComponent(household.fullName);

        // Try Google Maps first, fallback to generic maps URL
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        let url;
        if (isMobile) {
            // Mobile - try to open native maps app
            url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${label}`;
        } else {
            // Desktop - open Google Maps in browser
            url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        }

        window.open(url, '_blank');
    }

    /**
     * Edit household - show edit form
     */
    editHousehold(id) {
        const household = this.households.find(h => h.id === id);
        if (!household) return;

        // Populate edit form with household data
        if (window.showEditHouseholdModal) {
            window.showEditHouseholdModal(household);
        }
    }

    /**
     * Confirm delete household
     */
    confirmDeleteHousehold(id) {
        const household = this.households.find(h => h.id === id);
        if (!household) return;

        if (confirm(`Delete household: ${household.fullName}?\n\nThis action cannot be undone.`)) {
            this.deleteHousehold(id)
                .then(() => {
                    alert('Household deleted successfully!');
                })
                .catch(error => {
                    alert('Failed to delete household: ' + error.message);
                });
        }
    }

    /**
     * Get household by ID
     */
    getHousehold(id) {
        return this.households.find(h => h.id === id);
    }

    /**
     * Get all households
     */
    getAllHouseholds() {
        return this.households;
    }

    /**
     * Export data
     */
    async exportData() {
        try {
            return await this.db.exportData();
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        }
    }

    /**
     * Import data
     */
    async importData(jsonData) {
        try {
            const count = await this.db.importData(jsonData);
            await this.initialize(); // Reload all
            return count;
        } catch (error) {
            console.error('Import failed:', error);
            throw error;
        }
    }
}
