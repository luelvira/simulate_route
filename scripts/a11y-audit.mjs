import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const AUDIT_TAGS = ['best-practice', 'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function audit(page, label) {
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async (tags) => {
    // eslint-disable-next-line no-undef
    return axe.run(document, { runOnly: { type: 'tag', values: tags } });
  }, AUDIT_TAGS);

  console.log(`\n[${label}] ${results.violations.length} violation(s)`);
  for (const violation of results.violations) {
    console.log(`- ${violation.id} (${violation.impact}): ${violation.help}`);
    for (const node of violation.nodes) {
      console.log(`    ${node.target.join(' ')}`);
    }
  }
  return results.violations;
}

const server = await preview({ preview: { port: 4173, strictPort: true } });
const browser = await chromium.launch();
let failures = 0;

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto('http://localhost:4173');
  failures += (await audit(desktop, 'Desktop')).length;

  await desktop.getByRole('button', { name: 'Guardar' }).click();
  failures += (await audit(desktop, 'Desktop · save dialog')).length;
  await desktop.getByRole('button', { name: 'Cancelar' }).click();

  await desktop.getByRole('button', { name: 'Cargar' }).click();
  failures += (await audit(desktop, 'Desktop · load dialog (empty)')).length;
  await desktop.getByRole('button', { name: 'Cancelar' }).click();

  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mobile.goto('http://localhost:4173');
  failures += (await audit(mobile, 'Mobile')).length;

  const presentation = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await presentation.goto('http://localhost:4173/?present');
  failures += (await audit(presentation, 'Desktop · presentation')).length;
} finally {
  await browser.close();
  server.httpServer.close();
}

if (failures > 0) {
  console.error(`\nAccessibility audit failed with ${failures} violation(s).`);
  process.exit(1);
}
console.log('\nAccessibility audit passed for all states and viewports.');
