import { describe, it, expect, beforeEach } from 'vitest';
import { authMiddleware } from '../src/middleware/auth';
import { sha256 } from 'hono/utils/crypto';

// Mock environment for testing
const createMockEnv = () => ({
    DB: {
        prepare: (query: string) => ({
            bind: (...args: any[]) => ({
                first: async () => {
                    // Mock token record
                    if (query.includes('SELECT * FROM tokens')) {
                        const tokenHash = await sha256('valid-token');
                        if (args[0] === tokenHash) {
                            return {
                                id: 1,
                                token_hash: tokenHash,
                                permissions: JSON.stringify({ read: true, write: false, create_token: false }),
                                expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
                                comment: null,
                                available_start_time: null,
                                available_end_time: null
                            };
                        }
                        // Expired token - this should NOT be returned by the query
                        // because the middleware query includes "expires_at > now"
                        if (args[0] === await sha256('expired-token')) {
                            return null; // Expired tokens are filtered out by the query
                        }
                        // Admin token
                        if (args[0] === await sha256('admin-token')) {
                            return {
                                id: 3,
                                token_hash: await sha256('admin-token'),
                                permissions: JSON.stringify({ read: true, write: true, create_token: true }),
                                expires_at: null, // Never expires
                                comment: 'Admin token',
                                available_start_time: null,
                                available_end_time: null
                            };
                        }
                    }
                    return null;
                }
            })
        })
    }
});

const createMockContext = (authHeader?: string, env = createMockEnv()) => ({
    env,
    req: {
        header: (name: string) => {
            if (name === 'Authorization') {
                return authHeader;
            }
            return undefined;
        }
    },
    json: (data: any, status?: number) => ({
        data,
        status: status || 200
    })
});

describe('Authentication Middleware', () => {
    it('should reject requests without Authorization header', async () => {
        const middleware = authMiddleware('read');
        const context = createMockContext();
        
        const result = await middleware(context, async () => {});
        
        expect(result.status).toBe(401);
        expect(result.data.error).toBe('Unauthorized');
    });

    it('should reject requests with invalid Authorization header format', async () => {
        const middleware = authMiddleware('read');
        const context = createMockContext('invalid-header');
        
        const result = await middleware(context, async () => {});
        
        expect(result.status).toBe(401);
        expect(result.data.error).toBe('Unauthorized');
    });

    it('should reject requests with non-Bearer token', async () => {
        const middleware = authMiddleware('read');
        const context = createMockContext('Basic dXNlcjpwYXNz');
        
        const result = await middleware(context, async () => {});
        
        expect(result.status).toBe(401);
        expect(result.data.error).toBe('Unauthorized');
    });

    it('should reject requests with invalid token', async () => {
        const middleware = authMiddleware('read');
        const context = createMockContext('Bearer invalid-token');
        
        const result = await middleware(context, async () => {});
        
        expect(result.status).toBe(401);
        expect(result.data.error).toBe('Unauthorized');
    });

    it('should reject requests with expired token', async () => {
        const middleware = authMiddleware('read');
        const context = createMockContext('Bearer expired-token');
        
        const result = await middleware(context, async () => {});
        
        expect(result).toBeDefined();
        expect(result.status).toBe(401);
        expect(result.data.error).toBe('Unauthorized');
    });

    it('should accept requests with valid token and sufficient permissions', async () => {
        const middleware = authMiddleware('read');
        const context = createMockContext('Bearer valid-token');
        
        let nextCalled = false;
        const next = async () => { nextCalled = true; };
        
        const result = await middleware(context, next);
        
        expect(nextCalled).toBe(true);
        expect(result).toBeUndefined();
        expect((context as any).tokenRecord).toBeDefined();
        expect((context as any).tokenRecord.id).toBe(1);
    });

    it('should reject requests with insufficient permissions', async () => {
        const middleware = authMiddleware('write'); // token only has read permission
        const context = createMockContext('Bearer valid-token');
        
        const result = await middleware(context, async () => {});
        
        expect(result.status).toBe(403);
        expect(result.data.error).toBe('Forbidden');
    });

    it('should accept admin token for any permission', async () => {
        const readMiddleware = authMiddleware('read');
        const writeMiddleware = authMiddleware('write');
        const createTokenMiddleware = authMiddleware('create_token');
        
        const context = createMockContext('Bearer admin-token');
        
        let nextCallCount = 0;
        const next = async () => { nextCallCount++; };
        
        // Test all permissions
        await readMiddleware(context, next);
        await writeMiddleware(context, next);
        await createTokenMiddleware(context, next);
        
        expect(nextCallCount).toBe(3);
    });

    it('should store token record in context for later use', async () => {
        const middleware = authMiddleware('read');
        const context = createMockContext('Bearer valid-token');
        
        await middleware(context, async () => {});
        
        const tokenRecord = (context as any).tokenRecord;
        expect(tokenRecord).toBeDefined();
        expect(tokenRecord.id).toBe(1);
        expect(tokenRecord.permissions).toBe(JSON.stringify({ read: true, write: false, create_token: false }));
        expect(tokenRecord.available_start_time).toBeNull();
        expect(tokenRecord.available_end_time).toBeNull();
    });

    it('should handle tokens with time range restrictions', async () => {
        const mockEnv = createMockEnv();
        // Override the DB mock to return token with time restrictions
        mockEnv.DB.prepare = (query: string) => ({
            bind: (...args: any[]) => ({
                first: async () => {
                    if (query.includes('SELECT * FROM tokens')) {
                        const tokenHash = await sha256('time-restricted-token');
                        if (args[0] === tokenHash) {
                            return {
                                id: 4,
                                token_hash: tokenHash,
                                permissions: JSON.stringify({ read: true, write: false, create_token: false }),
                                expires_at: Math.floor(Date.now() / 1000) + 3600,
                                comment: 'Time restricted token',
                                available_start_time: 1672531200, // 2023-01-01
                                available_end_time: 1703980799    // 2023-12-31
                            };
                        }
                    }
                    return null;
                }
            })
        });

        const middleware = authMiddleware('read');
        const context = createMockContext('Bearer time-restricted-token', mockEnv);
        
        await middleware(context, async () => {});
        
        const tokenRecord = (context as any).tokenRecord;
        expect(tokenRecord).toBeDefined();
        expect(tokenRecord.available_start_time).toBe(1672531200);
        expect(tokenRecord.available_end_time).toBe(1703980799);
    });

    it('should handle database errors gracefully', async () => {
        const mockEnv = {
            DB: {
                prepare: () => ({
                    bind: () => ({
                        first: async () => {
                            throw new Error('Database connection failed');
                        }
                    })
                })
            }
        };

        const middleware = authMiddleware('read');
        const context = createMockContext('Bearer valid-token', mockEnv);
        
        try {
            await middleware(context, async () => {});
            expect.fail('Should have thrown an error');
        } catch (error) {
            expect((error as Error).message).toBe('Database connection failed');
        }
    });
});