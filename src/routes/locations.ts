import { Hono } from 'hono';
import { LocationRecord, locationSchema } from '../schema';
import { authMiddleware } from '../middleware/auth';
import { clusterLocations } from '../utils/clustering';

const locations = new Hono<{ Bindings: Env }>();

locations.get('/', authMiddleware('read'), async (c) => {
    const minDistParam = c.req.query('minDist');
    const parsed = Number(minDistParam);
    const minDist = Number.isFinite(parsed) && parsed >= 0 ? parsed : 20;

    const { results } = await c.env.DB.prepare('SELECT * FROM locations ORDER BY timestamp ASC').all<LocationRecord>();

    const representatives = clusterLocations(results, minDist);

    return c.json(representatives);
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
