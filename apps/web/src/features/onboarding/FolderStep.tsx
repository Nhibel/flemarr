import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { PathInput } from '@/components/PathInput.js';
import { Button } from '@/components/Button.js';
import { getSettings, updateSettings, validateDir } from '@/lib/api.js';
import { displayPath } from '@/lib/paths.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';

/**
 * The install flow's folder step.
 *
 * Writes `settings.systemPaths[system]` — the same single value the scanner
 * reads and the server-side download destination reads. There has never
 * been a second one, and this step must not introduce one: that is the
 * whole point of asking the topology question first.
 *
 * Validation mirrors SystemFolderBar's: the path has to exist and be a
 * directory before it is saved, so a typo cannot be stored and surface
 * later as a failed scan.
 *
 * No scan here, deliberately. A scan hashes every file — minutes on a disc
 * collection — so the step reports the file count PathInput already shows
 * per folder and leaves the real verification to the Scanner tab.
 */
export function FolderStep({ system, onSaved }: { system: string; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const romsRoot = useRomsRoot();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const existing = settings?.systemPaths[system] ?? '';
  const [draft, setDraft] = useState(existing);

  const save = useMutation({
    mutationFn: async (path: string) => {
      const result = await validateDir(path);
      if (!result.exists) throw new Error('Chemin introuvable');
      if (!result.isDirectory) throw new Error("Ce chemin existe mais n'est pas un dossier");
      return updateSettings({ systemPaths: { [system]: path } });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings'], updated);
      onSaved();
    },
  });

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
      <p className={css({ fontSize: 'sm', color: 'fg.muted', lineHeight: '1.6' })}>
        Un seul dossier par console, et il sert à deux choses à la fois : reconnaître les jeux que
        tu as déjà dedans, et y ranger ceux que tu télécharges ensuite.
      </p>
      <p className={css({ fontSize: 'sm', color: 'fg.muted', lineHeight: '1.6' })}>
        Si tu as déjà une collection, pointe-la — le nombre de fichiers de chaque dossier
        t&apos;aide à la reconnaître. Sinon crée un dossier vide, on le remplira.
      </p>

      <PathInput value={draft} onChange={setDraft} placeholder="/roms/snes" />

      {existing !== '' && draft === existing && (
        <p className={css({ fontSize: 'xs', color: 'fg.faint', fontFamily: 'mono' })}>
          Dossier actuel : {displayPath(existing, romsRoot)}
        </p>
      )}

      {save.error instanceof Error && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'status.danger.text' })}>
          {save.error.message}
        </p>
      )}

      <div className={css({ display: 'flex', alignItems: 'center', gap: '3', flexWrap: 'wrap' })}>
        <Button
          variant="primary"
          onClick={() => save.mutate(draft)}
          disabled={draft.trim() === '' || save.isPending}
        >
          {save.isPending ? 'Vérification…' : 'Utiliser ce dossier'}
        </Button>
        {/* Skippable on purpose: someone starting a collection from nothing
            has no folder to point at yet, and blocking the flow on one
            would make them invent an empty directory to get past it. */}
        <button
          type="button"
          onClick={onSaved}
          className={css({
            fontSize: 'sm',
            color: 'fg.subtle',
            bg: 'transparent',
            border: 'none',
            cursor: 'pointer',
            _hover: { color: 'fg.default' },
          })}
        >
          Je n&apos;ai pas encore de collection pour cette console
        </button>
      </div>
    </div>
  );
}
