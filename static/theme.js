(function() {
    let listenerAttached = false;

    function updateThemeIcon(theme) {
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
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
        const savedTheme = localStorage.getItem('theme') || 'dark';
        applyTheme(savedTheme);

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle && !listenerAttached) {
            themeToggle.addEventListener('click', toggleTheme);
            listenerAttached = true;
        }
    }

    window.themeManager = {
        setupTheme
    };
})();
