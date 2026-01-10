import { dom, showError } from './ui.js';

export const STORAGE_KEY = 'apiToken';

export class ApiClient {
    static get token(): string {
        try {
            return localStorage.getItem(STORAGE_KEY) || '';
        } catch {
            return '';
        }
    }

    static set token(val: string) {
        try {
            if (val) localStorage.setItem(STORAGE_KEY, val);
            else localStorage.removeItem(STORAGE_KEY);
        } catch { }
    }

    static getApiUrl(startId: number | null = null): string {
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

    static async checkPermissions(): Promise<boolean> {
        const token = this.token;
        if (!token) return false;
        try {
            const response = await fetch('/tokens/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json() as any;
                return !!data.permissions?.write;
            }
        } catch (e) {
            console.warn('Failed to check permissions', e);
        }
        return false;
    }

    static async fetchLocations(startId: number | null = null): Promise<any[]> {
        const token = this.token;
        if (!token) throw new Error('No token provided');

        const response = await fetch(this.getApiUrl(startId), {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error('Invalid or unauthorized token.');
        }
        if (!response.ok) {
            throw new Error('Failed to fetch location data.');
        }
        return await response.json();
    }

    static async exportGpx() {
        const token = this.token;
        if (!token) throw new Error('No token provided');

        const baseUrl = this.getApiUrl();
        // Replace base path /locations with /locations/export/gpx
        // But getApiUrl might have query params "locations?foo=bar"
        // So we need to be careful.
        const url = baseUrl.replace('/locations', '/locations/export/gpx');

        try {
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = 'locations.gpx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();
        } catch (e) {
            console.error('Export failed', e);
            throw e;
        }
    }

    static async saveLocation(id: number, lat: number, lng: number): Promise<boolean> {
        const token = this.token;
        if (!token) return false;

        try {
            const res = await fetch(`/locations/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ lat, lng })
            });
            return res.ok;
        } catch (e) {
            console.error(e);
            return false;
        }
    }
}
