/**
 * Billing.js - Billing Calculation System
 * Handles water bill calculation with configurable rates and arrears
 * 
 * BILLING FORMULA (Temporary Configuration):
 * - Minimum Charge: ₱100 (includes 10 m³)
 * - Excess Rate: ₱100 per m³ over 10 m³ (TEMPORARY - must be configured)
 * - If usage <= 10 m³: Bill = ₱100
 * - If usage > 10 m³: Bill = ₱100 + ((usage - 10) × ₱100)
 */

class BillingManager {
    constructor(database) {
        this.db = database;
        this.currentBill = null;
        // TEMPORARY DEVELOPMENT RATES - Must be editable in settings
        this.defaultRates = {
            minimumCharge: 100,           // ₱100 minimum
            includedConsumption: 10,       // 10 m³ included
            excessRate: 100,              // ₱100 per excess m³ (TEMPORARY)
            dueDaysAfterReading: 10,
            disconnectionDaysAfterDue: 30,
            currency: 'PHP',
            billingMethod: 'minimum_plus_excess',
            decimalPlaces: 2,
            ratesVerified: false          // Flag to indicate temporary rates
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
                            case 'includedConsumption':
                                this.defaultRates.includedConsumption = parseFloat(setting.value);
                                break;
                            case 'excessRate':
                                this.defaultRates.excessRate = parseFloat(setting.value);
                                break;
                            case 'dueDaysAfterReading':
                                this.defaultRates.dueDaysAfterReading = parseInt(setting.value);
                                break;
                            case 'disconnectionDaysAfterDue':
                                this.defaultRates.disconnectionDaysAfterDue = parseInt(setting.value);
                                break;
                            case 'ratesVerified':
                                this.defaultRates.ratesVerified = setting.value === 'true';
                                break;
                        }
                    }
                });
            }

            console.log('Billing rates loaded:', this.defaultRates);
            
            // Show warning if rates are not verified
            if (!this.defaultRates.ratesVerified) {
                console.warn('⚠️ USING TEMPORARY BILLING RATES - Configure official rates in Billing Settings');
            }
        } catch (error) {
            console.error('Failed to load billing rates, using temporary defaults:', error);
        }
    }

    /**
     * Calculate bill from reading data
     */
    async calculateBill(readingData) {
        try {
            // Get arrears from previous unpaid bills
            const arrears = await this.calculateArrears(readingData.meter.id);

            // Get current rates (can be customized per meter/household in future)
            const rates = { ...this.defaultRates };

            // Calculate water charges using new formula
            const waterChargeBreakdown = this.calculateWaterCharge(readingData.usage, rates);

            // Calculate dates
            const readingDate = new Date(readingData.readingDate);
            const dueDate = this.calculateDueDate(readingDate, rates.dueDaysAfterReading);
            const disconnectionDate = this.calculateDisconnectionDate(dueDate, rates.disconnectionDaysAfterDue);

            // Calculate total
            const currentBill = waterChargeBreakdown.totalCharge;
            const totalDue = currentBill + arrears;

            // Generate unique bill reference
            const billReference = this.generateBillReference(readingData.meter.id);

            // Create billing period from reading date
            const billingPeriod = `${readingDate.getFullYear()}-${String(readingDate.getMonth() + 1).padStart(2, '0')}`;

            // Create bill object
            this.currentBill = {
                billReference: billReference,
                meterId: readingData.meter.id,
                meterNumber: readingData.meter.meterNumber,
                householdId: readingData.household?.id || null,
                billingPeriod: billingPeriod,
                previousReading: readingData.previousReading,
                currentReading: readingData.currentReading,
                usage: readingData.usage,
                
                // Detailed breakdown
                minimumCharge: rates.minimumCharge,
                includedConsumption: rates.includedConsumption,
                excessConsumption: waterChargeBreakdown.excessConsumption,
                excessRate: rates.excessRate,
                waterCharge: waterChargeBreakdown.totalCharge,
                
                currentBill: currentBill,
                arrears: arrears,
                totalDue: totalDue,
                
                dueDate: dueDate.toISOString(),
                disconnectionDate: disconnectionDate.toISOString(),
                
                // Snapshot of rates used for this bill
                rateSnapshot: {
                    minimumCharge: rates.minimumCharge,
                    includedConsumption: rates.includedConsumption,
                    excessRate: rates.excessRate,
                    dueDaysAfterReading: rates.dueDaysAfterReading,
                    disconnectionDaysAfterDue: rates.disconnectionDaysAfterDue,
                    currency: rates.currency,
                    billingMethod: rates.billingMethod,
                    ratesVerified: rates.ratesVerified,
                    appliedAt: new Date().toISOString()
                },
                
                // Store full context for receipts
                meterData: readingData.meter,
                householdData: readingData.household,
                locationData: readingData.location,
                
                paymentStatus: 'unpaid',
                createdAt: readingDate.toISOString(),
                updatedAt: new Date().toISOString()
            };

            return this.currentBill;
        } catch (error) {
            console.error('Failed to calculate bill:', error);
            throw error;
        }
    }

    /**
     * Calculate water charge based on usage using minimum + excess formula
     * 
     * Formula:
     * - If usage <= includedConsumption: charge = minimumCharge
     * - If usage > includedConsumption: charge = minimumCharge + ((usage - includedConsumption) × excessRate)
     * 
     * Examples with default rates (₱100 min, 10 m³ included, ₱100/m³ excess):
     * - 0 m³ = ₱100
     * - 5 m³ = ₱100
     * - 10 m³ = ₱100
     * - 11 m³ = ₱200 (₱100 + (1 × ₱100))
     * - 12 m³ = ₱300 (₱100 + (2 × ₱100))
     * - 15 m³ = ₱600 (₱100 + (5 × ₱100))
     * - 20 m³ = ₱1,100 (₱100 + (10 × ₱100))
     */
    calculateWaterCharge(usage, rates) {
        const minimumCharge = rates.minimumCharge;
        const includedConsumption = rates.includedConsumption;
        const excessRate = rates.excessRate;
        
        let totalCharge;
        let excessConsumption = 0;
        
        if (usage <= includedConsumption) {
            // Usage within included consumption - only pay minimum
            totalCharge = minimumCharge;
        } else {
            // Usage exceeds included consumption - pay minimum + excess
            excessConsumption = usage - includedConsumption;
            const excessCharge = excessConsumption * excessRate;
            totalCharge = minimumCharge + excessCharge;
        }
        
        // Round to 2 decimal places for currency
        totalCharge = parseFloat(totalCharge.toFixed(rates.decimalPlaces || 2));
        
        return {
            totalCharge: totalCharge,
            excessConsumption: excessConsumption,
            breakdown: {
                minimumCharge: minimumCharge,
                includedConsumption: includedConsumption,
                excessConsumption: excessConsumption,
                excessRate: excessRate,
                excessCharge: excessConsumption * excessRate
            }
        };
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
     * Generate unique bill reference number
     * Format: DWA-YYYYMM-XXXXX
     */
    generateBillReference(meterId) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const random = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
        const meterPart = String(meterId).padStart(4, '0');
        
        return `DWA${year}${month}${meterPart}${random}`;
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
