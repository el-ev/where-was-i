const leaflet = (globalThis as any).L as unknown as typeof import('leaflet');

let map: import('leaflet').Map;

const STORAGE_KEY = 'apiToken';

const dom = {
    errorMessage: document.getElementById('error-message') as HTMLElement,
    startTime: document.getElementById('startTime') as HTMLInputElement,
    endTime: document.getElementById('endTime') as HTMLInputElement,
    limit: document.getElementById('limit') as HTMLInputElement,
    clusterMaxDist: document.getElementById('clusterMaxDist') as HTMLInputElement,
    bbox: document.getElementById('bbox') as HTMLInputElement,
    tokenInput: document.getElementById('token-input') as HTMLInputElement,
    tokenPrompt: document.getElementById('token-prompt') as HTMLElement,
    controls: document.getElementById('controls') as HTMLElement,
    openControlsButton: document.getElementById('open-controls-button') as HTMLElement,
    loadButton: document.getElementById('load-button') as HTMLElement,
    refreshButton: document.getElementById('refresh-button') as HTMLElement,
};

function showError(message: string) {
    if (!dom.errorMessage) return;
    dom.errorMessage.textContent = message;
    dom.errorMessage.style.display = 'block';
}

function getApiUrl(startId: number | null = null): string {
    const startTime = dom.startTime.value;
    const endTime = dom.endTime.value;
    const limit = dom.limit.value;
    const clusterMaxDist = dom.clusterMaxDist.value;
    const bbox = dom.bbox.value;

    const params = new URLSearchParams();
    if (startId !== null) params.set('startId', String(startId));
    if (startTime) params.set('startTime', new Date(startTime).toISOString());
    if (endTime) params.set('endTime', new Date(endTime).toISOString());
    if (limit) params.set('limit', limit);
    if (clusterMaxDist) params.set('clusterMaxDist', clusterMaxDist);
    if (bbox) params.set('bbox', bbox);

    const queryString = params.toString();
    return `/locations${queryString ? `?${queryString}` : ''}`;
}

async function loadMap() {
    const tokenFromInput = dom.tokenInput?.value?.trim() || '';
    const token = tokenFromInput || (() => { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; } })();

    if (!token) {
        showError('Please enter a token.');
        return;
    }

    try { localStorage.setItem(STORAGE_KEY, token); } catch { }

    try {
        const response = await fetch(getApiUrl(), {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error('Invalid or unauthorized token.');
        }
        if (!response.ok) {
            throw new Error('Failed to fetch location data.');
        }

        const locations = await response.json();
        if (!Array.isArray(locations) || locations.length === 0) {
            showError('No location data found.');
            return;
        }

        if (dom.tokenPrompt) dom.tokenPrompt.style.display = 'none';
        if (dom.controls) dom.controls.style.display = 'none';
        if (dom.openControlsButton) dom.openControlsButton.style.display = 'block';

        const last = locations[locations.length - 1];
        map = leaflet.map('map').setView([last.latitude, last.longitude], 16);
        leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 25,
            attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        locationsCache = locations;
        await refresh(false);

        setInterval(() => {
            refresh(false);
        }, 120000);
    } catch (err: any) {
        showError(err?.message ?? 'Unknown error');
    }
}

let currentPolyline: any = null;
let startMarker: any = null;
let endMarker: any = null;
let locationsCache: any[] = [];

async function refresh(triggeredByUser: boolean = false) {
    if (!map) return;

    try {
        map.eachLayer((layer: any) => {
            if (!currentPolyline && (layer instanceof (leaflet as any).Polyline)) {
                currentPolyline = layer;
            }
            if (!startMarker && (layer instanceof (leaflet as any).Marker)) {
                const popup = layer.getPopup && layer.getPopup();
                if (popup && popup.getContent && popup.getContent() === 'Start') startMarker = layer;
            }
            if (!endMarker && (layer instanceof (leaflet as any).Marker)) {
                const popup = layer.getPopup && layer.getPopup();
                if (popup && popup.getContent && popup.getContent() === 'End') endMarker = layer;
            }
        });
    } catch {
    }

    const token = (() => { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; } })();
    if (!token) return;

    try {
        const startId = triggeredByUser ? null : (locationsCache.length > 0 ? locationsCache[locationsCache.length - 1].id : null);
        const response = await fetch(getApiUrl(startId), {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const locations = await response.json();
        if (!Array.isArray(locations) || locations.length === 0) return;

        if (triggeredByUser || locationsCache.length === 0) {
            locationsCache = locations;
        } else {
            locationsCache = locationsCache.concat(locations.slice(1));
        }
        const latLngs = locationsCache.map((loc: any) => [Number(loc.latitude), Number(loc.longitude)] as [number, number]);

        if (currentPolyline) {
            currentPolyline.setLatLngs(latLngs);
        } else {
            currentPolyline = leaflet.polyline(latLngs, { color: 'blue' }).addTo(map);
            currentPolyline.on('click', function (e: any) {
                const latlng = e.latlng;
                let minIdx = 0;
                let minDist = Infinity;
                locationsCache.forEach((info, idx) => {
                    const pt = [Number(info.latitude), Number(info.longitude)];
                    const dist = Math.hypot(pt[0] - latlng.lat, pt[1] - latlng.lng);
                    if (dist < minDist) {
                        minDist = dist;
                        minIdx = idx;
                    }
                });
                const info = locationsCache[minIdx];
                leaflet.popup()
                    .setLatLng([info.latitude, info.longitude])
                    .setContent(
                        `Point ${info.id}: [${info.latitude}, ${info.longitude}]<br>` +
                        (info.timestamp ? `Time: ${new Date(info.timestamp * 1000).toLocaleString()}<br>` : '')
                    )
                    .openOn(map);
            });
        }

        if (latLngs.length > 0) {
            if (startMarker) {
                startMarker.setLatLng(latLngs[0]);
            } else {
                startMarker = leaflet.marker(latLngs[0]).addTo(map).bindPopup('Start');
            }

            const last = latLngs.length - 1;
            if (endMarker) {
                endMarker.setLatLng(latLngs[last]);
            } else {
                endMarker = leaflet.marker(latLngs[last]).addTo(map).bindPopup('End');
            }
        }
    } catch {
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            if (dom.tokenInput) dom.tokenInput.value = stored;
        }
    } catch { }

    if (dom.loadButton) {
        dom.loadButton.addEventListener('click', () => {
            if (dom.errorMessage) dom.errorMessage.style.display = 'none';
            loadMap();
        });
    }

    if (dom.refreshButton) {
        dom.refreshButton.addEventListener('click', () => {
            refresh(true);
        });
    }

    if (dom.controls && dom.openControlsButton) {
        dom.openControlsButton.addEventListener('click', () => {
            dom.controls.style.display = 'block';
            dom.openControlsButton.style.display = 'none';
        });

        dom.controls.addEventListener('mouseleave', () => {
            dom.controls.style.display = 'none';
            dom.openControlsButton.style.display = 'block';
        });
    }
});
