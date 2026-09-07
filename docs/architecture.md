# Arquitetura inicial

## Visão

O `vpTutoriaisGuia` será um motor independente para captura, geração, versionamento e reprodução de tutoriais interativos.

## Pipeline

1. **Recorder** captura rota, clique, texto visível, papel semântico do elemento e screenshot.
2. **Normalizer** converte a captura bruta para o schema oficial de tutorial.
3. **AI Writer** melhora títulos, explicações e dicas sem alterar a intenção real do passo capturado.
4. **Git Store** versiona JSON e imagens junto ao projeto.
5. **Player** reproduz o tutorial como overlay/tour no sistema alvo.
6. **Playwright Validator** reexecuta o tutorial e identifica seletor quebrado, rota inválida ou comportamento divergente.

## Regra de robustez de seletores

Prioridade sugerida:

1. `data-testid`
2. `role + accessible name`
3. texto estável
4. seletor CSS específico apenas como último recurso

O projeto deve evitar seletores frágeis baseados em posição no DOM.

## Estratégia de integração

O motor deve permanecer desacoplado dos sistemas consumidores. Cada sistema VerticalParts poderá carregar os tutoriais por pacote, arquivo estático ou endpoint, mantendo o conteúdo versionado.

## Primeiro piloto

`010_GestaoImportacao → Comercial → Leads → Novo Lead`

O piloto deverá provar cinco capacidades:

- captura;
- geração do JSON;
- screenshot;
- reprodução dentro do React;
- validação E2E por Playwright.
