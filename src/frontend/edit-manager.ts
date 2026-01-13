import { MapManager } from './map-manager.js';
import { ApiClient } from './api.js';

const leaflet = (globalThis as any).L as unknown as typeof import('leaflet');

const AMBIGUITY_COLORS = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe'
];

export class EditManager {
    private mapManager: MapManager;
    private hasWritePermission: boolean = false;

    // State
    private activeEditMarker: L.Marker | null = null;
    private activePopup: L.Popup | null = null;
    private activeConfirmTooltip: L.Tooltip | null = null;
    private adjacentPolylines: L.Polyline[] = [];
    private activeAmbiguityLayers: L.Polyline[] = [];

    constructor(mapManager: MapManager) {
        this.mapManager = mapManager;
    }

    setPermissions(write: boolean) {
        this.hasWritePermission = write;
    }

    handlePointSelection(candidates: any[], latlng: L.LatLng) {
        if (candidates.length === 1) {
            this.showPointInfo(candidates[0].loc);
        } else {
            this.showAmbiguityPopup(candidates, latlng);
        }
    }

    private showPointInfo(info: any) {
        if (this.hasWritePermission) {
            this.enterEditMode(info);
        } else {
            const lat = Number(info.latitude);
            const lng = Number(info.longitude);
            const content = `
                <b>Point ${info.id}</b><br>
                [${lat.toFixed(5)}, ${lng.toFixed(5)}]<br>
                ${info.timestamp ? `Time: ${new Date(info.timestamp * 1000).toLocaleString()}<br>` : ''}
            `;

            if (this.mapManager.map) {
                this.activePopup = leaflet.popup()
                    .setLatLng([lat, lng])
                    .setContent(content)
                    .openOn(this.mapManager.map);
            }
        }
    }

    private showAmbiguityPopup(candidates: any[], latlng: L.LatLng) {
        if (!this.mapManager.map) return;

        this.clearAmbiguityLayers();

        const content = document.createElement('div');
        content.className = 'ambiguity-list';
        content.innerHTML = '<b>Select Point:</b>';

        candidates.forEach((c, i) => {
            const color = AMBIGUITY_COLORS[i % AMBIGUITY_COLORS.length];
            const locations = this.mapManager.getLocations();

            // Highlight lines
            const prevLoc = c.idx > 0 ? locations[c.idx - 1] : null;
            const nextLoc = c.idx < locations.length - 1 ? locations[c.idx + 1] : null;
            const currentLat = Number(c.loc.latitude);
            const currentLng = Number(c.loc.longitude);

            if (prevLoc) {
                this.activeAmbiguityLayers.push(leaflet.polyline([
                    [Number(prevLoc.latitude), Number(prevLoc.longitude)],
                    [currentLat, currentLng]
                ], { color: color, weight: 5, opacity: 0.7 }).addTo(this.mapManager.map!));
            }
            if (nextLoc) {
                this.activeAmbiguityLayers.push(leaflet.polyline([
                    [currentLat, currentLng],
                    [Number(nextLoc.latitude), Number(nextLoc.longitude)]
                ], { color: color, weight: 5, opacity: 0.7 }).addTo(this.mapManager.map!));
            }

            const item = document.createElement('div');
            item.className = 'ambiguity-item';
            item.style.borderLeft = `5px solid ${color}`;
            item.style.paddingLeft = '5px';

            const timeStr = c.loc.timestamp ? new Date(c.loc.timestamp * 1000).toLocaleTimeString() : 'No time';
            item.innerHTML = `#${c.loc.id} - ${timeStr}`;
            item.onclick = () => {
                this.clearAmbiguityLayers();
                this.showPointInfo(c.loc);
            };
            content.appendChild(item);
        });

        this.activePopup = leaflet.popup({ className: 'ambiguity-popup' })
            .setLatLng(latlng)
            .setContent(content)
            .openOn(this.mapManager.map);

        this.mapManager.map.once('popupclose', () => this.clearAmbiguityLayers());
    }

    private clearAmbiguityLayers() {
        if (this.mapManager.map) {
            this.activeAmbiguityLayers.forEach(l => this.mapManager.map!.removeLayer(l));
        }
        this.activeAmbiguityLayers = [];
    }

    private enterEditMode(info: any) {
        if (!this.mapManager.map) return;

        // Cleanup previous
        if (this.activePopup) {
            this.mapManager.map.closePopup(this.activePopup);
            this.activePopup = null;
        }
        this.clearAmbiguityLayers();
        this.exitEditMode();

        const locations = this.mapManager.getLocations();
        const idx = locations.findIndex(l => l.id === info.id);
        if (idx === -1) return;

        const startLat = Number(info.latitude);
        const startLng = Number(info.longitude);
        const prevLoc = idx > 0 ? locations[idx - 1] : null;
        const nextLoc = idx < locations.length - 1 ? locations[idx + 1] : null;

        const marker = leaflet.marker([startLat, startLng], {
            draggable: true,
            icon: leaflet.divIcon({
                className: 'dot-marker editing',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(this.mapManager.map);

        this.activeEditMarker = marker;

        // Info Popup
        const infoContent = `
            <div>
                <b>Point ${info.id}</b><br>
                [${startLat.toFixed(5)}, ${startLng.toFixed(5)}]<br>
                ${info.timestamp ? `Time: ${new Date(info.timestamp * 1000).toLocaleString()}<br>` : ''}
            </div>
        `;
        const popup = marker.bindPopup(infoContent);
        popup.openPopup();

        // Control UI Logic
        const showConfirmUI = () => {
            const pos = marker.getLatLng();
            const div = document.createElement('div');
            div.className = 'edit-controls-popup';
            div.innerHTML = `
                <div class="edit-controls">
                    <span>${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}</span>
                    <button class="btn-save">✓</button>
                    <button class="btn-cancel">✗</button>
                </div>
             `;

            div.querySelector('.btn-save')?.addEventListener('click', async (e) => {
                leaflet.DomEvent.stop(e as any);
                await this.save(info.id, marker.getLatLng(), idx);
            });

            div.querySelector('.btn-cancel')?.addEventListener('click', (e) => {
                leaflet.DomEvent.stop(e as any);
                this.exitEditMode();
            });

            if (!this.activeConfirmTooltip) {
                this.activeConfirmTooltip = leaflet.tooltip({
                    permanent: true, direction: 'top', offset: [0, -10], interactive: true, className: 'edit-tooltip-container'
                }).setContent(div).setLatLng(marker.getLatLng()).addTo(this.mapManager.map!);
            } else {
                this.activeConfirmTooltip.setLatLng(marker.getLatLng()).setContent(div);
            }
        };

        const updateEdges = (pos: L.LatLng) => {
            if (!this.mapManager.map) return;
            this.adjacentPolylines.forEach(p => this.mapManager.map!.removeLayer(p));
            this.adjacentPolylines = [];

            if (prevLoc) {
                this.adjacentPolylines.push(leaflet.polyline([
                    [Number(prevLoc.latitude), Number(prevLoc.longitude)],
                    [pos.lat, pos.lng]
                ], { color: 'red', dashArray: '5, 5' }).addTo(this.mapManager.map));
            }
            if (nextLoc) {
                this.adjacentPolylines.push(leaflet.polyline([
                    [pos.lat, pos.lng],
                    [Number(nextLoc.latitude), Number(nextLoc.longitude)]
                ], { color: 'red', dashArray: '5, 5' }).addTo(this.mapManager.map));
            }
        };

        marker.on('dragstart', () => {
            marker.closePopup();
            if (this.activeConfirmTooltip && this.mapManager.map) {
                this.mapManager.map.removeLayer(this.activeConfirmTooltip);
                this.activeConfirmTooltip = null;
            }
            updateEdges(marker.getLatLng());
        });
        marker.on('drag', () => updateEdges(marker.getLatLng()));
        marker.on('dragend', () => showConfirmUI());
    }

    private exitEditMode() {
        if (!this.mapManager.map) return;

        if (this.activeEditMarker) {
            this.mapManager.map.removeLayer(this.activeEditMarker);
            this.activeEditMarker = null;
        }
        if (this.activeConfirmTooltip) {
            this.mapManager.map.removeLayer(this.activeConfirmTooltip);
            this.activeConfirmTooltip = null;
        }
        this.adjacentPolylines.forEach(p => this.mapManager.map!.removeLayer(p));
        this.adjacentPolylines = [];
    }

    private async save(id: number, pos: L.LatLng, cacheIdx: number) {
        const success = await ApiClient.saveLocation(id, pos.lat, pos.lng);
        if (success) {
            const locations = this.mapManager.getLocations();
            if (locations[cacheIdx]) {
                locations[cacheIdx].latitude = pos.lat;
                locations[cacheIdx].longitude = pos.lng;
            }
            this.exitEditMode();

            // Local Map Update
            if (this.mapManager.currentPolyline) {
                const latLngs = locations.map((l: any) => [Number(l.latitude), Number(l.longitude)] as [number, number]);
                this.mapManager.currentPolyline.setLatLngs(latLngs);
            }
        } else {
            alert('Failed to save');
        }
    }
}
