import { sha256 } from 'hono/utils/crypto';
import type { Permissions, TokenRecord } from '../schema';

export const authMiddleware = (required: keyof Permissions) => {
    return async (c: any, next: any) => {
        const env = c.env as Env;
        const logger = (c as any).logger;
        
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger?.warn('Authentication failed - missing or invalid auth header', {
                action: 'auth_failed',
                reason: 'missing_auth_header'
            });
            return c.json({ error: 'Unauthorized' }, 401);
        }
        
        const token = authHeader.substring(7);
        const hash = await sha256(token);
        const now = Math.floor(Date.now() / 1000);
        
        logger?.debug('Checking token authentication', {
            action: 'auth_check',
            required_permission: required
        });
        
        const tokenRecord = await env.DB.prepare(
            'SELECT * FROM tokens WHERE token_hash = ? AND (expires_at IS NULL OR expires_at > ?)'
        ).bind(hash, now).first<TokenRecord>();
        
        if (!tokenRecord) {
            logger?.warn('Authentication failed - invalid or expired token', {
                action: 'auth_failed',
                reason: 'invalid_token'
            });
            return c.json({ error: 'Unauthorized' }, 401);
        }
        
        const permissions: Permissions = JSON.parse(tokenRecord.permissions as unknown as string);
        if (!permissions[required]) {
            logger?.warn('Authorization failed - insufficient permissions', {
                action: 'auth_failed',
                reason: 'insufficient_permissions',
                required_permission: required,
                user_permissions: permissions
            });
            return c.json({ error: 'Forbidden' }, 403);
        }
        
        logger?.debug('Authentication successful', {
            action: 'auth_success',
            token_id: tokenRecord.id,
            permissions: permissions
        });
        
        // Store token record in context for later use
        (c as any).tokenRecord = tokenRecord;
        await next();
    }
}
