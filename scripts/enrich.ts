import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { CapturedEvent, Tutorial, TutorialStep } from '../src/types.js';

const slug = process.env.VP_GUIDE_SLUG ?? process.argv[2];
const app = process.env.VP_GUIDE_APP ?? 'vp-system';
const title = process.env.VP_GUIDE_TITLE ?? slug ?? 'Tutorial';
const model = process.env.OPENAI_MODEL ?? 'gpt-5.6';

if (!slug) {
  console.error('Uso: npm run enrich -- <slug>');
  process.exit(1);
}

const captureDir = path.resolve('captures', slug);
const eventsPath = path.join(captureDir, 'events.json');
const events = JSON.parse(await readFile(eventsPath, 'utf8')) as CapturedEvent[];

const deterministicSteps: TutorialStep[] = events.map((event, index) => ({
  id: `step-${String(index + 1).padStart(3, '0')}`,
  title: event.action === 'navigate' ? 'Navegue para a próxima tela' : `Execute: ${event.target.text ?? event.action}`,
  body: event.value && event.value !== '[REDACTED]' ? `Informe o valor necessário neste campo.` : undefined,
  action: event.action,
  target: event.target,
  screenshot: event.screenshot,
}));

const route = (() => {
  try {
    return new URL(events[0]?.url ?? 'http://local/').pathname;
  } catch {
    return '/';
  }
})();

let tutorial: Tutorial = {
  id: slug,
  title,
  description: `Tutorial gerado a partir de uma captura do VP Guide.`,
  app,
  route,
  version: '0.1.0',
  updatedAt: new Date().toISOString(),
  steps: deterministicSteps,
};

if (process.env.OPENAI_API_KEY) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'Você é o redator do VP Guide. Converta eventos de interface em um tutorial corporativo claro em Português do Brasil. Preserve id, action, target e screenshot exatamente; melhore apenas title, body, description e expected. Responda exclusivamente com JSON válido no mesmo formato recebido.',
            },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: JSON.stringify(tutorial) }],
        },
      ],
      text: { format: { type: 'json_object' } },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API falhou: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { output_text?: string };
  if (!payload.output_text) throw new Error('OpenAI API não retornou output_text.');
  tutorial = JSON.parse(payload.output_text) as Tutorial;
}

const outputPath = path.join(captureDir, 'tutorial.generated.json');
await writeFile(outputPath, JSON.stringify(tutorial, null, 2));
console.log(`Tutorial gerado em ${outputPath}${process.env.OPENAI_API_KEY ? ` usando ${model}` : ' sem IA (fallback determinístico)'}.`);
