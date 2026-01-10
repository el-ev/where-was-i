import { LocationRecord, LocationQueryParams } from '../schema';
import { clusterLocations } from '../utils/clustering';

export class LocationService {
    constructor(private db: D1Database) { }

    async getLocations(params: LocationQueryParams, tokenRules?: { startTime?: Date, endTime?: Date }, skipClustering: boolean = false): Promise<any[]> {
        let queryString = 'SELECT * FROM locations';
        const whereClauses: string[] = [];
        const bindings: any[] = [];

        if (params.startId !== undefined) {
            whereClauses.push('id >= ?');
            bindings.push(params.startId);
        }

        // Apply time range logic including token restrictions
        let effectiveStartTime = params.startTime;
        let effectiveEndTime = params.endTime;

        if (tokenRules?.startTime) {
            if (!effectiveStartTime || tokenRules.startTime > effectiveStartTime) {
                effectiveStartTime = tokenRules.startTime;
            }
        }
        if (tokenRules?.endTime) {
            if (!effectiveEndTime || tokenRules.endTime < effectiveEndTime) {
                effectiveEndTime = tokenRules.endTime;
            }
        }

        if (effectiveStartTime !== undefined) {
            whereClauses.push('timestamp >= ?');
            bindings.push(Math.floor(effectiveStartTime.getTime() / 1000));
        }
        if (effectiveEndTime !== undefined) {
            whereClauses.push('timestamp <= ?');
            bindings.push(Math.floor(effectiveEndTime.getTime() / 1000));
        }

        if (params.bbox !== undefined) {
            const [minLng, minLat, maxLng, maxLat] = params.bbox;
            whereClauses.push('latitude >= ? AND latitude <= ? AND longitude >= ? AND longitude <= ?');
            bindings.push(minLat, maxLat, minLng, maxLng);
        }

        if (whereClauses.length) {
            queryString += ' WHERE ' + whereClauses.join(' AND ');
        }

        queryString += ' ORDER BY id DESC';

        const rawLimit = params.limit;
        if (rawLimit === undefined) {
            queryString += ' LIMIT 1000';
        } else if (Number(rawLimit) !== 0) {
            const limit = Math.max(1, Math.floor(Number(rawLimit)));
            queryString += ' LIMIT ?';
            bindings.push(limit);
        }

        const stmt = this.db.prepare(queryString).bind(...bindings);
        const { results } = await stmt.all<LocationRecord>();

        if (skipClustering) {
            return results.reverse();
        }

        const clusterMaxDist = Number.isFinite(params.clusterMaxDist) ? params.clusterMaxDist : 0;
        return clusterLocations(results.reverse(), clusterMaxDist);
    }

    async addLocation(lat: number, lng: number, alt: number, timestamp: number): Promise<void> {
        await this.db.prepare(
            'INSERT INTO locations (latitude, longitude, altitude, timestamp) VALUES (?, ?, ?, ?)'
        ).bind(lat, lng, alt, timestamp).run();
    }

    async updateLocation(id: number, lat: number, lng: number): Promise<boolean> {
        const res = await this.db.prepare(
            'UPDATE locations SET latitude = ?, longitude = ? WHERE id = ?'
        ).bind(lat, lng, id).run();
        return res.meta.changes > 0;
    }

    async getLastLocations(limit: number, tokenRules?: { startTime?: number | null, endTime?: number | null }): Promise<LocationRecord[]> {
        let queryString = 'SELECT * FROM locations';
        const whereClauses: string[] = [];
        const bindings: any[] = [];

        if (tokenRules?.startTime) {
            whereClauses.push('timestamp >= ?');
            bindings.push(tokenRules.startTime);
        }
        if (tokenRules?.endTime) {
            whereClauses.push('timestamp <= ?');
            bindings.push(tokenRules.endTime);
        }

        if (whereClauses.length) {
            queryString += ' WHERE ' + whereClauses.join(' AND ');
        }

        queryString += ' ORDER BY timestamp DESC LIMIT ?';
        bindings.push(limit);

        const { results } = await this.db.prepare(queryString).bind(...bindings).all<LocationRecord>();
        return results;
    }
}
