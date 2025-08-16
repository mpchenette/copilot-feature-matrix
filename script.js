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
    // Add click event listeners to all tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    
    console.log('Tabbed interface loaded successfully!');
});