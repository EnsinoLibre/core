/**
 * EnsinoLibre — tiny light/dark theme toggle.
 * Sets data-theme="dark" on <html> (design-system tokens do the rest) and
 * persists the choice. An inline <head> script should apply the stored theme
 * before paint to avoid a flash; this module handles the toggle button.
 */
const KEY = 'ensinolibre.theme';

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme) {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
}

export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** A small icon button. Append it wherever a nav lives. */
export function themeToggle() {
  const btn = document.createElement('button');
  btn.className = 'oc-theme-toggle';
  btn.type = 'button';
  const sync = () => {
    const dark = currentTheme() === 'dark';
    btn.textContent = dark ? '☀' : '☾';
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.title = btn.getAttribute('aria-label');
  };
  sync();
  btn.addEventListener('click', () => { toggleTheme(); sync(); });
  return btn;
}
