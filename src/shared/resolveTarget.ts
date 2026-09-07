import type { TutorialTarget } from '../types.js';

export type ResolveStrategy = 'testId' | 'selector' | 'role+text' | 'text' | 'none';

export interface ResolveResult {
  element: Element | null;
  strategy: ResolveStrategy;
}

const INTERACTIVE_SELECTOR = 'button,a,[role="button"],label,input,select,textarea,[role]';

const ROLE_TAG_HINTS: Record<string, string> = {
  button: 'button,[role="button"]',
  textbox: 'input,textarea,[role="textbox"]',
  link: 'a,[role="link"]',
  checkbox: 'input[type="checkbox"],[role="checkbox"]',
  combobox: 'select,[role="combobox"]',
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function textOf(element: Element): string {
  return normalize(element.textContent ?? '');
}

/**
 * Resolve um TutorialTarget contra o DOM vivo, em ordem decrescente de precisão.
 * Cada nível cai para o próximo quando a interface mudou o suficiente para
 * quebrar o anterior — é o mecanismo que permite ao tutorial "se moldar"
 * a pequenas mudanças de layout sem precisar ser regravado.
 */
export function resolveTarget(root: ParentNode, target: TutorialTarget): ResolveResult {
  if (target.testId) {
    const element = root.querySelector(`[data-testid="${CSS.escape(target.testId)}"]`);
    if (element) return { element, strategy: 'testId' };
  }

  if (target.selector) {
    try {
      const element = root.querySelector(target.selector);
      if (element) return { element, strategy: 'selector' };
    } catch {
      // seletor inválido (DOM mudou de estrutura) — cai para os fallbacks textuais
    }
  }

  if (target.role && target.text) {
    const roleSelector = ROLE_TAG_HINTS[target.role] ?? `[role="${CSS.escape(target.role)}"]`;
    const needle = normalize(target.text);
    const match = Array.from(root.querySelectorAll(roleSelector)).find((el) => textOf(el).includes(needle));
    if (match) return { element: match, strategy: 'role+text' };
  }

  if (target.text) {
    const needle = normalize(target.text);
    const match = Array.from(root.querySelectorAll(INTERACTIVE_SELECTOR)).find((el) => textOf(el).includes(needle));
    if (match) return { element: match, strategy: 'text' };
  }

  return { element: null, strategy: 'none' };
}
