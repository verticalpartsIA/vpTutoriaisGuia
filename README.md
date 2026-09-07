# vpTutoriaisGuia

Plataforma interna da VerticalParts para criar, versionar e reproduzir tutoriais interativos sobre os sistemas da empresa.

O objetivo é possuir uma solução própria, inspirada em Guidde, Scribe e Tango, mas integrada ao Git e aos sistemas VerticalParts.

## O que já existe no MVP

- captura de cliques, alterações de campos e navegação com Playwright;
- screenshots automáticos por passo;
- perfil Chromium persistente para reaproveitar login local;
- proteção básica contra captura de campos `password` e `hidden`;
- transformação dos eventos em `tutorial.json`;
- enriquecimento opcional com OpenAI Responses API;
- fallback determinístico quando não houver API de IA configurada;
- player React embutível no sistema de origem;
- destaque visual do elemento associado ao passo atual;
- schema JSON versionado;
- validação estrutural de todos os tutoriais;
- validação live opcional dos seletores contra o frontend real;
- GitHub Actions para impedir regressões no contrato dos tutoriais.

## Arquitetura

```text
Usuário / Playwright
       │
       ▼
Recorder no navegador
       │
       ├── events.json
       └── screenshots/
       │
       ▼
Enrichment
       │
       ├── fallback determinístico
       └── GPT opcional
       │
       ▼
tutorial.json
       │
       ├── Git / revisão
       ├── validação E2E
       └── TutorialPlayer React
```

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

Será aberto um Chromium visível. Navegue normalmente e execute o processo que deseja ensinar.

Os arquivos são gerados localmente em:

```text
captures/novo-lead/
├── events.json
└── screenshots/
```

O perfil padrão fica em `.vp-guide-profile/`, permitindo que a sessão autenticada seja reutilizada entre gravações. Esses dados não são commitados.

## 2. Converter a captura em tutorial

Sem IA:

```bash
VP_GUIDE_APP=010_GestaoImportacao \
VP_GUIDE_TITLE="Como cadastrar um novo Lead" \
npm run enrich -- novo-lead
```

Com IA:

```bash
OPENAI_API_KEY=... \
OPENAI_MODEL=gpt-5.6 \
VP_GUIDE_APP=010_GestaoImportacao \
VP_GUIDE_TITLE="Como cadastrar um novo Lead" \
npm run enrich -- novo-lead
```

Resultado:

```text
captures/novo-lead/tutorial.generated.json
```

Depois da revisão, copie o tutorial aprovado para a árvore `tutorials/` do sistema correspondente.

## 3. Exibir dentro de um sistema React

```tsx
import { TutorialPlayer } from '@verticalparts/vp-tutoriais-guia/player';
import tutorial from './tutorial.json';

export function AjudaDaTela() {
  return <TutorialPlayer tutorial={tutorial} />;
}
```

O player procura o alvo na seguinte ordem:

1. `data-testid`;
2. seletor CSS;
3. texto/role como fallback.

Sempre que possível, prefira `data-testid`, pois é mais estável que seletores derivados da posição do elemento no DOM.

## 4. Validar os tutoriais

Somente schema:

```bash
npm run validate:tutorials
```

Schema + frontend real:

```bash
VP_GUIDE_BASE_URL=https://vpgestaoimportacao.vpsistema.com npm run validate:tutorials
```

A validação live abre cada rota e verifica se os elementos referenciados ainda existem. Isso permite detectar tutorial quebrado quando o frontend muda.

## Primeiro piloto

Sistema: `010_GestaoImportacao`

Fluxo:

`Comercial → Leads → Novo Lead`

Tutorial inicial:

```text
tutorials/gestao-importacao/comercial/leads/novo-lead/tutorial.json
```

## Estrutura

```text
.github/workflows/       CI
scripts/                 recorder, IA e validação
schemas/                 contrato JSON
src/recorder/            captura injetada no navegador
src/player/              player React reutilizável
src/types.ts             domínio compartilhado
tutorials/               tutoriais aprovados e versionados
docs/                    arquitetura e decisões
```

## Princípio do projeto

O tutorial acompanha o código. Se uma tela, botão ou fluxo mudar, a validação deve apontar quais passos precisam ser atualizados antes que o treinamento fique silenciosamente desatualizado.
