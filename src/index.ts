import './style.css';
import { generateRoadMap } from './topology/roadMap';
import { renderRoadMap } from './topology/render';

const scenario = generateRoadMap({ rows: 18, cols: 24, entryCount: 12, exitCount: 4, blockSize: 7, seed: 47 });
renderRoadMap(document.getElementById('app')!, scenario);
