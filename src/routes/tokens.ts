import { Hono } from 'hono';
import { sha256 } from 'hono/utils/crypto';
import { createTokenSchema, Permissions, TokenRecord } from '../schema';
import { authMiddleware } from '../middleware/auth';
import { TokenService } from '../services/TokenService';

const tokens = new Hono<{ Bindings: Env }>();

tokens.post('/', authMiddleware('create_token'), async (c) => {
    const logger = (c as any).logger;
    const service = new TokenService(c.env.DB);

    let body: any;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid request.' }, 400);
    }

    logger?.debug('Processing token creation', { action: 'token_create_start' });

    const validation = createTokenSchema.safeParse(body);
    if (!validation.success) {
        return c.json({ error: 'Invalid token creation data', details: validation.error.flatten() }, 400);
    }

    const { expires, expires_in_days, permissions, comment, available_start_time, available_end_time } = validation.data;

    // Check constraints based on creator's token
    const authHeader = c.req.header('Authorization') || '';
    const creatorTokenHash = await sha256(authHeader.substring(7));

    if (!creatorTokenHash) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const selfToken = await service.getTokenRecord(creatorTokenHash);

    if (selfToken && selfToken.expires_at !== null) {
        const maxExpires = Number(selfToken.expires_at) - Math.floor(Date.now() / 1000);
        if (!expires || expires_in_days * 24 * 60 * 60 > maxExpires) {
            return c.json({ error: 'Cannot create a token that lasts that long.' }, 400);
        }
    }

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
        const newToken = await service.createToken({
            permissions,
            expires_at,
            comment: comment || null,
            available_start_time: available_start_time_epoch,
            available_end_time: available_end_time_epoch
        });

        logger?.log('Token created successfully', { permissions, expires_in_days });
        return c.json({ success: true, token: newToken }, 201);
    } catch (e) {
        logger?.error('Database error', e as Error);
        return c.json({ error: 'Database error', details: (e as Error).message }, 500);
    }
});

tokens.get('/', authMiddleware('create_token'), async (c) => {
    const logger = (c as any).logger;
    const service = new TokenService(c.env.DB);

    logger?.debug('Processing tokens list request', { action: 'tokens_list' });

    const allTokens = await service.listTokens();

    logger?.log('Tokens list retrieved', { count: allTokens.length });

    return c.json(allTokens);
});

tokens.get('/me', authMiddleware('read'), (c) => {
    const tokenRecord = (c as any).tokenRecord as TokenRecord;
    const permissions: Permissions = JSON.parse(tokenRecord.permissions as unknown as string);
    return c.json({ permissions });
});

export default tokens;
