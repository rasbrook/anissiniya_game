// Theme helper: apply theme tokens as inline CSS variables on document.documentElement
// This keeps styling driven via JS (inline styles) while components still read CSS vars.

const light = {
    '--bg': '#FDEDED',
    '--surface': '#EDFFF0',
    '--muted': '#555555',
    '--text': '#213547',
    '--accent': '#AEDEFC',
    '--primary': '#AEDEFC',
    '--hit': '#F875AA',
    '--drawn': '#ff8b2b',
    '--secondary': '#F875AA',
    '--danger': '#F875AA',
    '--muted-surface': '#f7fbfa',
    '--card-border': 'rgba(0,0,0,0.08)',
    '--card-highlight': 'rgba(174,222,252,0.16)',
    '--call-bg': '#F875AA',
    '--card-shadow': 'rgba(0,0,0,0.06)',
    '--btn-bg': '#fff'
};

const dark = {
    '--bg': '#0D1164',
    '--surface': '#640D5F',
    '--text': '#F3EAF0',
    '--accent': '#EA2264',
    '--primary': '#EA2264',
    '--secondary': '#F78D60',
    '--danger': '#EA2264',
    '--muted': 'rgba(243,234,240,0.72)',
    '--muted-surface': 'rgba(243,234,240,0.04)',
    '--card-border': 'rgba(243,234,240,0.06)',
    '--card-highlight': 'rgba(234,34,100,0.12)',
    '--call-bg': '#EA2264',
    '--card-shadow': 'rgba(0,0,0,0.6)',
    '--btn-bg': 'rgba(15,10,30,0.6)'
};

export function applyTheme(name) {
    try {
        const root = document.documentElement;
        const theme = name === 'dark' ? dark : light;
        Object.entries(theme).forEach(([key, val]) => root.style.setProperty(key, val));
        // also set a data attribute so CSS selectors can still inspect if needed
        root.setAttribute('data-theme', name);
    } catch (e) {
        // no-op in SSR or early load
    }
}

export function getSystemPrefersDark() {
    try {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) { return false; }
}

export default { applyTheme, getSystemPrefersDark };
