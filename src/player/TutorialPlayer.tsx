import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Tutorial, TutorialStep } from '../types.js';
import { resolveTarget } from '../shared/resolveTarget.js';

export interface TutorialPlayerProps {
  tutorial: Tutorial;
  open?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
  /**
   * Chamado quando o passo atual não encontra nenhum elemento correspondente
   * no DOM real — sinal de que a tela mudou e o tutorial precisa ser
   * revisado/regravado. Use isso para registrar telemetria de drift em
   * produção (ex.: gravar em uma tabela Supabase `tutorial_drift_events`).
   */
  onStepUnresolved?: (tutorial: Tutorial, step: TutorialStep) => void;
}

export function TutorialPlayer({ tutorial, open = true, onClose, onComplete, onStepUnresolved }: TutorialPlayerProps) {
  const [index, setIndex] = useState(0);
  const step = tutorial.steps[index];
  const progress = useMemo(() => `${index + 1} de ${tutorial.steps.length}`, [index, tutorial.steps.length]);

  useEffect(() => {
    if (!open || !step) return;
    if (Object.keys(step.target).length === 0) return;

    const { element, strategy } = resolveTarget(document, step.target);
    if (strategy === 'none' || !(element instanceof HTMLElement)) {
      onStepUnresolved?.(tutorial, step);
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const previousOutline = element.style.outline;
    const previousOutlineOffset = element.style.outlineOffset;
    element.style.outline = '4px solid currentColor';
    element.style.outlineOffset = '4px';

    return () => {
      element.style.outline = previousOutline;
      element.style.outlineOffset = previousOutlineOffset;
    };
  }, [open, step, tutorial, onStepUnresolved]);

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
