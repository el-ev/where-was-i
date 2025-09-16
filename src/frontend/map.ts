const L: any = (globalThis as any).L;

let map: any;

const STORAGE_KEY = 'apiToken';

function showError(message: string) {
    const errorMessage = document.getElementById('error-message') as HTMLElement | null;
    if (!errorMessage) return;
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
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
        const response = await fetch('/locations', {
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

        const first = locations[0];
        map = L.map('map').setView([first.latitude, first.longitude], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 25,
            attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        const latLngs: any[] = locations.map((loc: any) => [Number(loc.latitude), Number(loc.longitude)] as [number, number]);
        const polyline = L.polyline(latLngs, { color: 'blue' }).addTo(map);

        polyline.on('click', function (e: any) {
            const latlng = e.latlng;
            let minIdx = 0;
            let minDist = Infinity;
            latLngs.forEach((pt, idx) => {
                const dist = Math.sqrt(Math.pow(pt[0] - latlng.lat, 2) + Math.pow(pt[1] - latlng.lng, 2));
                if (dist < minDist) {
                    minDist = dist;
                    minIdx = idx;
                }
            });
            const info = locations[minIdx];
            L.popup()
                .setLatLng([info.latitude, info.longitude])
                .setContent(
                    `Point ${info.id}: [${info.latitude}, ${info.longitude}]<br>` +
                    (info.timestamp ? `Time: ${new Date(info.timestamp * 1000).toLocaleString()}<br>` : '')
                )
                .openOn(map);
        });
        L.marker(latLngs[0]).addTo(map).bindPopup('Start');
        L.marker(latLngs[latLngs.length - 1]).addTo(map).bindPopup('End');

        map.fitBounds(polyline.getBounds());
    } catch (err: any) {
        showError(err?.message ?? 'Unknown error');
    }
}

setInterval(() => {
    loadMap();
}, 120000);

document.addEventListener('DOMContentLoaded', () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const input = document.getElementById('token-input') as HTMLInputElement | null;
            if (input) input.value = stored;
        }
    } catch { }

    const button = document.getElementById('load-button');
    if (button) {
        button.addEventListener('click', () => {
            const errorMessage = document.getElementById('error-message') as HTMLElement | null;
            if (errorMessage) errorMessage.style.display = 'none';
            loadMap();
        });
    }
});
