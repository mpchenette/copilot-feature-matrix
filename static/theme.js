(function() {
    let listenerAttached = false;

    function updateThemeIcon(theme) {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = theme === 'dark' ? '●' : '○';
        }
    }

    function applyTheme(theme) {
        const resolvedTheme = theme === 'light' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', resolvedTheme);
        localStorage.setItem('theme', resolvedTheme);
        updateThemeIcon(resolvedTheme);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    }

    function setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        applyTheme(savedTheme);

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle && !listenerAttached) {
            themeToggle.addEventListener('click', toggleTheme);
            listenerAttached = true;
        }
    }

    // Auto-initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupTheme);
    } else {
        setupTheme();
    }

    window.themeManager = {
        setupTheme
    };
})();
