import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'


import { applyTheme, getSystemPrefersDark } from './theme'
// Apply saved theme early so non-header components render with correct theme
try {
  const saved = localStorage.getItem('app-theme');
  if (saved === 'dark' || saved === 'light') applyTheme(saved);
  else {
    // Respect system preference if no saved choice
    if (getSystemPrefersDark()) applyTheme('dark');
    else applyTheme('light');
  }
} catch (e) { }
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
