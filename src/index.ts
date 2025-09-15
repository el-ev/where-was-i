import { Hono } from 'hono';
import { z } from 'zod';
import { locationSchema, createTokenSchema, Permissions, TokenRecord } from './schema';
import { sha256 } from 'hono/utils/crypto';

const app = new Hono<{ Bindings: Env }>();

const authMiddleware = (required: keyof Permissions) => {
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
		const permissions = typeof tokenRecord.permissions === 'string' ? JSON.parse(tokenRecord.permissions) : tokenRecord.permissions;
		if (!(permissions as any)[required]) {
			return c.json({ error: 'Forbidden' }, 403);
		}
		await next();
	}
}

app.post('/init', async (c) => {
	if (c.env.INIT_SECRET === undefined) {
		return c.json({ error: 'INIT_SECRET is not set.' }, 500);
	}

	const { results: tableCheck } = await c.env.DB.prepare(
		"SELECT name FROM sqlite_master WHERE type='table' AND name='tokens';"
	).all();
	if (tableCheck && tableCheck.length > 0) {
		const { results: countRes } = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tokens;').all();
		const rawCount = countRes && countRes[0] ? (countRes[0].count ?? countRes[0]['COUNT(*)'] ?? 0) : 0;
		const count = Number(rawCount || 0);
		if (count > 0) {
			return c.json({ error: 'Database already initialized' }, 409);
		}
	}

	let body: any;
	try {
		body = await c.req.json();
	} catch (e) {
		return c.json({ error: 'Invalid request.' }, 400);
	}
	if (body?.secret !== c.env.INIT_SECRET) {
		return c.json({ error: 'Invalid secret' }, 403);
	}

	const batch = [
		c.env.DB.prepare(`
	  CREATE TABLE locations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		latitude REAL NOT NULL,
		longitude REAL NOT NULL,
		altitude REAL NOT NULL,
		timestamp INTEGER NOT NULL
	  );
	`),
		c.env.DB.prepare(`
	  CREATE TABLE tokens (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		token_hash TEXT NOT NULL UNIQUE,
		permissions TEXT NOT NULL,
		expires_at INTEGER
	  );
	`),
	];

	await c.env.DB.batch(batch);

	const adminToken = generateToken();
	const tokenHash = await sha256(adminToken);
	const adminPermissions = JSON.stringify({ read: true, write: true, create_token: true });

	await c.env.DB.prepare(
		'INSERT INTO tokens (token_hash, permissions, expires_at) VALUES (?, ?, NULL)'
	).bind(tokenHash, adminPermissions).run();

	return c.json({ success: true, message: 'Database initialized', admin_token: adminToken });
});

app.get('/locations', authMiddleware('read'), async (c) => {
	const { results } = await c.env.DB.prepare('SELECT * FROM locations ORDER BY timestamp ASC').all();
	return c.json(results);
})

app.post('/locations', authMiddleware('write'), async (c) => {
	// { lat: number, lng: number, alt: number, t: number }
	const parseResult = locationSchema.safeParse(await c.req.json());
	if (!parseResult.success) {
		return c.json({ error: 'Invalid location data', details: parseResult.error.errors }, 400);
	}
	const { lat, lng, alt, t } = parseResult.data;
	await c.env.DB.prepare('INSERT INTO locations (latitude, longitude, altitude, timestamp) VALUES (?, ?, ?, ?)').bind(lat, lng, alt, t).run();
	return c.json({ message: 'Location added' }, 201);
})

app.post('/tokens', authMiddleware('create_token'), async (c) => {
	const body = await c.req.json();
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

function generateToken(length = 32): string {
	const array = new Uint8Array(length);
	crypto.getRandomValues(array);
	return btoa(String.fromCharCode.apply(null, Array.from(array))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export default app satisfies ExportedHandler<Env>;
