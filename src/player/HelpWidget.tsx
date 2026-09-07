import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Tutorial, TutorialStep } from '../types.js';
import { TutorialPlayer } from './TutorialPlayer.js';

export interface HelpWidgetProps {
  /** Tutoriais disponíveis para a tela atual (normalmente filtrados por `app` + `route` antes de chegar aqui). */
  tutorials: Tutorial[];
  position?: 'bottom-right' | 'bottom-left';
  /** Prefixo da chave usada no localStorage para lembrar quais tutoriais o usuário já viu. */
  storageKeyPrefix?: string;
  onStepUnresolved?: (tutorial: Tutorial, step: TutorialStep) => void;
}

function hasSeen(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return true; // sem localStorage (modo privado etc.) — não insiste com o badge
  }
}

function markSeen(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // silencioso: badge é cosmético, não é crítico persistir
  }
}

/**
 * Botão de ajuda "?" flutuante, autocontido (sem dependência de CSS externo,
 * só estilos inline) para não colidir com o design system do site host.
 * Basta importar e renderizar uma vez perto da raiz do app:
 *
 *   <HelpWidget tutorials={tutoriaisDaRotaAtual} />
 */
export function HelpWidget({ tutorials, position = 'bottom-right', storageKeyPrefix = 'vp-guide-seen', onStepUnresolved }: HelpWidgetProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const seenKeys = useMemo(
    () => Object.fromEntries(tutorials.map((tutorial) => [tutorial.id, `${storageKeyPrefix}:${tutorial.id}`])),
    [tutorials, storageKeyPrefix],
  );

  const hasUnseen = tutorials.some((tutorial) => !hasSeen(seenKeys[tutorial.id]));
  const activeTutorial = tutorials.find((tutorial) => tutorial.id === activeId) ?? null;

  if (tutorials.length === 0) return null;

  const positionStyle: CSSProperties = position === 'bottom-left' ? { left: 24 } : { right: 24 };

  const openTutorial = (tutorial: Tutorial) => {
    setActiveId(tutorial.id);
    setMenuOpen(false);
    markSeen(seenKeys[tutorial.id]);
  };

  const buttonStyle: CSSProperties = {
    position: 'fixed',
    bottom: 24,
    ...positionStyle,
    zIndex: 2147483646,
    width: 52,
    height: 52,
    borderRadius: '50%',
    border: 'none',
    background: '#111',
    color: '#fff',
    fontSize: 22,
    fontWeight: 700,
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    boxShadow: '0 10px 30px rgba(0,0,0,.28)',
  };

  const badgeStyle: CSSProperties = {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: '#f5a524',
    border: '2px solid #fff',
  };

  const menuStyle: CSSProperties = {
    position: 'fixed',
    bottom: 84,
    ...positionStyle,
    zIndex: 2147483646,
    width: 'min(300px, calc(100vw - 48px))',
    background: '#fff',
    color: '#111',
    border: '1px solid #ddd',
    borderRadius: 12,
    boxShadow: '0 18px 48px rgba(0,0,0,.22)',
    padding: 8,
    fontFamily: 'system-ui, sans-serif',
  };

  const itemStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    border: 'none',
    background: 'transparent',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
  };

  return (
    <>
      <button
        type="button"
        aria-label="Abrir tutoriais de ajuda"
        style={{ position: 'relative' }}
        onClick={() => (tutorials.length === 1 ? openTutorial(tutorials[0]) : setMenuOpen((value) => !value))}
      >
        <span style={buttonStyle}>
          ?
          {hasUnseen ? <span style={badgeStyle} /> : null}
        </span>
      </button>

      {menuOpen && tutorials.length > 1 ? (
        <div role="menu" aria-label="Tutoriais disponíveis" style={menuStyle}>
          {tutorials.map((tutorial) => (
            <button key={tutorial.id} type="button" role="menuitem" style={itemStyle} onClick={() => openTutorial(tutorial)}>
              {!hasSeen(seenKeys[tutorial.id]) ? '🟠 ' : ''}
              {tutorial.title}
            </button>
          ))}
        </div>
      ) : null}

      {activeTutorial ? (
        <TutorialPlayer
          tutorial={activeTutorial}
          open
          onClose={() => setActiveId(null)}
          onComplete={() => setActiveId(null)}
          onStepUnresolved={onStepUnresolved}
        />
      ) : null}
    </>
  );
}
