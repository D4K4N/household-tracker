/**
 * Printer.js - Bill Printing Service
 * Handles thermal printer output and print preview
 */

class PrinterService {
    constructor(database) {
        this.db = database;
        this.associationName = 'Dicklum Water Association, Inc.';
        this.associationAddress = 'Dicklum, Manolo Fortich, Bukidnon';
    }

    /**
     * Initialize - load association info from settings
     */
    async initialize() {
        try {
            const nameSettings = await this.db.getSettingByKey('associationName');
            const addressSettings = await this.db.getSettingByKey('associationAddress');
            
            if (nameSettings) this.associationName = nameSettings.value;
            if (addressSettings) this.associationAddress = addressSettings.value;
        } catch (error) {
            console.log('Using default association info');
        }
    }

    /**
     * Print billing record
     */
    async printBill(billingRecordId) {
        try {
            // Get billing record from database
            const bill = await this.db.getBillingRecord(billingRecordId);
            if (!bill) {
                throw new Error('Billing record not found');
            }

            // Get reminder text from settings
            const reminderSetting = await this.db.getSettingByKey('reminderText');
            const reminders = reminderSetting?.value || this.getDefaultReminders();

            // Generate payment code
            const paymentCode = this.generatePaymentCode(bill);

            // Generate print content
            const printContent = this.generateBillHTML(bill, reminders);

            // Open print preview with barcode
            this.openPrintPreview(printContent, paymentCode);
        } catch (error) {
            console.error('Print error:', error);
            throw error;
        }
    }

    /**
     * Generate bill HTML matching the long thermal receipt layout
     * Includes detailed billing breakdown with minimum + excess calculation
     */
    generateBillHTML(bill, reminders) {
        // Format billing period
        const yearMonth = bill.billingPeriod.split('-');
        const year = yearMonth[0];
        const month = yearMonth[1];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        const billingPeriodText = monthNames[parseInt(month) - 1] + ' ' + year;

        // Format dates
        const dueDate = new Date(bill.dueDate).toLocaleDateString('en-PH', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        
        // Format disconnection date if applicable
        let disconnectionInfo = '';
        if (bill.disconnectionDate && bill.totalDue > bill.currentBill) {
            const disconnectionDate = new Date(bill.disconnectionDate).toLocaleDateString('en-PH', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            disconnectionInfo = '<div class="info-row"><span class="info-label">Disconnection Date:</span><span class="info-value">' + disconnectionDate + '</span></div>';
        }

        // Get account info
        const accountName = (bill.householdData && bill.householdData.fullName) || (bill.meterData && bill.meterData.ownerName) || 'N/A';
        const accountNumber = (bill.meterData && bill.meterData.meterNumber) || bill.billReference || 'N/A';
        const address = (bill.householdData && bill.householdData.address) || (bill.locationData && bill.locationData.label) || 'N/A';
        const classification = (bill.householdData && bill.householdData.classification) || 'Residential';
        const meterNumber = bill.meterNumber || (bill.meterData && bill.meterData.meterNumber) || 'N/A';

        // Format currency
        const formatPHP = function(amount) {
            const num = parseFloat(amount || 0).toFixed(2);
            return '₱' + num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        };

        // Get billing breakdown
        const minimumCharge = bill.minimumCharge || (bill.rateSnapshot && bill.rateSnapshot.minimumCharge) || 0;
        const includedConsumption = bill.includedConsumption || (bill.rateSnapshot && bill.rateSnapshot.includedConsumption) || 0;
        const excessConsumption = bill.excessConsumption || 0;
        const excessRate = bill.excessRate || (bill.rateSnapshot && bill.rateSnapshot.excessRate) || 0;

        // Additional fees section
        let additionalFeesHTML = '';
        if (bill.additionalFees) {
            additionalFeesHTML = '<div class="info-row"><span class="info-label">Additional Fees:</span><span class="info-value">' + formatPHP(bill.additionalFees) + '</span></div>';
        }

        // Discounts section
        let discountsHTML = '';
        if (bill.discounts) {
            discountsHTML = '<div class="info-row"><span class="info-label">Discounts/Credits:</span><span class="info-value">-' + formatPHP(bill.discounts) + '</span></div>';
        }

        // Build detailed HTML with complete breakdown
        const html = '<!DOCTYPE html>' +
'<html>' +
'<head>' +
'    <meta charset="UTF-8">' +
'    <title>Water Bill - ' + accountName + '</title>' +
'    <style>' +
'        @media print {' +
'            @page { size: 80mm auto; margin: 3mm; }' +
'            body { margin: 0; padding: 0; }' +
'        }' +
'        body {' +
'            font-family: "Courier New", Consolas, monospace;' +
'            font-size: 11px;' +
'            line-height: 1.5;' +
'            max-width: 80mm;' +
'            margin: 0 auto;' +
'            padding: 5mm;' +
'            color: #000;' +
'            background: white;' +
'        }' +
'        .print-notice { font-size: 9px; color: #666; margin-bottom: 3mm; text-align: center; }' +
'        .header { text-align: center; margin-bottom: 5mm; border-bottom: 2px solid #000; padding-bottom: 3mm; }' +
'        .association-name { font-size: 14px; font-weight: bold; margin-bottom: 1mm; }' +
'        .association-address { font-size: 10px; margin-bottom: 3mm; }' +
'        .statement-title { font-size: 11px; font-weight: bold; margin-top: 2mm; }' +
'        .section { margin: 3mm 0; padding: 2mm 0; }' +
'        .section-title { font-weight: bold; font-size: 10px; text-transform: uppercase; margin-bottom: 2mm; border-bottom: 1px solid #000; padding-bottom: 1mm; }' +
'        .info-row { display: flex; justify-content: space-between; padding: 1mm 0; border-bottom: 1px dotted #ddd; }' +
'        .info-label { font-weight: normal; }' +
'        .info-value { font-weight: bold; text-align: right; }' +
'        .total-row { font-size: 13px; font-weight: bold; padding: 3mm; margin: 3mm 0; border: 2px solid #000; background: #f5f5f5; text-align: center; }' +
'        .reminders { margin-top: 5mm; padding-top: 3mm; border-top: 2px solid #000; font-size: 10px; }' +
'        .reminders-title { font-weight: bold; margin-bottom: 2mm; }' +
'        .reminder-item { margin-bottom: 2mm; padding-left: 3mm; }' +
'        .barcode-section { margin: 5mm 0; padding: 3mm; border: 2px solid #000; text-align: center; }' +
'        .barcode-title { font-size: 10px; font-weight: bold; margin-bottom: 2mm; }' +
'        .barcode-number { font-family: "Courier New", monospace; font-size: 9px; margin-top: 2mm; letter-spacing: 1px; }' +
'        .footer { text-align: center; margin-top: 5mm; padding-top: 3mm; border-top: 1px solid #000; font-weight: bold; font-size: 12px; }' +
'        .no-border { border-bottom: none; }' +
'    </style>' +
'</head>' +
'<body>' +
'    <div class="print-notice">Print Notice</div>' +
'    <div class="header">' +
'        <div class="association-name">' + this.associationName + '</div>' +
'        <div class="association-address">' + this.associationAddress + '</div>' +
'        <div class="statement-title">Statement of Account for the Month of ' + billingPeriodText + '</div>' +
'    </div>' +
'    <div class="section">' +
'        <div class="section-title">Account Information</div>' +
'        <div class="info-row"><span class="info-label">Account Name:</span><span class="info-value">' + accountName + '</span></div>' +
'        <div class="info-row"><span class="info-label">Account No.:</span><span class="info-value">' + accountNumber + '</span></div>' +
'        <div class="info-row"><span class="info-label">Address:</span><span class="info-value">' + address + '</span></div>' +
'        <div class="info-row"><span class="info-label">Classification:</span><span class="info-value">' + classification + '</span></div>' +
'        <div class="info-row no-border"><span class="info-label">Meter Number:</span><span class="info-value">' + meterNumber + '</span></div>' +
'    </div>' +
'    <div class="section">' +
'        <div class="section-title">Reading Information</div>' +
'        <div class="info-row"><span class="info-label">Previous Reading:</span><span class="info-value">' + bill.previousReading.toFixed(0) + ' m³</span></div>' +
'        <div class="info-row"><span class="info-label">Current Reading:</span><span class="info-value">' + bill.currentReading.toFixed(0) + ' m³</span></div>' +
'        <div class="info-row no-border"><span class="info-label">Usage:</span><span class="info-value">' + bill.usage.toFixed(2) + ' cubic meters</span></div>' +
'    </div>' +
'    <div class="section">' +
'        <div class="section-title">Billing Breakdown</div>' +
'        <div class="info-row"><span class="info-label">Minimum Charge:</span><span class="info-value">' + formatPHP(minimumCharge) + '</span></div>' +
'        <div class="info-row"><span class="info-label">Included Consumption:</span><span class="info-value">' + includedConsumption.toFixed(0) + ' m³</span></div>' +
'        <div class="info-row"><span class="info-label">Excess Consumption:</span><span class="info-value">' + excessConsumption.toFixed(2) + ' m³</span></div>' +
'        <div class="info-row"><span class="info-label">Excess Rate per m³:</span><span class="info-value">' + formatPHP(excessRate) + '</span></div>' +
'        <div class="info-row" style="font-weight: bold; border-top: 1px solid #000; padding-top: 2mm; margin-top: 2mm;">' +
'            <span class="info-label">Current Bill:</span><span class="info-value">' + formatPHP(bill.currentBill) + '</span>' +
'        </div>' +
'        <div class="info-row"><span class="info-label">Arrears:</span><span class="info-value">' + formatPHP(bill.arrears) + '</span></div>' +
additionalFeesHTML +
discountsHTML +
'    </div>' +
'    <div class="total-row">' +
'        <div>TOTAL DUE</div>' +
'        <div style="font-size: 16px; margin-top: 1mm;">' + formatPHP(bill.totalDue) + '</div>' +
'    </div>' +
'    <div class="section">' +
'        <div class="section-title">Payment Information</div>' +
'        <div class="info-row"><span class="info-label">Due Date:</span><span class="info-value">' + dueDate + '</span></div>' +
disconnectionInfo +
'    </div>' +
'    <div class="barcode-section">' +
'        <div class="barcode-title">Payment Barcode</div>' +
'        <div style="margin: 3mm 0;"><svg id="barcode"></svg></div>' +
'        <div class="barcode-number">' + this.generatePaymentCode(bill) + '</div>' +
'        <div style="font-size: 9px; margin-top: 2mm; color: #666;">Scan this at cashier to pay</div>' +
'    </div>' +
'    <div class="reminders">' +
'        <div class="reminders-title">REMINDERS</div>' +
this.formatReminders(reminders) +
'    </div>' +
'    <div class="footer">Thank you!</div>' +
'</body>' +
'</html>';

        return html;
    }

    /**
     * Generate unique payment code for barcode
     */
    generatePaymentCode(bill) {
        // Format: DWA + Year + Month + MeterNumber + Amount (padded)
        const yearMonth = bill.billingPeriod.split('-');
        const year = yearMonth[0];
        const month = yearMonth[1];
        const meterNum = (bill.meterData && bill.meterData.meterNumber) || '0000';
        const meterNumber = ('0000' + meterNum).slice(-4);
        const amount = ('000000' + Math.round(bill.totalDue).toString()).slice(-6);
        
        // Generate payment code: DWA + YYYYMM + MeterNumber + Amount
        return 'DWA' + year + month + meterNumber + amount;
    }

    /**
     * Format reminders for printing
     */
    formatReminders(remindersText) {
        const defaultReminders = [
            'Disregard this notice if payment has been made.',
            'This serves as Notice of Disconnection.',
            'Please pay on time.',
            'Pay bills directly to the cashier.',
            'Kindly report leaks or acts of vandalism on our pipeline.'
        ];

        // Split reminders by newline or use default
        const remindersList = remindersText ? remindersText.split('\n') : defaultReminders;

        let html = '';
        for (let i = 0; i < remindersList.length; i++) {
            const reminder = remindersList[i].trim();
            if (reminder) {
                html += '<div class="reminder-item">' + (i + 1) + '. ' + reminder + '</div>';
            }
        }
        return html;
    }

    /**
     * Get default reminders
     */
    getDefaultReminders() {
        return 'Disregard this notice if payment has been made.\n' +
               'This serves as Notice of Disconnection.\n' +
               'Please pay on time.\n' +
               'Pay bills directly to the cashier.\n' +
               'Kindly report leaks or acts of vandalism on our pipeline.';
    }

    /**
     * Open print preview with barcode
     */
    openPrintPreview(htmlContent, paymentCode) {
        // Create a new window for print preview
        const printWindow = window.open('', '_blank', 'width=400,height=700');
        
        if (!printWindow) {
            alert('Please allow popups to print bills');
            return;
        }

        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Wait for content to load, then generate barcode and print
        printWindow.onload = function() {
            setTimeout(function() {
                // Generate barcode using JsBarcode library
                const barcodeElement = printWindow.document.getElementById('barcode');
                if (barcodeElement && paymentCode && typeof JsBarcode !== 'undefined') {
                    try {
                        JsBarcode(barcodeElement, paymentCode, {
                            format: 'CODE128',
                            width: 2,
                            height: 50,
                            displayValue: false,
                            margin: 5
                        });
                    } catch (error) {
                        console.error('Barcode generation error:', error);
                        // Fallback: show text only
                        barcodeElement.innerHTML = '<div style="padding: 10px; border: 2px solid #000; font-family: monospace;">' + paymentCode + '</div>';
                    }
                } else {
                    // No JsBarcode library, show text barcode
                    if (barcodeElement) {
                        barcodeElement.innerHTML = '<div style="padding: 10px; border: 2px solid #000; font-family: monospace; font-size: 10px;">' + paymentCode + '</div>';
                    }
                }
                
                // Print after barcode is generated
                setTimeout(function() {
                    printWindow.print();
                }, 200);
            }, 300);
        };
    }
}
