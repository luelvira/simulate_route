/** Tracks the controls panel state and wires its toolbar toggle. */

const TOGGLE_ID = 'toggle-controls';
const CONTROLS_ID = 'controls';

let stateBeforePresentation: boolean | undefined;
let changedDuringPresentation = false;

function applyState(open: boolean): void {
  const button = document.getElementById(TOGGLE_ID)!;
  button.setAttribute('aria-expanded', String(open));
  button.classList.toggle('is-active', open);
  document.getElementById(CONTROLS_ID)!.classList.toggle('is-open', open);
}

export function isControlsOpen(): boolean {
  return document.getElementById(TOGGLE_ID)!.getAttribute('aria-expanded') === 'true';
}

export function toggleControls(): void {
  changedDuringPresentation = true;
  applyState(!isControlsOpen());
}

export function hideControls(): void {
  stateBeforePresentation = isControlsOpen();
  changedDuringPresentation = false;
  applyState(false);
}

export function restoreControls(): void {
  const restored = changedDuringPresentation
    ? isControlsOpen()
    : stateBeforePresentation ?? true;
  applyState(restored);
}

export function initPanels(): void {
  document.getElementById(TOGGLE_ID)!.addEventListener('click', toggleControls);
}
