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
     * Generate bill HTML matching the template image
     */
    generateBillHTML(bill, reminders) {
        // Format billing period
        const [year, month] = bill.billingPeriod.split('-');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        const billingPeriodText = `${monthNames[parseInt(month) - 1]} ${year}`;

        // Format dates
        const dueDate = new Date(bill.dueDate).toLocaleDateString('en-PH', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        const disconnectionDate = new Date(bill.disconnectionDate).toLocaleDateString('en-PH', {
            year: 'numeric', month: 'long', day: 'numeric'
        });

        // Get account info
        const accountName = bill.householdData?.fullName || bill.meterData?.ownerName || 'N/A';
        const accountNumber = bill.meterData?.meterNumber || 'N/A';
        const address = bill.householdData?.address || 'N/A';
        const classification = bill.householdData?.classification || 'Residential';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Statement of Account - ${accountName}</title>
    <style>
        @media print {
            @page {
                size: 58mm auto;
                margin: 5mm;
            }
            body {
                margin: 0;
                padding: 0;
            }
        }
        
        body {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.4;
            max-width: 58mm;
            margin: 0 auto;
            padding: 5mm;
            color: #000;
        }
        
        .print-notice {
            font-size: 9px;
            color: #666;
            margin-bottom: 3mm;
        }
        
        .header {
            text-align: center;
            margin-bottom: 4mm;
        }
        
        .association-name {
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 1mm;
        }
        
        .association-address {
            font-size: 10px;
            margin-bottom: 2mm;
        }
        
        .statement-title {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 3mm;
        }
        
        .bill-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2mm;
            border-bottom: 1px dotted #ccc;
            padding-bottom: 1mm;
        }
        
        .bill-label {
            font-weight: normal;
        }
        
        .bill-value {
            font-weight: bold;
            text-align: right;
        }
        
        .account-name-value {
            background: #d0e7f5;
            padding: 1mm 2mm;
        }
        
        .total-row {
            margin-top: 2mm;
            padding-top: 2mm;
            border-top: 2px solid #000;
            font-weight: bold;
            font-size: 12px;
        }
        
        .due-date-row {
            margin-top: 3mm;
            font-weight: bold;
        }
        
        .disconnection-row {
            color: #666;
            font-size: 10px;
        }
        
        .reminders {
            margin-top: 4mm;
            padding-top: 3mm;
            border-top: 1px solid #000;
        }
        
        .reminders-title {
            font-weight: bold;
            margin-bottom: 2mm;
        }
        
        .reminder-item {
            margin-bottom: 1.5mm;
            font-size: 10px;
        }
        
        .no-border {
            border-bottom: none;
        }
        
        .barcode-section {
            margin: 4mm 0;
            padding: 3mm 0;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            text-align: center;
        }
        
        .barcode-title {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 2mm;
        }
        
        .barcode-container {
            margin: 2mm 0;
        }
        
        .barcode-number {
            font-family: monospace;
            font-size: 9px;
            margin-top: 1mm;
            letter-spacing: 1px;
        }
    </style>
</head>
<body>
    <div class="print-notice">Print Notice</div>
    
    <div class="header">
        <div class="association-name">${this.associationName}</div>
        <div class="association-address">${this.associationAddress}</div>
        <div class="statement-title">Statement of Account for the month of ${billingPeriodText}</div>
    </div>
    
    <div class="bill-content">
        <div class="bill-row">
            <span class="bill-label">Account Name:</span>
            <span class="bill-value account-name-value">${accountName}</span>
        </div>
        
        <div class="bill-row">
            <span class="bill-label">Account No.:</span>
            <span class="bill-value">${accountNumber}</span>
        </div>
        
        <div class="bill-row">
            <span class="bill-label">Address:</span>
            <span class="bill-value">${address}</span>
        </div>
        
        <div class="bill-row">
            <span class="bill-label">Classification:</span>
            <span class="bill-value">${classification}</span>
        </div>
        
        <div class="bill-row">
            <span class="bill-label">Previous Reading:</span>
            <span class="bill-value">${bill.previousReading.toFixed(0)}</span>
        </div>
        
        <div class="bill-row">
            <span class="bill-label">Current Reading:</span>
            <span class="bill-value">${bill.currentReading.toFixed(0)}</span>
        </div>
        
        <div class="bill-row">
            <span class="bill-label">Usage:</span>
            <span class="bill-value">${bill.usage.toFixed(0)} cubic meters</span>
        </div>
        
        <div class="bill-row">
            <span class="bill-label">Current Bill:</span>
            <span class="bill-value">₱ ${bill.currentBill.toFixed(0)}</span>
        </div>
        
        <div class="bill-row no-border">
            <span class="bill-label">Arrears:</span>
            <span class="bill-value">₱ ${bill.arrears.toFixed(0)}</span>
        </div>
        
        <div class="bill-row total-row">
            <span class="bill-label">Total Due:</span>
            <span class="bill-value">₱ ${bill.totalDue.toFixed(0)}</span>
        </div>
        
        <div class="bill-row due-date-row">
            <span class="bill-label">Due Date:</span>
            <span class="bill-value">${dueDate}</span>
        </div>
        
        <div class="bill-row disconnection-row no-border">
            <span class="bill-label">Disconnection Date:</span>
            <span class="bill-value">${disconnectionDate}</span>
        </div>
    </div>
    
    <div class="barcode-section">
        <div class="barcode-title">Payment Code</div>
        <div class="barcode-container">
            <canvas id="barcode" width="200" height="50"></canvas>
        </div>
        <div class="barcode-number">${this.generatePaymentCode(bill)}</div>
    </div>
    
    <div class="reminders">
        <div class="reminders-title">Reminders</div>
        ${this.formatReminders(reminders)}
    </div>
</body>
</html>
        `;
    }

    /**
     * Generate unique payment code for barcode
     */
    generatePaymentCode(bill) {
        // Format: DWA + Year + Month + MeterNumber + Amount (padded)
        const [year, month] = bill.billingPeriod.split('-');
        const meterNumber = (bill.meterData?.meterNumber || '0000').padStart(4, '0');
        const amount = Math.round(bill.totalDue).toString().padStart(6, '0');
        
        // Generate payment code: DWA + YYYYMM + MeterNumber + Amount
        return `DWA${year}${month}${meterNumber}${amount}`;
    }

    /**
     * Generate barcode using Code 128
     */
    generateBarcode(canvas, code) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        
        // Simple barcode representation (alternating bars)
        ctx.fillStyle = 'black';
        const barWidth = width / (code.length * 2);
        
        for (let i = 0; i < code.length; i++) {
            const charCode = code.charCodeAt(i);
            const barCount = (charCode % 4) + 1; // 1-4 bars per character
            
            for (let j = 0; j < barCount; j++) {
                const x = (i * 2 * barWidth) + (j * barWidth * 0.5);
                if ((i + j) % 2 === 0) { // Alternate black/white
                    ctx.fillRect(x, 0, barWidth * 0.4, height);
                }
            }
        }
    }

    /**
     * Format reminders for printing
     */
    formatReminders(remindersText) {
        const defaultReminders = [
            'Disregard this notice if payment has been made.',
            'This serves as Notice of Disconnection.',
            'Please pay on time. Reconnection fee is Php 500.',
            'Pay bills directly to the cashier.',
            'Kindly report leaks or acts of vandalism on our pipeline.'
        ];

        // Split reminders by newline or use default
        const reminders = remindersText ? remindersText.split('\n') : defaultReminders;

        return reminders.map((reminder, index) => 
            `<div class="reminder-item">${index + 1}. ${reminder.trim()}</div>`
        ).join('');
    }

    /**
     * Get default reminders
     */
    getDefaultReminders() {
        return `Disregard this notice if payment has been made.
This serves as Notice of Disconnection.
Please pay on time. Reconnection fee is Php 500.
Pay bills directly to the cashier.
Kindly report leaks or acts of vandalism on our pipeline.`;
    }

    /**
     * Open print preview
     */
    openPrintPreview(htmlContent, paymentCode) {
        // Create a new window for print preview
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        
        if (!printWindow) {
            alert('Please allow popups to print bills');
            return;
        }

        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Wait for content to load, then generate barcode and print
        printWindow.onload = () => {
            setTimeout(() => {
                const canvas = printWindow.document.getElementById('barcode');
                if (canvas && paymentCode) {
                    this.generateBarcode(canvas, paymentCode);
                }
                
                // Print after barcode is generated
                setTimeout(() => {
                    printWindow.print();
                }, 100);
            }, 250);
        };
    }

    /**
     * Generate plain text bill for thermal printer (alternative)
     */
    generatePlainTextBill(bill, reminders) {
        const [year, month] = bill.billingPeriod.split('-');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        const billingPeriodText = `${monthNames[parseInt(month) - 1]} ${year}`;

        let text = '';
        text += 'Print Notice\n';
        text += '\n';
        text += `${this.associationName}\n`;
        text += `${this.associationAddress}\n`;
        text += '\n';
        text += `Statement of Account for the month of ${billingPeriodText}\n`;
        text += '\n';
        text += `Account Name: ${bill.householdData?.fullName || bill.meterData?.ownerName}\n`;
        text += `Account No.: ${bill.meterData?.meterNumber}\n`;
        text += `Address: ${bill.householdData?.address || 'N/A'}\n`;
        text += `Classification: ${bill.householdData?.classification || 'Residential'}\n`;
        text += '\n';
        text += `Previous Reading: ${bill.previousReading.toFixed(0)}\n`;
        text += `Current Reading: ${bill.currentReading.toFixed(0)}\n`;
        text += `Usage: ${bill.usage.toFixed(0)} cubic meters\n`;
        text += '\n';
        text += `Current Bill: ₱${bill.currentBill.toFixed(0)}\n`;
        text += `Arrears: ₱${bill.arrears.toFixed(0)}\n`;
        text += `Total Due: ₱${bill.totalDue.toFixed(0)}\n`;
        text += '\n';
        text += `Due Date: ${new Date(bill.dueDate).toLocaleDateString()}\n`;
        text += `Disconnection Date: ${new Date(bill.disconnectionDate).toLocaleDateString()}\n`;
        text += '\n';
        text += 'Reminders\n';
        text += reminders;

        return text;
    }
}
