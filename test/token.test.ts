import { describe, it, expect } from 'vitest';
import { generateToken } from '../src/utils/token';

describe('Token Utility', () => {
    it('should generate a token with default length', () => {
        const token = generateToken();
        
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(40); // Base64 encoded 32 bytes should be longer
        expect(token.length).toBeLessThan(50);    // But not too long
    });

    it('should generate a token with custom length', () => {
        const token = generateToken(16);
        
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(20);
        expect(token.length).toBeLessThan(25);
    });

    it('should generate different tokens on each call', () => {
        const token1 = generateToken();
        const token2 = generateToken();
        
        expect(token1).not.toBe(token2);
    });

    it('should generate tokens without unsafe characters', () => {
        const token = generateToken();
        
        // Should not contain +, /, or = characters (URL-safe base64)
        expect(token).not.toMatch(/[+/=]/);
    });

    it('should generate tokens of consistent length for same input', () => {
        const tokens = Array.from({ length: 10 }, () => generateToken(32));
        
        const lengths = tokens.map(token => token.length);
        const uniqueLengths = new Set(lengths);
        
        expect(uniqueLengths.size).toBe(1); // All tokens should have same length
    });

    it('should handle edge case of very small length', () => {
        const token = generateToken(1);
        
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(0);
    });

    it('should handle edge case of large length', () => {
        const token = generateToken(256);
        
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(300); // Base64 encoded 256 bytes
    });

    it('should generate cryptographically random tokens', () => {
        // Generate many tokens and check for randomness
        const tokens = Array.from({ length: 1000 }, () => generateToken(8));
        const uniqueTokens = new Set(tokens);
        
        // All tokens should be unique (extremely high probability)
        expect(uniqueTokens.size).toBe(1000);
    });

    it('should generate tokens suitable for URL use', () => {
        const token = generateToken();
        
        // Should be valid for URL usage (no percent encoding needed)
        const encoded = encodeURIComponent(token);
        expect(encoded).toBe(token);
    });

    it('should generate tokens suitable for HTTP headers', () => {
        const token = generateToken();
        
        // Should not contain whitespace or control characters
        expect(token).toMatch(/^[A-Za-z0-9\-_]+$/);
    });
});