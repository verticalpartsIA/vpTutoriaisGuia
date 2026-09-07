import { chromium, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { recorderInitScript } from '../src/recorder/injected.js';
import type { CapturedEvent } from '../src/types.js';

/**
 * Variante de scripts/record.ts para gravação SEM humano: um agente (ou CI)
 * fornece uma lista de ações em JSON e o Playwright as executa sozinho,
 * enquanto o mesmo recorder injetado captura eventos + screenshots.
 * Os eventos disparados pelo Playwright são eventos DOM reais (não
 * sintéticos no sentido de "fake") — o injected.ts não distingue quem clicou.
 */
interface ScriptAction {
  type: 'goto' | 'click' | 'fill' | 'press' | 'wait';
  /** goto */
  url?: string;
  /** click/fill: seletor CSS. Se ausente, usa "text". */
  selector?: string;
  /** click: texto visível do elemento. fill: placeholder do campo. */
  text?: string;
  /** fill: valor a digitar. press: tecla a pressionar (padrão "Enter"). */
  value?: string;
  /** wait: milissegundos a esperar. */
  ms?: number;
}

const scriptPath = process.argv[2];
const slug = process.argv[3] ?? 'captura-roteirizada';
const userDataDir = process.env.VP_GUIDE_PROFILE ?? '.vp-guide-profile';

if (!scriptPath) {
  console.error('Uso: npm run record:scripted -- <acoes.json> <slug>');
  console.error('Formato de acoes.json: array de { type, url?, selector?, text?, value?, ms? }');
  console.error('Tipos: goto | click | fill | press | wait');
  process.exit(1);
}

const actions = JSON.parse(await readFile(path.resolve(scriptPath), 'utf8')) as ScriptAction[];

const outputDir = path.resolve('captures', slug);
const screenshotsDir = path.join(outputDir, 'screenshots');
await mkdir(screenshotsDir, { recursive: true });

const events: CapturedEvent[] = [];
let screenshotCounter = 0;

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: process.env.VP_GUIDE_HEADLESS === '1',
  viewport: { width: 1440, height: 960 },
});
await context.addInitScript({ content: recorderInitScript });

const page: Page = context.pages()[0] ?? (await context.newPage());
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

for (const action of actions) {
  switch (action.type) {
    case 'goto': {
      if (!action.url) throw new Error('Ação "goto" precisa de "url".');
      await page.goto(action.url, { waitUntil: 'domcontentloaded' });
      break;
    }
    case 'click': {
      const locator = action.selector
        ? page.locator(action.selector)
        : page.getByText(action.text ?? '', { exact: false });
      await locator.first().click();
      break;
    }
    case 'fill': {
      const locator = action.selector ? page.locator(action.selector) : page.getByPlaceholder(action.text ?? '');
      await locator.first().fill(action.value ?? '');
      // dispara o evento "change" manualmente: fill() do Playwright nem sempre
      // aciona o listener de "change" do recorder da mesma forma que digitação real.
      await locator.first().dispatchEvent('change');
      break;
    }
    case 'press': {
      await page.keyboard.press(action.value ?? 'Enter');
      break;
    }
    case 'wait': {
      await page.waitForTimeout(action.ms ?? 1000);
      break;
    }
    default: {
      throw new Error(`Ação desconhecida no roteiro: ${JSON.stringify(action)}`);
    }
  }
}

await writeFile(path.join(outputDir, 'events.json'), JSON.stringify(events, null, 2));
console.log(`\nCaptura roteirizada concluída: ${events.length} eventos em ${outputDir}`);
await context.close();
