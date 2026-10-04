/**
 * MeterReading.js - Meter Reading Workflow
 * Handles field meter reading with automatic previous reading and usage calculation
 */

class MeterReadingManager {
    constructor(database, settingsManager) {
        this.db = database;
        this.settings = settingsManager;
        this.currentReading = null;
    }

    /**
     * Start meter reading workflow
     */
    async startReading(meterId) {
        try {
            // Get meter details
            const meter = await this.db.getWaterMeter(meterId);
            if (!meter) {
                throw new Error('Meter not found');
            }

            // Get household info
            const household = meter.householdId 
                ? await this.db.getHousehold(meter.householdId)
                : null;

            // Get latest billing record for previous reading
            const latestBilling = await this.db.getLatestBillingRecordForMeter(meterId);
            
            // Get meter location
            const location = meter.waterMeterLocationId
                ? await this.db.getWaterMeterLocation(meter.waterMeterLocationId)
                : null;

            this.currentReading = {
                meter,
                household,
                location,
                previousReading: latestBilling ? latestBilling.currentReading : 0,
                previousBillingDate: latestBilling ? latestBilling.createdAt : null,
                currentReading: null,
                usage: 0,
                readingDate: new Date().toISOString()
            };

            return this.currentReading;
        } catch (error) {
            console.error('Failed to start reading:', error);
            throw error;
        }
    }

    /**
     * Set current reading and calculate usage
     */
    setCurrentReading(reading) {
        if (!this.currentReading) {
            throw new Error('No reading session started');
        }

        const currentReading = parseFloat(reading);
        const previousReading = this.currentReading.previousReading;

        // Validate reading
        const validation = this.validateReading(currentReading, previousReading);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Calculate usage
        const usage = currentReading - previousReading;

        this.currentReading.currentReading = currentReading;
        this.currentReading.usage = usage;

        return {
            currentReading,
            previousReading,
            usage,
            valid: true
        };
    }

    /**
     * Validate reading
     */
    validateReading(currentReading, previousReading) {
        // Check if reading is a valid number
        if (isNaN(currentReading) || currentReading < 0) {
            return {
                valid: false,
                error: 'Reading must be a positive number'
            };
        }

        // Check if reading is less than previous (unusual case)
        if (currentReading < previousReading) {
            return {
                valid: false,
                error: `Current reading (${currentReading}) cannot be less than previous reading (${previousReading}). Possible meter replacement or reset?`,
                warningOnly: false
            };
        }

        // Check for unusually high usage (potential error)
        const usage = currentReading - previousReading;
        const unusuallyHigh = 1000; // 1000 m³ is extremely high for one month
        
        if (usage > unusuallyHigh) {
            return {
                valid: false,
                error: `Usage of ${usage} m³ seems unusually high. Please verify the reading.`,
                warningOnly: true // Can be overridden
            };
        }

        return {
            valid: true,
            error: null
        };
    }

    /**
     * Get current reading session
     */
    getCurrentReading() {
        return this.currentReading;
    }

    /**
     * Clear current reading session
     */
    clearCurrentReading() {
        this.currentReading = null;
    }

    /**
     * Format reading for display
     */
    formatReading(reading) {
        return reading.toFixed(2);
    }

    /**
     * Get reading summary for confirmation
     */
    getReadingSummary() {
        if (!this.currentReading) {
            return null;
        }

        const { meter, household, previousReading, currentReading, usage } = this.currentReading;

        return {
            meterNumber: meter.meterNumber,
            ownerName: meter.ownerName,
            householdName: household?.fullName || 'Unassigned',
            address: household?.address || '',
            previousReading: this.formatReading(previousReading),
            currentReading: this.formatReading(currentReading),
            usage: this.formatReading(usage),
            readingDate: new Date(this.currentReading.readingDate).toLocaleDateString()
        };
    }

    /**
     * Calculate estimated days since last reading
     */
    getDaysSinceLastReading() {
        if (!this.currentReading || !this.currentReading.previousBillingDate) {
            return null;
        }

        const lastDate = new Date(this.currentReading.previousBillingDate);
        const today = new Date();
        const diffTime = Math.abs(today - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    }

    /**
     * Get average daily usage
     */
    getAverageDailyUsage() {
        if (!this.currentReading) {
            return null;
        }

        const days = this.getDaysSinceLastReading();
        if (!days || days === 0) {
            return null;
        }

        const avgDaily = this.currentReading.usage / days;
        return avgDaily.toFixed(2);
    }

    /**
     * Check if reading is suspicious
     */
    isSuspiciousReading() {
        if (!this.currentReading) {
            return false;
        }

        const usage = this.currentReading.usage;
        
        // Zero usage is suspicious
        if (usage === 0) {
            return {
                suspicious: true,
                reason: 'Zero usage detected. Meter may be stuck or not in use.'
            };
        }

        // Very low usage (less than 1 m³ per month)
        const days = this.getDaysSinceLastReading();
        if (days && days > 20 && usage < 1) {
            return {
                suspicious: true,
                reason: 'Very low usage detected. Please verify meter is functioning.'
            };
        }

        // Very high daily average (more than 20 m³ per day)
        const avgDaily = parseFloat(this.getAverageDailyUsage());
        if (avgDaily && avgDaily > 20) {
            return {
                suspicious: true,
                reason: `High daily average (${avgDaily.toFixed(1)} m³/day). Possible leak or meter error.`
            };
        }

        return {
            suspicious: false,
            reason: null
        };
    }

    /**
     * Prepare data for saving (Phase 7 will handle billing calculation)
     */
    prepareForSave() {
        if (!this.currentReading) {
            throw new Error('No reading to save');
        }

        if (this.currentReading.currentReading === null) {
            throw new Error('Current reading not set');
        }

        // Return data structure ready for billing calculation
        return {
            meterId: this.currentReading.meter.id,
            householdId: this.currentReading.household?.id || null,
            previousReading: this.currentReading.previousReading,
            currentReading: this.currentReading.currentReading,
            usage: this.currentReading.usage,
            readingDate: this.currentReading.readingDate,
            billingPeriod: this.getCurrentBillingPeriod(),
            meterData: {
                meterNumber: this.currentReading.meter.meterNumber,
                ownerName: this.currentReading.meter.ownerName,
                status: this.currentReading.meter.status
            },
            householdData: this.currentReading.household ? {
                fullName: this.currentReading.household.fullName,
                address: this.currentReading.household.address,
                contactNumber: this.currentReading.household.contactNumber
            } : null
        };
    }

    /**
     * Get current billing period (YYYY-MM format)
     */
    getCurrentBillingPeriod() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    /**
     * Format billing period for display
     */
    formatBillingPeriod(period) {
        const [year, month] = period.split('-');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
}
