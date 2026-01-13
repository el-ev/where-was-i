import { LocationRecord } from '../schema';

export class PackService {
    constructor(private db: D1Database, private bucket: R2Bucket) { }

    async packLocations(): Promise<void> {
        const lastPack = await this.db.prepare(
            'SELECT end_id FROM packs ORDER BY end_id DESC LIMIT 1'
        ).first<{ end_id: number }>();

        const startId = (lastPack?.end_id || 0) + 1;
        const countRes = await this.db.prepare(
            'SELECT COUNT(*) as count FROM locations WHERE id >= ?'
        ).bind(startId).first<{ count: number }>();

        if (!countRes || countRes.count < 1000) {
            console.log('Not enough locations to pack yet.');
            return;
        }

        const locations = await this.db.prepare(
            'SELECT * FROM locations WHERE id >= ? ORDER BY id ASC LIMIT 1000'
        ).bind(startId).all<LocationRecord>();

        if (!locations.results.length) return;

        const batch = locations.results;
        const first = batch[0];
        const last = batch[batch.length - 1];

        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        let minTime = Number.MAX_SAFE_INTEGER, maxTime = 0;

        for (const loc of batch) {
            minLat = Math.min(minLat, loc.latitude);
            maxLat = Math.max(maxLat, loc.latitude);
            minLng = Math.min(minLng, loc.longitude);
            maxLng = Math.max(maxLng, loc.longitude);
            minTime = Math.min(minTime, loc.timestamp);
            maxTime = Math.max(maxTime, loc.timestamp);
        }

        const objectKey = `packs/${first.id}_${last.id}.json`;
        const content = JSON.stringify(batch);

        await this.bucket.put(objectKey, content, {
            httpMetadata: { contentType: 'application/json' }
        });

        await this.db.prepare(
            `INSERT INTO packs (
                start_id, end_id, 
                min_lat, max_lat, min_lng, max_lng, 
                min_time, max_time, 
                object_key, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            first.id, last.id,
            minLat, maxLat, minLng, maxLng,
            minTime, maxTime,
            objectKey, Date.now()
        ).run();

        console.log(`Packed ${batch.length} locations into ${objectKey}`);
    }
}
