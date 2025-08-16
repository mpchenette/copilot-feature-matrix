// Data objects for each table
const tableData = {
    ide: {
        headers: ['IDE', 'Code Completion', 'Chat', 'Inline Edit'],
        rows: [
            { name: 'VS Code', values: ['supported', 'supported', 'supported'] },
            { name: 'Visual Studio', values: ['supported', 'supported', 'partial'] },
            { name: 'JetBrains', values: ['supported', 'not-supported', 'not-supported'] },
            { name: 'Vim/Neovim', values: ['supported', 'not-supported', 'not-supported'] }
        ]
    },
    language: {
        headers: ['Language', 'Suggestions', 'Refactoring', 'Testing'],
        rows: [
            { name: 'JavaScript', values: ['supported', 'supported', 'supported'] },
            { name: 'Python', values: ['supported', 'supported', 'partial'] },
            { name: 'Java', values: ['supported', 'partial', 'partial'] },
            { name: 'C++', values: ['supported', 'not-supported', 'not-supported'] }
        ]
    },
    version: {
        headers: ['Feature', 'v1.0', 'v1.5', 'v2.0'],
        rows: [
            { name: 'Auto-complete', values: ['supported', 'supported', 'supported'] },
            { name: 'Chat Interface', values: ['not-supported', 'supported', 'supported'] },
            { name: 'Voice Commands', values: ['not-supported', 'not-supported', 'partial'] },
            { name: 'Multi-file Edit', values: ['not-supported', 'partial', 'supported'] }
        ]
    }
};

// Support status mapping
const supportStatus = {
    'supported': '✓',
    'partial': '⚬',
    'not-supported': '✗'
};

// Function to create a table from data
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
        
        // Feature columns
        row.values.forEach(value => {
            const td = document.createElement('td');
            td.className = value;
            td.textContent = supportStatus[value];
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    return table;
}

// Function to populate all tables
function populateTables() {
    // IDE Support table
    const ideContainer = document.getElementById('ideTable');
    ideContainer.appendChild(createTable(tableData.ide));
    
    // Language Support table
    const languageContainer = document.getElementById('languageTable');
    languageContainer.appendChild(createTable(tableData.language));
    
    // Version Support table
    const versionContainer = document.getElementById('versionTable');
    versionContainer.appendChild(createTable(tableData.version));
}

// Function to switch tabs
function switchTab(tabId) {
    // Hide all tab panes
    const allPanes = document.querySelectorAll('.tab-pane');
    allPanes.forEach(pane => pane.classList.remove('active'));
    
    // Remove active class from all tab buttons
    const allButtons = document.querySelectorAll('.tab-button');
    allButtons.forEach(button => button.classList.remove('active'));
    
    // Show the selected tab pane
    document.getElementById(tabId).classList.add('active');
    
    // Add active class to the clicked button
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Populate tables with data
    populateTables();
    
    // Add click event listeners to all tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    
    console.log('Feature matrix loaded with JavaScript data objects!');
});