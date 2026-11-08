import { useState } from 'react';
import { css } from '@/styled-system/css';
import type { SuggestResponse } from '@/lib/api.js';
import { LayoutBadge } from './LayoutBadge.js';

export function SuggestionRow({
  suggestion,
  onAdopt,
}: {
  suggestion: SuggestResponse['suggestions'][number];
  onAdopt: () => Promise<void>;
}) {
  const [adopting, setAdopting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pct = Math.round(suggestion.coverage * 100);
  const pctColor = pct >= 80 ? 'green.600' : pct >= 40 ? 'amber.600' : 'red.600';

  const handleAdopt = async () => {
    setAdopting(true);
    setError(null);
    try {
      await onAdopt();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setAdopting(false);
    }
  };

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '3',
        px: '3',
        py: '2.5',
        borderBottom: '1px solid',
        borderColor: 'bd.subtle',
        bg: 'bg.page',
        _last: { borderBottom: 'none' },
      })}
    >
      <div className={css({ flex: 1, minW: 0 })}>
        <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
          <span
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'fg.heading',
              fontFamily: 'mono',
              truncate: true,
            })}
          >
            {suggestion.identifier}
          </span>
          <LayoutBadge layout={suggestion.layout} />
        </div>
        <p className={css({ fontSize: 'xs', color: 'fg.faint' })}>
          <span className={css({ fontWeight: 'semibold', color: pctColor })}>
            {pct} % de couverture
          </span>{' '}
          (échantillon de {suggestion.sampleSize}) · {suggestion.fileCount} fichiers
        </p>
        {error && (
          <p role="alert" className={css({ fontSize: 'xs', color: 'red.600', mt: '1' })}>
            {error}
          </p>
        )}
      </div>
      <button
        onClick={() => void handleAdopt()}
        disabled={adopting}
        className={css({
          px: '3',
          py: '1',
          fontSize: 'xs',
          fontWeight: 'medium',
          borderRadius: 'lg',
          cursor: 'pointer',
          bg: 'violet.500',
          color: 'white',
          flexShrink: 0,
          transition: 'background-color 0.15s',
          _hover: { bg: 'violet.600' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
        })}
      >
        {adopting ? '…' : 'Adopter'}
      </button>
    </div>
  );
}
