import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';
import { createRequire } from 'node:module';

// gifenc é CommonJS puro e o cjs-module-lexer do Node não sintetiza os named
// exports de forma confiável sob NodeNext (GIFEncoder também existe como
// module.exports.default) — usamos createRequire para pegar o objeto real.
const require = createRequire(import.meta.url);
const { GIFEncoder, quantize, applyPalette } = require('gifenc') as typeof import('gifenc');
import type { Tutorial } from '../src/types.js';

const tutorialDir = process.argv[2];
const outputArg = process.argv[3];

if (!tutorialDir) {
  console.error('Uso: npm run export:gif -- <pasta-do-tutorial> [saida.gif]');
  console.error('Exemplo: npm run export:gif -- tutorials/gestao-importacao/comercial/leads/novo-lead');
  process.exit(1);
}

const resolvedDir = path.resolve(tutorialDir);
const outputPath = outputArg ? path.resolve(outputArg) : path.join(resolvedDir, 'tutorial.gif');

const tutorial = JSON.parse(await readFile(path.join(resolvedDir, 'tutorial.json'), 'utf8')) as Tutorial;
const framesSource = tutorial.steps.filter((step) => step.screenshot);

if (!framesSource.length) {
  throw new Error('Nenhum passo com "screenshot" encontrado neste tutorial — não há o que animar.');
}

const canvasWidth = Number(process.env.VP_GUIDE_GIF_WIDTH ?? 960);
const canvasHeight = Number(process.env.VP_GUIDE_GIF_HEIGHT ?? 600);
const delayMs = Number(process.env.VP_GUIDE_GIF_DELAY_MS ?? 1400);

const gif = GIFEncoder();

for (const step of framesSource) {
  const imagePath = path.join(resolvedDir, step.screenshot!);
  const { data } = await sharp(imagePath)
    .resize(canvasWidth, canvasHeight, { fit: 'contain', background: '#ffffff' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const palette = quantize(data, 256);
  const indexed = applyPalette(data, palette);
  gif.writeFrame(indexed, canvasWidth, canvasHeight, { palette, delay: delayMs });
  console.log(`[GIF] frame adicionado: ${step.id} (${path.basename(imagePath)})`);
}

gif.finish();
await writeFile(outputPath, Buffer.from(gif.bytes()));
console.log(`\nGIF gerado em ${outputPath} (${framesSource.length} frames, ${canvasWidth}x${canvasHeight}, ${delayMs}ms/frame).`);
