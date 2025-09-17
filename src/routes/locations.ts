import { Hono } from 'hono';
import { locationQuerySchema, LocationRecord, locationSchema, TokenRecord } from '../schema';
import { authMiddleware } from '../middleware/auth';
import { clusterLocations } from '../utils/clustering';

const locations = new Hono<{ Bindings: Env }>();

locations.get('/', authMiddleware('read'), async (c) => {
    const logger = c.logger;
    const query = c.req.query();
    
    logger?.debug('Processing locations query', {
        action: 'locations_query',
        query_params: query
    });
    
    const locationQueryParams = locationQuerySchema.safeParse(query);
    if (!locationQueryParams.success) {
        logger?.warn('Invalid query parameters for locations', {
            action: 'validation_error',
            errors: locationQueryParams.error.flatten()
        });
        return c.json({ error: 'Invalid query parameters', details: locationQueryParams.error.flatten() }, 400);
    }
    const clusterMaxDist = Number.isFinite(locationQueryParams.data.clusterMaxDist) ? locationQueryParams.data.clusterMaxDist : 0;

    // Get token record from auth middleware
    const tokenRecord = (c as any).tokenRecord as TokenRecord;

    let queryString = 'SELECT * FROM locations';
    const whereClauses: string[] = [];

    if (locationQueryParams.data.startId !== undefined) {
        whereClauses.push(`id >= ${locationQueryParams.data.startId}`);
    }
    
    // Apply token time range restrictions
    let effectiveStartTime = locationQueryParams.data.startTime;
    let effectiveEndTime = locationQueryParams.data.endTime;
    
    if (tokenRecord.available_start_time !== null) {
        const tokenStartTime = new Date(tokenRecord.available_start_time * 1000);
        if (!effectiveStartTime || tokenStartTime > effectiveStartTime) {
            effectiveStartTime = tokenStartTime;
        }
    }
    
    if (tokenRecord.available_end_time !== null) {
        const tokenEndTime = new Date(tokenRecord.available_end_time * 1000);
        if (!effectiveEndTime || tokenEndTime < effectiveEndTime) {
            effectiveEndTime = tokenEndTime;
        }
    }
    
    if (effectiveStartTime !== undefined) {
        const startTimestamp = Math.floor(effectiveStartTime.getTime() / 1000);
        whereClauses.push(`timestamp >= ${startTimestamp}`);
    }
    if (effectiveEndTime !== undefined) {
        const endTimestamp = Math.floor(effectiveEndTime.getTime() / 1000);
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
    
    logger?.debug('Executing locations query', {
        action: 'db_query',
        query: queryString,
        cluster_max_dist: clusterMaxDist
    });
    
    const { results } = await c.env.DB.prepare(queryString).all<LocationRecord>();

    const representatives = clusterLocations(results.reverse(), clusterMaxDist);
    
    logger?.log('Locations query completed', {
        action: 'locations_query_complete',
        total_results: results.length,
        clustered_results: representatives.length,
        cluster_max_dist: clusterMaxDist
    });
    
    return c.json(representatives);
});

locations.post('/', authMiddleware('write'), async (c) => {
    const logger = c.logger;
    
    let body: any;
    try {
        body = await c.req.json();
    } catch {
        logger?.warn('Invalid JSON in location creation request', {
            action: 'validation_error',
            reason: 'invalid_json'
        });
        return c.json({ error: 'Invalid request.' }, 400);
    }
    
    logger?.debug('Processing location creation', {
        action: 'location_create',
        body: body
    });
    
    const parseResult = locationSchema.safeParse(body);
    if (!parseResult.success) {
        logger?.warn('Invalid location data', {
            action: 'validation_error',
            errors: parseResult.error.errors
        });
        return c.json({ error: 'Invalid location data', details: parseResult.error.errors }, 400);
    }
    
    const { lat, lng, alt, t } = parseResult.data;
    
    try {
        await c.env.DB.prepare(
            'INSERT INTO locations (latitude, longitude, altitude, timestamp) VALUES (?, ?, ?, ?)'
        ).bind(lat, lng, alt, t).run();
        
        logger?.log('Location created successfully', {
            action: 'location_created',
            latitude: lat,
            longitude: lng,
            altitude: alt,
            timestamp: t
        });
    } catch (e) {
        logger?.error('Database error while creating location', e as Error, {
            action: 'db_error',
            operation: 'insert_location'
        });
        return c.json({ error: 'Database error', details: (e as Error).message }, 500);
    }
    
    return c.json({ message: 'Location added' }, 201);
});

locations.get('/last', authMiddleware('read'), async (c) => {
    const logger = c.logger;
    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.max(1, Math.min(1000, Math.floor(Number(limitParam)))) : 1;

    logger?.debug('Processing last locations query', {
        action: 'last_locations_query',
        limit: limit
    });

    // Get token record from auth middleware
    const tokenRecord = (c as any).tokenRecord as TokenRecord;

    let queryString = 'SELECT * FROM locations';
    const whereClauses: string[] = [];

    // Apply token time range restrictions
    if (tokenRecord.available_start_time !== null) {
        whereClauses.push(`timestamp >= ${tokenRecord.available_start_time}`);
    }
    if (tokenRecord.available_end_time !== null) {
        whereClauses.push(`timestamp <= ${tokenRecord.available_end_time}`);
    }

    if (whereClauses.length) {
        queryString += ' WHERE ' + whereClauses.join(' AND ');
    }

    queryString += ' ORDER BY timestamp DESC LIMIT ?';

    logger?.debug('Executing last locations query', {
        action: 'db_query',
        query: queryString,
        limit: limit
    });

    const { results } = await c.env.DB.prepare(queryString).bind(limit).all<LocationRecord>();

    logger?.log('Last locations query completed', {
        action: 'last_locations_query_complete',
        results_count: results.length,
        limit: limit
    });

    return c.json(results);
});

export default locations;
