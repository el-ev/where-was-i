import { Hono } from 'hono';
import { sha256 } from 'hono/utils/crypto';
import { generateToken } from '../utils/token';

const init = new Hono<{ Bindings: Env }>();

init.post('/', async (c) => {
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
	} catch {
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

export default init;
