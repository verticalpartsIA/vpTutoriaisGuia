# vpTutoriaisGuia

Plataforma interna da VerticalParts para criar, versionar e reproduzir tutoriais interativos sobre os sistemas da empresa.

## Objetivo

Criar uma solução própria, inspirada em ferramentas como Guidde/Scribe/Tango, com:

- captura de navegação e interações;
- screenshots automáticos;
- geração de instruções por IA;
- armazenamento dos tutoriais no próprio Git;
- reprodução de tours interativos dentro dos sistemas VerticalParts;
- validação automática de tutoriais quando a interface mudar.

## Arquitetura inicial

- `recorder/` — captura de passos e eventos do usuário;
- `playwright/` — automações, replay e validação E2E;
- `ai/` — transformação dos eventos em instruções legíveis;
- `tutorials/` — conteúdo versionado dos tutoriais;
- `player/` — componente React para exibir tours dentro dos sistemas;
- `schemas/` — contratos JSON dos tutoriais;
- `docs/` — documentação técnica e decisões arquiteturais.

## Primeiro piloto

Sistema: `010_GestaoImportacao`

Fluxo inicial:

`Comercial → Leads → Novo Lead`

O objetivo do piloto é provar o ciclo completo:

`capturar → interpretar → salvar → reproduzir → validar`.

## Princípio do projeto

O tutorial deve acompanhar o código. Sempre que a interface mudar, o sistema deve ser capaz de detectar passos quebrados e indicar necessidade de atualização.
