import AjvModule from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { chromium, type Page } from '@playwright/test';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { Tutorial, TutorialStep } from '../src/types.js';

const Ajv = ((AjvModule as unknown as { default?: new (options?: unknown) => any }).default ?? AjvModule) as unknown as new (options?: unknown) => any;
const addFormats = ((addFormatsModule as unknown as { default?: (ajv: any) => void }).default ?? addFormatsModule) as unknown as (ajv: any) => void;

interface StepReport {
  stepId: string;
  status: 'ok' | 'missing' | 'skipped';
  target: TutorialStep['target'];
}

interface TutorialReport {
  tutorialId: string;
  app: string;
  file: string;
  schemaValid: boolean;
  baseUrl?: string;
  liveChecked: boolean;
  steps: StepReport[];
}

async function collectTutorials(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTutorials(full);
    return entry.isFile() && entry.name === 'tutorial.json' ? [full] : [];
  }));
  return nested.flat();
}

async function loadAppBaseUrls(): Promise<Record<string, string>> {
  try {
    const raw = JSON.parse(await readFile(path.resolve('config/app-base-urls.json'), 'utf8')) as Record<string, string> & { _comment?: string };
    const { _comment, ...rest } = raw;
    void _comment;
    return rest;
  } catch {
    return {};
  }
}

function targetLocator(page: Page, step: TutorialStep) {
  if (step.target.testId) return page.getByTestId(step.target.testId).first();
  if (step.target.selector) return page.locator(step.target.selector).first();
  if (step.target.role && step.target.text) {
    return page.getByRole(step.target.role as never, { name: step.target.text }).first();
  }
  if (step.target.text) return page.getByText(step.target.text, { exact: false }).first();
  return null;
}

const schema = JSON.parse(await readFile(path.resolve('schemas/tutorial.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema) as ((data: unknown) => boolean) & { errors?: unknown };
const files = await collectTutorials(path.resolve('tutorials'));

if (!files.length) throw new Error('Nenhum tutorial.json encontrado.');

let failures = 0;
const reports: TutorialReport[] = [];

for (const file of files) {
  const tutorial = JSON.parse(await readFile(file, 'utf8')) as Tutorial;
  const schemaValid = validate(tutorial);
  if (!schemaValid) {
    failures += 1;
    console.error(`\n[SCHEMA] ${file}`);
    console.error(validate.errors);
  } else {
    console.log(`[SCHEMA OK] ${file}`);
  }
  reports.push({
    tutorialId: tutorial.id,
    app: tutorial.app,
    file: path.relative(process.cwd(), file),
    schemaValid,
    liveChecked: false,
    steps: [],
  });
}

const overrideBaseUrl = process.env.VP_GUIDE_BASE_URL;
const appBaseUrls = await loadAppBaseUrls();
const anyLiveUrl = Boolean(overrideBaseUrl) || Object.keys(appBaseUrls).length > 0;

if (anyLiveUrl) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const tutorial = JSON.parse(await readFile(file, 'utf8')) as Tutorial;
    const baseUrl = overrideBaseUrl || appBaseUrls[tutorial.app];
    const report = reports[i];

    if (!baseUrl) {
      console.log(`[LIVE SKIP] ${tutorial.id}: app "${tutorial.app}" sem URL configurada em config/app-base-urls.json`);
      continue;
    }

    report.baseUrl = baseUrl;
    report.liveChecked = true;
    const url = new URL(tutorial.route, baseUrl).toString();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      for (const step of tutorial.steps) {
        if (step.action === 'navigate' || Object.keys(step.target).length === 0) {
          report.steps.push({ stepId: step.id, status: 'skipped', target: step.target });
          continue;
        }
        const locator = targetLocator(page, step);
        if (!locator) {
          report.steps.push({ stepId: step.id, status: 'skipped', target: step.target });
          continue;
        }
        if ((await locator.count()) === 0) {
          failures += 1;
          report.steps.push({ stepId: step.id, status: 'missing', target: step.target });
          console.error(`[TARGET AUSENTE] ${tutorial.id} / ${step.id}: ${JSON.stringify(step.target)}`);
        } else {
          report.steps.push({ stepId: step.id, status: 'ok', target: step.target });
          console.log(`[TARGET OK] ${tutorial.id} / ${step.id}`);
        }
      }
    } catch (error) {
      failures += 1;
      console.error(`[LIVE ERROR] ${tutorial.id}:`, error);
    }
  }

  await browser.close();
} else {
  console.log('\nNenhuma URL configurada (VP_GUIDE_BASE_URL nem config/app-base-urls.json): validação live de seletores foi ignorada.');
}

const reportDir = path.resolve('reports');
await mkdir(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'drift-report.json');
await writeFile(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  failures,
  tutorials: reports,
}, null, 2));
console.log(`\nRelatório de drift salvo em ${reportPath}`);

if (failures > 0) {
  console.error(`\nValidação falhou com ${failures} problema(s).`);
  process.exit(1);
}

console.log(`\n${files.length} tutorial(is) validado(s) com sucesso.`);
