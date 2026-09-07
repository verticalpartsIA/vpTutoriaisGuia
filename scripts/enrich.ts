import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { CapturedEvent, Tutorial, TutorialStep } from '../src/types.js';

const slug = process.env.VP_GUIDE_SLUG ?? process.argv[2];
const app = process.env.VP_GUIDE_APP ?? 'vp-system';
const title = process.env.VP_GUIDE_TITLE ?? slug ?? 'Tutorial';
const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

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
  body: event.value && event.value !== '[REDACTED]' ? 'Informe o valor necessário neste campo.' : undefined,
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
  description: 'Tutorial gerado a partir de uma captura do VP Guide.',
  app,
  route,
  version: '0.1.0',
  updatedAt: new Date().toISOString(),
  steps: deterministicSteps,
};

if (process.env.ANTHROPIC_API_KEY) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system:
        'Você é o redator do VP Guide. Converta eventos de interface em um tutorial corporativo claro em Português do Brasil. Preserve id, action, target e screenshot exatamente; melhore title, body, description e expected. Além disso, para cada passo que representa um campo de entrada ou botão relevante (não para navegação simples), preencha também "why": uma frase curta explicando o motivo de negócio daquele campo/botão existir — por que a empresa precisa dessa informação ou dessa ação, não apenas "como" preenchê-la. Se não souber o motivo real com confiança a partir do contexto disponível, omita "why" em vez de inventar. Responda exclusivamente com JSON válido no mesmo formato recebido, sem markdown ao redor.',
      messages: [{ role: 'user', content: JSON.stringify(tutorial) }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API falhou: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const outputText = payload.content?.find((block) => block.type === 'text' && typeof block.text === 'string')?.text;

  if (!outputText) throw new Error('Anthropic API não retornou conteúdo textual utilizável.');
  tutorial = JSON.parse(outputText) as Tutorial;
}

const outputPath = path.join(captureDir, 'tutorial.generated.json');
await writeFile(outputPath, JSON.stringify(tutorial, null, 2));
console.log(`Tutorial gerado em ${outputPath}${process.env.ANTHROPIC_API_KEY ? ` usando ${model}` : ' sem IA (fallback determinístico)'}.`);
