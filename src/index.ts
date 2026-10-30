import './style.css';
import { generateRoadMap } from './topology/roadMap';
import { renderRoadMap } from './topology/render';
import { initConfigControls } from './ui/configControls';
import { initIcons } from './ui/icons';
import { initPanels } from './ui/panels';
import { initPresentationMode } from './ui/presentationMode';

initPanels();
initIcons();
initPresentationMode();

const scenarioForm = document.getElementById('scenario-form') as HTMLFormElement;
scenarioForm.addEventListener('submit', (event) => event.preventDefault());
initConfigControls(scenarioForm);

const scenario = generateRoadMap({ rows: 18, cols: 24, entryCount: 12, exitCount: 4, blockSize: 7, seed: 47 });
renderRoadMap(document.getElementById('app')!, scenario);
