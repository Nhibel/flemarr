import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@/lib/api.js';
import type { SettingsResponse } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { ArchiveAccountSection } from '../ArchiveAccountSection.js';

vi.mock('@/lib/api.js');

const SETTINGS: SettingsResponse = {
  fresh1g1rPreset: 'PropeR',
  downloaderConcurrency: 2,
  systemPaths: {},
  archiveOrgKeysConfigured: false,
  archiveOrgSessionConfigured: false,
  downloadTarget: 'server',
  topology: 'local',
  autoConvertChd: false,
  romsRoot: null,
};

function renderSection(settings: Partial<SettingsResponse> = {}, saving = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const onSave = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ArchiveAccountSection
        settings={{ ...SETTINGS, ...settings }}
        saving={saving}
        onSave={onSave}
      />
    </QueryClientProvider>,
  );
  return { onSave, invalidate };
}

beforeEach(() => {
  vi.mocked(api.archiveLogin).mockReset();
});

describe('ArchiveAccountSection — login', () => {
  it('needs both an email and a password', async () => {
    renderSection();
    const login = screen.getByRole('button', { name: 'Se connecter' });
    expect(login).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('Email archive.org'), 'me@example.com');
    expect(login).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('Mot de passe archive.org'), 'secret');
    expect(login).toBeEnabled();
  });

  // The password is exchanged once, then forgotten; settings refetch to show the session.
  it('logs in, clears the password and refreshes the settings', async () => {
    vi.mocked(api.archiveLogin).mockResolvedValue(undefined);
    const { invalidate } = renderSection();
    await userEvent.type(screen.getByPlaceholderText('Email archive.org'), ' me@example.com ');
    const password = screen.getByPlaceholderText('Mot de passe archive.org');
    await userEvent.type(password, 'secret{Enter}');
    expect(await screen.findByText('✓ Connexion réussie')).toBeInTheDocument();
    expect(api.archiveLogin).toHaveBeenCalledWith('me@example.com', 'secret');
    expect(password).toHaveValue('');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.settings() });
  });

  it('shows a failed login', async () => {
    vi.mocked(api.archiveLogin).mockRejectedValue(new Error('Identifiants refusés'));
    renderSection();
    await userEvent.type(screen.getByPlaceholderText('Email archive.org'), 'me@example.com');
    await userEvent.type(screen.getByPlaceholderText('Mot de passe archive.org'), 'bad{Enter}');
    expect(await screen.findByText('Identifiants refusés')).toBeInTheDocument();
  });

  it('says when a session is already active', () => {
    renderSection({ archiveOrgSessionConfigured: true });
    expect(screen.getByText(/Connecté à archive.org/)).toBeInTheDocument();
  });
});

describe('ArchiveAccountSection — keys and cookies', () => {
  it('saves trimmed S3 keys, then empties the fields', async () => {
    const { onSave } = renderSection();
    const access = screen.getByPlaceholderText('Access key');
    await userEvent.type(access, ' AK ');
    await userEvent.type(screen.getByPlaceholderText('Secret key'), ' SK ');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les clés' }));
    expect(onSave).toHaveBeenCalledWith({ archiveOrgAccessKey: 'AK', archiveOrgSecretKey: 'SK' });
    expect(access).toHaveValue('');
  });

  // The server never returns stored keys: the fields only hint they exist.
  it('hints at keys already configured without showing them', () => {
    renderSection({ archiveOrgKeysConfigured: true });
    expect(screen.getByPlaceholderText('Access key (déjà configurée)')).toHaveValue('');
    expect(screen.getByText('✓ Clés configurées')).toBeInTheDocument();
  });

  it('saves trimmed session cookies', async () => {
    const { onSave } = renderSection();
    await userEvent.type(screen.getByPlaceholderText('logged-in-user'), ' me ');
    await userEvent.type(screen.getByPlaceholderText('logged-in-sig'), ' sig ');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer les cookies' }));
    expect(onSave).toHaveBeenCalledWith({
      archiveOrgLoggedInUser: 'me',
      archiveOrgLoggedInSig: 'sig',
    });
  });

  it('locks the saves while settings are being written', async () => {
    renderSection({}, true);
    await userEvent.type(screen.getByPlaceholderText('Access key'), 'AK');
    await userEvent.type(screen.getByPlaceholderText('Secret key'), 'SK');
    expect(screen.getByRole('button', { name: 'Enregistrer les clés' })).toBeDisabled();
  });
});
