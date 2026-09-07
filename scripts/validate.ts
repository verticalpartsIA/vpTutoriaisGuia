import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { chromium, type Page } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { Tutorial, TutorialStep } from '../src/types.js';

async function collectTutorials(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTutorials(full);
    return entry.isFile() && entry.name === 'tutorial.json' ? [full] : [];
  }));
  return nested.flat();
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
const validate = ajv.compile(schema);
const files = await collectTutorials(path.resolve('tutorials'));

if (!files.length) throw new Error('Nenhum tutorial.json encontrado.');

let failures = 0;
for (const file of files) {
  const tutorial = JSON.parse(await readFile(file, 'utf8')) as Tutorial;
  if (!validate(tutorial)) {
    failures += 1;
    console.error(`\n[SCHEMA] ${file}`);
    console.error(validate.errors);
  } else {
    console.log(`[SCHEMA OK] ${file}`);
  }
}

const baseUrl = process.env.VP_GUIDE_BASE_URL;
if (baseUrl) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const file of files) {
    const tutorial = JSON.parse(await readFile(file, 'utf8')) as Tutorial;
    const url = new URL(tutorial.route, baseUrl).toString();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      for (const step of tutorial.steps) {
        if (step.action === 'navigate' || Object.keys(step.target).length === 0) continue;
        const locator = targetLocator(page, step);
        if (!locator) continue;
        if ((await locator.count()) === 0) {
          failures += 1;
          console.error(`[TARGET AUSENTE] ${tutorial.id} / ${step.id}: ${JSON.stringify(step.target)}`);
        } else {
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
  console.log('\nVP_GUIDE_BASE_URL não definido: validação live de seletores foi ignorada.');
}

if (failures > 0) {
  console.error(`\nValidação falhou com ${failures} problema(s).`);
  process.exit(1);
}

console.log(`\n${files.length} tutorial(is) validado(s) com sucesso.`);
