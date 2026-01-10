import { dom, showError } from './ui.js';
import { ApiClient } from './api.js';
import { MapManager } from './map-manager.js';
import { EditManager } from './edit-manager.js';

let mapManager: MapManager;
let editManager: EditManager;

async function refresh(triggeredByUser: boolean = false) {
    console.log('Refreshing map data', { triggeredByUser });
    try {
        const startId = triggeredByUser ? null : (mapManager.locationsCache.length > 0 ? mapManager.locationsCache[mapManager.locationsCache.length - 1].id : null);
        const locations = await ApiClient.fetchLocations(startId);

        if (locations.length > 0) {
            mapManager.updatePath(locations, !triggeredByUser);
        }
    } catch (e) {
        if (triggeredByUser) console.error(e);
    }
}

async function loadMap() {
    const tokenFromInput = dom.tokenInput?.value?.trim() || '';
    if (tokenFromInput) ApiClient.token = tokenFromInput;

    const token = ApiClient.token;
    if (!token) {
        showError('Please enter a token.');
        return;
    }

    const hasWrite = await ApiClient.checkPermissions();
    editManager.setPermissions(hasWrite);

    try {
        const locations = await ApiClient.fetchLocations();

        if (locations.length === 0) {
            showError('No location data found.');
            return;
        }

        if (dom.tokenPrompt) dom.tokenPrompt.style.display = 'none';
        if (dom.controls) dom.controls.style.display = 'none';
        if (dom.openControlsButton) dom.openControlsButton.style.display = 'block';

        const last = locations[locations.length - 1];
        mapManager.init(last.latitude, last.longitude);
        mapManager.updatePath(locations);

        console.log('Setting up auto-refresh interval');
        setInterval(() => refresh(false), 60000);
    } catch (err: any) {
        console.error('Error loading map:', err);
        showError(err?.message ?? 'Unknown error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Check for stored token
    const stored = ApiClient.token;
    if (stored && dom.tokenInput) dom.tokenInput.value = stored;

    // Initialize Managers
    mapManager = new MapManager('map', (candidates, latlng) => {
        editManager.handlePointSelection(candidates, latlng);
    });
    editManager = new EditManager(mapManager);

    // Event Listeners
    if (dom.loadButton) {
        dom.loadButton.addEventListener('click', () => {
            if (dom.errorMessage) dom.errorMessage.style.display = 'none';
            loadMap();
        });
    }

    if (dom.refreshButton) {
        dom.refreshButton.addEventListener('click', () => refresh(true));
    }

    if (dom.exportButton) {
        dom.exportButton.addEventListener('click', async () => {
            try {
                await ApiClient.exportGpx();
            } catch (e: any) {
                showError(e.message || 'Export failed');
            }
        });
    }

    if (dom.controls && dom.openControlsButton) {
        dom.openControlsButton.addEventListener('click', () => {
            dom.controls.style.display = 'block';
            dom.openControlsButton.style.display = 'none';
        });

        dom.controls.addEventListener('focusout', (event) => {
            if (!dom.controls.contains((event.relatedTarget as Node))) {
                dom.controls.style.display = 'none';
                dom.openControlsButton.style.display = 'block';
            }
        });
    }
});
