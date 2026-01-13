import { LocationRecord, LocationQueryParams } from '../schema';
import { clusterLocations, crowFlyDist } from '../utils/clustering';

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

    async addSmartLocation(lat: number, lng: number, alt: number, timestamp: number): Promise<string> {
        const { results: recent } = await this.db.prepare(
            'SELECT * FROM locations ORDER BY timestamp DESC LIMIT 2'
        ).all<LocationRecord>();

        if (recent.length > 0) {
            const last = recent[0];
            const dist = crowFlyDist(last.latitude, last.longitude, lat, lng);

            if (dist < 5) {
                return "Skipped";
            }
        }

        if (recent.length >= 2) {
            const pB = recent[0];
            const pA = recent[1];

            const distAB = crowFlyDist(pA.latitude, pA.longitude, pB.latitude, pB.longitude);
            const distBC = crowFlyDist(pB.latitude, pB.longitude, lat, lng);
            const distAC = crowFlyDist(pA.latitude, pA.longitude, lat, lng);

            const timeAB = pB.timestamp - pA.timestamp;
            const timeBC = timestamp - pB.timestamp;

            const speedAB = timeAB > 0 ? distAB / timeAB : 0;
            const speedBC = timeBC > 0 ? distBC / timeBC : 0;

            const MIN_GLITCH_SPEED = 15;

            const totalPath = distAB + distBC;
            const efficiency = totalPath > 0 ? distAC / totalPath : 1;

            if (speedAB > MIN_GLITCH_SPEED && speedBC > MIN_GLITCH_SPEED && efficiency < 0.3) {
                await this.db.prepare(
                    'UPDATE locations SET latitude = ?, longitude = ?, altitude = ?, timestamp = ? WHERE id = ?'
                ).bind(lat, lng, alt, timestamp, pB.id).run();

                return "Corrected";
            }
        }

        await this.db.prepare(
            'INSERT INTO locations (latitude, longitude, altitude, timestamp) VALUES (?, ?, ?, ?)'
        ).bind(lat, lng, alt, timestamp).run();

        return "Added";
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
