import { LocationRecord } from '../schema';

const DEG_TO_RAD = Math.PI / 180;
const R = 6371000;

export function crowFlyDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLat = (lat2 - lat1) * DEG_TO_RAD;
    const dLng = (lng2 - lng1) * DEG_TO_RAD;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fastDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const x = (lng2 - lng1) * DEG_TO_RAD * Math.cos((lat1 + lat2) * 0.5 * DEG_TO_RAD);
    const y = (lat2 - lat1) * DEG_TO_RAD;
    return R * Math.sqrt(x * x + y * y);
}

interface CachedPoint {
    record: LocationRecord;
    lat: number;
    lng: number;
}

export function clusterLocations(
    records: LocationRecord[],
    maxDist: number = 20,
    windowSize: number = 5,
    splitThreshold: number = 0.2
): LocationRecord[] {
    if (maxDist === 0) {
        return records;
    }
    const n = records.length;
    if (n === 0) {
        return [];
    }

    const points: CachedPoint[] = new Array(n);
    for (let i = 0; i < n; i++) {
        const r = records[i];
        points[i] = {
            record: r,
            lat: Number(r.latitude),
            lng: Number(r.longitude)
        };
    }

    const representatives: LocationRecord[] = [];
    let clusterStart = 0;
    let clusterEnd = 0;
    let sumLat = 0;
    let sumLng = 0;

    const finalizeCluster = () => {
        if (clusterEnd <= clusterStart) return;

        const count = clusterEnd - clusterStart;
        const centroidLat = sumLat / count;
        const centroidLng = sumLng / count;

        let bestIdx = clusterStart;
        let bestDist = fastDist(centroidLat, centroidLng, points[clusterStart].lat, points[clusterStart].lng);

        for (let i = clusterStart + 1; i < clusterEnd; i++) {
            const d = fastDist(centroidLat, centroidLng, points[i].lat, points[i].lng);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }

        representatives.push(points[bestIdx].record);
    };

    sumLat = points[0].lat;
    sumLng = points[0].lng;
    clusterEnd = 1;

    for (let i = 1; i < n; i++) {
        const p = points[i];
        const count = clusterEnd - clusterStart;
        const centroidLat = sumLat / count;
        const centroidLng = sumLng / count;
        const d = fastDist(centroidLat, centroidLng, p.lat, p.lng);

        if (d < maxDist) {
            sumLat += p.lat;
            sumLng += p.lng;
            clusterEnd++;
        } else {
            // Count far points in window without creating new array
            const windowEnd = Math.min(i + windowSize, n);
            const windowLen = windowEnd - i;
            let farPoints = 0;

            for (let j = i; j < windowEnd; j++) {
                if (fastDist(centroidLat, centroidLng, points[j].lat, points[j].lng) >= maxDist) {
                    farPoints++;
                }
            }

            if (farPoints / windowLen >= splitThreshold) {
                finalizeCluster();
                clusterStart = i;
                clusterEnd = i + 1;
                sumLat = p.lat;
                sumLng = p.lng;
            } else {
                sumLat += p.lat;
                sumLng += p.lng;
                clusterEnd++;
            }
        }
    }
    finalizeCluster();

    return representatives;
}
