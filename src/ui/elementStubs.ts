/** Lightweight element and document stubs shared by the UI unit tests. */

export interface StubElement {
  attributes: Map<string, string>;
  classes: Set<string>;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  addEventListener(type: string, listener: EventListener): void;
  classList: {
    contains(name: string): boolean;
    toggle(name: string, force?: boolean): boolean;
  };
}

export interface StubDocument {
  document: Document;
  root: HTMLElement;
  elements: Map<string, StubElement>;
  /** Dispatches a keydown event through the listeners registered in the document. */
  press(event: Partial<KeyboardEvent>): void;
}

function toggleIn(classes: Set<string>, name: string, force?: boolean): boolean {
  const enabled = force ?? !classes.has(name);
  if (enabled) {
    classes.add(name);
  } else {
    classes.delete(name);
  }
  return enabled;
}

function createStubElement(attributes: Record<string, string>, classNames: string[]): StubElement {
  const element = {
    attributes: new Map(Object.entries(attributes)),
    classes: new Set(classNames),
  } as unknown as StubElement;

  element.setAttribute = (name, value) => element.attributes.set(name, value);
  element.getAttribute = (name) => element.attributes.get(name) ?? null;
  element.addEventListener = () => undefined;
  element.classList = {
    contains: (name) => element.classes.has(name),
    toggle: (name, force) => toggleIn(element.classes, name, force),
  };

  return element;
}

/** Creates a fake document with the controls panel elements and an initial state. */
export function createControlsStubDocument(search = '', open = true): StubDocument {
  const elements = new Map<string, StubElement>([
    ['toggle-controls', createStubElement({ 'aria-expanded': String(open) }, ['bar-toggle', ...(open ? ['is-active'] : [])])],
    ['controls', createStubElement({}, ['admin', ...(open ? ['is-open'] : [])])],
  ]);

  const rootClasses = new Set<string>();
  const root: HTMLElement = {
    classList: {
      contains: (name: string) => rootClasses.has(name),
      toggle: (name: string, force: boolean|undefined) => toggleIn(rootClasses, name, force),
    },
  } as unknown as HTMLElement;

  const listeners = new Map<string, (event: unknown) => void>();
  const document = {
    documentElement: root,
    defaultView: { location: { search } },
    addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    getElementById: (id: string | null) => elements.get(id ?? ''),
  } as unknown as Document;

  return {
    document,
    root,
    elements,
    press: (event) => listeners.get('keydown')?.(event),
  };
}
