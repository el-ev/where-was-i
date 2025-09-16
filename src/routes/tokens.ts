import { Hono } from 'hono';
import { sha256 } from 'hono/utils/crypto';
import { createTokenSchema, TokenRecord } from '../schema';
import { authMiddleware } from '../middleware/auth';
import { generateToken } from '../utils/token';

const tokens = new Hono<{ Bindings: Env }>();

tokens.post('/', authMiddleware('create_token'), async (c) => {
    let body: any;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid request.' }, 400);
    }
    const validation = createTokenSchema.safeParse(body);

    if (!validation.success) {
        return c.json({ error: 'Invalid token creation data', details: validation.error.flatten() }, 400);
    }

    const { expires, expires_in_days, permissions } = validation.data;

    const selfToken = await c.env.DB.prepare(
        'SELECT expires_at FROM tokens WHERE token_hash = ?'
    ).bind(await sha256((c.req.header('Authorization') || '').substring(7))).first<TokenRecord>();
    if (selfToken && selfToken.expires_at !== null) {
        const maxExpires = Number(selfToken.expires_at) - Math.floor(Date.now() / 1000);
        if (!expires || expires_in_days * 24 * 60 * 60 > maxExpires) {
            return c.json({ error: 'Cannot create a token that lasts that long.' }, 400);
        }
    }

    const newToken = generateToken();
    const tokenHash = await sha256(newToken);

    let expires_at: number | null = null;
    if (expires) {
        expires_at = Math.floor(Date.now() / 1000) + expires_in_days * 24 * 60 * 60;
    }

    try {
        await c.env.DB.prepare(
            'INSERT INTO tokens (token_hash, permissions, expires_at) VALUES (?, ?, ?)'
        ).bind(tokenHash, JSON.stringify(permissions), expires_at).run();
    } catch (e) {
        return c.json({ error: 'Database error', details: (e as Error).message }, 500);
    }

    return c.json({ success: true, token: newToken }, 201);
});

export default tokens;
