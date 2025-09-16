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
        const { results } = await env.DB.prepare(
            'SELECT * FROM tokens WHERE token_hash = ? AND (expires_at IS NULL OR expires_at > ?)'
        ).bind(hash, now).all<TokenRecord>();
        if (!results || results.length === 0) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        const tokenRecord = results[0];
        const permissions = typeof tokenRecord.permissions === 'string'
            ? JSON.parse(tokenRecord.permissions)
            : tokenRecord.permissions;
        if (!(permissions as any)[required]) {
            return c.json({ error: 'Forbidden' }, 403);
        }
        await next();
    }
}
