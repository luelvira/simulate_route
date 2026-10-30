import './style.css';
import { generateRoadMap } from './topology/roadMap';
import { renderRoadMap } from './topology/render';
import { initConfigControls, readConfig } from './ui/configControls';
import { initIcons } from './ui/icons';
import { initPanels } from './ui/panels';
import { initPresentationMode } from './ui/presentationMode';

initPanels();
initIcons();
initPresentationMode();

const scenarioForm = document.getElementById('scenario-form') as HTMLFormElement;
scenarioForm.addEventListener('submit', (event: SubmitEvent) => {
  event.preventDefault();
  renderRoadMap(document.getElementById('app')!, generateRoadMap(readConfig(scenarioForm)));
});
initConfigControls(scenarioForm);
