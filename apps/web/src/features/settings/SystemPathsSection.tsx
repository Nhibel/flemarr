import { css } from '@/styled-system/css';
import type { SettingsResponse, UpdateSettings } from '@/lib/api.js';
import { displayPath } from '@/lib/paths.js';
import { sectionClass } from './styles.js';
import { Button } from '@/components/Button.js';
import { Card } from '@/components/Card.js';

/**
 * Read-only overview of the per-system folders. Each folder is chosen from
 * the system's own view (SystemFolderBar); here we only list and remove —
 * useful for cleaning up entries whose system name no longer matches a DAT.
 */
export function SystemPathsSection({
  settings,
  saving,
  onSave,
}: {
  settings: SettingsResponse;
  saving: boolean;
  onSave: (patch: UpdateSettings) => void;
}) {
  const handleRemovePath = (system: string) => {
    onSave({ systemPaths: { [system]: '' } });
  };

  const entries = Object.entries(settings.systemPaths);

  return (
    <section className={sectionClass}>
      <h2
        className={css({
          fontSize: 'base',
          fontWeight: 'semibold',
          color: 'fg.default',
          mb: '1',
        })}
      >
        Dossiers par système
      </h2>
      <p className={css({ fontSize: 'xs', color: 'fg.faint', mb: '3' })}>
        Chaque dossier se choisit depuis la vue du système concerné (bandeau « Dossier du système
        »). Cette liste sert de vue d'ensemble.
      </p>

      {entries.length === 0 ? (
        <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          Aucun dossier défini pour l'instant.
        </p>
      ) : (
        <Card className={css({ overflow: 'hidden' })}>
          {entries.map(([system, path]) => (
            <div
              key={system}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '3',
                px: '3',
                py: '2',
                borderBottom: '1px solid',
                borderColor: 'bd.subtle',
                _last: { borderBottom: 'none' },
              })}
            >
              <span
                className={css({
                  fontSize: 'sm',
                  color: 'fg.default',
                  flex: 1,
                  minW: '0',
                  truncate: true,
                })}
              >
                {system}
              </span>
              <span
                className={css({
                  fontSize: 'xs',
                  color: 'fg.faint',
                  fontFamily: 'mono',
                  flex: 1,
                  minW: '0',
                  truncate: true,
                })}
              >
                {displayPath(path, settings.romsRoot)}
              </span>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleRemovePath(system)}
                disabled={saving}
              >
                Supprimer
              </Button>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
