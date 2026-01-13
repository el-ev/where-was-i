import { Hono } from 'hono';
import { locationQuerySchema, LocationRecord, locationSchema, TokenRecord } from '../schema';
import { authMiddleware } from '../middleware/auth';
import { LocationService } from '../services/LocationService';

const locations = new Hono<{ Bindings: Env }>();

locations.get('/export/gpx', authMiddleware('read'), async (c) => {
    const logger = (c as any).logger;
    const query = c.req.query();
    const service = new LocationService(c.env.DB, c.env.PACKS_BUCKET);

    const locationQueryParams = locationQuerySchema.safeParse(query);
    if (!locationQueryParams.success) {
        return c.json({ error: 'Invalid query parameters', details: locationQueryParams.error.flatten() }, 400);
    }

    const tokenRecord = (c as any).tokenRecord as TokenRecord;
    const tokenRules = {
        startTime: tokenRecord.available_start_time ? new Date(tokenRecord.available_start_time * 1000) : undefined,
        endTime: tokenRecord.available_end_time ? new Date(tokenRecord.available_end_time * 1000) : undefined
    };

    const results = await service.getLocations(locationQueryParams.data, tokenRules, true);

    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
    gpx += '<gpx version="1.1" creator="WhereWasI" xmlns="http://www.topografix.com/GPX/1/1">\n';
    gpx += '  <trk>\n';
    gpx += '    <name>Where Was I Export</name>\n';
    gpx += '    <trkseg>\n';

    for (const r of results) {
        const timeStr = new Date(r.timestamp * 1000).toISOString();
        gpx += `      <trkpt lat="${r.latitude}" lon="${r.longitude}">\n`;
        gpx += `        <ele>${r.altitude}</ele>\n`;
        gpx += `        <time>${timeStr}</time>\n`;
        gpx += `      </trkpt>\n`;
    }

    gpx += '    </trkseg>\n';
    gpx += '  </trk>\n';
    gpx += '</gpx>';

    return c.body(gpx, 200, {
        'Content-Type': 'application/gpx+xml',
        'Content-Disposition': 'attachment; filename="locations.gpx"'
    });
});

locations.get('/', authMiddleware('read'), async (c) => {
    const logger = (c as any).logger;
    const query = c.req.query();
    const service = new LocationService(c.env.DB, c.env.PACKS_BUCKET);

    logger?.debug('Processing locations query', { action: 'locations_query', query_params: query });

    const locationQueryParams = locationQuerySchema.safeParse(query);
    if (!locationQueryParams.success) {
        return c.json({ error: 'Invalid query parameters', details: locationQueryParams.error.flatten() }, 400);
    }

    const tokenRecord = (c as any).tokenRecord as TokenRecord;

    const tokenRules = {
        startTime: tokenRecord.available_start_time ? new Date(tokenRecord.available_start_time * 1000) : undefined,
        endTime: tokenRecord.available_end_time ? new Date(tokenRecord.available_end_time * 1000) : undefined
    };

    const results = await service.getLocations(locationQueryParams.data, tokenRules);

    logger?.log('Locations query completed', {
        action: 'locations_query_complete',
        count: results.length
    });

    return c.json(results);
});

locations.post('/', authMiddleware('write'), async (c) => {
    const logger = (c as any).logger;
    const service = new LocationService(c.env.DB);

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
        await service.addLocation(lat, lng, alt, t);
        logger?.log('Location created successfully', { action: 'location_created', lat, lng });
    } catch (e) {
        logger?.error('Database error', e as Error);
        return c.json({ error: 'Database error', details: (e as Error).message }, 500);
    }

    return c.json({ message: 'Location added' }, 201);
});

locations.get('/last', authMiddleware('read'), async (c) => {
    const logger = (c as any).logger;
    const service = new LocationService(c.env.DB);

    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.max(1, Math.min(1000, Math.floor(Number(limitParam)))) : 1;

    const tokenRecord = (c as any).tokenRecord as TokenRecord;
    const tokenRules = {
        startTime: tokenRecord.available_start_time,
        endTime: tokenRecord.available_end_time
    };

    const results = await service.getLastLocations(limit, tokenRules);

    logger?.log('Last locations query completed', { count: results.length });

    return c.json(results);
});

locations.put('/:id', authMiddleware('write'), async (c) => {
    const logger = (c as any).logger;
    const service = new LocationService(c.env.DB);

    const id = Number(c.req.param('id'));
    let body: any;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid request.' }, 400);
    }

    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return c.json({ error: 'Invalid latitude or longitude' }, 400);
    }

    try {
        const success = await service.updateLocation(id, lat, lng);
        if (!success) {
            return c.json({ error: 'Location not found' }, 404);
        }
        logger?.log('Location updated successfully', { id, lat, lng });
        return c.json({ success: true });
    } catch (e) {
        logger?.error('Database error', e as Error);
        return c.json({ error: 'Database error', details: (e as Error).message }, 500);
    }
});

export default locations;
