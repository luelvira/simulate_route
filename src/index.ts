import { generateScenario } from "./topology/generator";


const scenario = generateScenario({rows: 8, cols: 12, entryCount: 3, exitCount: 2});

console.log(scenario.entries); // 3 entradas
console.log(scenario.exits);   // 2 salidas
console.log(scenario.nodes);   // 96 intersecciones
console.log(scenario.roads);   // Carreteras existentes
