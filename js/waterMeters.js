/**
 * WaterMeters.js - Individual Water Meter Management
 * Manages individual water meters linked to households and locations
 */

class WaterMeterManager {
    constructor(mapManager, database) {
        this.map = mapManager;
        this.db = database;
        this.meters = [];
    }

    /**
     * Initialize - load all water meters from database
     */
    async initialize() {
        try {
            this.meters = await this.db.getAllWaterMeters();
            console.log(`Loaded ${this.meters.length} water meters`);
        } catch (error) {
            console.error('Failed to load water meters:', error);
        }
    }

    /**
     * Add new water meter
     */
    async addWaterMeter(meterData) {
        try {
            // Validate meter number doesn't exist
            const existing = this.meters.find(m => 
                m.meterNumber.toLowerCase() === meterData.meterNumber.toLowerCase()
            );
            
            if (existing) {
                throw new Error(`Meter number ${meterData.meterNumber} already exists`);
            }

            const meter = await this.db.addWaterMeter(meterData);
            this.meters.push(meter);
            
            // If meter has a location, update the location marker
            if (meter.waterMeterLocationId && window.meterLocationManager) {
                await window.meterLocationManager.updateMarker(
                    await this.db.getWaterMeterLocation(meter.waterMeterLocationId)
                );
            }
            
            console.log('Water meter added:', meter);
            return meter;
        } catch (error) {
            console.error('Failed to add water meter:', error);
            throw error;
        }
    }

    /**
     * Update water meter
     */
    async updateWaterMeter(id, updates) {
        try {
            const meter = await this.db.updateWaterMeter(id, updates);
            
            // Update in memory
            const index = this.meters.findIndex(m => m.id === id);
            if (index !== -1) {
                this.meters[index] = meter;
            }

            // Update location marker if location changed
            if (meter.waterMeterLocationId && window.meterLocationManager) {
                await window.meterLocationManager.updateMarker(
                    await this.db.getWaterMeterLocation(meter.waterMeterLocationId)
                );
            }
            
            return meter;
        } catch (error) {
            console.error('Failed to update water meter:', error);
            throw error;
        }
    }

    /**
     * Delete water meter
     */
    async deleteWaterMeter(id) {
        try {
            // Check if meter has billing records
            const billingRecords = await this.db.getBillingRecordsByMeter(id);
            if (billingRecords.length > 0) {
                throw new Error(`Cannot delete meter with ${billingRecords.length} billing record(s). This would lose billing history.`);
            }

            const meter = this.meters.find(m => m.id === id);
            const locationId = meter?.waterMeterLocationId;

            await this.db.deleteWaterMeter(id);
            
            // Remove from memory
            this.meters = this.meters.filter(m => m.id !== id);
            
            // Update location marker if needed
            if (locationId && window.meterLocationManager) {
                await window.meterLocationManager.updateMarker(
                    await this.db.getWaterMeterLocation(locationId)
                );
            }
            
            return true;
        } catch (error) {
            console.error('Failed to delete water meter:', error);
            throw error;
        }
    }

    /**
     * Get meters for a household
     */
    async getMetersForHousehold(householdId) {
        return await this.db.getWaterMetersByHousehold(householdId);
    }

    /**
     * Get meters at a location
     */
    async getMetersAtLocation(locationId) {
        return await this.db.getWaterMetersByLocation(locationId);
    }

    /**
     * Get meter by ID
     */
    getMeter(id) {
        return this.meters.find(m => m.id === id);
    }

    /**
     * Get all meters
     */
    getAllMeters() {
        return this.meters;
    }

    /**
     * Search meters
     */
    async searchMeters(query) {
        return await this.db.searchWaterMeters(query);
    }

    /**
     * Get meter with related data (household, location, latest billing)
     */
    async getMeterWithDetails(id) {
        const meter = this.getMeter(id);
        if (!meter) return null;

        const household = meter.householdId 
            ? await this.db.getHousehold(meter.householdId)
            : null;

        const location = meter.waterMeterLocationId
            ? await this.db.getWaterMeterLocation(meter.waterMeterLocationId)
            : null;

        const latestBilling = await this.db.getLatestBillingRecordForMeter(id);

        return {
            meter,
            household,
            location,
            latestBilling
        };
    }

    /**
     * Get all meters with household and location names
     */
    async getAllMetersWithDetails() {
        const metersWithDetails = await Promise.all(
            this.meters.map(async (meter) => {
                const household = meter.householdId 
                    ? await this.db.getHousehold(meter.householdId)
                    : null;

                const location = meter.waterMeterLocationId
                    ? await this.db.getWaterMeterLocation(meter.waterMeterLocationId)
                    : null;

                const latestBilling = await this.db.getLatestBillingRecordForMeter(meter.id);

                return {
                    ...meter,
                    householdName: household?.fullName || 'Unassigned',
                    locationLabel: location?.label || 'No location',
                    previousReading: latestBilling?.currentReading || 0,
                    lastReadingDate: latestBilling?.createdAt || null
                };
            })
        );

        return metersWithDetails;
    }

    /**
     * Get meters grouped by location
     */
    async getMetersGroupedByLocation() {
        const locations = await this.db.getAllWaterMeterLocations();
        const grouped = {};

        for (const location of locations) {
            const meters = await this.db.getWaterMetersByLocation(location.id);
            grouped[location.id] = {
                location,
                meters
            };
        }

        // Add ungrouped meters (no location)
        const ungroupedMeters = this.meters.filter(m => !m.waterMeterLocationId);
        if (ungroupedMeters.length > 0) {
            grouped['ungrouped'] = {
                location: { label: 'Ungrouped Meters', id: null },
                meters: ungroupedMeters
            };
        }

        return grouped;
    }

    /**
     * Get meter statistics
     */
    getMeterStatistics() {
        const active = this.meters.filter(m => m.status === 'active').length;
        const inactive = this.meters.filter(m => m.status === 'inactive').length;
        const disconnected = this.meters.filter(m => m.status === 'disconnected').length;
        const withLocation = this.meters.filter(m => m.waterMeterLocationId).length;
        const withoutLocation = this.meters.filter(m => !m.waterMeterLocationId).length;

        return {
            total: this.meters.length,
            active,
            inactive,
            disconnected,
            withLocation,
            withoutLocation
        };
    }

    /**
     * Validate meter data
     */
    validateMeterData(meterData, isUpdate = false) {
        const errors = [];

        if (!isUpdate && !meterData.meterNumber?.trim()) {
            errors.push('Meter number is required');
        }

        if (!meterData.ownerName?.trim()) {
            errors.push('Owner name is required');
        }

        if (!meterData.householdId && !meterData.waterMeterLocationId) {
            errors.push('Meter must be linked to either a household or a location');
        }

        if (!['active', 'inactive', 'disconnected'].includes(meterData.status)) {
            errors.push('Invalid meter status');
        }

        return errors;
    }

    /**
     * Format meter status for display
     */
    formatStatus(status) {
        const statusMap = {
            'active': '🟢 Active',
            'inactive': '⚫ Inactive',
            'disconnected': '🔴 Disconnected'
        };
        return statusMap[status] || status;
    }

    /**
     * Get meter display name
     */
    getMeterDisplayName(meter) {
        return `${meter.ownerName} - ${meter.meterNumber}`;
    }
}
