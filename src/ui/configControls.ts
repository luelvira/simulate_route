import { SimulationConfig, listConfigs, loadConfig, saveConfig } from './configStorage';

const FIELDS: (keyof SimulationConfig)[] = [
  'rows', 'cols', 'entryCount', 'exitCount', 'blockSize',
  'seed', 'cycleRatio', 'roundaboutRatio', 'vehicles',
];

const INT_FIELDS = new Set<keyof SimulationConfig>([
  'rows', 'cols', 'entryCount', 'exitCount', 'blockSize', 'seed', 'vehicles',
]);

function readConfig(form: HTMLFormElement): SimulationConfig {
  const data = new FormData(form);
  return Object.fromEntries(FIELDS.map((field) => {
    const value = Number(data.get(field) ?? 0);
    return [field, INT_FIELDS.has(field) ? Math.round(value) : value];
  })) as unknown as SimulationConfig;
}

function writeConfig(form: HTMLFormElement, config: SimulationConfig): void {
  FIELDS.forEach((field) => {
    const input = form.elements.namedItem(field) as HTMLInputElement | null;
    if (input) input.value = String(config[field]);
  });
}

function openSaveDialog(form: HTMLFormElement): void {
  const dialog = document.getElementById('save-dialog') as HTMLDialogElement;
  const saveForm = document.getElementById('save-form') as HTMLFormElement;
  const nameInput = document.getElementById('config-name') as HTMLInputElement;

  nameInput.value = '';
  dialog.showModal();

  saveForm.onsubmit = (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (name === '') {
      nameInput.focus();
      return;
    }
    saveConfig(name, readConfig(form), localStorage);
    dialog.close();
  };
}

function openLoadDialog(form: HTMLFormElement): void {
  const dialog = document.getElementById('load-dialog') as HTMLDialogElement;
  const loadForm = document.getElementById('load-form') as HTMLFormElement;
  const list = document.getElementById('saved-config-list') as HTMLElement;
  const empty = document.getElementById('load-empty') as HTMLElement;
  const confirm = document.getElementById('btn-confirm-load') as HTMLButtonElement;
  const names = listConfigs(localStorage);

  list.replaceChildren();
  empty.classList.toggle('hidden', names.length > 0);
  confirm.disabled = true;

  for (const name of names) {
    const option = document.createElement('label');
    option.className = 'config-option';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'saved-config';
    radio.value = name;
    radio.addEventListener('change', () => { confirm.disabled = false; });
    option.append(radio, document.createTextNode(name));
    list.append(option);
  }

  dialog.showModal();

  loadForm.onsubmit = (event) => {
    event.preventDefault();
    const selected = list.querySelector<HTMLInputElement>('input[name="saved-config"]:checked');
    if (!selected) return;
    const config = loadConfig(selected.value, localStorage);
    if (config) writeConfig(form, config);
    dialog.close();
  };
}

export function initConfigControls(form: HTMLFormElement): void {
  document.getElementById('btn-save-config')!.addEventListener('click', () =>
    openSaveDialog(form));

  document.getElementById('btn-load-config')!.addEventListener('click', () =>
    openLoadDialog(form));

  document.getElementById('btn-cancel-save')!.addEventListener('click', () =>
    (document.getElementById('save-dialog') as HTMLDialogElement).close());

  document.getElementById('btn-cancel-load')!.addEventListener('click', () =>
    (document.getElementById('load-dialog') as HTMLDialogElement).close());
}
