import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { updateSettings, validateDir } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { useSettings } from '@/lib/use-settings.js';
import { PathInput } from '@/components/PathInput.js';
import { SystemIcon } from '@/components/SystemIcon.js';
import { useSystemIcons } from '@/lib/use-system-icons.js';
import { displayPath } from '@/lib/paths.js';

/**
 * The single place where a system's library folder is chosen. The scanner
 * always reads settings.systemPaths[system]; the download destination does
 * too, but only when settings.downloadTarget is 'server' (in 'browser' mode
 * this folder is just where the scanner expects files once moved there by
 * hand). This bar is the only writer (plus the removal button in the
 * settings overview).
 */
export function SystemFolderBar({ system }: { system: string }) {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const systemIcons = useSystemIcons([system]);

  const save = useMutation({
    mutationFn: async (path: string) => {
      const result = await validateDir(path);
      if (!result.exists) throw new Error('Chemin introuvable');
      if (!result.isDirectory) throw new Error("Ce chemin existe mais n'est pas un dossier");
      return updateSettings({ systemPaths: { [system]: path } });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.settings(), updated);
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
    borderRadius: '14px',
    bg: 'bg.surface',
    shadow: 'md',
    fontSize: 'sm',
  });

  const actionClass = css({
    fontSize: 'sm',
    fontWeight: 'medium',
    color: 'accent.text',
    cursor: 'pointer',
    flexShrink: 0,
    _hover: { textDecoration: 'underline' },
    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
  });

  if (!editing) {
    return (
      <div className={barClass}>
        <SystemIcon system={system} style={systemIcons.get(system)} size={28} />
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
            {displayPath(folder, settings.romsRoot)}
          </span>
        ) : (
          <span className={css({ color: 'status.warning.text', flex: 1, minW: 0 })}>
            non défini — requis pour le scanner
            {settings.downloadTarget === 'server' ? ' et les téléchargements' : ''}
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
      <SystemIcon system={system} style={systemIcons.get(system)} size={28} />
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
          borderRadius: 'md',
          bg: 'bg.surface',
          outline: 'none',
          _focusVisible: {
            _nightdrive: {
              boxShadow: '0 0 8px #37EBF3, 0 0 16px rgba(55, 235, 243, 0.3)',
            },
            _contraste: {
              boxShadow: '0 0 8px #37EBF3, 0 0 16px rgba(55, 235, 243, 0.3)',
            },
          },
        })}
      />
      {save.error instanceof Error && (
        <span className={css({ fontSize: 'xs', color: 'status.danger.text', flexShrink: 0 })}>
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
