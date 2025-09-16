import { Hono } from 'hono';
import { locationSchema } from '../schema';
import { authMiddleware } from '../middleware/auth';

const locations = new Hono<{ Bindings: Env }>();

locations.get('/', authMiddleware('read'), async (c) => {
    const minDistParam = c.req.query('minDist');
    const parsed = Number(minDistParam);
    const minDist = Number.isFinite(parsed) && parsed >= 0 ? parsed : 20;

    const { results } = await c.env.DB.prepare('SELECT * FROM locations ORDER BY timestamp ASC').all();

    const crowFlyDist = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const R = 6371000;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c2 = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c2;
    };

    const median = (arr: number[]) => {
        if (arr.length === 0) return 0;
        const s = arr.slice().sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };

    const representatives: any[] = [];
    let cluster: any[] = [];
    let sumLat = 0;
    let sumLng = 0;

    const finalizeCluster = () => {
        if (cluster.length === 0) return;
        if (cluster.length === 1) {
            representatives.push(cluster[0]);
        } else {
            const lats = cluster.map((p) => Number(p.latitude));
            const lngs = cluster.map((p) => Number(p.longitude));
            const alts = cluster.map((p) => (p.altitude != null ? Number(p.altitude) : NaN)).filter((v) => !Number.isNaN(v));
            const times = cluster.map((p) => Number(p.timestamp));

            const rep: any = {
                latitude: median(lats),
                longitude: median(lngs),
                timestamp: median(times),
            };
            if (alts.length > 0) rep.altitude = median(alts);
            representatives.push(rep);
        }
        cluster = [];
        sumLat = 0;
        sumLng = 0;
    };

    for (const p of results) {
        const plat = Number(p.latitude);
        const plng = Number(p.longitude);

        if (cluster.length === 0) {
            cluster.push(p);
            sumLat = plat;
            sumLng = plng;
            continue;
        }

        const centroidLat = sumLat / cluster.length;
        const centroidLng = sumLng / cluster.length;
        const d = crowFlyDist(centroidLat, centroidLng, plat, plng);

        if (d < minDist) {
            cluster.push(p);
            sumLat += plat;
            sumLng += plng;
        } else {
            finalizeCluster();
            cluster.push(p);
            sumLat = plat;
            sumLng = plng;
        }
    }
    finalizeCluster();

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
