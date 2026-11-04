import { describe, it, expect, beforeEach, vi } from 'vitest';

const storage = (initial: Record<string, string> = {}): Storage => {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    clear: () => undefined,
    removeItem: (name: string) => values.delete(name),
    getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, value: string) => values.set(name, value),
  };
};

let rootAttributes: Map<string, string>;

/** Minimal button stub: classList plus attribute and click listeners. */
function createToggleStub() {
  const classes = new Set<string>(['btn']);
  const attributes = new Map<string, string>([
    ['data-theme-state', 'dark'],
  ]);
  let listener: EventListener | undefined;
  const domElement = {
    classList: {
      contains: (name: string) => classes.has(name),
      toggle: (name: string, force: boolean) => ((force ? classes.add(name) : classes.delete(name)), force),
    },
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    getAttribute: (name: string) => attributes.get(name) ?? null,
    addEventListener: (_type: string, handle: EventListener) => { listener = handle; },
    click: () => listener?.({ target: domElement } as unknown as Event),
  } as unknown as HTMLButtonElement;
  return domElement;
}

beforeEach(() => {
  rootAttributes = new Map<string, string>([['data-theme', 'dark']]);
  const root = {
    setAttribute: (name: string, value: string) => rootAttributes.set(name, value),
    getAttribute: (name: string) => rootAttributes.get(name) ?? null,
  };
  vi.stubGlobal('document', { documentElement: root });
  vi.stubGlobal('localStorage', storage());
});

const storedTheme = (): string | null =>
  (globalThis as { localStorage: Storage }).localStorage.getItem('theme');

describe('Feature: Theme toggle', () => {

  describe('When the app loads without a stored preference', () => {
    it('should keep the dark theme and mark the toggle as inactive', async () => {
      const toggle = createToggleStub();
      const { initTheme } = await import('./theme');

      initTheme(toggle);

      expect(rootAttributes.get('data-theme')).toBe('dark');
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(toggle.getAttribute('aria-label')).toBe('Cambiar a tema claro');
      expect(toggle.classList.contains('is-light')).toBe(false);
    });
  });

  describe('When the toggle is pressed while the dark theme is active', () => {
    it('should enable the light theme, update all signals and store it', async () => {
      const toggle = createToggleStub();
      const { initTheme } = await import('./theme');

      initTheme(toggle);
      toggle.click();

      expect(rootAttributes.get('data-theme')).toBe('light');
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(toggle.getAttribute('aria-label')).toBe('Cambiar a tema oscuro');
      expect(toggle.classList.contains('is-light')).toBe(true);
      expect(storedTheme()).toBe('light');
    });
  });

  describe('When the toggle is pressed twice', () => {
    it('should return to the dark theme', async () => {
      const toggle = createToggleStub();
      const { initTheme } = await import('./theme');

      initTheme(toggle);
      toggle.click();
      toggle.click();

      expect(rootAttributes.get('data-theme')).toBe('dark');
      expect(toggle.classList.contains('is-light')).toBe(false);
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(storedTheme()).toBe('dark');
    });
  });

  describe('When the app loads with a stored light preference', () => {
    it('should enable the light theme and mark the toggle as active', async () => {
      vi.stubGlobal('localStorage', storage({ theme: 'light' }));
      const toggle = createToggleStub();
      const { initTheme } = await import('./theme');

      initTheme(toggle);

      expect(rootAttributes.get('data-theme')).toBe('light');
      expect(toggle.classList.contains('is-light')).toBe(true);
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(toggle.getAttribute('aria-label')).toBe('Cambiar a tema oscuro');
    });
  });
});
