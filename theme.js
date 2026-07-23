/**
 * BOOYAH Arena — Theme Engine + Page Loader
 * Manages Dark / Light mode with CSS custom properties.
 * Adds a 2-second gaming loading screen on every page load.
 * Include this script in <head> BEFORE Tailwind CDN for flash-free loading.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'booyah-theme';

    function getTheme() {
        return 'light'; // Forced Light Mode
    }

    var themes = {
        dark: { // Replaced with Light Mode colors to prevent any dark mode flash
            '--bg-primary-rgb': '237 240 246',
            '--bg-card-rgb': '255 255 255',
            '--bg-card-light-rgb': '245 247 252',
            '--text-primary-rgb': '26 30 46',
            '--text-dim-rgb': '107 114 128',
            '--border-color-rgb': '0 0 0'
        },
        light: {
            '--bg-primary-rgb': '237 240 246',
            '--bg-card-rgb': '255 255 255',
            '--bg-card-light-rgb': '245 247 252',
            '--text-primary-rgb': '26 30 46',
            '--text-dim-rgb': '107 114 128',
            '--border-color-rgb': '0 0 0'
        }
    };

    function applyTheme(mode) {
        var root = document.documentElement;
        var vars = themes[mode] || themes.dark;

        Object.keys(vars).forEach(function (key) {
            root.style.setProperty(key, vars[key]);
        });

        root.classList.toggle('light', mode === 'light');
        root.classList.toggle('dark', mode !== 'light');
    }

    function setTheme(mode) {
        try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) { }
        applyTheme(mode);
    }

    function toggleTheme() {
        var current = getTheme();
        var next = current === 'dark' ? 'light' : 'dark';
        setTheme(next);

        document.documentElement.classList.add('theme-transitioning');
        setTimeout(function () {
            document.documentElement.classList.remove('theme-transitioning');
        }, 400);

        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'THEME_SYNC', theme: next }, '*');
            }
        } catch (e) { }

        return next;
    }

    /* -------- Apply immediately (prevents FOUC) -------- */
    applyTheme(getTheme());

    /* -------- Inject global theme stylesheet -------- */
    var css = [
        '/* ===== Theme Transition ===== */',
        'html.theme-transitioning,',
        'html.theme-transitioning *,',
        'html.theme-transitioning *::before,',
        'html.theme-transitioning *::after {',
        '  transition: background-color 0.35s ease, color 0.35s ease,',
        '              border-color 0.35s ease, box-shadow 0.35s ease !important;',
        '}',
        '',
        '/* ===== Light Mode — Global Overrides ===== */',
        'html.light .shadow-lg { box-shadow: 0 10px 25px rgba(0,0,0,0.07) !important; }',
        'html.light .shadow-md { box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important; }',
        'html.light .sub-panel { background: rgb(var(--bg-primary-rgb)) !important; }',
        'html.light input, html.light textarea { caret-color: #1a1e2e; }',
        'html.light ::-webkit-scrollbar-track { background: rgb(var(--bg-primary-rgb)); }',
        'html.light ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }',
        'html.dark ::-webkit-scrollbar-thumb  { background: rgba(255,255,255,0.1); border-radius: 4px; }',
        '::-webkit-scrollbar { width: 4px; }',
        '',
        '/* ===== Light Mode Text & Icon Visibility Fixes ===== */',
        'html.light .text-booyahYellow { color: #d97706 !important; } /* Darker golden-orange */',
        'html.light .text-booyahOrange { color: #c2410c !important; } /* Darker burnt orange */',
        'html.light .text-cyberBlue { color: #0369a1 !important; } /* Darker cyan/blue */',
        'html.light #profile-uid {',
        '  background: linear-gradient(to right, rgba(0,0,0,0.06), rgba(0,0,0,0.02)) !important;',
        '  border-color: rgba(0,0,0,0.1) !important;',
        '  color: #c2410c !important;',
        '}',
        '.logo-glow { animation: logoGlow 3s infinite ease-in-out; }',
        '@keyframes logoGlow {',
        '  0%, 100% { filter: drop-shadow(0 0 15px rgba(255,107,0,0.5)); }',
        '  50%      { filter: drop-shadow(0 0 30px rgba(227,0,82,0.7)); }',
        '}',
        '',
        '/* ===== Skeleton & Row Animations ===== */',
        '.skeleton {',
        '  background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);',
        '  background-size: 200% 100%;',
        '  animation: skeletonLoading 1.5s infinite ease-in-out;',
        '  border-radius: 0.5rem;',
        '}',
        '.light-mode .skeleton {',
        '  background: linear-gradient(90deg, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.05) 75%);',
        '  background-size: 200% 100%;',
        '}',
        '@keyframes skeletonLoading {',
        '  0% { background-position: 200% 0; }',
        '  100% { background-position: -200% 0; }',
        '}',
        '.row-animate {',
        '  opacity: 0;',
        '  transform: translateY(10px);',
        '  animation: rowFadeIn 0.4s forwards ease-out;',
        '}',
        '@keyframes rowFadeIn {',
        '  to { opacity: 1; transform: translateY(0); }',
        '}'
    ].join('\n');

    var styleEl = document.createElement('style');
    styleEl.id = 'booyah-theme-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    /* -------- Listen for theme sync messages -------- */
    window.addEventListener('message', function (e) {
        if (e.data) {
            if (e.data.type === 'THEME_CHANGE' || e.data.type === 'THEME_SYNC') {
                setTheme(e.data.theme);
            }
        }
    });

    /* -------- Public API -------- */
    window.BooyahTheme = {
        getTheme: getTheme,
        setTheme: setTheme,
        toggleTheme: toggleTheme,
        applyTheme: applyTheme
    };
})();
