import { Hono } from 'hono';
import { sha256 } from 'hono/utils/crypto';
import { createTokenSchema, TokenRecord } from '../schema';
import { authMiddleware } from '../middleware/auth';
import { generateToken } from '../utils/token';

const tokens = new Hono<{ Bindings: Env }>();

tokens.post('/', authMiddleware('create_token'), async (c) => {
    const logger = c.logger;
    
    let body: any;
    try {
        body = await c.req.json();
    } catch {
        logger?.warn('Invalid JSON in token creation request', {
            action: 'validation_error',
            reason: 'invalid_json'
        });
        return c.json({ error: 'Invalid request.' }, 400);
    }
    
    logger?.debug('Processing token creation', {
        action: 'token_create_start'
    });
    
    const validation = createTokenSchema.safeParse(body);

    if (!validation.success) {
        logger?.warn('Invalid token creation data', {
            action: 'validation_error',
            errors: validation.error.flatten()
        });
        return c.json({ error: 'Invalid token creation data', details: validation.error.flatten() }, 400);
    }

    const { expires, expires_in_days, permissions, comment, available_start_time, available_end_time } = validation.data;

    const selfToken = await c.env.DB.prepare(
        'SELECT expires_at FROM tokens WHERE token_hash = ?'
    ).bind(await sha256((c.req.header('Authorization') || '').substring(7))).first<TokenRecord>();
    if (selfToken && selfToken.expires_at !== null) {
        const maxExpires = Number(selfToken.expires_at) - Math.floor(Date.now() / 1000);
        if (!expires || expires_in_days * 24 * 60 * 60 > maxExpires) {
            logger?.warn('Token creation failed - requested duration too long', {
                action: 'token_create_failed',
                reason: 'duration_too_long',
                requested_days: expires_in_days,
                max_allowed_seconds: maxExpires
            });
            return c.json({ error: 'Cannot create a token that lasts that long.' }, 400);
        }
    }

    const newToken = generateToken();
    const tokenHash = await sha256(newToken);

    let expires_at: number | null = null;
    if (expires) {
        expires_at = Math.floor(Date.now() / 1000) + expires_in_days * 24 * 60 * 60;
    }

    let available_start_time_epoch: number | null = null;
    let available_end_time_epoch: number | null = null;
    if (available_start_time) {
        available_start_time_epoch = Math.floor(available_start_time.getTime() / 1000);
    }
    if (available_end_time) {
        available_end_time_epoch = Math.floor(available_end_time.getTime() / 1000);
    }

    try {
        await c.env.DB.prepare(
            'INSERT INTO tokens (token_hash, permissions, expires_at, comment, available_start_time, available_end_time) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(tokenHash, JSON.stringify(permissions), expires_at, comment, available_start_time_epoch, available_end_time_epoch).run();
        
        logger?.log('Token created successfully', {
            action: 'token_created',
            permissions: permissions,
            expires_in_days: expires_in_days,
            expires_at: expires_at,
            comment: comment,
            has_time_range: !!(available_start_time || available_end_time)
        });
    } catch (e) {
        logger?.error('Database error while creating token', e as Error, {
            action: 'db_error',
            operation: 'insert_token'
        });
        return c.json({ error: 'Database error', details: (e as Error).message }, 500);
    }

    return c.json({ success: true, token: newToken }, 201);
});

tokens.get('/', authMiddleware('create_token'), async (c) => {
    const logger = c.logger;
    
    logger?.debug('Processing tokens list request', {
        action: 'tokens_list'
    });
    
    const { results } = await c.env.DB.prepare(
        'SELECT id, permissions, expires_at, comment, available_start_time, available_end_time FROM tokens'
    ).all<TokenRecord>();

    const allTokens = results.map(t => ({ ...t, permissions: JSON.parse(t.permissions as unknown as string) }));

    logger?.log('Tokens list retrieved', {
        action: 'tokens_list_complete',
        count: allTokens.length
    });

    return c.json(allTokens);
});

export default tokens;
