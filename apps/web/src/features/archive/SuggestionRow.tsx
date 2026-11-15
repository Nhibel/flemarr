import { useState } from 'react';
import { css } from '@/styled-system/css';
import type { SuggestResponse } from '@/lib/api.js';
import { LayoutBadge } from './LayoutBadge.js';

export function SuggestionRow({
  suggestion,
  onAdopt,
  configured = false,
}: {
  suggestion: SuggestResponse['suggestions'][number];
  onAdopt: () => Promise<void>;
  /** Already a source for this system — adopting it again would be a no-op. */
  configured?: boolean;
}) {
  const [adopting, setAdopting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const crcPct = Math.round(suggestion.crcCoverage * 100);
  // coverage includes crcCoverage — the remainder is the name-only subset.
  const nameOnlyPct = Math.round((suggestion.coverage - suggestion.crcCoverage) * 100);
  // Colored on the CRC-verified fraction, not the blended one: a source
  // that's mostly name-only guesses shouldn't look reassuringly green.
  const pctColor =
    crcPct >= 80
      ? 'status.success.text'
      : crcPct >= 40
        ? 'status.warning.text'
        : 'status.danger.text';

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
            {crcPct} % CRC vérifié
          </span>
          {nameOnlyPct > 0 && (
            <span className={css({ color: 'fg.subtle' })}> + {nameOnlyPct} % nom seul</span>
          )}{' '}
          (échantillon de {suggestion.sampleSize} jeux) · {suggestion.fileCount} fichiers dans
          l’item
        </p>
        {error && (
          <p role="alert" className={css({ fontSize: 'xs', color: 'status.danger.text', mt: '1' })}>
            {error}
          </p>
        )}
      </div>
      {configured ? (
        <span
          className={css({
            fontSize: 'xs',
            fontWeight: 'medium',
            color: 'status.success.text',
            flexShrink: 0,
          })}
        >
          ✓ Déjà ajoutée
        </span>
      ) : (
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
            bg: 'accent2.solid',
            color: 'accent2.fg',
            flexShrink: 0,
            transition: 'background-color 0.15s',
            _hover: { bg: 'accent2.hover' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {adopting ? '…' : 'Adopter'}
        </button>
      )}
    </div>
  );
}
