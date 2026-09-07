import { chromium, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { recorderInitScript } from '../src/recorder/injected.js';
import type { CapturedEvent } from '../src/types.js';

const startUrl = process.env.VP_GUIDE_URL ?? process.argv[2];
const slug = process.env.VP_GUIDE_SLUG ?? process.argv[3] ?? 'captura';
const userDataDir = process.env.VP_GUIDE_PROFILE ?? '.vp-guide-profile';

if (!startUrl) {
  console.error('Uso: npm run record -- <url> <slug>');
  console.error('Exemplo: npm run record -- https://meu-sistema.com/comercial/leads novo-lead');
  process.exit(1);
}

const outputDir = path.resolve('captures', slug);
const screenshotsDir = path.join(outputDir, 'screenshots');
await mkdir(screenshotsDir, { recursive: true });

const events: CapturedEvent[] = [];
let screenshotCounter = 0;

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  viewport: { width: 1440, height: 960 },
});

await context.addInitScript({ content: recorderInitScript });

const attach = async (page: Page) => {
  await page.exposeFunction('__vpGuideCapture', async (event: Omit<CapturedEvent, 'screenshot'>) => {
    screenshotCounter += 1;
    const fileName = `step-${String(screenshotCounter).padStart(3, '0')}.png`;
    const screenshotPath = path.join(screenshotsDir, fileName);

    try {
      await page.screenshot({ path: screenshotPath, fullPage: false });
      events.push({ ...event, screenshot: `screenshots/${fileName}` });
    } catch {
      events.push(event);
    }

    await writeFile(path.join(outputDir, 'events.json'), JSON.stringify(events, null, 2));
    console.log(`[VP Guide] ${event.action}: ${event.target.text ?? event.target.selector ?? event.url}`);
  });
};

for (const page of context.pages()) await attach(page);
context.on('page', (page) => void attach(page));

const page = context.pages()[0] ?? (await context.newPage());
await page.goto(startUrl, { waitUntil: 'domcontentloaded' });

console.log('\nVP Guide Recorder ativo.');
console.log('Navegue normalmente. Cada clique/alteração será registrado.');
console.log(`Saída: ${outputDir}`);
console.log('Feche o navegador para finalizar.\n');

await new Promise<void>((resolve) => context.on('close', () => resolve()));
await writeFile(path.join(outputDir, 'events.json'), JSON.stringify(events, null, 2));
console.log(`Captura concluída: ${events.length} eventos.`);
