import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { getSettings, updateSettings } from '@/lib/api.js';
import { SunIcon, MoonIcon, iconBtnClass } from '@/components/icons.js';
import { PresetSection } from './PresetSection.js';
import { ArchiveAccountSection } from './ArchiveAccountSection.js';
import { ConcurrencySection } from './ConcurrencySection.js';
import { SystemPathsSection } from './SystemPathsSection.js';

interface Props {
  onClose: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

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
