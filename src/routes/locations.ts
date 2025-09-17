import { Hono } from 'hono';
import { locationQuerySchema, LocationRecord, locationSchema } from '../schema';
import { authMiddleware } from '../middleware/auth';
import { clusterLocations } from '../utils/clustering';

const locations = new Hono<{ Bindings: Env }>();

locations.get('/', authMiddleware('read'), async (c) => {
    const query = c.req.query();
    const locationQueryParams = locationQuerySchema.safeParse(query);
    if (!locationQueryParams.success) {
        return c.json({ error: 'Invalid query parameters', details: locationQueryParams.error.flatten() }, 400);
    }
    const clusterMaxDist = Number.isFinite(locationQueryParams.data.clusterMaxDist) ? locationQueryParams.data.clusterMaxDist : 0;

    let queryString = 'SELECT * FROM locations';
    const whereClauses: string[] = [];

    if (locationQueryParams.data.startId !== undefined) {
        whereClauses.push(`id >= ${locationQueryParams.data.startId}`);
    }
    if (locationQueryParams.data.startTime !== undefined) {
        const startTimestamp = Math.floor(locationQueryParams.data.startTime.getTime() / 1000);
        whereClauses.push(`timestamp >= ${startTimestamp}`);
    }
    if (locationQueryParams.data.endTime !== undefined) {
        const endTimestamp = Math.floor(locationQueryParams.data.endTime.getTime() / 1000);
        whereClauses.push(`timestamp <= ${endTimestamp}`);
    }
    if (locationQueryParams.data.bbox !== undefined) {
        const [minLng, minLat, maxLng, maxLat] = locationQueryParams.data.bbox;
        whereClauses.push(`latitude >= ${minLat}`);
        whereClauses.push(`latitude <= ${maxLat}`);
        whereClauses.push(`longitude >= ${minLng}`);
        whereClauses.push(`longitude <= ${maxLng}`);
    }

    if (whereClauses.length) {
        queryString += ' WHERE ' + whereClauses.join(' AND ');
    }

    queryString += ' ORDER BY id DESC';

    const rawLimit = locationQueryParams.data.limit;
    if (rawLimit === undefined) {
        queryString += ' LIMIT 1000';
    } else if (Number(rawLimit) !== 0) {
        const limit = Math.max(1, Math.floor(Number(rawLimit)));
        queryString += ' LIMIT ' + limit;
    }
    const { results } = await c.env.DB.prepare(queryString).all<LocationRecord>();

    const representatives = clusterLocations(results.reverse(), clusterMaxDist);

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
    try {
        await c.env.DB.prepare(
            'INSERT INTO locations (latitude, longitude, altitude, timestamp) VALUES (?, ?, ?, ?)'
        ).bind(lat, lng, alt, t).run();
    } catch (e) {
        return c.json({ error: 'Database error', details: (e as Error).message }, 500);
    }
    return c.json({ message: 'Location added' }, 201);
});

locations.get('/last', authMiddleware('read'), async (c) => {
    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.max(1, Math.min(1000, Math.floor(Number(limitParam)))) : 1;

    const { results } = await c.env.DB.prepare(
        'SELECT * FROM locations ORDER BY timestamp DESC LIMIT ?'
    ).bind(limit).all<LocationRecord>();

    return c.json(results);
});

export default locations;
