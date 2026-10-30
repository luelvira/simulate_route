import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createControlsStubDocument, type StubDocument } from './elementStubs';
import {
  PRESENTATION_CLASS,
  type PresentationKeyEvent,
  isPresentationRequested,
  isPresentationToggleKey,
  setPresentation,
} from './presentationMode';

let stub: StubDocument;

beforeEach(() => {
  vi.resetModules();
  stub = createControlsStubDocument('', true);
  vi.stubGlobal('document', stub.document);
});

const isPanelOpen = () => stub.elements.get('controls')!.classes.has('is-open');

function keyEvent(overrides: Partial<PresentationKeyEvent> = {}): PresentationKeyEvent {
  return { key: 'p', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...overrides };
}

function keyTarget(tagName: string): EventTarget {
  return { tagName } as unknown as EventTarget;
}

describe('Feature: Presentation mode', () => {

  describe('When the URL requests presentation mode', () => {
    it('should enable it when the query contains the present flag', () => {
      expect(isPresentationRequested('?present')).toBe(true);
    });

    it('should enable it when the present flag is combined with other parameters', () => {
      expect(isPresentationRequested('?seed=47&present&speed=60')).toBe(true);
    });

    it('should not enable it when the query is empty', () => {
      expect(isPresentationRequested('')).toBe(false);
    });

    it('should not enable it for a parameter that merely contains the word present', () => {
      expect(isPresentationRequested('?presentation=1')).toBe(false);
    });
  });

  describe('When applying presentation mode to the page', () => {
    it('should add the presentation class to the root element', () => {
      const root = { classList: { toggle: vi.fn(), contains: vi.fn(() => false) } } as unknown as HTMLElement;

      const enabled = setPresentation(root, true);

      expect(enabled).toBe(true);
      expect(root.classList.toggle).toHaveBeenCalledWith(PRESENTATION_CLASS, true);
    });

    it('should remove the presentation class when disabled', () => {
      const root = { classList: { toggle: vi.fn(), contains: vi.fn(() => true) } } as unknown as HTMLElement;

      const enabled = setPresentation(root, false);

      expect(enabled).toBe(false);
      expect(root.classList.toggle).toHaveBeenCalledWith(PRESENTATION_CLASS, false);
    });
  });

  describe('When the presenter presses Shift+P', () => {
    it('should toggle on a lowercase p with Shift', () => {
      expect(isPresentationToggleKey(keyEvent({ shiftKey: true }), keyTarget('BODY'))).toBe(true);
    });

    it('should toggle on an uppercase P with Shift', () => {
      expect(isPresentationToggleKey(keyEvent({ key: 'P', shiftKey: true }), keyTarget('BODY'))).toBe(true);
    });

    it('should toggle when there is no focused element', () => {
      expect(isPresentationToggleKey(keyEvent({ shiftKey: true }), null)).toBe(true);
    });

    it('should ignore the shortcut without Shift', () => {
      expect(isPresentationToggleKey(keyEvent(), keyTarget('BODY'))).toBe(false);
    });

    it('should ignore the shortcut combined with Ctrl, Cmd or Alt', () => {
      expect(isPresentationToggleKey(keyEvent({ shiftKey: true, ctrlKey: true }), keyTarget('BODY'))).toBe(false);
      expect(isPresentationToggleKey(keyEvent({ shiftKey: true, metaKey: true }), keyTarget('BODY'))).toBe(false);
      expect(isPresentationToggleKey(keyEvent({ shiftKey: true, altKey: true }), keyTarget('BODY'))).toBe(false);
    });

    it('should ignore the shortcut typed inside a form field', () => {
      expect(isPresentationToggleKey(keyEvent({ shiftKey: true }), keyTarget('INPUT'))).toBe(false);
      expect(isPresentationToggleKey(keyEvent({ shiftKey: true }), keyTarget('SELECT'))).toBe(false);
      expect(isPresentationToggleKey(keyEvent({ shiftKey: true }), keyTarget('TEXTAREA'))).toBe(false);
    });

    it('should ignore keys other than P even with Shift', () => {
      expect(isPresentationToggleKey(keyEvent({ key: 'x', shiftKey: true }), keyTarget('BODY'))).toBe(false);
    });
  });

  describe('When the app starts in presentation mode', () => {
    it('should activate the mode and hide the controls', async () => {
      const startStub = createControlsStubDocument('?present', true);
      vi.stubGlobal('document', startStub.document);
      const { initPresentationMode } = await import('./presentationMode');
      initPresentationMode(startStub.document);

      expect(startStub.root.classList.contains(PRESENTATION_CLASS)).toBe(true);
      expect(startStub.elements.get('controls')!.classes.has('is-open')).toBe(false);
    });
  });

  describe('When the presenter presses Shift+P in the page', () => {
    it('should enter presentation mode and hide the controls', async () => {
      const { initPresentationMode } = await import('./presentationMode');
      initPresentationMode(stub.document);

      stub.press({ key: 'P', shiftKey: true });

      expect(stub.root.classList.contains(PRESENTATION_CLASS)).toBe(true);
      expect(isPanelOpen()).toBe(false);
    });

    it('should leave presentation mode and restore the hidden controls', async () => {
      const { initPresentationMode } = await import('./presentationMode');
      initPresentationMode(stub.document);

      stub.press({ key: 'P', shiftKey: true });
      stub.press({ key: 'P', shiftKey: true });

      expect(stub.root.classList.contains(PRESENTATION_CLASS)).toBe(false);
      expect(isPanelOpen()).toBe(true);
    });

    it('should keep the controls hidden in a following presentation after restoring them', async () => {
      const { initPresentationMode } = await import('./presentationMode');
      initPresentationMode(stub.document);

      stub.press({ key: 'P', shiftKey: true });
      stub.press({ key: 'P', shiftKey: true });
      stub.press({ key: 'P', shiftKey: true });

      expect(stub.root.classList.contains(PRESENTATION_CLASS)).toBe(true);
      expect(isPanelOpen()).toBe(false);
    });

    it('should ignore pressing P without Shift', async () => {
      const { initPresentationMode } = await import('./presentationMode');
      initPresentationMode(stub.document);

      stub.press({ key: 'P', shiftKey: false });

      expect(stub.root.classList.contains(PRESENTATION_CLASS)).toBe(false);
      expect(isPanelOpen()).toBe(true);
    });
  });
});
