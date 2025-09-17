import { describe, it, expect } from 'vitest';
import { createTokenSchema } from '../src/schema';

describe('Token Time Range Feature', () => {
    it('should accept valid time range parameters', () => {
        const validToken = {
            expires: true,
            expires_in_days: 30,
            permissions: { read: true, write: false, create_token: false },
            comment: 'Test token',
            available_start_time: new Date('2023-01-01'),
            available_end_time: new Date('2023-12-31'),
        };

        const result = createTokenSchema.safeParse(validToken);
        expect(result.success).toBe(true);
    });

    it('should reject invalid time range (start after end)', () => {
        const invalidToken = {
            expires: true,
            expires_in_days: 30,
            permissions: { read: true, write: false, create_token: false },
            available_start_time: new Date('2023-12-31'),
            available_end_time: new Date('2023-01-01'),
        };

        const result = createTokenSchema.safeParse(invalidToken);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some(issue => 
                issue.message.includes('available_start_time must be before or equal to available_end_time')
            )).toBe(true);
        }
    });

    it('should accept token without time range (optional fields)', () => {
        const tokenWithoutTimeRange = {
            expires: true,
            expires_in_days: 30,
            permissions: { read: true, write: false, create_token: false },
        };

        const result = createTokenSchema.safeParse(tokenWithoutTimeRange);
        expect(result.success).toBe(true);
    });

    it('should parse string dates correctly', () => {
        const tokenWithStringDates = {
            expires: true,
            expires_in_days: 30,
            permissions: { read: true, write: false, create_token: false },
            available_start_time: '2023-01-01T00:00:00Z',
            available_end_time: '2023-12-31T23:59:59Z',
        };

        const result = createTokenSchema.safeParse(tokenWithStringDates);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.available_start_time).toBeInstanceOf(Date);
            expect(result.data.available_end_time).toBeInstanceOf(Date);
        }
    });
});