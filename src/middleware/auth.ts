import { sha256 } from 'hono/utils/crypto';
import type { Permissions, TokenRecord } from '../schema';

export const authMiddleware = (required: keyof Permissions) => {
    return async (c: any, next: any) => {
        const env = c.env as Env;
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        const token = authHeader.substring(7);
        const hash = await sha256(token);
        const now = Math.floor(Date.now() / 1000);
        const tokenRecord = await env.DB.prepare(
            'SELECT * FROM tokens WHERE token_hash = ? AND (expires_at IS NULL OR expires_at > ?)'
        ).bind(hash, now).first<TokenRecord>();
        if (!tokenRecord) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        const permissions: Permissions = JSON.parse(tokenRecord.permissions as unknown as string);
        if (!permissions[required]) {
            return c.json({ error: 'Forbidden' }, 403);
        }
        // Store token record in context for later use
        (c as any).tokenRecord = tokenRecord;
        await next();
    }
}
