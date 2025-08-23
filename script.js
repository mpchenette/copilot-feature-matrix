// Global variables
window.featureData = [];
window.rawFeatureData = {};

// Function to load and process feature data
async function loadFeatureData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const rawData = await response.json();
        console.log('Raw data loaded successfully:', Object.keys(rawData));
        
        // Store raw data globally for other functions
        window.rawFeatureData = rawData;
        
        // Validate data for conflicts
        const warnings = validateData(rawData);
        displayWarnings(warnings);
        
        // Convert to normalized format
        window.featureData = normalizeData(rawData);
        
        console.log('Loaded feature data:', window.featureData.length, 'entries');
        
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

// Global variables
window.featureData = [];
window.rawFeatureData = {};

// Function to validate data for conflicts and inconsistencies
function validateData(rawData) {
    const warnings = [];
    
    for (const [ide, versions] of Object.entries(rawData)) {
        const sortedVersions = Object.keys(versions).sort(compareVersions);
        const featureHistory = {}; // Track feature release type history
        
        // Get all features across all versions for this IDE
        const allFeatures = new Set();
        for (const version of Object.values(versions)) {
            for (const featureName of Object.keys(version)) {
                allFeatures.add(featureName);
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
        console.log('✅ Data validation passed - no conflicts detected');
        return;
    }
    
    console.warn(`⚠️ Data validation found ${warnings.length} issue(s):`);
    
    const groupedWarnings = {
        duplicate: warnings.filter(w => w.type === 'duplicate'),
        chronology: warnings.filter(w => w.type === 'chronology')
    };
    
    if (groupedWarnings.duplicate.length > 0) {
        console.warn('\n🔄 Duplicate Entries:');
        groupedWarnings.duplicate.forEach(w => console.warn(`  • ${w.message}`));
    }
    
    if (groupedWarnings.chronology.length > 0) {
        console.warn('\n📅 Chronology Issues:');
        groupedWarnings.chronology.forEach(w => console.warn(`  • ${w.message}`));
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
        
        // Get all possible features for this IDE (to track absence)
        const allFeatures = new Set();
        for (const version of Object.values(versions)) {
            for (const featureName of Object.keys(version)) {
                allFeatures.add(featureName);
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
            
            // Apply this version's features (overriding inherited ones)
            for (const [featureName, featureData] of Object.entries(versionData)) {
                features[featureName] = featureData;
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
    'full': { symbol: '✓', class: 'supported' },
    'partial': { symbol: 'P', class: 'partial' },
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
    
    // Collect all features from all IDEs and versions
    for (const [ide, versions] of Object.entries(window.rawFeatureData)) {
        for (const version of Object.values(versions)) {
            for (const featureName of Object.keys(version)) {
                features.add(featureName);
            }
        }
    }
    
    return [...features].sort();
}

function getVersionsForIDE(ide) {
    if (!window.rawFeatureData[ide]) return [];
    return Object.keys(window.rawFeatureData[ide]).sort(compareVersions);
}

function getAllVersions() {
    const versions = new Set();
    for (const ide of Object.values(window.rawFeatureData)) {
        Object.keys(ide).forEach(version => versions.add(version));
    }
    return [...versions].sort(compareVersions);
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
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    data.rows.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        
        // First column (name)
        const nameCell = document.createElement('td');
        nameCell.textContent = row.name;
        tr.appendChild(nameCell);
        
        // Value columns
        row.values.forEach((value, colIndex) => {
            const td = document.createElement('td');
            
            // Check if this is a support status (for Features by IDE view) or version number (for IDEs by Feature view)
            if (supportStatus[value]) {
                // This is a support status symbol
                const status = supportStatus[value];
                td.className = status.class + ' tooltip';
                td.textContent = status.symbol;
                
                // Add tooltip for Feature Matrix view
                if (viewType === 'custom-pivot') {
                    const featureName = row.name;
                    const ideName = data.headers[colIndex + 1]; // +1 because first header is empty
                    
                    // Get detailed info for tooltip
                    const tooltipInfo = getFeatureTooltipInfo(featureName, ideName, value);
                    td.setAttribute('data-tooltip', tooltipInfo);
                }
            } else {
                // This is a version number or N/A
                td.textContent = value;
                if (value === 'N/A') {
                    td.className = 'not-supported tooltip';
                    td.style.fontStyle = 'italic';
                    td.style.color = '#888';
                    td.setAttribute('data-tooltip', 'Feature not available in this IDE');
                } else {
                    td.className = 'version-number tooltip';
                    td.style.fontWeight = 'bold';
                    
                    // Add tooltip for version info
                    if (viewType === 'feature-ides') {
                        const featureName = data.headers[0] === 'IDE' ? 
                            document.getElementById('featureFilter')?.value || 'Selected Feature' :
                            'Feature';
                        const releaseType = colIndex === 0 ? 'Preview' : 'GA';
                        td.setAttribute('data-tooltip', `${featureName} ${releaseType}: Version ${value}`);
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
function getFeatureTooltipInfo(featureName, ideName, supportLevel) {
    if (!window.featureData) return 'Loading...';
    
    // Find the latest version entry for this feature and IDE
    const entries = window.featureData.filter(item => 
        item.feature === featureName && 
        item.ide === ideName && 
        item.support !== 'none'
    );
    
    // if (entries.length === 0) {
    //     return `Not Supported`;
    // }
    return `Not Supported`;
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
            break;
            
        case 'custom-pivot':
            // No filters for custom view - it's a static matrix
            const description = document.createElement('div');
            description.style.textAlign = 'center';
            description.style.color = '#ccc';
            description.style.fontStyle = 'italic';
            description.style.marginBottom = '1rem';
            description.textContent = 'Complete feature matrix showing latest version of each IDE';
            filtersContainer.appendChild(description);
            break;
            
        case 'extension-compatibility':
            // No filters for extension compatibility view yet
            const compatDescription = document.createElement('div');
            compatDescription.style.textAlign = 'center';
            compatDescription.style.color = '#ccc';
            compatDescription.style.fontStyle = 'italic';
            compatDescription.style.marginBottom = '1rem';
            compatDescription.textContent = 'Extension compatibility matrix - coming soon';
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
        optionEl.textContent = option.charAt(0).toUpperCase() + option.slice(1);
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
        // Get the latest version for each IDE
        const latestVersions = {};
        window.featureData.forEach(item => {
            if (!latestVersions[item.ide] || compareVersions(item.version, latestVersions[item.ide]) > 0) {
                latestVersions[item.ide] = item.version;
            }
        });
        
        // Filter to only include latest versions
        const latestData = window.featureData.filter(item => 
            latestVersions[item.ide] === item.version
        );
        
        // Create pivot with the latest data
        const ides = sortIDEs([...new Set(latestData.map(item => item.ide))]);
        const features = [...new Set(latestData.map(item => item.feature))].sort();
        
        return {
            headers: ['', ...ides],
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
    
    if (!window.featureData || window.featureData.length === 0) {
        return { headers: [], rows: [] };
    }
    
    // Get the latest version for each IDE
    const latestVersions = {};
    window.featureData.forEach(item => {
        if (!latestVersions[item.ide] || compareVersions(item.version, latestVersions[item.ide]) > 0) {
            latestVersions[item.ide] = item.version;
        }
    });
    
    // Filter to only include latest versions
    const latestData = window.featureData.filter(item => 
        latestVersions[item.ide] === item.version
    );
    
    // Get unique IDEs and features
    const ides = sortIDEs([...new Set(latestData.map(item => item.ide))]);
    const features = [...new Set(latestData.map(item => item.feature))].sort();
    
    // Create the matrix
    return {
        headers: ['', ...ides],
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

function generateExtensionCompatibilityView() {
    // Placeholder for extension compatibility matrix
    return {
        headers: ['Extension', 'VS Code', 'Visual Studio', 'JetBrains', 'Neovim'],
        rows: [
            {
                name: 'Coming Soon...',
                values: ['-', '-', '-', '-']
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
    
    console.log('Feature matrix application initialized with JSON data!');
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