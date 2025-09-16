const leaflet = (globalThis as any).L as unknown as typeof import('leaflet');

let map: import('leaflet').Map;

const STORAGE_KEY = 'apiToken';

function showError(message: string) {
    const errorMessage = document.getElementById('error-message') as HTMLElement | null;
    if (!errorMessage) return;
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

function getApiUrl() {
    const startTime = (document.getElementById('startTime') as HTMLInputElement).value;
    const endTime = (document.getElementById('endTime') as HTMLInputElement).value;
    const limit = (document.getElementById('limit') as HTMLInputElement).value;
    const clusterMaxDist = (document.getElementById('clusterMaxDist') as HTMLInputElement).value;
    const bbox = (document.getElementById('bbox') as HTMLInputElement).value;

    const params = new URLSearchParams();
    if (startTime) params.set('startTime', new Date(startTime).toISOString());
    if (endTime) params.set('endTime', new Date(endTime).toISOString());
    if (limit) params.set('limit', limit);
    if (clusterMaxDist) params.set('clusterMaxDist', clusterMaxDist);
    if (bbox) params.set('bbox', bbox);

    const queryString = params.toString();
    return `/locations${queryString ? `?${queryString}` : ''}`;
}

async function loadMap() {
    const tokenInput = document.getElementById('token-input') as HTMLInputElement | null;
    const tokenFromInput = tokenInput?.value?.trim() || '';
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

        const promptDiv = document.getElementById('token-prompt') as HTMLElement | null;
        if (promptDiv) promptDiv.style.display = 'none';

        const controlsDiv = document.getElementById('controls') as HTMLElement | null;
        if (controlsDiv) controlsDiv.style.display = 'none';

        const openControlsButton = document.getElementById('open-controls-button') as HTMLElement | null;
        if (openControlsButton) openControlsButton.style.display = 'block';

        const first = locations[0];
        map = leaflet.map('map').setView([first.latitude, first.longitude], 16);
        leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 25,
            attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        locationsCache = locations;
        await refresh();

    } catch (err: any) {
        showError(err?.message ?? 'Unknown error');
    }
}

let currentPolyline: any = null;
let startMarker: any = null;
let endMarker: any = null;
let locationsCache: any[] = [];

// TODO incremental fetching
async function refresh() {
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
        const response = await fetch(getApiUrl(), {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const locations = await response.json();
        if (!Array.isArray(locations) || locations.length === 0) return;

        locationsCache = locations;
        const latLngs = locations.map((loc: any) => [Number(loc.latitude), Number(loc.longitude)] as [number, number]);

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

setInterval(() => {
    refresh();
}, 120000);

document.addEventListener('DOMContentLoaded', () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const input = document.getElementById('token-input') as HTMLInputElement | null;
            if (input) input.value = stored;
        }
    } catch { }

    const loadButton = document.getElementById('load-button');
    if (loadButton) {
        loadButton.addEventListener('click', () => {
            const errorMessage = document.getElementById('error-message') as HTMLElement | null;
            if (errorMessage) errorMessage.style.display = 'none';
            loadMap();
        });
    }

    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            refresh();
        });
    }

    const controlsDiv = document.getElementById('controls');
    const openControlsButton = document.getElementById('open-controls-button');

    if (controlsDiv && openControlsButton) {
        openControlsButton.addEventListener('click', () => {
            controlsDiv.style.display = 'block';
            openControlsButton.style.display = 'none';
        });

        controlsDiv.addEventListener('mouseleave', () => {
            controlsDiv.style.display = 'none';
            openControlsButton.style.display = 'block';
        });
    }
});
