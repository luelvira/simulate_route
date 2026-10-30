import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createControlsStubDocument, type StubDocument, type StubElement } from './elementStubs';

let stub: StubDocument;

beforeEach(() => {
  vi.resetModules();
  stub = createControlsStubDocument('', true);
  vi.stubGlobal('document', stub.document);
});

const loadPanels = () => import('./panels');
const toggleButton = () => stub.elements.get('toggle-controls')!;
const panel = () => stub.elements.get('controls')!;
const isOpen = () => panel().classes.has('is-open') && toggleButton().attributes.get('aria-expanded') === 'true';

describe('Feature: Controls panel visibility', () => {

  describe('When toggling the controls from the toolbar button', () => {
    it('should hide an open panel and mark the toggle as inactive', async () => {
      const panels = await loadPanels();

      panels.toggleControls();

      expect(isOpen()).toBe(false);
    });

    it('should show the panel again on a second toggle', async () => {
      const panels = await loadPanels();
      panels.toggleControls();

      panels.toggleControls();

      expect(isOpen()).toBe(true);
    });
  });

  describe('When presentation mode hides the controls', () => {
    it('should hide an open panel and remember the state it had', async () => {
      const panels = await loadPanels();

      panels.hideControls();

      expect(isOpen()).toBe(false);
    });

    it('should restore the remembered state when returning to normal mode untouched', async () => {
      const panels = await loadPanels();
      panels.hideControls();

      panels.restoreControls();

      expect(isOpen()).toBe(true);
    });

    it('should keep the panel closed when it was closed before the presentation', async () => {
      const panels = await loadPanels();
      panels.toggleControls();
      panels.hideControls();

      panels.restoreControls();

      expect(isOpen()).toBe(false);
    });
  });

  describe('When the panel is changed during the presentation', () => {
    it('should keep the state chosen during the presentation instead of the previous one', async () => {
      const panels = await loadPanels();
      panels.hideControls();

      panels.toggleControls();
      panels.restoreControls();

      expect(isOpen()).toBe(true);
    });

    it('should keep the final state even when it returns to the initial value', async () => {
      const panels = await loadPanels();
      panels.hideControls();

      panels.toggleControls();
      panels.toggleControls();
      panels.restoreControls();

      expect(isOpen()).toBe(false);
    });

    it('should restore again when presentation mode is entered a second time', async () => {
      const panels = await loadPanels();
      panels.hideControls();
      panels.toggleControls();
      panels.restoreControls();

      panels.hideControls();
      panels.restoreControls();

      expect(isOpen()).toBe(true);
    });
  });
});
