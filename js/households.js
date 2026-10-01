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
    }

    /**
     * Initialize - load all households from database
     */
    async initialize() {
        try {
            this.households = await this.db.getAllHouseholds();
            this.renderAllMarkers();
            console.log(`Loaded ${this.households.length} households`);
        } catch (error) {
            console.error('Failed to load households:', error);
        }
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
        const marker = L.marker([household.latitude, household.longitude], {
            icon: this.createHouseholdIcon(),
            title: household.fullName
        });

        // Bind popup
        const popupContent = this.createPopupContent(household);
        marker.bindPopup(popupContent);

        // Add click handler
        marker.on('click', () => {
            this.selectHousehold(household);
        });

        // Add to map
        marker.addTo(this.map.getMap());

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
            marker.remove();
            this.markers.delete(id);
        }
    }

    /**
     * Render all household markers
     */
    renderAllMarkers() {
        // Clear existing markers
        this.markers.forEach(marker => marker.remove());
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
        this.map.flyTo(household.latitude, household.longitude, 18);
        
        // Open popup
        const marker = this.markers.get(household.id);
        if (marker) {
            marker.openPopup();
        }
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

        const bounds = [];
        this.households.forEach(h => {
            bounds.push([h.latitude, h.longitude]);
        });

        this.map.getMap().fitBounds(bounds, { padding: [50, 50] });
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
