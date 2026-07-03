import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { getSettings, updateSettings } from '@/lib/api.js';
import { PresetSection } from './PresetSection.js';
import { ArchiveAccountSection } from './ArchiveAccountSection.js';
import { ConcurrencySection } from './ConcurrencySection.js';
import { SystemPathsSection } from './SystemPathsSection.js';

interface Props {
  onClose: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

const iconBtnClass = css({
  color: 'fg.faint',
  cursor: 'pointer',
  p: '1',
  borderRadius: 'md',
  _hover: { color: 'fg.muted', bg: 'bg.muted' },
});

export function SettingsPage({ onClose, theme, onToggleTheme }: Props) {
  const queryClient = useQueryClient();
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings'], updated);
    },
  });

  if (isLoading) {
    return (
      <main className={css({ maxW: '2xl', mx: 'auto', mt: '16', px: '6' })}>
        <p className={css({ color: 'fg.faint', fontSize: 'sm' })}>Chargement…</p>
      </main>
    );
  }

  if (error instanceof Error || !settings) {
    return (
      <main className={css({ maxW: '2xl', mx: 'auto', mt: '16', px: '6' })}>
        <p role="alert" className={css({ color: 'red.600', fontSize: 'sm' })}>
          {error instanceof Error ? error.message : 'Erreur de chargement'}
        </p>
      </main>
    );
  }

  return (
    <main className={css({ maxW: '2xl', mx: 'auto', mt: '16', px: '6', pb: '12' })}>
      <div className={css({ display: 'flex', alignItems: 'baseline', gap: '4', mb: '8' })}>
        <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'fg.heading', flex: 1 })}>
          Paramètres
        </h1>
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          className={iconBtnClass}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <button
          onClick={onClose}
          className={css({
            fontSize: 'sm',
            color: 'blue.600',
            cursor: 'pointer',
            _hover: { textDecoration: 'underline' },
            _dark: { color: 'blue.400' },
          })}
        >
          ← Retour
        </button>
      </div>

      {mutation.isError && (
        <p role="alert" className={css({ mb: '4', fontSize: 'sm', color: 'red.600' })}>
          {mutation.error instanceof Error ? mutation.error.message : 'Erreur de sauvegarde'}
        </p>
      )}

      <PresetSection settings={settings} saving={mutation.isPending} onSave={mutation.mutate} />
      <ArchiveAccountSection
        settings={settings}
        saving={mutation.isPending}
        onSave={mutation.mutate}
      />
      <ConcurrencySection
        settings={settings}
        saving={mutation.isPending}
        onSave={mutation.mutate}
      />
      <SystemPathsSection
        settings={settings}
        saving={mutation.isPending}
        onSave={mutation.mutate}
      />
    </main>
  );
}
