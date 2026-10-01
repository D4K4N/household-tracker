/**
 * Database.js - IndexedDB Management
 * Handles permanent storage of household data
 */

class HouseholdDatabase {
    constructor() {
        this.dbName = 'HouseholdTrackerDB';
        this.dbVersion = 1;
        this.storeName = 'households';
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

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    // Create indexes for searching
                    objectStore.createIndex('surname', 'surname', { unique: false });
                    objectStore.createIndex('firstName', 'firstName', { unique: false });
                    objectStore.createIndex('fullName', 'fullName', { unique: false });
                    objectStore.createIndex('meterNumber', 'meterNumber', { unique: false });
                    objectStore.createIndex('createdAt', 'createdAt', { unique: false });

                    console.log('Database setup complete');
                }
            };
        });
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
}
