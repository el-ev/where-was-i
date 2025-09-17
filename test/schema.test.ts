import { describe, it, expect } from 'vitest';
import { 
    locationSchema, 
    createTokenSchema, 
    locationQuerySchema, 
    permissionsSchema 
} from '../src/schema';

describe('Schema Validation', () => {
    describe('locationSchema', () => {
        it('should accept valid location data', () => {
            const validLocation = {
                lat: 37.7749,
                lng: -122.4194,
                alt: 10.5,
                t: 1672531200
            };

            const result = locationSchema.safeParse(validLocation);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual(validLocation);
            }
        });

        it('should reject invalid latitude', () => {
            const invalidLocation = {
                lat: 91, // Invalid: > 90
                lng: -122.4194,
                alt: 10.5,
                t: 1672531200
            };

            const result = locationSchema.safeParse(invalidLocation);
            expect(result.success).toBe(false);
        });

        it('should reject invalid longitude', () => {
            const invalidLocation = {
                lat: 37.7749,
                lng: -181, // Invalid: < -180
                alt: 10.5,
                t: 1672531200
            };

            const result = locationSchema.safeParse(invalidLocation);
            expect(result.success).toBe(false);
        });

        it('should reject negative timestamp', () => {
            const invalidLocation = {
                lat: 37.7749,
                lng: -122.4194,
                alt: 10.5,
                t: -1 // Invalid: negative
            };

            const result = locationSchema.safeParse(invalidLocation);
            expect(result.success).toBe(false);
        });

        it('should reject non-integer timestamp', () => {
            const invalidLocation = {
                lat: 37.7749,
                lng: -122.4194,
                alt: 10.5,
                t: 1672531200.5 // Invalid: not integer
            };

            const result = locationSchema.safeParse(invalidLocation);
            expect(result.success).toBe(false);
        });

        it('should accept boundary values', () => {
            const boundaryLocation = {
                lat: 90,    // Max latitude
                lng: 180,   // Max longitude
                alt: -1000, // Negative altitude (below sea level)
                t: 0        // Zero timestamp
            };

            const result = locationSchema.safeParse(boundaryLocation);
            expect(result.success).toBe(true);
        });

        it('should reject missing required fields', () => {
            const incompleteLocation = {
                lat: 37.7749,
                lng: -122.4194
                // Missing alt and t
            };

            const result = locationSchema.safeParse(incompleteLocation);
            expect(result.success).toBe(false);
        });
    });

    describe('permissionsSchema', () => {
        it('should accept valid permissions', () => {
            const validPermissions = {
                read: true,
                write: false,
                create_token: true
            };

            const result = permissionsSchema.safeParse(validPermissions);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toEqual(validPermissions);
            }
        });

        it('should apply default values for missing fields', () => {
            const partialPermissions = {
                read: true
                // write and create_token should default to false
            };

            const result = permissionsSchema.safeParse(partialPermissions);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.read).toBe(true);
                expect(result.data.write).toBe(false);
                expect(result.data.create_token).toBe(false);
            }
        });

        it('should accept empty object with defaults', () => {
            const result = permissionsSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.read).toBe(false);
                expect(result.data.write).toBe(false);
                expect(result.data.create_token).toBe(false);
            }
        });

        it('should reject non-boolean values', () => {
            const invalidPermissions = {
                read: "true", // String instead of boolean
                write: false,
                create_token: false
            };

            const result = permissionsSchema.safeParse(invalidPermissions);
            expect(result.success).toBe(false);
        });
    });

    describe('createTokenSchema', () => {
        it('should accept valid token creation data', () => {
            const validToken = {
                expires: true,
                expires_in_days: 30,
                permissions: { read: true, write: false, create_token: false },
                comment: 'Test token',
                available_start_time: new Date('2023-01-01'),
                available_end_time: new Date('2023-12-31')
            };

            const result = createTokenSchema.safeParse(validToken);
            expect(result.success).toBe(true);
        });

        it('should apply default values', () => {
            const minimalToken = {
                permissions: { read: true }
            };

            const result = createTokenSchema.safeParse(minimalToken);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.expires).toBe(true);
                expect(result.data.expires_in_days).toBe(30);
                expect(result.data.permissions.write).toBe(false);
                expect(result.data.permissions.create_token).toBe(false);
            }
        });

        it('should parse string dates', () => {
            const tokenWithStringDates = {
                expires: true,
                expires_in_days: 30,
                permissions: { read: true },
                available_start_time: '2023-01-01T00:00:00Z',
                available_end_time: '2023-12-31T23:59:59Z'
            };

            const result = createTokenSchema.safeParse(tokenWithStringDates);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.available_start_time).toBeInstanceOf(Date);
                expect(result.data.available_end_time).toBeInstanceOf(Date);
            }
        });

        it('should reject invalid time range (start after end)', () => {
            const invalidToken = {
                expires: true,
                expires_in_days: 30,
                permissions: { read: true },
                available_start_time: new Date('2023-12-31'),
                available_end_time: new Date('2023-01-01')
            };

            const result = createTokenSchema.safeParse(invalidToken);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(issue => 
                    issue.message.includes('available_start_time must be before or equal to available_end_time')
                )).toBe(true);
            }
        });

        it('should accept equal start and end times', () => {
            const sameTimeToken = {
                expires: true,
                expires_in_days: 30,
                permissions: { read: true },
                available_start_time: new Date('2023-01-01T12:00:00Z'),
                available_end_time: new Date('2023-01-01T12:00:00Z')
            };

            const result = createTokenSchema.safeParse(sameTimeToken);
            expect(result.success).toBe(true);
        });

        it('should allow only start time', () => {
            const startOnlyToken = {
                expires: true,
                expires_in_days: 30,
                permissions: { read: true },
                available_start_time: new Date('2023-01-01')
            };

            const result = createTokenSchema.safeParse(startOnlyToken);
            expect(result.success).toBe(true);
        });

        it('should allow only end time', () => {
            const endOnlyToken = {
                expires: true,
                expires_in_days: 30,
                permissions: { read: true },
                available_end_time: new Date('2023-12-31')
            };

            const result = createTokenSchema.safeParse(endOnlyToken);
            expect(result.success).toBe(true);
        });

        it('should reject negative expires_in_days', () => {
            const invalidToken = {
                expires: true,
                expires_in_days: -1,
                permissions: { read: true }
            };

            const result = createTokenSchema.safeParse(invalidToken);
            expect(result.success).toBe(false);
        });

        it('should reject non-integer expires_in_days', () => {
            const invalidToken = {
                expires: true,
                expires_in_days: 30.5,
                permissions: { read: true }
            };

            const result = createTokenSchema.safeParse(invalidToken);
            expect(result.success).toBe(false);
        });

        it('should handle invalid date strings', () => {
            const invalidToken = {
                expires: true,
                expires_in_days: 30,
                permissions: { read: true },
                available_start_time: 'invalid-date'
            };

            const result = createTokenSchema.safeParse(invalidToken);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.available_start_time).toBeUndefined();
            }
        });
    });

    describe('locationQuerySchema', () => {
        it('should accept valid query parameters', () => {
            const validQuery = {
                startId: '100',
                startTime: '2023-01-01T00:00:00Z',
                endTime: '2023-12-31T23:59:59Z',
                clusterMaxDist: '20',
                limit: '1000',
                bbox: '-122.5,37.7,-122.3,37.8'
            };

            const result = locationQuerySchema.safeParse(validQuery);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.startId).toBe(100);
                expect(result.data.startTime).toBeInstanceOf(Date);
                expect(result.data.endTime).toBeInstanceOf(Date);
                expect(result.data.clusterMaxDist).toBe(20);
                expect(result.data.limit).toBe(1000);
                expect(result.data.bbox).toEqual([-122.5, 37.7, -122.3, 37.8]);
            }
        });

        it('should accept empty query', () => {
            const result = locationQuerySchema.safeParse({});
            expect(result.success).toBe(true);
        });

        it('should reject invalid time range', () => {
            const invalidQuery = {
                startTime: '2023-12-31T00:00:00Z',
                endTime: '2023-01-01T00:00:00Z'
            };

            const result = locationQuerySchema.safeParse(invalidQuery);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some(issue => 
                    issue.message.includes('startTime must be before or equal to endTime')
                )).toBe(true);
            }
        });

        it('should reject invalid bbox coordinates', () => {
            const invalidQuery = {
                bbox: '-122.5,91,-122.3,37.8' // Invalid latitude > 90
            };

            const result = locationQuerySchema.safeParse(invalidQuery);
            expect(result.success).toBe(false);
        });

        it('should parse bbox array format', () => {
            const arrayQuery = {
                bbox: [-122.5, 37.7, -122.3, 37.8]
            };

            const result = locationQuerySchema.safeParse(arrayQuery);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.bbox).toEqual([-122.5, 37.7, -122.3, 37.8]);
            }
        });

        it('should handle negative inputs gracefully', () => {
            const invalidQuery = {
                startId: '-1',
                limit: '-5',
                clusterMaxDist: '-10'
            };

            const result = locationQuerySchema.safeParse(invalidQuery);
            expect(result.success).toBe(true);
            if (result.success) {
                // Negative values should be parsed as undefined (invalid)
                expect(result.data.startId).toBeUndefined();
                expect(result.data.limit).toBeUndefined();
                expect(result.data.clusterMaxDist).toBeUndefined();
            }
        });

        it('should handle invalid number strings', () => {
            const invalidQuery = {
                limit: 'not-a-number'
            };

            const result = locationQuerySchema.safeParse(invalidQuery);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.limit).toBeUndefined();
            }
        });

        it('should handle malformed bbox', () => {
            const invalidQuery = {
                bbox: 'invalid-bbox-format'
            };

            const result = locationQuerySchema.safeParse(invalidQuery);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.bbox).toBeUndefined();
            }
        });
    });
});