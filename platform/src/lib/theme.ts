import { useEffect, useState } from 'react';

const KEY = 'ensinolibre.theme';

export function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(
    () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'),
  );
  useEffect(() => {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }, [theme]);
  return { theme, toggle: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')) };
}
