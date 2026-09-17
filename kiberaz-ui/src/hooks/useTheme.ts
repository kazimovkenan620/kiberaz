import { useCallback, useSyncExternalStore } from 'react';

// ─── Mövzu (light / dark) ─────────────────────────────────────
//
// Mənbə: <html data-theme="..."> atributu. index.html-dəki inline skript ilk
// boyamadan əvvəl bunu localStorage-dan (yoxdursa qaranlıq mövzu kimi) qoyur; bu hook
// həmin dəyəri oxuyur, dəyişir və yadda saxlayır.
//
// localStorage-da YALNIZ mövzu seçimi saxlanılır ('kiberaz-theme'). Token və
// sessiya məlumatı heç vaxt bura yazılmır.

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'kiberaz-theme';
const THEME_COLORS: Record<Theme, string> = { light: '#FAFBFC', dark: '#060C14' };

const listeners = new Set<() => void>();

function readTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: Theme, persist: boolean): void {
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== theme) {
    // Səthlərin rəngi yumşaq keçsin; keçid bitəndə sinif silinir ki, adi
    // hover/fokus animasiyaları yavaşlamasın.
    document.body.classList.add('theme-transition');
    root.setAttribute('data-theme', theme);
    window.setTimeout(() => document.body.classList.remove('theme-transition'), 260);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* gizli rejim və s. — sükutla keçilir */ }
  }
  listeners.forEach(fn => fn());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void } {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'dark' as Theme);

  const setTheme = useCallback((t: Theme) => applyTheme(t, true), []);
  const toggleTheme = useCallback(() => applyTheme(readTheme() === 'dark' ? 'light' : 'dark', true), []);

  return { theme, setTheme, toggleTheme };
}
