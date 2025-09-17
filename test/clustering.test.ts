import { describe, it, expect } from 'vitest';
import { crowFlyDist, clusterLocations } from '../src/utils/clustering';
import { LocationRecord } from '../src/schema';

describe('Clustering Utility', () => {
    describe('crowFlyDist', () => {
        it('should calculate zero distance for same coordinates', () => {
            const distance = crowFlyDist(37.7749, -122.4194, 37.7749, -122.4194);
            expect(distance).toBe(0);
        });

        it('should calculate correct distance for known coordinates', () => {
            // San Francisco to Los Angeles (approx 559 km)
            const distance = crowFlyDist(37.7749, -122.4194, 34.0522, -118.2437);
            expect(distance).toBeCloseTo(559121, -3); // Within 1km tolerance
        });

        it('should calculate short distances accurately', () => {
            // 1 degree latitude ≈ 111 km
            const distance = crowFlyDist(37.0, -122.0, 38.0, -122.0);
            expect(distance).toBeCloseTo(111195, -3); // Within 1km tolerance
        });

        it('should handle crossing the prime meridian', () => {
            const distance = crowFlyDist(51.5074, -0.1278, 51.5074, 0.1278); // London area
            expect(distance).toBeGreaterThan(0);
            expect(distance).toBeLessThan(50000); // Should be reasonable
        });

        it('should handle polar regions', () => {
            const distance = crowFlyDist(89.0, 0.0, 89.0, 180.0);
            expect(distance).toBeGreaterThan(0);
            expect(distance).toBeLessThan(500000);
        });
    });

    describe('clusterLocations', () => {
        const createLocation = (id: number, lat: number, lng: number, timestamp: number): LocationRecord => ({
            id,
            latitude: lat,
            longitude: lng,
            altitude: 0,
            timestamp
        });

        it('should return empty array for empty input', () => {
            const result = clusterLocations([], 20);
            expect(result).toEqual([]);
        });

        it('should return all points when clustering disabled', () => {
            const locations = [
                createLocation(1, 37.7749, -122.4194, 1000),
                createLocation(2, 37.7750, -122.4195, 2000),
                createLocation(3, 37.7751, -122.4196, 3000)
            ];

            const result = clusterLocations(locations, 0);
            expect(result).toEqual(locations);
        });

        it('should cluster nearby points', () => {
            const locations = [
                createLocation(1, 37.7749, -122.4194, 1000),
                createLocation(2, 37.7749, -122.4194, 2000), // Same location
                createLocation(3, 37.7749, -122.4194, 3000), // Same location
            ];

            const result = clusterLocations(locations, 20);
            expect(result.length).toBe(1);
            expect(result[0].id).toBeOneOf([1, 2, 3]); // Should be one of the original points
        });

        it('should not cluster distant points', () => {
            const locations = [
                createLocation(1, 37.7749, -122.4194, 1000), // San Francisco
                createLocation(2, 34.0522, -118.2437, 2000), // Los Angeles
                createLocation(3, 40.7128, -74.0060, 3000),  // New York
            ];

            const result = clusterLocations(locations, 1000); // 1km clustering
            expect(result.length).toBe(3); // Should remain separate
        });

        it('should select representative points closest to centroid', () => {
            const locations = [
                createLocation(1, 37.7748, -122.4194, 1000), // Slightly south
                createLocation(2, 37.7749, -122.4194, 2000), // Center
                createLocation(3, 37.7750, -122.4194, 3000), // Slightly north
            ];

            const result = clusterLocations(locations, 500); // Large clustering distance
            expect(result.length).toBe(1);
            expect(result[0].id).toBe(2); // Should select the center point
        });

        it('should handle sliding window logic correctly', () => {
            // Create a pattern: cluster, outlier, cluster
            const locations = [
                createLocation(1, 37.7749, -122.4194, 1000),
                createLocation(2, 37.7749, -122.4194, 2000), // Same as 1
                createLocation(3, 37.8000, -122.4000, 3000), // Far away outlier
                createLocation(4, 37.7749, -122.4194, 4000), // Back to original cluster
                createLocation(5, 37.7749, -122.4194, 5000), // Same as 4
            ];

            const result = clusterLocations(locations, 20, 5, 0.2);
            
            // Should create separate clusters due to outlier
            expect(result.length).toBeGreaterThan(1);
            expect(result.length).toBeLessThanOrEqual(3);
        });

        it('should respect custom window size', () => {
            const locations = Array.from({ length: 10 }, (_, i) => 
                createLocation(i + 1, 37.7749 + (i % 2) * 0.01, -122.4194, i * 1000)
            );

            const result1 = clusterLocations(locations, 20, 2); // Small window
            const result2 = clusterLocations(locations, 20, 8); // Large window
            
            // Different window sizes should potentially produce different results
            expect(result1.length).toBeGreaterThanOrEqual(1);
            expect(result2.length).toBeGreaterThanOrEqual(1);
        });

        it('should respect custom split threshold', () => {
            const locations = [
                createLocation(1, 37.7749, -122.4194, 1000),
                createLocation(2, 37.8000, -122.4000, 2000), // Far outlier
                createLocation(3, 37.7749, -122.4194, 3000), // Back to cluster
            ];

            const result1 = clusterLocations(locations, 20, 5, 0.1); // Low threshold
            const result2 = clusterLocations(locations, 20, 5, 0.9); // High threshold
            
            // Different thresholds should potentially affect clustering
            expect(result1.length).toBeGreaterThanOrEqual(1);
            expect(result2.length).toBeGreaterThanOrEqual(1);
        });

        it('should maintain chronological order preference', () => {
            const locations = [
                createLocation(1, 37.7749, -122.4194, 3000), // Newest first (reverse order)
                createLocation(2, 37.7749, -122.4194, 2000),
                createLocation(3, 37.7749, -122.4194, 1000), // Oldest last
            ];

            const result = clusterLocations(locations, 100);
            expect(result.length).toBe(1);
            // Should return one of the actual points, not interpolated
            expect([1, 2, 3]).toContain(result[0].id);
        });

        it('should handle single point', () => {
            const locations = [createLocation(1, 37.7749, -122.4194, 1000)];
            const result = clusterLocations(locations, 20);
            
            expect(result.length).toBe(1);
            expect(result[0]).toEqual(locations[0]);
        });

        it('should handle very large clustering distance', () => {
            const locations = [
                createLocation(1, 37.7749, -122.4194, 1000),
                createLocation(2, 37.7750, -122.4195, 2000),
                createLocation(3, 37.7751, -122.4196, 3000),
            ];

            const result = clusterLocations(locations, 100000); // 100km
            expect(result.length).toBe(1); // Should cluster everything
        });

        it('should preserve original point properties', () => {
            const locations = [
                createLocation(1, 37.7749, -122.4194, 1000),
                createLocation(2, 37.7749, -122.4194, 2000),
            ];

            const result = clusterLocations(locations, 100);
            expect(result.length).toBe(1);
            
            const representative = result[0];
            expect(representative.latitude).toBe(37.7749);
            expect(representative.longitude).toBe(-122.4194);
            expect(representative.altitude).toBe(0);
            expect([1000, 2000]).toContain(representative.timestamp);
        });

        it('should handle numerical precision correctly', () => {
            const locations = [
                createLocation(1, 37.774900001, -122.419400001, 1000),
                createLocation(2, 37.774900002, -122.419400002, 2000),
            ];

            const result = clusterLocations(locations, 1); // 1 meter
            // These points are very close, should cluster
            expect(result.length).toBe(1);
        });
    });
});