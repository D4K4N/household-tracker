/**
 * Billing Settings Manager
 * Handles configuration of billing rates and parameters
 * Admin-only access required
 */

class BillingSettingsManager {
    constructor(database, billingManager) {
        this.db = database;
        this.billingManager = billingManager;
        this.isAdmin = false; // Future: implement admin authentication
    }

    /**
     * Open billing settings modal
     */
    async openSettings() {
        try {
            // Load current rates
            const currentRates = this.billingManager.defaultRates;
            
            // Populate form
            document.getElementById('settingMinimumCharge').value = currentRates.minimumCharge;
            document.getElementById('settingIncludedConsumption').value = currentRates.includedConsumption;
            document.getElementById('settingExcessRate').value = currentRates.excessRate;
            document.getElementById('settingDueDays').value = currentRates.dueDaysAfterReading;
            document.getElementById('settingDisconnectionDays').value = currentRates.disconnectionDaysAfterDue;
            document.getElementById('settingRatesVerified').checked = currentRates.ratesVerified;
            
            // Show warning if rates not verified
            const warningEl = document.getElementById('tempRatesWarning');
            if (!currentRates.ratesVerified) {
                warningEl.style.display = 'block';
            } else {
                warningEl.style.display = 'none';
            }
            
            // Show modal
            document.getElementById('billingSettingsModal').classList.add('active');
        } catch (error) {
            console.error('Failed to open settings:', error);
            alert('Failed to load billing settings');
        }
    }

    /**
     * Close billing settings modal
     */
    closeSettings() {
        document.getElementById('billingSettingsModal').classList.remove('active');
    }


    /**
     * Save billing settings
     */
    async saveSettings() {
        try {
            // Get form values
            const minimumCharge = parseFloat(document.getElementById('settingMinimumCharge').value);
            const includedConsumption = parseFloat(document.getElementById('settingIncludedConsumption').value);
            const excessRate = parseFloat(document.getElementById('settingExcessRate').value);
            const dueDays = parseInt(document.getElementById('settingDueDays').value);
            const disconnectionDays = parseInt(document.getElementById('settingDisconnectionDays').value);
            const ratesVerified = document.getElementById('settingRatesVerified').checked;
            
            // Validate
            const validation = this.validateRates({
                minimumCharge,
                includedConsumption,
                excessRate,
                dueDays,
                disconnectionDays
            });
            
            if (!validation.valid) {
                alert('Invalid settings: ' + validation.error);
                return;
            }
            
            // Confirm with user
            const confirmMsg = `Save new billing rates?\n\n` +
                `Minimum Charge: ₱${minimumCharge}\n` +
                `Included Consumption: ${includedConsumption} m³\n` +
                `Excess Rate: ₱${excessRate}/m³\n` +
                `Due Days: ${dueDays}\n` +
                `Disconnection Days: ${disconnectionDays}\n` +
                `Rates Verified: ${ratesVerified ? 'Yes' : 'No'}\n\n` +
                `This will affect all NEW bills generated after saving.`;
            
            if (!confirm(confirmMsg)) {
                return;
            }
            
            // Save to database
            await this.db.setSetting('minimumCharge', minimumCharge.toString(), 'billing');
            await this.db.setSetting('includedConsumption', includedConsumption.toString(), 'billing');
            await this.db.setSetting('excessRate', excessRate.toString(), 'billing');
            await this.db.setSetting('dueDaysAfterReading', dueDays.toString(), 'billing');
            await this.db.setSetting('disconnectionDaysAfterDue', disconnectionDays.toString(), 'billing');
            await this.db.setSetting('ratesVerified', ratesVerified.toString(), 'billing');
            
            // Reload billing manager rates
            await this.billingManager.initialize();
            
            alert('Billing settings saved successfully!');
            this.closeSettings();
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save billing settings: ' + error.message);
        }
    }


    /**
     * Save billing settings
     */
    async saveSettings() {
        try {
            // Get form values
            const minimumCharge = parseFloat(document.getElementById('settingMinimumCharge').value);
            const includedConsumption = parseFloat(document.getElementById('settingIncludedConsumption').value);
            const excessRate = parseFloat(document.getElementById('settingExcessRate').value);
            const dueDays = parseInt(document.getElementById('settingDueDays').value);
            const disconnectionDays = parseInt(document.getElementById('settingDisconnectionDays').value);
            const ratesVerified = document.getElementById('settingRatesVerified').checked;
            
            // Validate
            const validation = this.validateRates({
                minimumCharge,
                includedConsumption,
                excessRate,
                dueDays,
                disconnectionDays
            });
            
            if (!validation.valid) {
                alert('Invalid settings: ' + validation.error);
                return;
            }
            
            // Confirm with user
            const confirmMsg = `Save new billing rates?\n\n` +
                `Minimum Charge: ₱${minimumCharge}\n` +
                `Included Consumption: ${includedConsumption} m³\n` +
                `Excess Rate: ₱${excessRate}/m³\n` +
                `Due Days: ${dueDays}\n` +
                `Disconnection Days: ${disconnectionDays}\n` +
                `Rates Verified: ${ratesVerified ? 'Yes' : 'No'}\n\n` +
                `This will affect all NEW bills generated after saving.`;
            
            if (!confirm(confirmMsg)) {
                return;
            }
            
            // Save to database
            await this.db.setSetting('minimumCharge', minimumCharge.toString(), 'billing');
            await this.db.setSetting('includedConsumption', includedConsumption.toString(), 'billing');
            await this.db.setSetting('excessRate', excessRate.toString(), 'billing');
            await this.db.setSetting('dueDaysAfterReading', dueDays.toString(), 'billing');
            await this.db.setSetting('disconnectionDaysAfterDue', disconnectionDays.toString(), 'billing');
            await this.db.setSetting('ratesVerified', ratesVerified.toString(), 'billing');
            
            // Reload billing manager rates
            await this.billingManager.initialize();
            
            alert('Billing settings saved successfully!');
            this.closeSettings();
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save billing settings: ' + error.message);
        }
    }

    /**
     * Validate billing rates
     */
    validateRates(rates) {
        // Check minimum charge
        if (isNaN(rates.minimumCharge) || rates.minimumCharge < 0) {
            return { valid: false, error: 'Minimum charge must be a positive number' };
        }

        // Check included consumption
        if (isNaN(rates.includedConsumption) || rates.includedConsumption < 0) {
            return { valid: false, error: 'Included consumption must be a positive number' };
        }

        // Check excess rate (can be zero if explicitly set)
        if (isNaN(rates.excessRate) || rates.excessRate < 0) {
            return { valid: false, error: 'Excess rate must be a positive number or zero' };
        }

        // Check due days
        if (isNaN(rates.dueDays) || rates.dueDays < 1) {
            return { valid: false, error: 'Due days must be at least 1' };
        }

        // Check disconnection days
        if (isNaN(rates.disconnectionDays) || rates.disconnectionDays < 1) {
            return { valid: false, error: 'Disconnection days must be at least 1' };
        }

        return { valid: true };
    }

    /**
     * Test billing calculation with current settings
     */
    testCalculation() {
        try {
            const testUsage = parseFloat(prompt('Enter test usage in cubic meters (e.g., 12):')) || 12;
            
            const minimumCharge = parseFloat(document.getElementById('settingMinimumCharge').value);
            const includedConsumption = parseFloat(document.getElementById('settingIncludedConsumption').value);
            const excessRate = parseFloat(document.getElementById('settingExcessRate').value);
            
            let bill;
            if (testUsage <= includedConsumption) {
                bill = minimumCharge;
            } else {
                const excess = testUsage - includedConsumption;
                bill = minimumCharge + (excess * excessRate);
            }
            
            const resultMsg = `TEST CALCULATION\n\n` +
                `Usage: ${testUsage} m³\n` +
                `Minimum Charge: ₱${minimumCharge}\n` +
                `Included: ${includedConsumption} m³\n` +
                `Excess: ${Math.max(0, testUsage - includedConsumption).toFixed(2)} m³\n` +
                `Excess Rate: ₱${excessRate}/m³\n\n` +
                `TOTAL BILL: ₱${bill.toFixed(2)}`;
            
            alert(resultMsg);
        } catch (error) {
            alert('Test calculation failed: ' + error.message);
        }
    }

    /**
     * Restore default configuration
     */
    restoreDefaults() {
        if (!confirm('Restore temporary development rates? (₱100 min + 10m³ included + ₱100/m³ excess)')) {
            return;
        }
        
        document.getElementById('settingMinimumCharge').value = 100;
        document.getElementById('settingIncludedConsumption').value = 10;
        document.getElementById('settingExcessRate').value = 100;
        document.getElementById('settingDueDays').value = 10;
        document.getElementById('settingDisconnectionDays').value = 30;
        document.getElementById('settingRatesVerified').checked = false;
        
        document.getElementById('tempRatesWarning').style.display = 'block';
    }
}

// Make available globally
window.BillingSettingsManager = BillingSettingsManager;
