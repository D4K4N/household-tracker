/**
 * GPS.js - GPS Location Tracking Module
 * Handles real-time GPS tracking using navigator.geolocation.watchPosition()
 */

class GPSTracker {
    constructor() {
        this.watchId = null;
        this.currentPosition = null;
        this.accuracy = null;
        this.isTracking = false;
        this.callbacks = {
            onPositionUpdate: null,
            onStatusChange: null,
            onError: null
        };
    }

    /**
     * Start GPS tracking
     */
    startTracking() {
        if (!navigator.geolocation) {
            this.handleError({
                code: 0,
                message: 'Geolocation is not supported by your browser'
            });
            return;
        }

        if (this.isTracking) {
            console.log('GPS tracking already active');
            return;
        }

        this.updateStatus('searching', 'Searching for GPS...');

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePosition(position),
            (error) => this.handleError(error),
            options
        );

        this.isTracking = true;
        
        // Also start compass/heading tracking if available
        this.startCompassTracking();
        
        console.log('GPS tracking started');
    }
    
    /**
     * Start compass/heading tracking
     */
    startCompassTracking() {
        if ('ondeviceorientationabsolute' in window) {
            window.addEventListener('deviceorientationabsolute', (event) => {
                if (event.absolute && event.alpha !== null) {
                    const heading = 360 - event.alpha; // Convert to compass heading
                    if (this.callbacks.onHeadingUpdate) {
                        this.callbacks.onHeadingUpdate(heading);
                    }
                }
            });
        } else if ('ondeviceorientation' in window) {
            window.addEventListener('deviceorientation', (event) => {
                if (event.alpha !== null) {
                    // Compass heading (0 = North, 90 = East, 180 = South, 270 = West)
                    let heading = event.webkitCompassHeading || (360 - event.alpha);
                    if (this.callbacks.onHeadingUpdate) {
                        this.callbacks.onHeadingUpdate(heading);
                    }
                }
            });
        } else {
            console.log('Device orientation not supported');
        }
    }

    /**
     * Stop GPS tracking
     */
    stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.isTracking = false;
            console.log('GPS tracking stopped');
        }
    }

    /**
     * Handle successful position update
     */
    handlePosition(position) {
        this.currentPosition = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
        };

        this.accuracy = position.coords.accuracy;

        this.updateStatus('active', 'GPS Active');

        if (this.callbacks.onPositionUpdate) {
            this.callbacks.onPositionUpdate(this.currentPosition);
        }

        console.log('GPS position updated:', {
            lat: this.currentPosition.latitude.toFixed(6),
            lng: this.currentPosition.longitude.toFixed(6),
            accuracy: Math.round(this.accuracy) + 'm'
        });
    }

    /**
     * Handle GPS errors
     */
    handleError(error) {
        let errorMessage = 'GPS unavailable';
        let errorCode = error.code;

        switch (errorCode) {
            case 1: // PERMISSION_DENIED
                errorMessage = 'Location permission denied';
                break;
            case 2: // POSITION_UNAVAILABLE
                errorMessage = 'Position unavailable';
                break;
            case 3: // TIMEOUT
                errorMessage = 'GPS timeout';
                break;
            default:
                errorMessage = error.message || 'GPS error';
        }

        this.updateStatus('error', errorMessage);

        if (this.callbacks.onError) {
            this.callbacks.onError(error);
        }

        console.error('GPS error:', errorMessage);
    }

    /**
     * Update GPS status
     */
    updateStatus(status, message) {
        if (this.callbacks.onStatusChange) {
            this.callbacks.onStatusChange(status, message);
        }
    }

    /**
     * Get current position
     */
    getCurrentPosition() {
        return this.currentPosition;
    }

    /**
     * Get current accuracy
     */
    getAccuracy() {
        return this.accuracy;
    }

    /**
     * Check if GPS accuracy is good enough for saving
     */
    isAccuracyGood(threshold = 20) {
        return this.accuracy !== null && this.accuracy <= threshold;
    }

    /**
     * Register callback for position updates
     */
    onPositionUpdate(callback) {
        this.callbacks.onPositionUpdate = callback;
    }

    /**
     * Register callback for status changes
     */
    onStatusChange(callback) {
        this.callbacks.onStatusChange = callback;
    }

    /**
     * Register callback for errors
     */
    onError(callback) {
        this.callbacks.onError = callback;
    }

    /**
     * Get formatted coordinates string
     */
    getFormattedCoordinates() {
        if (!this.currentPosition) {
            return '';
        }
        return `Lat: ${this.currentPosition.latitude.toFixed(6)}, Lng: ${this.currentPosition.longitude.toFixed(6)}`;
    }

    /**
     * Get formatted accuracy string
     */
    getFormattedAccuracy() {
        if (this.accuracy === null) {
            return '';
        }
        return `±${Math.round(this.accuracy)}m`;
    }
}
