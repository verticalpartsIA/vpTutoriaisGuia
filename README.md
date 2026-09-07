# VP Tutoriais Guia

**Tutoriais interativos e vivos, embutidos nos próprios sistemas VerticalParts.**

Um botão "?" flutuante em cada sistema abre um passo a passo guiado sobre a tela real — e quando a tela muda, o tutorial percebe e avisa, em vez de ficar silenciosamente desatualizado.

---

## Por que isso existe

Documentação de processo tradicional (Notion, PDF, vídeo gravado) descasa do produto no primeiro deploy. A ideia aqui é inversa: **o tutorial mora dentro do sistema que ele explica**, é gerado a partir de uma navegação real (não escrito à mão), e se valida continuamente contra a tela de produção.

Esse princípio já estava no README original deste repositório ("o tutorial acompanha o código") — este upgrade leva ele adiante: de um MVP que gravava e enriquecia com OpenAI, para uma ferramenta com **resolução de alvo em cascata** (o tutorial "se molda" a pequenas mudanças de UI), **detecção de drift agendada** (roda mesmo sem push, porque os sites mudam independente deste repo) e um **widget de ajuda embutível**.

### Inspirações

A visão original citava [Guidde](https://www.guidde.com/), Scribe e Tango. Para este upgrade, estudamos três ferramentas open-source de gravação/replay de tutoriais e trouxemos o que fazia sentido para o nosso caso (React interno, multi-sistema, sem SaaS de terceiro):

| Projeto | O que usamos como referência |
|---|---|
| [stepshots](https://github.com/hauju/stepshots) | Comando de verificação (`verify`) que detecta drift de seletor/URL em CI; ideia de expor a ferramenta como tools de agente (MCP) |
| [mimik](https://github.com/westpoint-io/mimik) | "Guide Me Replay" — destacar o próximo elemento e avançar sozinho conforme o usuário interage; descrições de IA geradas a partir do DOM (barato) em vez de visão computacional |
| [pagewalk](https://github.com/hamad501/pagewalk) | Cascata de resolução de alvo (seletor → atributo → texto → coordenada); widget flutuante isolado do CSS do host |

Não copiamos código de nenhum dos três (licenças e stacks diferentes) — usamos as ideias arquiteturais e reimplementamos no nosso stack (Node + Playwright + React), do jeito que fazia sentido para os sistemas VerticalParts.

---

## Como funciona

```mermaid
flowchart TD
    A[Alguém navega no sistema real] -->|Playwright grava cliques/campos/telas| B[captures/slug/events.json + screenshots]
    B -->|npm run enrich| C{ANTHROPIC_API_KEY?}
    C -->|sim| D[Claude reescreve title/body/expected]
    C -->|não| E[Fallback determinístico]
    D --> F[tutorial.generated.json]
    E --> F
    F -->|revisão humana| G[tutorials/sistema/.../tutorial.json]
    G --> H[npm run validate:tutorials]
    H -->|schema + seletor ao vivo, via config/app-base-urls.json| I{Passou?}
    I -->|não| J[Issue de drift aberta/atualizada automaticamente]
    I -->|sim| K[HelpWidget "?" no site consome o tutorial]
    K -->|produção: passo não encontrado| L[onStepUnresolved -> telemetria]
    L -.sinaliza necessidade de regravar.-> A
```

O ciclo fecha: gravação real → IA enriquece → validação de schema + checagem ao vivo (CI agendada, não só em push) → widget em produção → se um usuário real encontrar um passo quebrado, o próprio player sinaliza isso via callback, fechando o loop de volta para "precisa regravar".

---

## O mecanismo "vivo" (self-healing)

Cada passo do tutorial (`TutorialStep.target`) pode carregar `testId`, `selector`, `role` e `text` ao mesmo tempo. Em vez de depender de um único seletor CSS frágil, `src/shared/resolveTarget.ts` tenta, em ordem decrescente de precisão:

1. **`data-testid`** — mais estável, sobrevive a redesign visual;
2. **seletor CSS** — específico, mas quebra fácil se o DOM mudar de estrutura;
3. **`role` + `text`** (ex.: botão com texto "Entrar") — sobrevive a mudança de classe/estrutura, quebra se o texto mudar;
4. **texto isolado** — último recurso.

Essa mesma cascata roda em dois lugares:

- **No navegador real** (`TutorialPlayer`/`HelpWidget`, via `resolveTarget`) — se nenhuma estratégia encontrar o elemento, o player chama `onStepUnresolved(tutorial, step)` em vez de travar. É o gancho para você registrar telemetria de drift em produção (ex.: gravar num Supabase `tutorial_drift_events`).
- **Em CI** (`scripts/validate.ts`, via Playwright `getByTestId`/`locator`/`getByRole`/`getByText`) — roda contra a URL real do sistema (`config/app-base-urls.json`) em todo push, PR e **todo dia às 09:00 UTC** (cron), porque o site pode mudar num deploy que não passou por este repositório.

Quando a validação ao vivo falha, o workflow abre (ou atualiza) automaticamente uma issue `Drift de tutoriais detectado` neste repositório com o log completo.

**Limitação conhecida:** a checagem ao vivo hoje navega sem autenticação. Para sistemas atrás de login, um passo pode aparecer como "ausente" só por estar vendo a tela de login, não por drift real de UI — ver a issue de suporte a `storageState` autenticado no backlog.

---

## Instalação local

```bash
npm install
npx playwright install chromium
```

Node.js 20 ou superior.

## 1. Gravar um processo

```bash
npm run record -- https://vpgestaoimportacao.vpsistema.com/comercial/leads novo-lead
```

Abre um Chromium visível. Navegue normalmente e execute o processo que quer ensinar. Saída em `captures/novo-lead/{events.json, screenshots/}`. Perfil persistente em `.vp-guide-profile/` (não commitado) reaproveita login local entre gravações.

## 2. Enriquecer com Claude

```bash
ANTHROPIC_API_KEY=... \
ANTHROPIC_MODEL=claude-sonnet-5 \
VP_GUIDE_APP=010_GestaoImportacao \
VP_GUIDE_TITLE="Como cadastrar um novo Lead" \
npm run enrich -- novo-lead
```

Sem `ANTHROPIC_API_KEY`, cai no fallback determinístico (títulos genéricos a partir da própria ação capturada — continua funcional, só menos redigido). Resultado em `captures/novo-lead/tutorial.generated.json`.

## 3. Revisar e publicar

Depois de revisar, copie o `tutorial.generated.json` aprovado para `tutorials/<sistema>/<rota>/tutorial.json`. Se o sistema é novo, adicione a URL de produção dele em `config/app-base-urls.json` — é isso que liga o tutorial à checagem de drift ao vivo.

## 4. Validar

```bash
npm run validate:tutorials
```

Valida o schema de todos os `tutorial.json` em `tutorials/` e, para cada `app` presente em `config/app-base-urls.json`, abre a rota real e confere se os seletores/textos ainda existem. Gera `reports/drift-report.json` (ignorado no git) com o resultado estruturado por passo.

## 5. Embutir o botão "?" no sistema

```tsx
import { HelpWidget } from '@verticalparts/vp-tutoriais-guia/player';
import novoLead from './tutorials/comercial/leads/novo-lead/tutorial.json';

export function AppShell() {
  const tutoriaisDaTela = [novoLead]; // filtre pelos tutoriais da rota atual

  return (
    <>
      {/* ...resto do app... */}
      <HelpWidget
        tutorials={tutoriaisDaTela}
        onStepUnresolved={(tutorial, step) => {
          console.warn('[VP Guide] passo não encontrado — tela pode ter mudado', tutorial.id, step.id);
          // opcional: registrar em telemetria própria do sistema
        }}
      />
    </>
  );
}
```

O widget é 100% estilos inline (sem CSS externo) para não colidir com o design system de cada site — funciona igual num app Tailwind, Bootstrap ou CSS puro. Se houver mais de um tutorial elegível para a tela, o "?" abre um menu; se só houver um, abre direto.

O player procura o alvo na ordem `data-testid` → seletor CSS → `role`+texto → texto. Sempre que possível, prefira `data-testid` na hora de gravar — é o mais estável.

---

## Estrutura do repositório

```text
.github/workflows/       CI: typecheck, schema, drift ao vivo (push/PR/cron/manual), abre issue em falha
config/                  app-base-urls.json — URL de produção de cada sistema, usada na checagem ao vivo
scripts/                 record (Playwright), enrich (Claude), validate (schema + drift)
schemas/                 contrato JSON do tutorial (draft 2020-12)
src/recorder/            script injetado no navegador durante a gravação
src/shared/              resolveTarget.ts — cascata de resolução de alvo (usada pelo player)
src/player/              TutorialPlayer (reprodutor) + HelpWidget (botão "?") reutilizáveis em React
src/types.ts             domínio compartilhado (Tutorial, TutorialStep, TutorialTarget, CapturedEvent)
tutorials/               tutoriais aprovados e versionados, por sistema/rota
reports/                 drift-report.json gerado a cada validação (não versionado)
docs/                    arquitetura e decisões
```

---

## Roadmap

O backlog vive nas [Issues](https://github.com/verticalpartsIA/vpTutoriaisGuia/issues) deste repositório (label `roadmap`). Itens já mapeados nesta rodada de upgrade:

- Suporte a `storageState` autenticado na validação ao vivo (elimina falso-positivo de tela de login)
- Auto-reparo de tutoriais quebrados usando Claude para propor novo seletor + abrir PR
- Isolamento de estilo do widget via Shadow DOM
- Exportação multi-formato (PDF/HTML/Markdown) inspirada no Pagewalk/Mimik
- Redação automática avançada de dados sensíveis no recorder (além de password/hidden)
- MCP server expondo gravação/validação como tools de agente (inspirado no stepshots)
- Telemetria central de `onStepUnresolved` (hoje é só um callback — falta um destino padrão)
- Registro central multi-repo (mapa app → rota → tutorial id) para o `HelpWidget` descobrir tutoriais sem import manual
- Publicar o pacote em um registry interno para `npm install @verticalparts/vp-tutoriais-guia` funcionar entre repositórios sem link manual

---

## Para quem (ou qual agente) for mexer aqui

Este README é a fonte de verdade sobre propósito e arquitetura — leia antes de propor uma reestruturação do zero; é bem provável que o que você quer já esteja listado no Roadmap acima como issue.

Convenções deste repositório:

- Conteúdo voltado ao usuário final (títulos, descrições de tutorial) em **Português do Brasil**; identificadores de código, commits e nomes de arquivo em inglês.
- Nunca commitar segredos: `.env`, `.vp-guide-profile/` (perfil de navegador com sessão) e `reports/*.json` já estão no `.gitignore` — não force adição deles.
- `scripts/enrich.ts` só chama a Anthropic API se `ANTHROPIC_API_KEY` estiver definida; sem a chave, o fallback determinístico precisa continuar funcional — não quebre esse caminho.
- Antes de abrir PR: `npm run typecheck` e `npm run validate:tutorials` (a segunda só faz checagem ao vivo se houver alguma URL em `config/app-base-urls.json` ou `VP_GUIDE_BASE_URL` — sem isso, valida só o schema).
- Ao adicionar tutorial de um sistema novo, adicione a entrada correspondente em `config/app-base-urls.json` (`app` do tutorial → URL de produção) para ele entrar na checagem de drift agendada.
- `src/shared/resolveTarget.ts` (DOM/navegador) e a cascata equivalente em `scripts/validate.ts` (Playwright) implementam a mesma ordem de fallback em duas APIs diferentes — se mudar uma ordem, replique na outra.
