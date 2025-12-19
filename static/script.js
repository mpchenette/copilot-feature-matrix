// Global variables
window.featureData = [];
window.rawFeatureData = {};
window.versionDateIndex = {};

// Function to load and process feature data
async function loadFeatureData() {
    try {
        // Add cache-busting parameter to force fresh data
        const timestamp = new Date().getTime();
        const response = await fetch(`data.json?v=${timestamp}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const rawData = await response.json();
        console.debug('Raw data loaded successfully:', Object.keys(rawData));
        
        // Store raw data globally for other functions
        window.rawFeatureData = rawData;

        // Validate data for conflicts
        const warnings = validateData(rawData);
        displayWarnings(warnings);

        // Capture release dates for metadata surfaces
        const { versionDates, latestDate } = extractDateMetadata(rawData);
        window.versionDateIndex = versionDates;
        updateLastUpdatedBanner(latestDate);

        // Convert to normalized format
        window.featureData = normalizeData(rawData);

        console.debug('Loaded feature data:', window.featureData.length, 'entries');
        
        // Initialize the default view
        showFeatureMatrix();
        
        return true; // Return success
    } catch (error) {
        console.error('Error loading feature data:', error);
        
        // Display error in UI
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div style="padding: 2rem; background: #4a2828; border: 1px solid #d66; border-radius: 8px; margin: 2rem;">
                    <h3 style="color: #d66; margin: 0 0 1rem 0;">❌ Error Loading Data</h3>
                    <p style="color: #ddd; margin: 0;">
                        <strong>Error:</strong> ${error.message}
                    </p>
                    <p style="color: #999; margin: 1rem 0 0 0; font-size: 0.9em;">
                        Please check the browser console for more details and verify that data.json is valid JSON.
                    </p>
                </div>
            `;
        }
        
        return false; // Return failure
    }
}

// Function to validate data for conflicts and inconsistencies
function validateData(rawData) {
    const warnings = [];
    
    for (const [ide, versions] of Object.entries(rawData)) {
        const sortedVersions = Object.keys(versions).sort(compareVersions);
        const featureHistory = {}; // Track feature release type history
        const dateHistory = []; // Track date chronology
        
        // Get all features across all versions for this IDE (excluding _date fields)
        const allFeatures = new Set();
        for (const version of Object.values(versions)) {
            for (const featureName of Object.keys(version)) {
                // Skip internal fields like _date
                if (!featureName.startsWith('_')) {
                    allFeatures.add(featureName);
                }
            }
        }
        
        // Validate dates and chronology
        for (const version of sortedVersions) {
            const versionData = versions[version];
            if (versionData._date) {
                const dateStr = versionData._date;
                
                // Validate date format (YYYY-MM-DD)
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(dateStr)) {
                    warnings.push({
                        type: 'invalid_date',
                        ide,
                        version,
                        message: `Invalid date format "${dateStr}" in version ${version}. Expected YYYY-MM-DD format.`
                    });
                    continue;
                }
                
                // Validate that it's a real date
                const dateObj = new Date(dateStr + 'T00:00:00.000Z');
                if (isNaN(dateObj.getTime()) || dateObj.toISOString().slice(0, 10) !== dateStr) {
                    warnings.push({
                        type: 'invalid_date',
                        ide,
                        version,
                        message: `Invalid date "${dateStr}" in version ${version}. Date does not exist.`
                    });
                    continue;
                }
                
                // Check chronological order
                if (dateHistory.length > 0) {
                    const lastDate = dateHistory[dateHistory.length - 1];
                    if (dateObj <= lastDate.dateObj) {
                        warnings.push({
                            type: 'date_chronology',
                            ide,
                            version,
                            message: `Date "${dateStr}" in version ${version} is not chronologically after "${lastDate.dateStr}" in version ${lastDate.version}.`
                        });
                    }
                }
                
                dateHistory.push({ dateStr, dateObj, version });
            }
        }
        
        // Check each feature's history across versions
        for (const featureName of allFeatures) {
            featureHistory[featureName] = [];
            
            // Collect all explicit mentions of this feature
            for (const version of sortedVersions) {
                const versionData = versions[version];
                if (versionData[featureName]) {
                    featureHistory[featureName].push({
                        version: version,
                        releaseType: versionData[featureName].releaseType
                    });
                }
            }
            
            // Validate feature history
            const history = featureHistory[featureName];
            if (history.length > 0) {
                // Check for duplicate entries with same release type
                const releaseTypeCounts = {};
                for (const entry of history) {
                    const key = entry.releaseType;
                    releaseTypeCounts[key] = (releaseTypeCounts[key] || 0) + 1;
                    if (releaseTypeCounts[key] > 1) {
                        warnings.push({
                            type: 'duplicate',
                            ide: ide,
                            feature: featureName,
                            releaseType: entry.releaseType,
                            message: `Feature "${featureName}" in ${ide} has multiple entries with releaseType "${entry.releaseType}"`
                        });
                    }
                }
                
                // Check for GA before Preview (chronological order violation)
                let seenGA = false;
                for (const entry of history) {
                    if (entry.releaseType === 'ga') {
                        seenGA = true;
                    } else if (entry.releaseType === 'preview') {
                        if (seenGA) {
                            warnings.push({
                                type: 'chronology',
                                ide: ide,
                                feature: featureName,
                                message: `Feature "${featureName}" in ${ide} has Preview release after GA (should be Preview → GA)`
                            });
                        }
                    }
                }
            }
        }
    }
    
    return warnings;
}

// Function to display validation warnings
function displayWarnings(warnings) {
    if (warnings.length === 0) {
        console.info('✅ Data validation passed - no conflicts detected');
        return;
    }
    
    console.warn(`⚠️ Data validation found ${warnings.length} issue(s):`);
    
    const groupedWarnings = {
        duplicate: warnings.filter(w => w.type === 'duplicate'),
        chronology: warnings.filter(w => w.type === 'chronology'),
        invalid_date: warnings.filter(w => w.type === 'invalid_date'),
        date_chronology: warnings.filter(w => w.type === 'date_chronology')
    };
    
    if (groupedWarnings.duplicate.length > 0) {
        console.warn('\n🔄 Duplicate Entries:');
        groupedWarnings.duplicate.forEach(w => console.warn(`  • ${w.message}`));
    }
    
    if (groupedWarnings.chronology.length > 0) {
        console.warn('\n📅 Feature Chronology Issues:');
        groupedWarnings.chronology.forEach(w => console.warn(`  • ${w.message}`));
    }
    
    if (groupedWarnings.invalid_date.length > 0) {
        console.warn('\n📅 Invalid Date Format:');
        groupedWarnings.invalid_date.forEach(w => console.warn(`  • ${w.message}`));
    }
    
    if (groupedWarnings.date_chronology.length > 0) {
        console.warn('\n📅 Date Chronology Issues:');
        groupedWarnings.date_chronology.forEach(w => console.warn(`  • ${w.message}`));
    }
    
    // Also display in UI
    const warningDiv = document.createElement('div');
    warningDiv.className = 'validation-warnings';
    warningDiv.innerHTML = `
        <h3>⚠️ Data Validation Warnings (${warnings.length})</h3>
        <ul>
            ${warnings.map(w => `<li><strong>${w.ide}</strong> - ${w.message}</li>`).join('')}
        </ul>
        <p><em>Check browser console for details. These issues should be fixed in data.json.</em></p>
    `;
    
    // Insert warnings at the top of the page
    const container = document.querySelector('.container');
    container.insertBefore(warningDiv, container.firstChild);
}

// Function to resolve inheritance and convert to flat structure
function normalizeData(rawData) {
    const normalized = [];
    const featureIntroductions = {}; // Track when each feature was first introduced per IDE
    
    for (const [ide, versions] of Object.entries(rawData)) {
        // Sort versions to process in order (automatic inheritance from previous version)
        const sortedVersions = Object.keys(versions).sort(compareVersions);
        const resolvedVersions = {};
        featureIntroductions[ide] = {};
        
        // Get all possible features for this IDE (to track absence, excluding _date fields)
        const allFeatures = new Set();
        for (const version of Object.values(versions)) {
            for (const featureName of Object.keys(version)) {
                // Skip internal fields like _date
                if (!featureName.startsWith('_')) {
                    allFeatures.add(featureName);
                }
            }
        }
        
        for (let i = 0; i < sortedVersions.length; i++) {
            const version = sortedVersions[i];
            const versionData = versions[version];
            let features = {};
            
            // Automatically inherit from previous version (if exists)
            if (i > 0) {
                const previousVersion = sortedVersions[i - 1];
                if (resolvedVersions[previousVersion]) {
                    features = { ...resolvedVersions[previousVersion] };
                }
            }
            
            // Apply this version's features (overriding inherited ones, excluding _date fields)
            for (const [featureName, featureData] of Object.entries(versionData)) {
                // Skip internal fields like _date
                if (!featureName.startsWith('_')) {
                    features[featureName] = featureData;
                }
            }
            
            // Store resolved features for this version
            resolvedVersions[version] = features;
            
            // Convert to flat structure for all features (present and absent)
            for (const featureName of allFeatures) {
                const featureInfo = features[featureName];
                const isSupported = !!featureInfo;
                
                // Track when this feature was first introduced
                if (isSupported && !featureIntroductions[ide][featureName]) {
                    featureIntroductions[ide][featureName] = version;
                }
                
                // Calculate the introduced version and support level
                const introducedVersion = isSupported ? featureIntroductions[ide][featureName] : null;
                const support = isSupported 
                    ? (featureInfo.releaseType === 'preview' ? 'partial' : 'full')
                    : 'none';
                
                normalized.push({
                    ide: ide,
                    version: version,
                    feature: featureName,
                    support: support,
                    introduced: introducedVersion,
                    releaseType: isSupported ? featureInfo.releaseType : null
                });
            }
        }
    }
    
    return normalized;
}

function extractDateMetadata(rawData) {
    const versionDates = {};
    let latestDate = null;

    const isoPattern = /^\d{4}-\d{2}-\d{2}$/;

    for (const [ide, versions] of Object.entries(rawData)) {
        versionDates[ide] = {};
        for (const [version, versionData] of Object.entries(versions)) {
            const isoDate = versionData._date;
            if (!isoDate || !isoPattern.test(isoDate)) {
                continue;
            }

            versionDates[ide][version] = isoDate;

            if (!latestDate || isDateNewer(isoDate, latestDate)) {
                latestDate = isoDate;
            }
        }
    }

    return { versionDates, latestDate };
}

function isDateNewer(candidateISO, baselineISO) {
    if (!candidateISO) return false;
    if (!baselineISO) return true;

    const candidateDate = new Date(`${candidateISO}T00:00:00.000Z`);
    const baselineDate = new Date(`${baselineISO}T00:00:00.000Z`);

    return candidateDate > baselineDate;
}

function getVersionDate(ide, version) {
    if (!ide || !version || !window.versionDateIndex) {
        return null;
    }

    return window.versionDateIndex[ide]?.[version] || null;
}

function formatDisplayDate(isoDate) {
    if (!isoDate) return '';
    const parsed = new Date(`${isoDate}T00:00:00.000Z`);
    if (isNaN(parsed.getTime())) {
        return isoDate;
    }

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).format(parsed);
}

function updateLastUpdatedBanner(latestDate) {
    const banner = document.getElementById('lastUpdated');
    if (!banner) {
        return;
    }

    if (!latestDate) {
        banner.textContent = '';
        banner.classList.add('is-hidden');
        return;
    }

    banner.textContent = `Updated: ${formatDisplayDate(latestDate)}`;
    banner.classList.remove('is-hidden');
}

// Helper function to compare versions properly
function compareVersions(a, b) {
    // Handle different version formats
    if (a === b) return 0;
    
    // If both are years (like 2019, 2022)
    if (/^\d{4}$/.test(a) && /^\d{4}$/.test(b)) {
        return parseInt(a) - parseInt(b);
    }
    
    // If both are semantic versions (like 1.60.0, 2023.1)
    const aParts = a.split('.').map(num => parseInt(num));
    const bParts = b.split('.').map(num => parseInt(num));
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        
        if (aPart !== bPart) {
            return aPart - bPart;
        }
    }
    
    return 0;
}

// Support status mapping
const supportStatus = {
    'full': { 
        symbol: '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="48" height="48" viewBox="0 0 96 96" style="display: inline-block; vertical-align: middle;"><g transform="translate(26.386363636363633, 64.1590909090909)"><path d="M16.77-4.23L5.18-15.75 7.77-18.41 16.77-9.55 35.39-28.09 38.05-25.43 16.77-4.23Z" fill="#4CAF50" stroke="#4CAF50" stroke-width="2" stroke-linejoin="round"></path></g></svg>', 
        class: 'supported',
        isHtml: true
    },
    'partial': { 
        symbol: '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="48" height="48" viewBox="0 0 96 96" style="display: inline-block; vertical-align: middle;"><text x="50" y="60" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="currentColor">P</text></svg>', 
        class: 'partial',
        isHtml: true
    },
    'none': { symbol: '-', class: 'not-supported' }
};

// Helper function for custom IDE sorting
function sortIDEs(ides) {
    const customOrder = ['VS Code', 'Visual Studio', 'JetBrains', 'Eclipse', 'Xcode', 'Neovim'];
    
    return ides.sort((a, b) => {
        const aIndex = customOrder.indexOf(a);
        const bIndex = customOrder.indexOf(b);
        
        // If both are in custom order, use that order
        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
        }
        // If only one is in custom order, prioritize it
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        // If neither is in custom order, use alphabetical
        return a.localeCompare(b);
    });
}

// Utility functions to get unique values
function getUniqueIDEs() {
    const ides = Object.keys(window.rawFeatureData);
    return sortIDEs(ides);
}

function getUniqueFeatures() {
    const features = new Set();
    
    // Collect all features from all IDEs and versions (excluding _date fields)
    for (const [ide, versions] of Object.entries(window.rawFeatureData)) {
        for (const version of Object.values(versions)) {
            for (const featureName of Object.keys(version)) {
                // Skip internal fields like _date
                if (!featureName.startsWith('_')) {
                    features.add(featureName);
                }
            }
        }
    }
    
    return [...features].sort();
}

function getVersionsForIDE(ide) {
    if (!window.rawFeatureData[ide]) return [];
    return Object.keys(window.rawFeatureData[ide]).sort(compareVersions);
}

function getLatestVersionsByIDE(data) {
    const latestVersions = {};

    if (!Array.isArray(data)) {
        return latestVersions;
    }

    data.forEach(item => {
        const current = latestVersions[item.ide];
        if (!current || compareVersions(item.version, current) > 0) {
            latestVersions[item.ide] = item.version;
        }
    });

    return latestVersions;
}

function buildLatestFeatureMatrix(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return { headers: [], rows: [] };
    }

    const latestVersions = getLatestVersionsByIDE(data);
    const latestData = data.filter(item => latestVersions[item.ide] === item.version);
    const ides = sortIDEs([...new Set(latestData.map(item => item.ide))]);
    const features = [...new Set(latestData.map(item => item.feature))].sort();

    // Create headers with IDE names and their latest versions
    const headersWithVersions = ides.map(ide => {
        const version = latestVersions[ide];
        return version ? `${ide} (v${version})` : ide;
    });

    return {
        headers: ['', ...headersWithVersions],
        rows: features.map(feature => {
            const row = { name: feature, values: [] };
            ides.forEach(ide => {
                const match = latestData.find(item => item.ide === ide && item.feature === feature);
                row.values.push(match ? match.support : 'none');
            });
            return row;
        })
    };
}

// Pivot function - the core of our slicing and dicing
function pivotData(rowAxis, columnAxis, filterBy = {}) {
    let data = featureData;
    
    // Apply filters
    if (filterBy.ide) data = data.filter(item => item.ide === filterBy.ide);
    if (filterBy.feature) data = data.filter(item => item.feature === filterBy.feature);
    if (filterBy.version) data = data.filter(item => item.version === filterBy.version);
    
    // Get unique values for rows and columns
    const rowValues = [...new Set(data.map(item => item[rowAxis]))].sort((a, b) => {
        return rowAxis === 'version' ? compareVersions(a, b) : a.localeCompare(b);
    });
    const columnValues = [...new Set(data.map(item => item[columnAxis]))].sort((a, b) => {
        return columnAxis === 'version' ? compareVersions(a, b) : a.localeCompare(b);
    });
    
    // Create pivot table structure
    const pivot = {
        headers: [rowAxis.charAt(0).toUpperCase() + rowAxis.slice(1), ...columnValues],
        rows: rowValues.map(rowValue => {
            const row = { name: rowValue, values: [] };
            columnValues.forEach(columnValue => {
                const match = data.find(item => 
                    item[rowAxis] === rowValue && item[columnAxis] === columnValue
                );
                row.values.push(match ? match.support : 'none');
            });
            return row;
        })
    };
    
    return pivot;
}

// Function to create a table from pivot data
function createTable(data, viewType = null) {
    const table = document.createElement('table');
    table.className = 'feature-table';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    data.headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        th.setAttribute('scope', 'col');
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    data.rows.forEach(row => {
        const tr = document.createElement('tr');
        
        // First column (name)
        const nameCell = document.createElement('td');
        nameCell.textContent = row.name;
        nameCell.classList.add('row-heading');
        nameCell.setAttribute('scope', 'row');
        tr.appendChild(nameCell);
        
        // Value columns
        row.values.forEach((value, colIndex) => {
            const td = document.createElement('td');
            
            if (supportStatus[value]) {
                // Render support status symbol
                const status = supportStatus[value];
                const isUnsupported = status.class === 'not-supported';
                td.classList.add(status.class);
                if (!isUnsupported) {
                    td.classList.add('tooltip');
                }

                if (status.isHtml) {
                    td.innerHTML = status.symbol;
                } else {
                    td.textContent = status.symbol;
                }

                const ideFilterValue = document.getElementById('ideFilter')?.value;
                const shouldShowStatusTooltip = viewType === 'custom-pivot' || viewType === 'ide-features';

                if (shouldShowStatusTooltip && !isUnsupported) {
                    const featureName = row.name;
                    const ideName = ideFilterValue || data.headers[colIndex + 1]; // +1 because first header is the descriptor column
                    const tooltipInfo = getFeatureTooltipInfo(featureName, ideName);
                    decorateInteractiveCell(td, tooltipInfo);
                }
            } else {
                // Render version number or N/A placeholder
                if (value === 'N/A') {
                    td.classList.add('not-supported', 'tooltip', 'value-missing');
                    td.textContent = 'N/A';
                    decorateInteractiveCell(td, 'Feature not available in this IDE yet');
                } else {
                    td.classList.add('version-number', 'tooltip');
                    td.textContent = value;

                    if (viewType === 'feature-ides') {
                        const featureSelectValue = document.getElementById('featureFilter')?.value || 'Selected Feature';
                        const releaseType = colIndex === 0 ? 'Preview' : 'GA';
                        const isoDate = getVersionDate(row.name, value);
                        const dateSuffix = isoDate ? ` (${formatDisplayDate(isoDate)})` : '';
                        decorateInteractiveCell(td, `${featureSelectValue} ${releaseType}: Version ${value}${dateSuffix}`);
                    }
                }
            }

            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    return table;
}

// Helper function to get tooltip information for feature matrix
function getFeatureTooltipInfo(featureName, ideName) {
    if (!window.featureData) return 'Loading...';
    
    // Find all version entries for this feature and IDE
    const entries = window.featureData.filter(item => 
        item.feature === featureName && 
        item.ide === ideName && 
        item.support !== 'none'
    );
    
    if (entries.length === 0) {
        return 'Not supported';
    }
    
    // Get the latest entry (highest version)
    const latestEntry = entries.reduce((latest, current) => {
        return compareVersions(current.version, latest.version) > 0 ? current : latest;
    });
    
    // Get the first GA version (if it exists)
    const gaEntries = entries.filter(item => item.releaseType === 'ga');
    const firstGAEntry = gaEntries.length > 0 ? 
        gaEntries.reduce((first, current) => {
            return compareVersions(current.version, first.version) < 0 ? current : first;
        }) : null;
    
    // Get the first preview version (if it exists)
    const previewEntries = entries.filter(item => item.releaseType === 'preview');
    const firstPreviewEntry = previewEntries.length > 0 ? 
        previewEntries.reduce((first, current) => {
            return compareVersions(current.version, first.version) < 0 ? current : first;
        }) : null;

    const buildLine = (label, entry) => {
        if (!entry) {
            return null;
        }
        const isoDate = getVersionDate(ideName, entry.version);
        const dateSuffix = isoDate ? ` (${formatDisplayDate(isoDate)})` : '';
        return `${label} - v${entry.version}`;
    };
    
    if (latestEntry.support === 'full') {
        // Feature is currently GA
        if (firstGAEntry) {
            const lines = [];
            if (firstPreviewEntry && compareVersions(firstPreviewEntry.version, firstGAEntry.version) < 0) {
                lines.push(buildLine('Preview', firstPreviewEntry));
            }
            lines.push(buildLine('GA', firstGAEntry));
            return lines.filter(Boolean).join('\n');
        } else {
            // Shouldn't happen, but fallback
            return buildLine('GA', latestEntry) || 'GA available';
        }
    } else if (latestEntry.support === 'partial') {
        // Feature is currently in preview
        return buildLine('Preview', firstPreviewEntry || latestEntry) || 'Preview available';
    }
    
    return 'Not supported';
}

function decorateInteractiveCell(cell, tooltipText) {
    if (!cell || !tooltipText) {
        return;
    }

    const inlineText = tooltipText.replace(/\n/g, ' • ');
    const ariaText = tooltipText.replace(/\n/g, ', ');

    cell.setAttribute('data-tooltip', tooltipText);
    cell.setAttribute('title', inlineText);
    cell.setAttribute('aria-label', ariaText);
    cell.setAttribute('tabindex', '0');
}

function renderLegend(viewType, tableData) {
    const legendContainer = document.getElementById('legendContainer');
    if (!legendContainer) {
        return;
    }

    legendContainer.innerHTML = '';
    legendContainer.classList.add('is-hidden');

    const showStatusLegend = ['custom-pivot', 'ide-features'].includes(viewType) && tableData?.rows?.length;
    const showVersionNote = viewType === 'feature-ides' && tableData?.rows?.length;

    if (showStatusLegend) {
        const legendList = document.createElement('div');
        legendList.className = 'legend-list';

        const items = [
            { key: 'full', label: 'Generally Available' },
            { key: 'partial', label: 'Public Preview' },
            { key: 'none', label: 'Not available' }
        ];

        items.forEach(item => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';

            const iconWrapper = document.createElement('span');
            iconWrapper.className = `legend-icon ${supportStatus[item.key].class}`;

            const status = supportStatus[item.key];
            if (status.isHtml) {
                iconWrapper.innerHTML = status.symbol;
            } else {
                iconWrapper.textContent = status.symbol;
            }

            const label = document.createElement('span');
            label.className = 'legend-label';
            label.textContent = item.label;
            legendItem.appendChild(iconWrapper);
            legendItem.appendChild(label);
            legendList.appendChild(legendItem);
        });

        legendContainer.appendChild(legendList);
        legendContainer.classList.remove('is-hidden');
        return;
    }

    if (showVersionNote) {
        const note = document.createElement('div');
        note.className = 'legend-note';
        note.textContent = 'Preview and GA columns show the first version where the feature reached each milestone. N/A indicates the milestone has not shipped yet.';
        legendContainer.appendChild(note);
        legendContainer.classList.remove('is-hidden');
    }
}

// Function to create filter controls based on view type
function createFilters(viewType) {
    const filtersContainer = document.getElementById('filters');
    filtersContainer.innerHTML = '';
    
    switch(viewType) {
        case 'ide-features':
            // IDE and Version selectors
            filtersContainer.appendChild(createFilterGroup('IDE:', 'ideFilter', getUniqueIDEs(), 'All IDEs'));
            filtersContainer.appendChild(createFilterGroup('Version:', 'versionFilter', [], 'All Versions'));
            break;
            
        case 'feature-ides':
            // Feature selector
            filtersContainer.appendChild(createFilterGroup('Feature:', 'featureFilter', getUniqueFeatures(), 'Select Feature'));
            const featureSelect = document.getElementById('featureFilter');
            if (featureSelect && featureSelect.options.length > 1) {
                featureSelect.selectedIndex = 1; // Default to first actual feature
            }
            break;
            
        case 'custom-pivot':
            // No filters for custom view - it's a static matrix
            break;
            
        case 'extension-compatibility':
            // No filters for extension compatibility view - shows Extensions feature support
            const compatDescription = document.createElement('div');
            compatDescription.style.textAlign = 'center';
            compatDescription.style.color = '#ccc';
            compatDescription.style.fontStyle = 'italic';
            compatDescription.style.marginBottom = '1rem';
            compatDescription.textContent = 'GitHub Copilot Extensions support across IDEs';
            filtersContainer.appendChild(compatDescription);
            break;
    }
}

// Helper function to create filter group
function createFilterGroup(label, id, options, defaultOption) {
    const group = document.createElement('div');
    group.className = 'filter-group';
    
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.setAttribute('for', id);
    
    const select = document.createElement('select');
    select.id = id;
    
    // Add default option
    if (defaultOption && typeof defaultOption === 'string' && !options.includes(defaultOption)) {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = defaultOption;
        select.appendChild(defaultOpt);
    }
    
    // Add options
    options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option;
        optionEl.textContent = option;
        if (option === defaultOption) {
            optionEl.selected = true;
        }
        select.appendChild(optionEl);
    });
    
    // Add event listener for dependent dropdowns
    if (id === 'ideFilter') {
        select.addEventListener('change', updateVersionFilter);
    } else {
        // Add event listener for table updates (but not for ideFilter since updateVersionFilter handles it)
        select.addEventListener('change', () => updateTable());
    }
    
    group.appendChild(labelEl);
    group.appendChild(select);
    return group;
}

// Function to update version filter based on IDE selection
function updateVersionFilter() {
    const ideSelect = document.getElementById('ideFilter');
    const versionSelect = document.getElementById('versionFilter');
    
    if (ideSelect && versionSelect) {
        const selectedIDE = ideSelect.value;
        
        versionSelect.innerHTML = '<option value="">All Versions</option>';
        
        if (selectedIDE) {
            const versions = getVersionsForIDE(selectedIDE);
            versions.forEach(version => {
                const option = document.createElement('option');
                option.value = version;
                option.textContent = version;
                versionSelect.appendChild(option);
            });

            if (versions.length > 0) {
                versionSelect.value = versions[versions.length - 1];
            }
        }
    }
    
    updateTable();
}

// View generation functions
function generateIDEFeaturesView() {
    const ideFilter = document.getElementById('ideFilter')?.value;
    const versionFilter = document.getElementById('versionFilter')?.value;
    
    if (ideFilter && versionFilter) {
        // Show features for specific IDE and version
        // We want to show features as rows, with just this IDE+version as the single column
        const filtered = window.featureData.filter(item => item.ide === ideFilter && item.version === versionFilter);
        
        // Create a simple table structure
        const features = [...new Set(filtered.map(item => item.feature))].sort();
        return {
            headers: ['Feature', `${ideFilter} ${versionFilter}`],
            rows: features.map(feature => {
                const match = filtered.find(item => item.feature === feature);
                return {
                    name: feature,
                    values: [match ? match.support : 'none']
                };
            })
        };
    } else if (ideFilter) {
        // Show features for specific IDE across all its versions
        return pivotData('feature', 'version', { ide: ideFilter });
    } else {
        // Show all IDEs vs features (use latest version for each IDE)
        return buildLatestFeatureMatrix(window.featureData);
    }
}

function generateFeatureIDEsView() {
    const featureFilter = document.getElementById('featureFilter')?.value;
    
    if (featureFilter) {
        // Get all data for this feature
        const featureData_filtered = window.featureData.filter(item => item.feature === featureFilter);
        
        // Get unique IDEs that have this feature
        const ides = sortIDEs([...new Set(featureData_filtered.map(item => item.ide))]);
        
        // For each IDE, find the Preview and GA versions
        const rows = ides.map(ide => {
            const ideFeatureData = featureData_filtered.filter(item => item.ide === ide);
            
            // Find Preview version (first version where feature was introduced as preview)
            const previewEntry = ideFeatureData.find(item => 
                item.support !== 'none' && item.releaseType === 'preview'
            );
            
            // Find GA version (first version where feature was released as GA)
            const gaEntry = ideFeatureData.find(item => 
                item.support !== 'none' && item.releaseType === 'ga'
            );
            
            return {
                name: ide,
                preview: previewEntry ? previewEntry.version : 'N/A',
                ga: gaEntry ? gaEntry.version : 'N/A'
            };
        });
        
        return {
            headers: ['IDE', 'Preview', 'GA'],
            rows: rows.map(row => ({
                name: row.name,
                values: [row.preview, row.ga]
            }))
        };
    } else {
        return { headers: [], rows: [] };
    }
}

function generateCustomPivotView() {
    // Create a static feature matrix showing all features vs all IDEs (latest versions)
    return buildLatestFeatureMatrix(window.featureData);
}

function generateExtensionCompatibilityView() {
    // Show which IDEs support Copilot Extensions
    // This displays the "Extensions" feature from the data
    
    const ides = getUniqueIDEs();
    const extensionsFeature = 'Extensions';
    
    // Get the Extensions feature data for each IDE
    const extensionData = window.featureData.filter(item => item.feature === extensionsFeature);
    
    // Get the latest versions for all IDEs (for consistent headers)
    const latestVersions = getLatestVersionsByIDE(window.featureData);
    
    // Get the latest version for each IDE that has Extensions support
    const ideSupport = {};
    ides.forEach(ide => {
        const ideData = extensionData.filter(item => item.ide === ide);
        if (ideData.length > 0) {
            // Find the first version with Extensions support
            const gaVersion = ideData.find(item => item.releaseType === 'ga');
            const previewVersion = ideData.find(item => item.releaseType === 'preview');
            
            if (gaVersion) {
                ideSupport[ide] = {
                    support: 'full',
                    version: gaVersion.version,
                    releaseType: 'ga'
                };
            } else if (previewVersion) {
                ideSupport[ide] = {
                    support: 'partial',
                    version: previewVersion.version,
                    releaseType: 'preview'
                };
            }
        }
    });
    
    // Create headers with IDE names and their latest versions (consistent with Feature Matrix)
    const headersWithVersions = ides.map(ide => {
        const version = latestVersions[ide];
        return version ? `${ide} (v${version})` : ide;
    });
    
    // Build the table - single row showing Extensions support across IDEs
    const headers = ['Feature', ...headersWithVersions];
    const values = ides.map(ide => {
        if (ideSupport[ide]) {
            return ideSupport[ide].support;
        }
        return 'none';
    });
    
    return {
        headers: headers,
        rows: [
            {
                name: extensionsFeature,
                values: values
            }
        ]
    };
}

// Function to show the feature matrix (default view)
function showFeatureMatrix() {
    // Set the first tab as active and switch to it
    const firstTab = document.querySelector('.tab-button');
    if (firstTab) {
        // Remove active from all tabs
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        // Set first tab as active
        firstTab.classList.add('active');
        // Switch to the view
        const viewType = firstTab.getAttribute('data-view');
        switchToView(viewType);
    }
}

// Initialize the application
async function initializeApp() {
    // Initialize theme
    if (window.themeManager?.setupTheme) {
        window.themeManager.setupTheme();
    }
    
    // Load data first
    const dataLoaded = await loadFeatureData();
    if (!dataLoaded) {
        // Error handling is already done in loadFeatureData
        return;
    }
    
    // Set up tab click handlers
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            
            // Get the view type and update
            const viewType = this.getAttribute('data-view');
            switchToView(viewType);
        });
    });
    
    console.info('Feature matrix application initialized with JSON data!');
}

// Function to switch to a specific view
function switchToView(viewType) {
    createFilters(viewType);
    updateTable(viewType);
}

// Main function to update the table based on view type and current selections
function updateTable(viewType = null) {
    // If no viewType provided, get it from the active tab
    if (!viewType) {
        const activeTab = document.querySelector('.tab-button.active');
        viewType = activeTab.getAttribute('data-view');
    }
    
    const tableContainer = document.getElementById('dynamicTable');
    let tableData;
    
    switch(viewType) {
        case 'ide-features':
            tableData = generateIDEFeaturesView();
            break;
        case 'feature-ides':
            tableData = generateFeatureIDEsView();
            break;
        case 'custom-pivot':
            tableData = generateCustomPivotView();
            break;
        case 'extension-compatibility':
            tableData = generateExtensionCompatibilityView();
            break;
    }

    renderLegend(viewType, tableData);
    
    // Clear and rebuild table
    tableContainer.innerHTML = '';
    if (tableData && tableData.rows.length > 0) {
        tableContainer.appendChild(createTable(tableData, viewType));
    } else {
        tableContainer.innerHTML = '<p style="color: #ccc; font-style: italic;">No data available for current selection.</p>';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', initializeApp);
