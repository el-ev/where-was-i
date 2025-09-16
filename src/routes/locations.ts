import { Hono } from 'hono';
import { locationSchema } from '../schema';
import { authMiddleware } from '../middleware/auth';

const locations = new Hono<{ Bindings: Env }>();

locations.get('/', authMiddleware('read'), async (c) => {
	const { results } = await c.env.DB.prepare('SELECT * FROM locations ORDER BY timestamp ASC').all();
	return c.json(results);
});

locations.post('/', authMiddleware('write'), async (c) => {
	let body: any;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: 'Invalid request.' }, 400);
	}
	const parseResult = locationSchema.safeParse(body);
	if (!parseResult.success) {
		return c.json({ error: 'Invalid location data', details: parseResult.error.errors }, 400);
	}
	const { lat, lng, alt, t } = parseResult.data;
	await c.env.DB.prepare(
		'INSERT INTO locations (latitude, longitude, altitude, timestamp) VALUES (?, ?, ?, ?)'
	).bind(lat, lng, alt, t).run();
	return c.json({ message: 'Location added' }, 201);
});

export default locations;
