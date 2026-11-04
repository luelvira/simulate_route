import { FolderOpen, Moon, Save, Sun, createIcons } from 'lucide';

/** Renders the Lucide icons declared in the markup with data-lucide attributes. */
export function initIcons(): void {
  createIcons({
    icons: { FolderOpen, Moon, Save, Sun },
    attrs: { 'aria-hidden': 'true' },
  });
}
