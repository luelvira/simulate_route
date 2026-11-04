import './style.css';
import { initConfigControls } from './ui/configControls';
import { initIcons } from './ui/icons';
import { initPanels } from './ui/panels';
import { initPresentationMode } from './ui/presentationMode';
import { initSimulation } from './ui/simulationView';
import { initTheme } from './ui/theme';

initPanels();
initIcons();
initPresentationMode();
initTheme(document.getElementById('theme-toggle') as HTMLButtonElement);

const scenarioForm = document.getElementById('scenario-form') as HTMLFormElement;
initSimulation(scenarioForm);
initConfigControls(scenarioForm);
