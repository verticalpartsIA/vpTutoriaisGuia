import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Tutorial, TutorialStep } from '../types.js';

export interface TutorialPlayerProps {
  tutorial: Tutorial;
  open?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
}

function resolveTarget(step: TutorialStep): Element | null {
  const { target } = step;
  if (target.testId) {
    const byTestId = document.querySelector(`[data-testid="${CSS.escape(target.testId)}"]`);
    if (byTestId) return byTestId;
  }
  if (target.selector) {
    try {
      const bySelector = document.querySelector(target.selector);
      if (bySelector) return bySelector;
    } catch {
      // selector inválido: seguimos para fallback textual
    }
  }
  if (target.text) {
    const candidates = Array.from(document.querySelectorAll('button,a,[role="button"],label,input,select,textarea'));
    return candidates.find((element) => (element.textContent ?? '').trim().includes(target.text!)) ?? null;
  }
  return null;
}

export function TutorialPlayer({ tutorial, open = true, onClose, onComplete }: TutorialPlayerProps) {
  const [index, setIndex] = useState(0);
  const step = tutorial.steps[index];
  const progress = useMemo(() => `${index + 1} de ${tutorial.steps.length}`, [index, tutorial.steps.length]);

  useEffect(() => {
    if (!open || !step) return;
    const target = resolveTarget(step);
    if (!(target instanceof HTMLElement)) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const previousOutline = target.style.outline;
    const previousOutlineOffset = target.style.outlineOffset;
    target.style.outline = '4px solid currentColor';
    target.style.outlineOffset = '4px';

    return () => {
      target.style.outline = previousOutline;
      target.style.outlineOffset = previousOutlineOffset;
    };
  }, [open, step]);

  if (!open || !step) return null;

  const panelStyle: CSSProperties = {
    position: 'fixed',
    right: 24,
    bottom: 24,
    zIndex: 2147483647,
    width: 'min(420px, calc(100vw - 48px))',
    background: '#fff',
    color: '#111',
    border: '1px solid #ddd',
    borderRadius: 14,
    boxShadow: '0 18px 48px rgba(0,0,0,.22)',
    padding: 20,
    fontFamily: 'system-ui, sans-serif',
  };

  const buttonStyle: CSSProperties = {
    border: '1px solid #bbb',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
    background: '#fff',
  };

  const finish = () => {
    onComplete?.();
    onClose?.();
  };

  return (
    <aside aria-label={`Tutorial: ${tutorial.title}`} style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <strong>{tutorial.title}</strong>
        <button type="button" onClick={onClose} aria-label="Fechar tutorial" style={buttonStyle}>×</button>
      </div>
      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>{progress}</div>
      <h3 style={{ marginBottom: 8 }}>{step.title}</h3>
      {step.body ? <p style={{ lineHeight: 1.5 }}>{step.body}</p> : null}
      {step.expected ? <p style={{ fontSize: 13 }}><strong>Resultado esperado:</strong> {step.expected}</p> : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, gap: 8 }}>
        <button type="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} style={buttonStyle}>Anterior</button>
        {index < tutorial.steps.length - 1 ? (
          <button type="button" onClick={() => setIndex((value) => value + 1)} style={buttonStyle}>Próximo</button>
        ) : (
          <button type="button" onClick={finish} style={buttonStyle}>Concluir</button>
        )}
      </div>
    </aside>
  );
}
