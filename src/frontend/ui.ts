export const dom = {
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
    exportButton: document.getElementById('export-button') as HTMLElement,
    map: document.getElementById('map') as HTMLElement,
};

export function showError(message: string) {
    if (!dom.errorMessage) return;
    dom.errorMessage.textContent = message;
    dom.errorMessage.style.display = 'block';
}
