export const THEME_ATTRIBUTE = 'data-theme';
export const THEME_STORAGE_KEY = 'theme';

const LABELS =
  { dark: 'Cambiar a tema claro', light: 'Cambiar a tema oscuro' } as const;

/**
 * Wires the theme toggle button: restores the stored theme on load and
 * flips the light attribute on every press. The icon swap is driven by
 * the `is-light` class in the stylesheet.
 */
export function initTheme(
  toggle: HTMLButtonElement,
  doc: Document = document,
  store: Storage = localStorage,
): void {
  setTheme(currentTheme(doc), doc, store, toggle, false);
  if (store.getItem(THEME_STORAGE_KEY) === 'light') {
    setTheme('light', doc, store, toggle, true);
  }
  toggle.addEventListener('click', () => {
    setTheme(nextTheme(doc), doc, store, toggle, true);
  });
}

function currentTheme(doc: Document): 'dark' | 'light' {
  return doc.documentElement.getAttribute(THEME_ATTRIBUTE) === 'light' ? 'light' : 'dark';
}

function nextTheme(doc: Document): 'dark' | 'light' {
  return currentTheme(doc) === 'light' ? 'dark' : 'light';
}

function setTheme(
  theme: 'dark' | 'light',
  doc: Document,
  store: Storage,
  toggle: HTMLButtonElement,
  persist: boolean,
): void {
  doc.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  if (persist) store.setItem(THEME_STORAGE_KEY, theme);
  toggle.classList.toggle('is-light', theme === 'light');
  toggle.setAttribute('aria-pressed', String(theme === 'light'));
  toggle.setAttribute('aria-label', LABELS[theme]);
  toggle.setAttribute('title', LABELS[theme]);
}
