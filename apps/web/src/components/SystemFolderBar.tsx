import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { getSettings, updateSettings, validateDir } from '@/lib/api.js';
import { PathInput } from '@/components/PathInput.js';

/**
 * The single place where a system's library folder is chosen. The scanner and
 * the download destination both read settings.systemPaths[system]; this bar
 * is the only writer (plus the removal button in the settings overview).
 */
export function SystemFolderBar({ system }: { system: string }) {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const save = useMutation({
    mutationFn: async (path: string) => {
      const result = await validateDir(path);
      if (!result.exists) throw new Error('Chemin introuvable');
      if (!result.isDirectory) throw new Error("Ce chemin existe mais n'est pas un dossier");
      return updateSettings({ systemPaths: { [system]: path } });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings'], updated);
      setEditing(false);
    },
  });

  if (settings === undefined) return null;
  const folder = settings.systemPaths[system] ?? '';

  const barClass = css({
    display: 'flex',
    alignItems: 'center',
    gap: '2',
    px: '3',
    py: '2',
    mb: '4',
    border: '1px solid',
    borderColor: 'bd.default',
    borderRadius: 'md',
    bg: 'bg.surface',
    fontSize: 'sm',
  });

  const actionClass = css({
    fontSize: 'sm',
    fontWeight: 'medium',
    color: 'blue.600',
    cursor: 'pointer',
    flexShrink: 0,
    _hover: { textDecoration: 'underline' },
    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
    _dark: { color: 'blue.400' },
  });

  if (!editing) {
    return (
      <div className={barClass}>
        <span className={css({ color: 'fg.subtle', flexShrink: 0 })}>Dossier du système :</span>
        {folder ? (
          <span
            className={css({
              fontFamily: 'mono',
              color: 'fg.default',
              flex: 1,
              minW: 0,
              truncate: true,
            })}
          >
            {folder}
          </span>
        ) : (
          <span className={css({ color: 'amber.600', flex: 1, minW: 0 })}>
            non défini — requis pour le scanner et les téléchargements
          </span>
        )}
        <button
          onClick={() => {
            setDraft(folder);
            save.reset();
            setEditing(true);
          }}
          className={actionClass}
        >
          {folder ? 'Modifier' : 'Choisir…'}
        </button>
      </div>
    );
  }

  return (
    <div className={barClass}>
      <span className={css({ color: 'fg.subtle', flexShrink: 0 })}>Dossier du système :</span>
      <PathInput
        value={draft}
        onChange={(v) => {
          setDraft(v);
          save.reset();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) save.mutate(draft.trim());
        }}
        placeholder="Choisir ou créer un dossier"
        inputClassName={css({
          px: '2.5',
          py: '1',
          fontSize: 'sm',
          fontFamily: 'mono',
          border: '1px solid',
          borderColor: 'bd.strong',
          borderRadius: 'md',
          bg: 'bg.page',
          outline: 'none',
          _focusVisible: { borderColor: 'blue.400' },
        })}
      />
      {save.error instanceof Error && (
        <span className={css({ fontSize: 'xs', color: 'red.600', flexShrink: 0 })}>
          {save.error.message}
        </span>
      )}
      <button
        onClick={() => save.mutate(draft.trim())}
        disabled={!draft.trim() || save.isPending}
        className={actionClass}
      >
        {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
      <button
        onClick={() => setEditing(false)}
        className={css({
          fontSize: 'sm',
          color: 'fg.faint',
          cursor: 'pointer',
          flexShrink: 0,
          _hover: { color: 'fg.default' },
        })}
      >
        Annuler
      </button>
    </div>
  );
}
