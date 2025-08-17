// Feature matrix data - loaded from JSON
let rawFeatureData = {};
let featureData = []; // Normalized data for backwards compatibility

// Load data from JSON file
async function loadFeatureData() {
    try {
        const response = await fetch('./data.json');
        rawFeatureData = await response.json();
        
        // Convert to normalized structure for existing functions
        featureData = normalizeData(rawFeatureData);
        
        console.log('Feature data loaded successfully');
        return true;
    } catch (error) {
        console.error('Error loading feature data:', error);
        return false;
    }
}

// Function to resolve inheritance and convert to flat structure
function normalizeData(rawData) {
    const normalized = [];
    
    for (const [ide, versions] of Object.entries(rawData)) {
        // Sort versions to process in order
        const sortedVersions = Object.keys(versions).sort(compareVersions);
        const resolvedVersions = {};
        
        for (const version of sortedVersions) {
            const versionData = versions[version];
            let features = {};
            
            // If this version inherits from another, start with parent's features
            if (versionData._inherits) {
                const parentVersion = versionData._inherits;
                if (resolvedVersions[parentVersion]) {
                    features = { ...resolvedVersions[parentVersion] };
                }
            }
            
            // Apply this version's features (overriding inherited ones)
            for (const [featureName, featureData] of Object.entries(versionData)) {
                if (featureName !== '_inherits') {
                    features[featureName] = featureData;
                }
            }
            
            // Store resolved features for this version
            resolvedVersions[version] = features;
            
            // Convert to flat structure for backwards compatibility
            for (const [featureName, featureInfo] of Object.entries(features)) {
                normalized.push({
                    ide: ide,
                    version: version,
                    feature: featureName,
                    support: featureInfo.support,
                    introduced: featureInfo.introduced,
                    releaseType: featureInfo.releaseType
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
    'partial': { symbol: '⚬', class: 'partial' },
    'none': { symbol: '✗', class: 'not-supported' }
};

// Utility functions to get unique values
function getUniqueIDEs() {
    return Object.keys(rawFeatureData).sort();
}

function getUniqueFeatures() {
    const features = new Set();
    for (const ide of Object.values(rawFeatureData)) {
        for (const version of Object.values(ide)) {
            for (const featureName of Object.keys(version)) {
                if (featureName !== '_inherits') {
                    features.add(featureName);
                }
            }
        }
    }
    return [...features].sort();
}

function getVersionsForIDE(ide) {
    if (!rawFeatureData[ide]) return [];
    return Object.keys(rawFeatureData[ide]).sort(compareVersions);
}

function getAllVersions() {
    const versions = new Set();
    for (const ide of Object.values(rawFeatureData)) {
        for (const version of Object.keys(ide)) {
            versions.add(version);
        }
    }
    return [...versions].sort(compareVersions);
}

// Query functions for different views
function getFeaturesByIDE(ide, version = null) {
    let filtered = featureData.filter(item => item.ide === ide);
    if (version) {
        filtered = filtered.filter(item => item.version === version);
    }
    return filtered;
}

function getIDEsByFeature(feature) {
    return featureData.filter(item => item.feature === feature);
}

function getFeatureIntroduction(feature) {
    // Get all IDEs that support this feature and when they introduced it
    return featureData
        .filter(item => item.feature === feature && item.introduced)
        .reduce((acc, item) => {
            if (!acc[item.ide] || acc[item.ide].introduced > item.introduced) {
                acc[item.ide] = {
                    introduced: item.introduced,
                    currentSupport: item.support
                };
            }
            return acc;
        }, {});
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
function createTable(data) {
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
    
    data.rows.forEach(row => {
        const tr = document.createElement('tr');
        
        // First column (name)
        const nameCell = document.createElement('td');
        nameCell.textContent = row.name;
        tr.appendChild(nameCell);
        
        // Value columns
        row.values.forEach(value => {
            const td = document.createElement('td');
            
            // Check if this is a support status (for Features by IDE view) or version number (for IDEs by Feature view)
            if (supportStatus[value]) {
                // This is a support status symbol
                const status = supportStatus[value];
                td.className = status.class;
                td.textContent = status.symbol;
            } else {
                // This is a version number or N/A
                td.textContent = value;
                if (value === 'N/A') {
                    td.className = 'not-supported';
                    td.style.fontStyle = 'italic';
                    td.style.color = '#888';
                } else {
                    td.className = 'version-number';
                    td.style.fontWeight = 'bold';
                }
            }
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    return table;
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
        const filtered = featureData.filter(item => item.ide === ideFilter && item.version === versionFilter);
        
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
        featureData.forEach(item => {
            if (!latestVersions[item.ide] || compareVersions(item.version, latestVersions[item.ide]) > 0) {
                latestVersions[item.ide] = item.version;
            }
        });
        
        // Filter to only include latest versions
        const latestData = featureData.filter(item => 
            latestVersions[item.ide] === item.version
        );
        
        // Create pivot with the latest data
        const ides = [...new Set(latestData.map(item => item.ide))].sort();
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
        const featureData_filtered = featureData.filter(item => item.feature === featureFilter);
        
        // Get unique IDEs that have this feature
        const ides = [...new Set(featureData_filtered.map(item => item.ide))].sort();
        
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
    
    // Get the latest version for each IDE
    const latestVersions = {};
    featureData.forEach(item => {
        if (!latestVersions[item.ide] || compareVersions(item.version, latestVersions[item.ide]) > 0) {
            latestVersions[item.ide] = item.version;
        }
    });
    
    // Filter to only include latest versions
    const latestData = featureData.filter(item => 
        latestVersions[item.ide] === item.version
    );
    
    // Get unique IDEs and features
    const ides = [...new Set(latestData.map(item => item.ide))].sort();
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

// Initialize the application
async function initializeApp() {
    // Load data first
    const dataLoaded = await loadFeatureData();
    if (!dataLoaded) {
        document.getElementById('dynamicTable').innerHTML = '<p style="color: #f44336;">Error loading feature data. Please check the console for details.</p>';
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
    
    // Initialize with the first tab (active tab)
    const activeTab = document.querySelector('.tab-button.active');
    const initialView = activeTab.getAttribute('data-view');
    switchToView(initialView);
    
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
    }
    
    // Clear and rebuild table
    tableContainer.innerHTML = '';
    if (tableData && tableData.rows.length > 0) {
        tableContainer.appendChild(createTable(tableData));
    } else {
        tableContainer.innerHTML = '<p style="color: #ccc; font-style: italic;">No data available for current selection.</p>';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', initializeApp);