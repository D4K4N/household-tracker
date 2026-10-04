/**
 * Billing.js - Billing Calculation System
 * Handles water bill calculation with configurable rates and arrears
 */

class BillingManager {
    constructor(database) {
        this.db = database;
        this.currentBill = null;
        this.defaultRates = {
            minimumCharge: 150,
            ratePerCubicMeter: 15,
            dueDaysAfterReading: 10,
            disconnectionDaysAfterDue: 30
        };
    }

    /**
     * Initialize - load billing rates from settings
     */
    async initialize() {
        try {
            // Load rates from settings
            const settings = await this.db.getAllSettings();
            
            if (settings && settings.length > 0) {
                settings.forEach(setting => {
                    if (setting.category === 'billing') {
                        switch (setting.key) {
                            case 'minimumCharge':
                                this.defaultRates.minimumCharge = parseFloat(setting.value);
                                break;
                            case 'ratePerCubicMeter':
                                this.defaultRates.ratePerCubicMeter = parseFloat(setting.value);
                                break;
                            case 'dueDaysAfterReading':
                                this.defaultRates.dueDaysAfterReading = parseInt(setting.value);
                                break;
                            case 'disconnectionDaysAfterDue':
                                this.defaultRates.disconnectionDaysAfterDue = parseInt(setting.value);
                                break;
                        }
                    }
                });
            }

            console.log('Billing rates loaded:', this.defaultRates);
        } catch (error) {
            console.error('Failed to load billing rates, using defaults:', error);
        }
    }

    /**
     * Calculate bill from reading data
     */
    async calculateBill(readingData) {
        try {
            // Get arrears from previous unpaid bills
            const arrears = await this.calculateArrears(readingData.meterId);

            // Get current rates (can be customized per meter/household in future)
            const rates = { ...this.defaultRates };

            // Calculate water charges
            const waterCharge = this.calculateWaterCharge(readingData.usage, rates);

            // Calculate dates
            const readingDate = new Date(readingData.readingDate);
            const dueDate = this.calculateDueDate(readingDate, rates.dueDaysAfterReading);
            const disconnectionDate = this.calculateDisconnectionDate(dueDate, rates.disconnectionDaysAfterDue);

            // Calculate total
            const currentBill = waterCharge;
            const totalDue = currentBill + arrears;

            // Create bill object
            this.currentBill = {
                meterId: readingData.meterId,
                householdId: readingData.householdId,
                billingPeriod: readingData.billingPeriod,
                previousReading: readingData.previousReading,
                currentReading: readingData.currentReading,
                usage: readingData.usage,
                currentBill: currentBill,
                arrears: arrears,
                totalDue: totalDue,
                dueDate: dueDate.toISOString(),
                disconnectionDate: disconnectionDate.toISOString(),
                rateSnapshot: {
                    minimumCharge: rates.minimumCharge,
                    ratePerCubicMeter: rates.ratePerCubicMeter,
                    dueDaysAfterReading: rates.dueDaysAfterReading,
                    disconnectionDaysAfterDue: rates.disconnectionDaysAfterDue,
                    appliedAt: new Date().toISOString()
                },
                meterData: readingData.meterData,
                householdData: readingData.householdData,
                createdAt: readingData.readingDate
            };

            return this.currentBill;
        } catch (error) {
            console.error('Failed to calculate bill:', error);
            throw error;
        }
    }

    /**
     * Calculate water charge based on usage
     */
    calculateWaterCharge(usage, rates) {
        // Minimum charge applies regardless of usage
        const minimumCharge = rates.minimumCharge;
        
        // Additional charge for usage
        const usageCharge = usage * rates.ratePerCubicMeter;
        
        // Total is minimum + usage charge
        const total = minimumCharge + usageCharge;
        
        return parseFloat(total.toFixed(2));
    }

    /**
     * Calculate arrears from previous unpaid bills
     */
    async calculateArrears(meterId) {
        try {
            const billingRecords = await this.db.getBillingRecordsByMeter(meterId);
            
            // Sum up unpaid amounts (in future, track payment status)
            // For now, assume last bill's arrears carry forward
            if (billingRecords.length > 0) {
                const lastBill = billingRecords[0]; // Most recent (sorted desc)
                
                // If last bill has arrears, they carry forward
                // In production, would check payment status
                return lastBill.arrears || 0;
            }
            
            return 0;
        } catch (error) {
            console.error('Error calculating arrears:', error);
            return 0;
        }
    }

    /**
     * Calculate due date
     */
    calculateDueDate(readingDate, daysAfter) {
        const dueDate = new Date(readingDate);
        dueDate.setDate(dueDate.getDate() + daysAfter);
        return dueDate;
    }

    /**
     * Calculate disconnection date
     */
    calculateDisconnectionDate(dueDate, daysAfter) {
        const disconnectionDate = new Date(dueDate);
        disconnectionDate.setDate(disconnectionDate.getDate() + daysAfter);
        return disconnectionDate;
    }

    /**
     * Save billing record to database
     */
    async saveBillingRecord() {
        if (!this.currentBill) {
            throw new Error('No bill to save');
        }

        try {
            const savedBill = await this.db.addBillingRecord(this.currentBill);
            console.log('Billing record saved:', savedBill);
            return savedBill;
        } catch (error) {
            console.error('Failed to save billing record:', error);
            throw error;
        }
    }

    /**
     * Get current bill
     */
    getCurrentBill() {
        return this.currentBill;
    }

    /**
     * Clear current bill
     */
    clearCurrentBill() {
        this.currentBill = null;
    }

    /**
     * Format currency
     */
    formatCurrency(amount) {
        return `₱${amount.toFixed(2)}`;
    }

    /**
     * Format date
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-PH', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    /**
     * Get days until due
     */
    getDaysUntilDue(dueDate) {
        const due = new Date(dueDate);
        const now = new Date();
        const diffTime = due - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    /**
     * Check if bill is overdue
     */
    isOverdue(dueDate) {
        return this.getDaysUntilDue(dueDate) < 0;
    }

    /**
     * Get bill summary for display
     */
    getBillSummary() {
        if (!this.currentBill) {
            return null;
        }

        const bill = this.currentBill;
        const daysUntilDue = this.getDaysUntilDue(bill.dueDate);
        const overdue = this.isOverdue(bill.dueDate);

        return {
            // Meter info
            meterNumber: bill.meterData.meterNumber,
            ownerName: bill.meterData.ownerName,
            
            // Household info
            fullName: bill.householdData?.fullName || bill.meterData.ownerName,
            address: bill.householdData?.address || 'No address',
            contactNumber: bill.householdData?.contactNumber || '',
            
            // Billing period
            billingPeriod: bill.billingPeriod,
            
            // Readings
            previousReading: bill.previousReading.toFixed(2),
            currentReading: bill.currentReading.toFixed(2),
            usage: bill.usage.toFixed(2),
            
            // Charges
            currentBill: this.formatCurrency(bill.currentBill),
            arrears: this.formatCurrency(bill.arrears),
            totalDue: this.formatCurrency(bill.totalDue),
            
            // Dates
            readingDate: this.formatDate(bill.createdAt),
            dueDate: this.formatDate(bill.dueDate),
            disconnectionDate: this.formatDate(bill.disconnectionDate),
            daysUntilDue: daysUntilDue,
            overdue: overdue,
            
            // Rate details
            minimumCharge: this.formatCurrency(bill.rateSnapshot.minimumCharge),
            ratePerCubicMeter: this.formatCurrency(bill.rateSnapshot.ratePerCubicMeter),
            usageCharge: this.formatCurrency(bill.usage * bill.rateSnapshot.ratePerCubicMeter)
        };
    }

    /**
     * Get charge breakdown
     */
    getChargeBreakdown() {
        if (!this.currentBill) {
            return null;
        }

        const bill = this.currentBill;
        const minimumCharge = bill.rateSnapshot.minimumCharge;
        const usageCharge = bill.usage * bill.rateSnapshot.ratePerCubicMeter;

        return {
            minimumCharge: {
                label: 'Minimum Charge',
                amount: minimumCharge,
                formatted: this.formatCurrency(minimumCharge)
            },
            usageCharge: {
                label: `Usage Charge (${bill.usage.toFixed(2)} m³ × ${this.formatCurrency(bill.rateSnapshot.ratePerCubicMeter)})`,
                amount: usageCharge,
                formatted: this.formatCurrency(usageCharge)
            },
            currentBill: {
                label: 'Current Bill',
                amount: bill.currentBill,
                formatted: this.formatCurrency(bill.currentBill)
            },
            arrears: {
                label: 'Previous Balance',
                amount: bill.arrears,
                formatted: this.formatCurrency(bill.arrears)
            },
            totalDue: {
                label: 'TOTAL AMOUNT DUE',
                amount: bill.totalDue,
                formatted: this.formatCurrency(bill.totalDue)
            }
        };
    }

    /**
     * Get billing rates
     */
    getRates() {
        return { ...this.defaultRates };
    }

    /**
     * Update rates (admin function)
     */
    async updateRates(newRates) {
        try {
            if (newRates.minimumCharge !== undefined) {
                await this.db.updateSetting('minimumCharge', newRates.minimumCharge.toString());
                this.defaultRates.minimumCharge = newRates.minimumCharge;
            }
            
            if (newRates.ratePerCubicMeter !== undefined) {
                await this.db.updateSetting('ratePerCubicMeter', newRates.ratePerCubicMeter.toString());
                this.defaultRates.ratePerCubicMeter = newRates.ratePerCubicMeter;
            }
            
            if (newRates.dueDaysAfterReading !== undefined) {
                await this.db.updateSetting('dueDaysAfterReading', newRates.dueDaysAfterReading.toString());
                this.defaultRates.dueDaysAfterReading = newRates.dueDaysAfterReading;
            }
            
            if (newRates.disconnectionDaysAfterDue !== undefined) {
                await this.db.updateSetting('disconnectionDaysAfterDue', newRates.disconnectionDaysAfterDue.toString());
                this.defaultRates.disconnectionDaysAfterDue = newRates.disconnectionDaysAfterDue;
            }

            console.log('Billing rates updated:', this.defaultRates);
            return true;
        } catch (error) {
            console.error('Failed to update billing rates:', error);
            throw error;
        }
    }
}
