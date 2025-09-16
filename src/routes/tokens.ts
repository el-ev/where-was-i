import { Hono } from 'hono';
import { sha256 } from 'hono/utils/crypto';
import { createTokenSchema } from '../schema';
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

    const newToken = generateToken();
    const tokenHash = await sha256(newToken);

    let expires_at: number | null = null;
    if (expires) {
        expires_at = Math.floor(Date.now() / 1000) + expires_in_days * 24 * 60 * 60;
    }

    await c.env.DB.prepare(
        'INSERT INTO tokens (token_hash, permissions, expires_at) VALUES (?, ?, ?)'
    ).bind(tokenHash, JSON.stringify(permissions), expires_at).run();

    return c.json({ success: true, token: newToken }, 201);
});

export default tokens;
