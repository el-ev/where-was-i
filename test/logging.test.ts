import { describe, it, expect, vi } from 'vitest';
import { Logger } from '../src/utils/logger';

describe('Logger functionality', () => {
    it('should format log messages with structured data', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        
        Logger.info('Test message', {
            action: 'test_action',
            userId: 'test_user'
        });
        
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('"level":"INFO"')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('"message":"Test message"')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('"action":"test_action"')
        );
        
        consoleSpy.mockRestore();
    });

    it('should create request logger with context', () => {
        const mockRequest = new Request('https://example.com/test', {
            method: 'GET',
            headers: { 'user-agent': 'test-agent' }
        });
        
        const requestLogger = Logger.createRequestLogger(mockRequest);
        
        expect(requestLogger.requestId).toBeDefined();
        expect(typeof requestLogger.requestId).toBe('string');
        expect(requestLogger.log).toBeInstanceOf(Function);
        expect(requestLogger.warn).toBeInstanceOf(Function);
        expect(requestLogger.error).toBeInstanceOf(Function);
        expect(requestLogger.debug).toBeInstanceOf(Function);
    });

    it('should handle error logging with stack traces', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        const testError = new Error('Test error');
        Logger.error('Error occurred', testError, {
            action: 'test_error'
        });
        
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('"level":"ERROR"')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('"message":"Error occurred"')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('"name":"Error"')
        );
        
        consoleSpy.mockRestore();
    });
});