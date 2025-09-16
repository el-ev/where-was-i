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

    queryString += ' ORDER BY timestamp ASC';

    if (locationQueryParams.data.limit !== undefined && locationQueryParams.data.limit > 0) {
        const limit = Math.max(0, Math.floor(Number(locationQueryParams.data.limit)));
        queryString += ' LIMIT ' + limit;
    }
    const { results } = await c.env.DB.prepare(queryString).all<LocationRecord>();

    const representatives = clusterLocations(results, clusterMaxDist);

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
