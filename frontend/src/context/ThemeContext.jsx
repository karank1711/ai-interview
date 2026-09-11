import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  THEME_CHANGE_EVENT,
  applyTheme,
  readLocalSettings,
  resolveTheme,
  setAppTheme,
} from '../utils/userSettings';

const ThemeContext = createContext(null);

export function ThemeProvider({ children, userId }) {
  const [theme, setTheme] = useState(() => readLocalSettings(userId).theme);
  const [resolved, setResolved] = useState(() => resolveTheme(readLocalSettings(userId).theme));

  useEffect(() => {
    applyTheme(readLocalSettings().theme);
    const onChange = (event) => {
      setTheme(event.detail?.theme || readLocalSettings().theme);
      setResolved(event.detail?.resolved || resolveTheme(event.detail?.theme));
    };
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, [userId]);

  useEffect(() => {
    if (theme !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyTheme('system');
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [theme]);

  const setThemeMode = useCallback((nextTheme) => {
    setAppTheme(nextTheme, userId);
  }, [userId]);

  const toggleTheme = useCallback(() => {
    setAppTheme(resolved === 'dark' ? 'light' : 'dark', userId);
  }, [resolved, userId]);

  const value = useMemo(() => ({
    theme,
    resolved,
    isDark: resolved === 'dark',
    setTheme: setThemeMode,
    toggleTheme,
  }), [theme, resolved, setThemeMode, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
