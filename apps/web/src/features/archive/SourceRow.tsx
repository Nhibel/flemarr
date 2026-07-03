import { useState } from 'react';
import { css } from '@/styled-system/css';
import { previewIndex } from '@/lib/api.js';
import type { ArchiveSource } from '@/lib/api.js';
import { LayoutBadge } from './LayoutBadge.js';

export function SourceRow({ source, onRemove }: { source: ArchiveSource; onRemove: () => void }) {
  const [preview, setPreview] = useState<{ fileCount: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestError(null);
    try {
      const result = await previewIndex(source.identifier);
      setPreview({ fileCount: result.fileCount });
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'flex-start',
        gap: '3',
        p: '3',
        border: '1px solid',
        borderColor: 'bd.default',
        borderRadius: 'md',
        bg: 'bg.page',
      })}
    >
      <div className={css({ flex: 1, minW: 0 })}>
        <div className={css({ display: 'flex', alignItems: 'center', gap: '2', mb: '0.5' })}>
          <span
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'fg.heading',
              fontFamily: 'mono',
            })}
          >
            {source.identifier}
          </span>
          <LayoutBadge layout={source.layout} />
        </div>
        {source.note && <p className={css({ fontSize: 'xs', color: 'fg.faint' })}>{source.note}</p>}
        {preview && (
          <p className={css({ fontSize: 'xs', color: 'green.600', mt: '1' })}>
            ✓ {preview.fileCount} fichiers trouvés
          </p>
        )}
        {testError && (
          <p className={css({ fontSize: 'xs', color: 'red.600', mt: '1' })}>{testError}</p>
        )}
      </div>
      <div className={css({ display: 'flex', gap: '2', flexShrink: 0 })}>
        <button
          onClick={() => void handleTest()}
          disabled={testing}
          className={css({
            px: '2.5',
            py: '1',
            fontSize: 'xs',
            borderRadius: 'md',
            cursor: 'pointer',
            border: '1px solid',
            borderColor: 'bd.strong',
            color: 'fg.muted',
            _hover: { bg: 'bg.surface' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {testing ? '…' : 'Tester'}
        </button>
        <button
          onClick={onRemove}
          className={css({
            px: '2.5',
            py: '1',
            fontSize: 'xs',
            borderRadius: 'md',
            cursor: 'pointer',
            border: '1px solid',
            borderColor: 'red.200',
            color: 'red.600',
            _hover: { bg: 'red.50' },
          })}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
