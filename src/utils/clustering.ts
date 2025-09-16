import { LocationRecord } from '../schema';

export function crowFlyDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
}

export function clusterLocations(
    records: LocationRecord[],
    minDist: number = 20,
    windowSize: number = 5,
    splitThreshold: number = 0.2
): LocationRecord[] {
    if (records.length === 0) {
        return [];
    }

    const representatives: LocationRecord[] = [];
    let cluster: LocationRecord[] = [];
    let sumLat = 0;
    let sumLng = 0;

    const finalizeCluster = () => {
        if (cluster.length === 0) return;

        const centroidLat = sumLat / cluster.length;
        const centroidLng = sumLng / cluster.length;

        let bestPoint = cluster[0];
        let bestDist = crowFlyDist(
            centroidLat,
            centroidLng,
            Number(bestPoint.latitude),
            Number(bestPoint.longitude)
        );

        for (let i = 1; i < cluster.length; i++) {
            const p = cluster[i];
            const d = crowFlyDist(centroidLat, centroidLng, Number(p.latitude), Number(p.longitude));
            if (d < bestDist) {
                bestDist = d;
                bestPoint = p;
            }
        }

        representatives.push(bestPoint);

        cluster = [];
        sumLat = 0;
        sumLng = 0;
    };

    for (let i = 0; i < records.length; i++) {
        const p = records[i];
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
            const window = records.slice(i, i + windowSize);
            let farPoints = 0;
            for (const futureP of window) {
                if (
                    crowFlyDist(
                        centroidLat,
                        centroidLng,
                        Number(futureP.latitude),
                        Number(futureP.longitude)
                    ) >= minDist
                ) {
                    farPoints++;
                }
            }

            if (farPoints / window.length >= splitThreshold) {
                finalizeCluster();
                cluster.push(p);
                sumLat = plat;
                sumLng = plng;
            } else {
                cluster.push(p);
                sumLat += plat;
                sumLng += plng;
            }
        }
    }
    finalizeCluster();

    return representatives;
}
