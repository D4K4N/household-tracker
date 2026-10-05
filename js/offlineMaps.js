/**
 * Offline Maps - Pre-download map tiles for offline use
 * Downloads tiles for Barangay Diclum area
 */

class OfflineMapManager {
    constructor() {
        this.cacheName = 'offline-map-tiles-v1';
        this.isDownloading = false;
        this.totalTiles = 0;
        this.downloadedTiles = 0;
        
        // Barangay Diclum boundaries
        this.bounds = {
            north: 8.3800,
            south: 8.3550,
            east: 124.8700,
            west: 124.8480
        };
        
        // Zoom levels to cache (16-20 for close detail)
        this.zoomLevels = [16, 17, 18, 19, 20];
    }

    /**
     * Calculate total tiles needed
     */
    calculateTileCount() {
        let total = 0;
        this.zoomLevels.forEach(zoom => {
            const tiles = this.getTilesForZoom(zoom);
            total += tiles.length;
        });
        return total;
    }

    /**
     * Get tile coordinates for a zoom level
     */
    getTilesForZoom(zoom) {
        const tiles = [];
        const minTile = this.latLngToTile(this.bounds.north, this.bounds.west, zoom);
        const maxTile = this.latLngToTile(this.bounds.south, this.bounds.east, zoom);
        
        for (let x = minTile.x; x <= maxTile.x; x++) {
            for (let y = minTile.y; y <= maxTile.y; y++) {
                tiles.push({ x, y, z: zoom });
            }
        }
        return tiles;
    }

    /**
     * Convert lat/lng to tile coordinates
     */
    latLngToTile(lat, lng, zoom) {
        const n = Math.pow(2, zoom);
        const x = Math.floor((lng + 180) / 360 * n);
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
        return { x, y };
    }

    /**
     * Download all tiles for offline use
     */
    async downloadMapTiles(onProgress, onComplete) {
        if (this.isDownloading) {
            console.log('Already downloading');
            return;
        }

        this.isDownloading = true;
        this.downloadedTiles = 0;
        
        // Get all tiles to download
        const allTiles = [];
        this.zoomLevels.forEach(zoom => {
            const tiles = this.getTilesForZoom(zoom);
            allTiles.push(...tiles);
        });
        
        this.totalTiles = allTiles.length;
        
        console.log(`Starting download of ${this.totalTiles} map tiles...`);
        
        if (onProgress) {
            onProgress(0, this.totalTiles);
        }

        try {
            const cache = await caches.open(this.cacheName);
            
            // Download tiles in batches to avoid overwhelming the browser
            const batchSize = 10;
            for (let i = 0; i < allTiles.length; i += batchSize) {
                const batch = allTiles.slice(i, i + batchSize);
                await Promise.all(
                    batch.map(tile => this.downloadTile(tile, cache))
                );
                
                this.downloadedTiles += batch.length;
                
                if (onProgress) {
                    onProgress(this.downloadedTiles, this.totalTiles);
                }
            }
            
            this.isDownloading = false;
            
            if (onComplete) {
                onComplete(true, this.totalTiles);
            }
            
            console.log('Map download complete!');
            
        } catch (error) {
            console.error('Map download failed:', error);
            this.isDownloading = false;
            
            if (onComplete) {
                onComplete(false, 0);
            }
        }
    }

    /**
     * Download a single tile
     */
    async downloadTile(tile, cache) {
        // Use Google Hybrid tiles (satellite + labels)
        const url = `https://mt1.google.com/vt/lyrs=y&x=${tile.x}&y=${tile.y}&z=${tile.z}`;
        
        try {
            const response = await fetch(url);
            if (response.ok) {
                await cache.put(url, response);
            }
        } catch (error) {
            console.warn('Failed to download tile:', tile, error);
        }
    }

    /**
     * Check if maps are already downloaded
     */
    async checkIfMapsDownloaded() {
        try {
            const cache = await caches.open(this.cacheName);
            const keys = await cache.keys();
            
            // Check if we have at least some tiles cached
            return keys.length > 100; // Rough estimate
        } catch (error) {
            return false;
        }
    }

    /**
     * Clear cached maps
     */
    async clearCachedMaps() {
        try {
            await caches.delete(this.cacheName);
            console.log('Cached maps cleared');
            return true;
        } catch (error) {
            console.error('Failed to clear maps:', error);
            return false;
        }
    }

    /**
     * Get cache size estimate
     */
    async getCacheSize() {
        try {
            const cache = await caches.open(this.cacheName);
            const keys = await cache.keys();
            return {
                tiles: keys.length,
                estimatedMB: (keys.length * 15 / 1024).toFixed(1) // ~15KB per tile
            };
        } catch (error) {
            return { tiles: 0, estimatedMB: 0 };
        }
    }
}
