/**
 * Database.js - IndexedDB Management
 * Handles permanent storage of household data
 */

class HouseholdDatabase {
    constructor() {
        this.dbName = 'HouseholdTrackerDB';
        this.dbVersion = 3; // UPGRADED: v2→v3 adds water meters, billing, settings
        this.storeName = 'households';
        this.routeStoreName = 'routes';
        this.waterMeterLocationStoreName = 'waterMeterLocations';
        this.waterMeterStoreName = 'waterMeters';
        this.billingRecordStoreName = 'billingRecords';
        this.settingsStoreName = 'settings';
        this.migrationMetadataStoreName = 'migrationMetadata';
        this.db = null;
    }

    /**
     * Initialize database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Database failed to open');
                reject(request.error);
            };

            request.onsuccess = async () => {
                this.db = request.result;
                console.log(`Database opened successfully (v${this.dbVersion})`);
                
                // Run post-upgrade migrations if needed
                await this.runPostUpgradeMigrations();
                
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                const newVersion = event.newVersion;

                console.log(`🔄 Upgrading database from v${oldVersion} to v${newVersion}`);

                // V0 → V1: Create households store (initial setup)
                if (oldVersion < 1) {
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        const objectStore = db.createObjectStore(this.storeName, {
                            keyPath: 'id',
                            autoIncrement: true
                        });

                        objectStore.createIndex('surname', 'surname', { unique: false });
                        objectStore.createIndex('firstName', 'firstName', { unique: false });
                        objectStore.createIndex('fullName', 'fullName', { unique: false });
                        objectStore.createIndex('meterNumber', 'meterNumber', { unique: false });
                        objectStore.createIndex('createdAt', 'createdAt', { unique: false });

                        console.log('✅ Households store created');
                    }
                }

                // V1 → V2: Add routes store
                if (oldVersion < 2) {
                    if (!db.objectStoreNames.contains(this.routeStoreName)) {
                        const routeStore = db.createObjectStore(this.routeStoreName, {
                            keyPath: 'id',
                            autoIncrement: true
                        });

                        routeStore.createIndex('startHouseholdId', 'startHouseholdId', { unique: false });
                        routeStore.createIndex('destinationHouseholdId', 'destinationHouseholdId', { unique: false });
                        routeStore.createIndex('createdAt', 'createdAt', { unique: false });

                        console.log('✅ Routes store created');
                    }
                }

                // V2 → V3: Add water meters, billing, and settings (PRESERVES EXISTING DATA)
                if (oldVersion < 3) {
                    // Water Meter Locations store
                    if (!db.objectStoreNames.contains(this.waterMeterLocationStoreName)) {
                        const wmLocStore = db.createObjectStore(this.waterMeterLocationStoreName, {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                        wmLocStore.createIndex('label', 'label', { unique: false });
                        wmLocStore.createIndex('createdAt', 'createdAt', { unique: false });
                        console.log('✅ Water Meter Locations store created');
                    }

                    // Water Meters store
                    if (!db.objectStoreNames.contains(this.waterMeterStoreName)) {
                        const wmStore = db.createObjectStore(this.waterMeterStoreName, {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                        wmStore.createIndex('waterMeterLocationId', 'waterMeterLocationId', { unique: false });
                        wmStore.createIndex('householdId', 'householdId', { unique: false });
                        wmStore.createIndex('meterNumber', 'meterNumber', { unique: false });
                        wmStore.createIndex('ownerName', 'ownerName', { unique: false });
                        wmStore.createIndex('status', 'status', { unique: false });
                        console.log('✅ Water Meters store created');
                    }

                    // Billing Records store
                    if (!db.objectStoreNames.contains(this.billingRecordStoreName)) {
                        const billStore = db.createObjectStore(this.billingRecordStoreName, {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                        billStore.createIndex('meterId', 'meterId', { unique: false });
                        billStore.createIndex('householdId', 'householdId', { unique: false });
                        billStore.createIndex('billingPeriod', 'billingPeriod', { unique: false });
                        billStore.createIndex('createdAt', 'createdAt', { unique: false });
                        billStore.createIndex('dueDate', 'dueDate', { unique: false });
                        console.log('✅ Billing Records store created');
                    }

                    // Settings store
                    if (!db.objectStoreNames.contains(this.settingsStoreName)) {
                        const settingsStore = db.createObjectStore(this.settingsStoreName, {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                        settingsStore.createIndex('key', 'key', { unique: true });
                        settingsStore.createIndex('category', 'category', { unique: false });
                        console.log('✅ Settings store created');
                    }

                    // Migration Metadata store
                    if (!db.objectStoreNames.contains(this.migrationMetadataStoreName)) {
                        const metaStore = db.createObjectStore(this.migrationMetadataStoreName, {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                        metaStore.createIndex('version', 'version', { unique: false });
                        metaStore.createIndex('appliedAt', 'appliedAt', { unique: false });
                        console.log('✅ Migration Metadata store created');
                    }

                    console.log('✅ Database upgraded to v3 - All stores ready');
                }
            };
        });
    }

    /**
     * Run post-upgrade data migrations
     */
    async runPostUpgradeMigrations() {
        try {
            // Check if v3 household enhancement migration needs to run
            const migrationVersion = 'v3-household-enhancement';
            const alreadyRan = await this.checkMigrationRun(migrationVersion);
            
            if (!alreadyRan) {
                console.log('🔄 Running v3 household enhancement migration...');
                await this.migrateHouseholdsToV3();
                await this.initializeDefaultSettings();
            }
        } catch (error) {
            console.error('Migration error:', error);
            // Don't reject - allow app to continue even if migration has issues
        }
    }

    /**
     * Check if a migration has already been run
     */
    async checkMigrationRun(version) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction([this.migrationMetadataStoreName], 'readonly');
            const store = transaction.objectStore(this.migrationMetadataStoreName);
            const index = store.index('version');
            const request = index.get(version);

            request.onsuccess = () => {
                resolve(!!request.result);
            };

            request.onerror = () => {
                resolve(false); // If error, assume not run
            };
        });
    }

    /**
     * Migrate existing households to v3 (add new fields, optionally create meters)
     */
    async migrateHouseholdsToV3() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                [this.storeName, this.waterMeterStoreName, this.migrationMetadataStoreName],
                'readwrite'
            );
            
            const householdStore = transaction.objectStore(this.storeName);
            const meterStore = transaction.objectStore(this.waterMeterStoreName);
            const metaStore = transaction.objectStore(this.migrationMetadataStoreName);

            let migrated = 0;
            let metersCreated = 0;

            const cursorRequest = householdStore.openCursor();

            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor) {
                    const household = cursor.value;

                    // Add new fields if missing (NON-DESTRUCTIVE)
                    let updated = false;

                    if (!household.legacyId) {
                        household.legacyId = household.id;
                        updated = true;
                    }
                    if (household.middleName === undefined) {
                        household.middleName = '';
                        updated = true;
                    }
                    if (!household.zone) {
                        household.zone = '';
                        updated = true;
                    }
                    if (!household.classification) {
                        household.classification = 'residential';
                        updated = true;
                    }
                    if (!household.accountNumber) {
                        household.accountNumber = '';
                        updated = true;
                    }

                    // Update household if any fields were added
                    if (updated) {
                        cursor.update(household);
                        migrated++;
                    }

                    // Optionally migrate meter if meterNumber exists and not yet migrated
                    if (household.meterNumber && 
                        household.meterNumber.trim() !== '' && 
                        !household.migratedToWaterMeter) {
                        
                        const waterMeter = {
                            waterMeterLocationId: null,
                            householdId: household.id,
                            ownerName: household.fullName,
                            meterNumber: household.meterNumber,
                            latitude: household.latitude,
                            longitude: household.longitude,
                            status: 'active',
                            notes: 'Migrated from household record',
                            createdAt: household.createdAt || new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };

                        meterStore.add(waterMeter);
                        metersCreated++;

                        // Mark as migrated
                        household.migratedToWaterMeter = true;
                        cursor.update(household);
                    }

                    cursor.continue();
                } else {
                    // All households processed
                    console.log(`✅ Migration complete: ${migrated} households enhanced, ${metersCreated} meters created`);

                    // Record migration metadata
                    metaStore.add({
                        version: 'v3-household-enhancement',
                        description: 'Enhanced households with new fields and migrated meters',
                        appliedAt: new Date().toISOString(),
                        status: 'completed',
                        householdsProcessed: migrated,
                        metersCreated: metersCreated
                    });

                    resolve({ migrated, metersCreated });
                }
            };

            cursorRequest.onerror = () => {
                console.error('Migration cursor error');
                reject(cursorRequest.error);
            };

            transaction.onerror = () => {
                console.error('Migration transaction error');
                reject(transaction.error);
            };
        });
    }

    /**
     * Initialize default settings
     */
    async initializeDefaultSettings() {
        const defaults = [
            // General
            { key: 'associationName', value: 'Dicklum Water Association, Inc.', category: 'general' },
            { key: 'associationAddress', value: 'Dicklum, Manolo Fortich, Bukidnon', category: 'general' },
            
            // Billing
            { key: 'minimumCharge', value: '150', category: 'billing' },
            { key: 'ratePerCubicMeter', value: '15', category: 'billing' },
            { key: 'dueDaysAfterReading', value: '10', category: 'billing' },
            { key: 'disconnectionDaysAfterDue', value: '30', category: 'billing' },
            { key: 'reminderText', value: 'Please pay on or before due date to avoid disconnection.', category: 'billing' },
            
            // GPS
            { key: 'gpsMinDistance', value: '5', category: 'gps' },
            { key: 'gpsMinTimeInterval', value: '3000', category: 'gps' },
            { key: 'gpsAccuracyThreshold', value: '30', category: 'gps' },
            
            // Map
            { key: 'defaultZoom', value: '17', category: 'map' },
            { key: 'defaultLatitude', value: '8.3456', category: 'map' },
            { key: 'defaultLongitude', value: '124.8678', category: 'map' },
            
            // Database
            { key: 'lastBackupDate', value: '', category: 'database' }
        ];

        for (const setting of defaults) {
            const existing = await this.getSettingByKey(setting.key);
            if (!existing) {
                await this.addSetting(setting);
            }
        }

        console.log('✅ Default settings initialized');
    }

    /**
     * Add a new household
     */
    async addHousehold(householdData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);

            // Prepare household object
            const household = {
                surname: householdData.surname || '',
                firstName: householdData.firstName || '',
                fullName: `${householdData.firstName} ${householdData.surname}`.trim(),
                address: householdData.address || '',
                meterNumber: householdData.meterNumber || '',
                contactNumber: householdData.contactNumber || '',
                notes: householdData.notes || '',
                latitude: householdData.latitude,
                longitude: householdData.longitude,
                gpsAccuracy: householdData.gpsAccuracy || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const request = objectStore.add(household);

            request.onsuccess = () => {
                household.id = request.result;
                console.log('Household added:', household);
                resolve(household);
            };

            request.onerror = () => {
                console.error('Error adding household');
                reject(request.error);
            };
        });
    }

    /**
     * Get all households
     */
    async getAllHouseholds() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get household by ID
     */
    async getHousehold(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Update household
     */
    async updateHousehold(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const getRequest = objectStore.get(id);

            getRequest.onsuccess = () => {
                const household = getRequest.result;
                
                if (!household) {
                    reject(new Error('Household not found'));
                    return;
                }

                // Update fields
                Object.assign(household, updates);
                household.fullName = `${household.firstName} ${household.surname}`.trim();
                household.updatedAt = new Date().toISOString();

                const updateRequest = objectStore.put(household);

                updateRequest.onsuccess = () => {
                    console.log('Household updated:', household);
                    resolve(household);
                };

                updateRequest.onerror = () => {
                    reject(updateRequest.error);
                };
            };

            getRequest.onerror = () => {
                reject(getRequest.error);
            };
        });
    }

    /**
     * Delete household
     */
    async deleteHousehold(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(id);

            request.onsuccess = () => {
                console.log('Household deleted:', id);
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Search households by query
     */
    async searchHouseholds(query) {
        const allHouseholds = await this.getAllHouseholds();
        const searchTerm = query.toLowerCase().trim();

        if (!searchTerm) {
            return allHouseholds;
        }

        return allHouseholds.filter(household => {
            return (
                household.surname.toLowerCase().includes(searchTerm) ||
                household.firstName.toLowerCase().includes(searchTerm) ||
                household.fullName.toLowerCase().includes(searchTerm) ||
                household.address.toLowerCase().includes(searchTerm) ||
                household.meterNumber.toLowerCase().includes(searchTerm)
            );
        });
    }

    /**
     * Export all data as JSON
     */
    async exportData() {
        const households = await this.getAllHouseholds();
        return JSON.stringify(households, null, 2);
    }

    /**
     * Import data from JSON
     */
    async importData(jsonData) {
        try {
            const households = JSON.parse(jsonData);
            
            for (const household of households) {
                // Remove ID to create new entries
                delete household.id;
                await this.addHousehold(household);
            }

            return households.length;
        } catch (error) {
            throw new Error('Invalid JSON data');
        }
    }

    /**
     * Clear all data
     */
    async clearAll() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.clear();

            request.onsuccess = () => {
                console.log('All households cleared');
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // ========== WATER METER LOCATION METHODS ==========

    /**
     * Add a new water meter location
     */
    async addWaterMeterLocation(locationData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.waterMeterLocationStoreName], 'readwrite');
            const store = transaction.objectStore(this.waterMeterLocationStoreName);

            const location = {
                label: locationData.label || '',
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                gpsAccuracy: locationData.gpsAccuracy || null,
                notes: locationData.notes || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const request = store.add(location);

            request.onsuccess = () => {
                location.id = request.result;
                console.log('Water meter location added:', location);
                resolve(location);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all water meter locations
     */
    async getAllWaterMeterLocations() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.waterMeterLocationStoreName], 'readonly');
            const store = transaction.objectStore(this.waterMeterLocationStoreName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get water meter location by ID
     */
    async getWaterMeterLocation(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.waterMeterLocationStoreName], 'readonly');
            const store = transaction.objectStore(this.waterMeterLocationStoreName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update water meter location
     */
    async updateWaterMeterLocation(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.waterMeterLocationStoreName], 'readwrite');
            const store = transaction.objectStore(this.waterMeterLocationStoreName);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const location = getRequest.result;
                if (!location) {
                    reject(new Error('Location not found'));
                    return;
                }

                Object.assign(location, updates);
                location.updatedAt = new Date().toISOString();

                const updateRequest = store.put(location);
                updateRequest.onsuccess = () => resolve(location);
                updateRequest.onerror = () => reject(updateRequest.error);
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Delete water meter location
     */
    async deleteWaterMeterLocation(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.waterMeterLocationStoreName], 'readwrite');
            const store = transaction.objectStore(this.waterMeterLocationStoreName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // ========== WATER METER METHODS ==========

    /**
     * Add a new water meter
     */
    async addWaterMeter(meterData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.waterMeterStoreName], 'readwrite');
            const store = transaction.objectStore(this.waterMeterStoreName);

            const meter = {
                waterMeterLocationId: meterData.waterMeterLocationId || null,
                householdId: meterData.householdId || null,
                ownerName: meterData.ownerName || '',
                meterNumber: meterData.meterNumber || '',
                latitude: meterData.latitude || null,
                longitude: meterData.longitude || null,
                status: meterData.status || 'active',
                notes: meterData.notes || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const request = store.add(meter);

            request.onsuccess = () => {
                meter.id = request.result;
                console.log('Water meter added:', meter);
                resolve(meter);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all water meters
     */
    async getAllWaterMeters() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.waterMeterStoreName], 'readonly');
            const store = transaction.objectStore(this.waterMeterStoreName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get water meter by ID
     */
    async getWaterMeter(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.waterMeterStoreName], 'readonly');
            const store = transaction.objectStore(this.waterMeterStoreName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get water meters for a household
     */
    async getWaterMetersByHousehold(householdId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.waterMeterStoreName], 'readonly');
            const store = transaction.objectStore(this.waterMeterStoreName);
            const index = store.index('householdId');
            const request = index.getAll(householdId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get water meters at a location
     */
    async getWaterMetersByLocation(locationId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.waterMeterStoreName], 'readonly');
            const store = transaction.objectStore(this.waterMeterStoreName);
            const index = store.index('waterMeterLocationId');
            const request = index.getAll(locationId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update water meter
     */
    async updateWaterMeter(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.waterMeterStoreName], 'readwrite');
            const store = transaction.objectStore(this.waterMeterStoreName);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const meter = getRequest.result;
                if (!meter) {
                    reject(new Error('Water meter not found'));
                    return;
                }

                Object.assign(meter, updates);
                meter.updatedAt = new Date().toISOString();

                const updateRequest = store.put(meter);
                updateRequest.onsuccess = () => resolve(meter);
                updateRequest.onerror = () => reject(updateRequest.error);
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Delete water meter
     */
    async deleteWaterMeter(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.waterMeterStoreName], 'readwrite');
            const store = transaction.objectStore(this.waterMeterStoreName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Search water meters
     */
    async searchWaterMeters(query) {
        const allMeters = await this.getAllWaterMeters();
        const searchTerm = query.toLowerCase().trim();

        if (!searchTerm) return allMeters;

        return allMeters.filter(meter => 
            meter.ownerName.toLowerCase().includes(searchTerm) ||
            meter.meterNumber.toLowerCase().includes(searchTerm) ||
            (meter.notes && meter.notes.toLowerCase().includes(searchTerm))
        );
    }

    // ========== BILLING RECORD METHODS ==========

    /**
     * Add a new billing record
     */
    async addBillingRecord(billingData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.billingRecordStoreName], 'readwrite');
            const store = transaction.objectStore(this.billingRecordStoreName);

            const record = {
                meterId: billingData.meterId,
                householdId: billingData.householdId || null,
                billingPeriod: billingData.billingPeriod,
                previousReading: billingData.previousReading || 0,
                currentReading: billingData.currentReading,
                usage: billingData.usage,
                currentBill: billingData.currentBill,
                arrears: billingData.arrears || 0,
                totalDue: billingData.totalDue,
                dueDate: billingData.dueDate,
                disconnectionDate: billingData.disconnectionDate || null,
                rateSnapshot: billingData.rateSnapshot || {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                printedAt: null,
                printStatus: 'pending'
            };

            const request = store.add(record);

            request.onsuccess = () => {
                record.id = request.result;
                console.log('Billing record added:', record);
                resolve(record);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all billing records
     */
    async getAllBillingRecords() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.billingRecordStoreName], 'readonly');
            const store = transaction.objectStore(this.billingRecordStoreName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get billing record by ID
     */
    async getBillingRecord(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.billingRecordStoreName], 'readonly');
            const store = transaction.objectStore(this.billingRecordStoreName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get billing records for a meter
     */
    async getBillingRecordsByMeter(meterId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.billingRecordStoreName], 'readonly');
            const store = transaction.objectStore(this.billingRecordStoreName);
            const index = store.index('meterId');
            const request = index.getAll(meterId);

            request.onsuccess = () => {
                // Sort by date descending (newest first)
                const records = request.result.sort((a, b) => 
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                resolve(records);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get latest billing record for a meter
     */
    async getLatestBillingRecordForMeter(meterId) {
        const records = await this.getBillingRecordsByMeter(meterId);
        return records.length > 0 ? records[0] : null;
    }

    /**
     * Update billing record
     */
    async updateBillingRecord(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.billingRecordStoreName], 'readwrite');
            const store = transaction.objectStore(this.billingRecordStoreName);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const record = getRequest.result;
                if (!record) {
                    reject(new Error('Billing record not found'));
                    return;
                }

                Object.assign(record, updates);
                record.updatedAt = new Date().toISOString();

                const updateRequest = store.put(record);
                updateRequest.onsuccess = () => resolve(record);
                updateRequest.onerror = () => reject(updateRequest.error);
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Delete billing record
     */
    async deleteBillingRecord(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.billingRecordStoreName], 'readwrite');
            const store = transaction.objectStore(this.billingRecordStoreName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // ========== SETTINGS METHODS ==========

    /**
     * Add a setting
     */
    async addSetting(settingData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.settingsStoreName], 'readwrite');
            const store = transaction.objectStore(this.settingsStoreName);

            const setting = {
                key: settingData.key,
                value: settingData.value,
                category: settingData.category || 'general',
                updatedAt: new Date().toISOString()
            };

            const request = store.add(setting);

            request.onsuccess = () => {
                setting.id = request.result;
                resolve(setting);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all settings
     */
    async getAllSettings() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.settingsStoreName], 'readonly');
            const store = transaction.objectStore(this.settingsStoreName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get setting by key
     */
    async getSettingByKey(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.settingsStoreName], 'readonly');
            const store = transaction.objectStore(this.settingsStoreName);
            const index = store.index('key');
            const request = index.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get settings by category
     */
    async getSettingsByCategory(category) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.settingsStoreName], 'readonly');
            const store = transaction.objectStore(this.settingsStoreName);
            const index = store.index('category');
            const request = index.getAll(category);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update setting
     */
    async updateSetting(key, value) {
        return new Promise(async (resolve, reject) => {
            try {
                const setting = await this.getSettingByKey(key);
                
                if (!setting) {
                    reject(new Error('Setting not found'));
                    return;
                }

                const transaction = this.db.transaction([this.settingsStoreName], 'readwrite');
                const store = transaction.objectStore(this.settingsStoreName);
                
                setting.value = value;
                setting.updatedAt = new Date().toISOString();

                const request = store.put(setting);
                request.onsuccess = () => resolve(setting);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Get database statistics
     */
    async getDatabaseStatistics() {
        try {
            const households = await this.getAllHouseholds();
            const locations = await this.getAllWaterMeterLocations();
            const meters = await this.getAllWaterMeters();
            const billingRecords = await this.getAllBillingRecords();
            const routes = await this.getAllRoutes();

            return {
                householdCount: households.length,
                locationCount: locations.length,
                meterCount: meters.length,
                billingRecordCount: billingRecords.length,
                routeCount: routes.length,
                databaseVersion: this.dbVersion
            };
        } catch (error) {
            console.error('Error getting statistics:', error);
            return null;
        }
    }
}



    // ========== ROUTE METHODS ==========

    /**
     * Add a new route
     */
    async addRoute(routeData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.routeStoreName], 'readwrite');
            const objectStore = transaction.objectStore(this.routeStoreName);

            const route = {
                name: routeData.name || '',
                startHouseholdId: routeData.startHouseholdId || null,
                destinationHouseholdId: routeData.destinationHouseholdId || null,
                coordinates: routeData.coordinates || [],
                distance: routeData.distance || 0,
                duration: routeData.duration || 0,
                createdAt: routeData.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const request = objectStore.add(route);

            request.onsuccess = () => {
                route.id = request.result;
                console.log('Route added:', route);
                resolve(route);
            };

            request.onerror = () => {
                console.error('Error adding route');
                reject(request.error);
            };
        });
    }

    /**
     * Get all routes
     */
    async getAllRoutes() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.routeStoreName], 'readonly');
            const objectStore = transaction.objectStore(this.routeStoreName);
            const request = objectStore.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get route by ID
     */
    async getRoute(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.routeStoreName], 'readonly');
            const objectStore = transaction.objectStore(this.routeStoreName);
            const request = objectStore.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Update route
     */
    async updateRoute(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.routeStoreName], 'readwrite');
            const objectStore = transaction.objectStore(this.routeStoreName);
            const getRequest = objectStore.get(id);

            getRequest.onsuccess = () => {
                const route = getRequest.result;
                
                if (!route) {
                    reject(new Error('Route not found'));
                    return;
                }

                Object.assign(route, updates);
                route.updatedAt = new Date().toISOString();

                const updateRequest = objectStore.put(route);

                updateRequest.onsuccess = () => {
                    console.log('Route updated:', route);
                    resolve(route);
                };

                updateRequest.onerror = () => {
                    reject(updateRequest.error);
                };
            };

            getRequest.onerror = () => {
                reject(getRequest.error);
            };
        });
    }

    /**
     * Delete route
     */
    async deleteRoute(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.routeStoreName], 'readwrite');
            const objectStore = transaction.objectStore(this.routeStoreName);
            const request = objectStore.delete(id);

            request.onsuccess = () => {
                console.log('Route deleted:', id);
                resolve(true);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get routes for a specific household
     */
    async getRoutesForHousehold(householdId) {
        const allRoutes = await this.getAllRoutes();
        return allRoutes.filter(route => 
            route.startHouseholdId === householdId || 
            route.destinationHouseholdId === householdId
        );
    }
