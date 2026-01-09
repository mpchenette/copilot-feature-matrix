// Minimal script - just load and display data

let rawData = {};
let currentView = 'features'; // 'features' or 'ides'

// Load data
async function init() {
    try {
        const response = await fetch('data.json');
        rawData = await response.json();
        render();
        setupEventListeners();
    } catch (error) {
        document.getElementById('tableContainer').innerHTML =
            '<div class="loading">Failed to load data</div>';
    }
}

// Setup interactions
function setupEventListeners() {
    const viewToggle = document.getElementById('viewToggle');

    viewToggle.addEventListener('click', () => {
        currentView = currentView === 'features' ? 'ides' : 'features';
        viewToggle.textContent = currentView === 'features' ? 'By IDE' : 'By Feature';
        render();
    });
}

// Render table
function render() {
    const container = document.getElementById('tableContainer');

    if (currentView === 'features') {
        container.innerHTML = renderFeaturesView();
    } else {
        container.innerHTML = renderIDEsView();
    }
}

// Features view: rows = features, columns = IDEs
function renderFeaturesView() {
    const ides = Object.keys(rawData);
    const allFeatures = getAllFeatures();
    const latestVersions = getLatestVersions();

    let html = '<table><thead><tr><th>Feature</th>';
    ides.forEach(ide => {
        html += `<th>${ide}</th>`;
    });
    html += '</tr></thead><tbody>';

    allFeatures.forEach(feature => {
        html += '<tr>';
        html += `<td>${feature}</td>`;

        ides.forEach(ide => {
            const status = getFeatureStatus(ide, latestVersions[ide], feature);
            html += `<td>${formatStatus(status)}</td>`;
        });

        html += '</tr>';
    });

    html += '</tbody></table>';
    html += renderLegend();

    return html;
}

// IDEs view: rows = IDEs, columns = features
function renderIDEsView() {
    const ides = Object.keys(rawData);
    const allFeatures = getAllFeatures();
    const latestVersions = getLatestVersions();

    let html = '<table><thead><tr><th>IDE</th>';
    allFeatures.forEach(feature => {
        html += `<th>${feature}</th>`;
    });
    html += '</tr></thead><tbody>';

    ides.forEach(ide => {
        html += '<tr>';
        html += `<td>${ide}</td>`;

        allFeatures.forEach(feature => {
            const status = getFeatureStatus(ide, latestVersions[ide], feature);
            html += `<td>${formatStatus(status)}</td>`;
        });

        html += '</tr>';
    });

    html += '</tbody></table>';
    html += renderLegend();

    return html;
}

// Get all unique features
function getAllFeatures() {
    const features = new Set();

    Object.values(rawData).forEach(versions => {
        Object.values(versions).forEach(versionData => {
            Object.keys(versionData).forEach(key => {
                if (!key.startsWith('_')) {
                    features.add(key);
                }
            });
        });
    });

    return Array.from(features).sort();
}

// Get latest version for each IDE
function getLatestVersions() {
    const latest = {};

    Object.entries(rawData).forEach(([ide, versions]) => {
        const versionNumbers = Object.keys(versions).sort(compareVersions);
        latest[ide] = versionNumbers[versionNumbers.length - 1];
    });

    return latest;
}

// Get feature status for IDE at version
function getFeatureStatus(ide, version, feature) {
    const versions = Object.keys(rawData[ide]).sort(compareVersions);
    const versionIndex = versions.indexOf(version);

    // Check current and previous versions (inheritance)
    for (let i = versionIndex; i >= 0; i--) {
        const versionData = rawData[ide][versions[i]];
        if (versionData[feature]) {
            return {
                available: true,
                releaseType: versionData[feature].releaseType,
                version: versions[i]
            };
        }
    }

    return { available: false };
}

// Format status as HTML
function formatStatus(status) {
    if (!status.available) {
        return '<span class="status status-none"></span>';
    }

    const statusClass = status.releaseType === 'ga' ? 'status-ga' : 'status-preview';
    return `<span class="status ${statusClass}"></span><span class="version">v${status.version}</span>`;
}

// Render legend
function renderLegend() {
    return `
        <div class="legend">
            <div class="legend-item">
                <span class="status status-ga"></span>
                <span>Generally Available</span>
            </div>
            <div class="legend-item">
                <span class="status status-preview"></span>
                <span>Preview</span>
            </div>
            <div class="legend-item">
                <span class="status status-none"></span>
                <span>Not Available</span>
            </div>
        </div>
    `;
}

// Compare version strings
function compareVersions(a, b) {
    const aParts = a.split('.').map(n => parseInt(n) || 0);
    const bParts = b.split('.').map(n => parseInt(n) || 0);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        if (aPart !== bPart) return aPart - bPart;
    }

    return 0;
}

// Start
document.addEventListener('DOMContentLoaded', init);
