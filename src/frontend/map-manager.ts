const leaflet = (globalThis as any).L as unknown as typeof import('leaflet');

const MAX_AMBIGUITY_CANDIDATES = 10;

export class MapManager {
    map: L.Map | null = null;
    currentPolyline: L.Polyline | null = null;
    locationsCache: any[] = [];

    private onPointSelect: (candidates: any[], latlng: L.LatLng) => void;

    constructor(elementId: string, onPointSelect: (candidates: any[], latlng: L.LatLng) => void) {
        this.onPointSelect = onPointSelect;
    }

    init(startLat: number, startLng: number) {
        this.map = leaflet.map('map').setView([startLat, startLng], 16);

        const baseLayers = {
            "OpenStreetMap": leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 25,
                attribution: '© OpenStreetMap contributors',
            }),
            "OpenCycleMap": leaflet.tileLayer('/tiles/cycle/{z}/{x}/{y}', {
                maxZoom: 25,
                attribution: 'Data © OpenStreetMap contributors. Maps © Thunderforest'
            }),
            "Transport": leaflet.tileLayer('/tiles/transport/{z}/{x}/{y}', {
                maxZoom: 25,
                attribution: 'Data © OpenStreetMap contributors. Maps © Thunderforest'
            }),
            "None": leaflet.tileLayer('', { maxZoom: 25 }),
        };

        baseLayers.OpenStreetMap.addTo(this.map);
        leaflet.control.layers(baseLayers, {}, { position: 'topleft' }).addTo(this.map);

        // Global click logger (debug)
        this.map.on('click', (e: L.LeafletMouseEvent) => {
            console.log('Click at', e.latlng);
        });
    }

    updatePath(locations: any[], append: boolean = false) {
        if (!this.map) return;

        if (append && this.locationsCache.length > 0) {
            this.locationsCache = this.locationsCache.concat(locations.slice(1));
        } else {
            this.locationsCache = locations;
        }

        const latLngs = this.locationsCache.map((loc: any) => [Number(loc.latitude), Number(loc.longitude)] as [number, number]);

        if (this.currentPolyline) {
            this.currentPolyline.setLatLngs(latLngs);
        } else {
            this.currentPolyline = leaflet.polyline(latLngs, { color: 'blue' }).addTo(this.map);
            this.currentPolyline.on('click', (e: L.LeafletMouseEvent) => this.handlePolylineClick(e));
        }
    }

    handlePolylineClick(e: L.LeafletMouseEvent) {
        if (!this.map) return;

        const latlng = e.latlng;
        const clickPoint = this.map.latLngToContainerPoint(latlng);

        const candidates = this.locationsCache.map((loc, idx) => {
            const pt = this.map!.latLngToContainerPoint([Number(loc.latitude), Number(loc.longitude)]);
            const dist = clickPoint.distanceTo(pt);
            return { loc, dist, idx };
        }).filter(result => result.dist < 20)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, MAX_AMBIGUITY_CANDIDATES);

        if (candidates.length > 0) {
            this.onPointSelect(candidates, latlng);
        }
    }

    getLocations() {
        return this.locationsCache;
    }
}
