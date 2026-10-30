import { FolderOpen, Save, createIcons } from 'lucide';

/** Renders the Lucide icons declared in the markup with data-lucide attributes. */
export function initIcons(): void {
  createIcons({
    icons: { FolderOpen, Save },
    attrs: { 'aria-hidden': 'true' },
  });
}
