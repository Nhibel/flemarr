import { useState } from 'react';
import { css } from '@/styled-system/css';
import { previewIndex } from '@/lib/api.js';
import type { ArchiveSource } from '@/lib/api.js';
import { LayoutBadge } from './LayoutBadge.js';
import { Button } from '@/components/Button.js';
import { Card } from '@/components/Card.js';

export function SourceRow({
  source,
  onRemove,
  removing = false,
  removeError = null,
}: {
  source: ArchiveSource;
  onRemove: () => void;
  /** A delete is in flight for this source — don't let a second one fire. */
  removing?: boolean;
  /** Why the last delete of this source failed, if it did. */
  removeError?: string | null;
}) {
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
    <Card className={css({ display: 'flex', alignItems: 'flex-start', gap: '3', p: '3' })}>
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
          <p role="alert" className={css({ fontSize: 'xs', color: 'red.600', mt: '1' })}>
            {testError}
          </p>
        )}
        {removeError && (
          <p role="alert" className={css({ fontSize: 'xs', color: 'red.600', mt: '1' })}>
            Suppression échouée : {removeError}
          </p>
        )}
      </div>
      <div className={css({ display: 'flex', gap: '2', flexShrink: 0 })}>
        <Button variant="secondary" size="sm" onClick={() => void handleTest()} disabled={testing}>
          {testing ? '…' : 'Tester'}
        </Button>
        <Button variant="danger" size="sm" onClick={onRemove} disabled={removing}>
          {removing ? '…' : 'Supprimer'}
        </Button>
      </div>
    </Card>
  );
}
