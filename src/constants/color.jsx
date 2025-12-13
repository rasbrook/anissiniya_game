// Theme-aware color exports. Prefer CSS variables so theme toggle applies.
export const maincolor = 'var(--primary)'
export const secondaryColor = 'var(--secondary)'
export const accentColor = 'var(--accent)'
export const backgroundColor = 'var(--bg)'

// Theme-aware text colors: darker text for light mode, lighter text for dark mode
// Stronger contrast defaults: deeper dark and pure white for best readability
export const textOnLight = '#0F172A' // deeper slate (better contrast on light backgrounds)
export const textOnDark = '#FFFFFF'  // pure white for maximum contrast on dark backgrounds
// Luminance threshold used to decide whether a background is "dark".
// Raised from 0.5 -> 0.55 to prefer light text on mid-tones for stronger contrast.
export const contrastThreshold = 0.55

// Return the appropriate text color based on the current document theme.
// The app toggles `theme-dark` on `document.documentElement` early in `main.jsx`.
export function getThemeTextColor() {
    try {
        if (typeof document !== 'undefined' && document.documentElement.classList.contains('theme-dark')) {
            return textOnDark
        }
    } catch (e) { }
    return textOnLight
}

// Utility: pick light or dark text for a given background hex color using luminance.
// Returns `textOnDark` (light text) or `textOnLight` (dark text).
export function getTextColorForBackground(hex) {
    if (!hex || typeof hex !== 'string') return getThemeTextColor()
    // normalize #rgb to #rrggbb
    const h = hex.replace('#', '').trim()
    let r, g, b
    if (h.length === 3) {
        r = parseInt(h[0] + h[0], 16)
        g = parseInt(h[1] + h[1], 16)
        b = parseInt(h[2] + h[2], 16)
    } else if (h.length === 6) {
        r = parseInt(h.slice(0, 2), 16)
        g = parseInt(h.slice(2, 4), 16)
        b = parseInt(h.slice(4, 6), 16)
    } else {
        return getThemeTextColor()
    }

    // relative luminance formula
    const srgb = [r, g, b].map(v => v / 255).map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
    const lum = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]

    // contrast threshold: if background is dark (lum < contrastThreshold) use light text
    return lum < contrastThreshold ? textOnDark : textOnLight
}

// Default letter colors for B, I, N, G, O — bright and distinct for quick recognition
export const ballB = '#1E90FF' // Blue
export const ballI = '#28A745' // Green
export const ballN = '#FFC107' // Amber (yellow)
export const ballG = '#da3ee8ff' // Pink/Magenta
export const ballO = '#DC3545' // Red

// A reusable colorful palette to assign to numbered balls (rotates if more numbers needed)
export const bingoBallPalette = [
    '#FF6B6B', // soft red
    '#FFD93D', // bright yellow
    '#6BCB77', // mint green
    '#4D96FF', // sky blue
    '#845EC2', // purple
    '#FF9671', // salmon/orange
    '#00C2A8', // teal
    '#F9F871', // lime/yellow
    '#FF6FD8', // hot pink
    '#00BFFF', // deep sky
    '#9F86FF', // lavender
    '#FFBE0B'  // amber
]

// Get color for a ball by its number (1-based). Rotates through `bingoBallPalette`.
export function getBallColorByNumber(num) {
    if (typeof num !== 'number' || Number.isNaN(num)) return bingoBallPalette[0]
    const idx = (Math.max(1, Math.floor(num)) - 1) % bingoBallPalette.length
    return bingoBallPalette[idx]
}

// Get color for a ball letter (B, I, N, G, O). Falls back to `ballB` if unknown.
export function getBallColorByLetter(letter) {
    if (!letter || typeof letter !== 'string') return ballB
    switch (letter.toUpperCase()) {
        case 'B': return ballB
        case 'I': return ballI
        case 'N': return ballN
        case 'G': return ballG
        case 'O': return ballO
        default: return ballB
    }
}

// Helper: resolve a CSS var to computed value (returns raw value or the input if not resolvable)
export function resolveCssVar(val) {
    try {
        if (typeof val === 'string' && val.startsWith('var(')) {
            const name = val.slice(4, -1).trim();
            const computed = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
            return computed || val;
        }
    } catch (e) { }
    return val;
}