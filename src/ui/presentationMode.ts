import { hideControls, restoreControls } from './panels';

export const PRESENTATION_CLASS = 'is-presentation';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export interface PresentationKeyEvent {
  key: string;
  shiftKey: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export function isPresentationRequested(search: string): boolean {
  return new URLSearchParams(search).has('present');
}

export function setPresentation(root: HTMLElement, enabled: boolean): boolean {
  root.classList.toggle(PRESENTATION_CLASS, enabled);
  return enabled;
}

export function isPresentationToggleKey(
  event: PresentationKeyEvent,
  target: EventTarget | null,
): boolean {
  if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  if (event.key.toLowerCase() !== 'p') {
    return false;
  }

  const tagName = (target as HTMLElement | null)?.tagName?.toUpperCase();
  return tagName === undefined || !EDITABLE_TAGS.has(tagName);
}

/** Fullscreen may be refused (e.g. on page load, without a user gesture); the mode still applies. */
function applyPresentation(doc: Document, enabled: boolean): void {
  const root = doc.documentElement;
  setPresentation(root, enabled);
  if (enabled) {
    hideControls();
    root.scrollTo(0, doc.body.scrollHeight);
    root.requestFullscreen().catch(() => undefined);
  } else {
    restoreControls();
    if (doc.fullscreenElement) doc.exitFullscreen().catch(() => undefined);
  }
}

export function initPresentationMode(doc: Document = document): void {
  const root = doc.documentElement;
  const search = doc.defaultView?.location.search ?? '';

  applyPresentation(doc, isPresentationRequested(search));

  doc.addEventListener('keydown', (event) => {
    if (event.repeat) {
      return;
    }
    if (!isPresentationToggleKey(event, event.target)) {
      return;
    }
    applyPresentation(doc, !root.classList.contains(PRESENTATION_CLASS));
  });
}
