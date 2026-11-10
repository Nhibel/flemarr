import { useState } from 'react';
import { css } from '@/styled-system/css';
import type { SearchResponse } from '@/lib/api.js';

export function SearchResultRow({
  result,
  onAdd,
  configured = false,
}: {
  result: SearchResponse['results'][number];
  onAdd: (identifier: string, note: string) => Promise<void>;
  /** Already a source for this system — adding it again would be a no-op. */
  configured?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setAdding(true);
    setError(null);
    try {
      await onAdd(result.identifier, result.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setAdding(false);
    }
  };

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '3',
        px: '3',
        py: '2',
        borderBottom: '1px solid',
        borderColor: 'bd.subtle',
        bg: 'bg.page',
        _last: { borderBottom: 'none' },
      })}
    >
      <div className={css({ flex: 1, minW: 0 })}>
        <span className={css({ fontFamily: 'mono', color: 'accent.text', display: 'block' })}>
          {result.identifier}
        </span>
        {result.title !== result.identifier && (
          <span className={css({ color: 'fg.subtle', fontSize: 'xs' })}>{result.title}</span>
        )}
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
          onClick={() => void handleAdd()}
          disabled={adding}
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
          {adding ? '…' : 'Ajouter'}
        </button>
      )}
    </div>
  );
}
