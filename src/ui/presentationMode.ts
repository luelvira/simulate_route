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

function applyPresentation(root: HTMLElement, enabled: boolean): void {
  setPresentation(root, enabled);
  if (enabled) {
    hideControls();
    root.scrollTo(0, document.body.scrollHeight);
    document.documentElement.requestFullscreen();
  } else {
    restoreControls();
    document.exitFullscreen();
  }
}

export function initPresentationMode(doc: Document = document): void {
  const root = doc.documentElement;
  const search = doc.defaultView?.location.search ?? '';

  applyPresentation(root, isPresentationRequested(search));

  doc.addEventListener('keydown', (event) => {
    if (event.repeat) {
      return;
    }
    if (!isPresentationToggleKey(event, event.target)) {
      return;
    }
    applyPresentation(root, !root.classList.contains(PRESENTATION_CLASS));
  });
}
