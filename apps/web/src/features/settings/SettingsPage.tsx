import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { css, cx } from '@/styled-system/css';
import { getSettings, updateSettings, validateDir, archiveLogin } from '@/lib/api.js';
import type { Settings } from '@/lib/api.js';
import { PathInput } from '@/components/PathInput.js';

type Fresh1g1rPreset = Settings['fresh1g1rPreset'];
const PRESETS: Fresh1g1rPreset[] = ['PropeR', 'McLean', 'Hearto'];
const PRESET_DESCRIPTIONS: Record<Fresh1g1rPreset, string> = {
  McLean: 'Anglais uniquement, jeux licenciés seulement. Sélection la plus stricte.',
  PropeR: 'Toutes langues · jeux, add-ons, bonus discs, éducatif. Officiel uniquement.',
  Hearto: 'Le plus large · toutes langues, démos, non-licenciés, proto/bêta/alpha.',
};
type ValidationState = 'idle' | 'checking' | 'valid' | 'not-found' | 'not-dir';

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

  const [newSystem, setNewSystem] = useState('');
  const [newPath, setNewPath] = useState('');
  const [validation, setValidation] = useState<ValidationState>('idle');
  const [accessKey, setAccessKey] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginState, setLoginState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [cookieUser, setCookieUser] = useState<string | null>(null);
  const [cookieSig, setCookieSig] = useState<string | null>(null);

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

  const handlePreset = (preset: Fresh1g1rPreset) => {
    mutation.mutate({ fresh1g1rPreset: preset });
  };

  const handleConcurrency = (value: number) => {
    mutation.mutate({ downloaderConcurrency: value });
  };

  const handleValidatePath = async () => {
    const path = newPath.trim();
    if (!path) return;
    setValidation('checking');
    try {
      const result = await validateDir(path);
      if (!result.exists) setValidation('not-found');
      else if (!result.isDirectory) setValidation('not-dir');
      else setValidation('valid');
    } catch {
      setValidation('not-found');
    }
  };

  const handleAddPath = () => {
    const system = newSystem.trim();
    const path = newPath.trim();
    if (!system || !path || validation !== 'valid') return;
    mutation.mutate({ systemPaths: { [system]: path } });
    setNewSystem('');
    setNewPath('');
    setValidation('idle');
  };

  const handleRemovePath = (system: string) => {
    mutation.mutate({ systemPaths: { [system]: '' } });
  };

  // Local state is null until the user edits — the displayed value falls back
  // to what's stored in settings.
  const shownAccessKey = accessKey ?? settings.archiveOrgAccessKey;
  const shownSecretKey = secretKey ?? settings.archiveOrgSecretKey;
  const keysDirty =
    shownAccessKey !== settings.archiveOrgAccessKey ||
    shownSecretKey !== settings.archiveOrgSecretKey;

  const handleSaveKeys = () => {
    mutation.mutate({
      archiveOrgAccessKey: shownAccessKey.trim(),
      archiveOrgSecretKey: shownSecretKey.trim(),
    });
    setAccessKey(null);
    setSecretKey(null);
  };

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) return;
    setLoginState('pending');
    setLoginError(null);
    try {
      await archiveLogin(loginEmail.trim(), loginPassword);
      setLoginState('done');
      setLoginPassword('');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (err) {
      setLoginState('error');
      setLoginError(err instanceof Error ? err.message : 'Erreur de connexion');
    }
  };

  const isLoggedIn = settings.archiveOrgLoggedInUser !== '';

  const shownCookieUser = cookieUser ?? settings.archiveOrgLoggedInUser;
  const shownCookieSig = cookieSig ?? settings.archiveOrgLoggedInSig;
  const cookiesDirty =
    shownCookieUser !== settings.archiveOrgLoggedInUser ||
    shownCookieSig !== settings.archiveOrgLoggedInSig;

  const handleSaveCookies = () => {
    mutation.mutate({
      archiveOrgLoggedInUser: shownCookieUser.trim(),
      archiveOrgLoggedInSig: shownCookieSig.trim(),
    });
    setCookieUser(null);
    setCookieSig(null);
  };

  const inputClass = css({
    px: '3',
    py: '1.5',
    fontSize: 'sm',
    border: '1px solid',
    borderColor: 'bd.strong',
    borderRadius: 'md',
    outline: 'none',
    bg: 'bg.page',
    color: 'fg.default',
    _focusVisible: { borderColor: 'blue.400', ring: '2px', ringColor: 'blue.100' },
  });

  const sectionClass = css({
    pb: '6',
    mb: '6',
    borderBottom: '1px solid',
    borderColor: 'bd.subtle',
    _last: { borderBottom: 'none', mb: '0', pb: '0' },
  });

  const validationHint =
    validation === 'valid'
      ? { text: '✓ Dossier trouvé', ok: true }
      : validation === 'not-found'
        ? { text: '✗ Chemin introuvable', ok: false }
        : validation === 'not-dir'
          ? { text: "✗ Ce chemin existe mais n'est pas un dossier", ok: false }
          : null;

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

      {/* Fresh1G1R preset */}
      <section className={sectionClass}>
        <h2
          className={css({
            fontSize: 'base',
            fontWeight: 'semibold',
            color: 'fg.default',
            mb: '3',
          })}
        >
          Preset Fresh1G1R
        </h2>
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5' })}>
          {PRESETS.map((p) => {
            const active = settings.fresh1g1rPreset === p;
            return (
              <button
                key={p}
                onClick={() => handlePreset(p)}
                disabled={mutation.isPending}
                className={css({
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '3',
                  px: '3',
                  py: '2',
                  textAlign: 'left',
                  borderRadius: 'md',
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: active ? 'blue.400' : 'bd.default',
                  bg: active ? 'blue.50' : 'bg.page',
                  _hover: { bg: active ? 'blue.50' : 'bg.surface' },
                  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  _dark: active ? { bg: 'blue.900', borderColor: 'blue.600' } : undefined,
                })}
              >
                <span
                  className={css({
                    fontSize: 'sm',
                    fontWeight: 'semibold',
                    flexShrink: 0,
                    color: active ? 'blue.700' : 'fg.default',
                    _dark: active ? { color: 'blue.300' } : undefined,
                    w: '16',
                  })}
                >
                  {p}
                </span>
                <span
                  className={css({
                    fontSize: 'xs',
                    color: active ? 'blue.600' : 'fg.faint',
                    _dark: active ? { color: 'blue.400' } : undefined,
                  })}
                >
                  {PRESET_DESCRIPTIONS[p]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* archive.org credentials */}
      <section className={sectionClass}>
        <h2
          className={css({
            fontSize: 'base',
            fontWeight: 'semibold',
            color: 'fg.default',
            mb: '1',
          })}
        >
          Compte archive.org
        </h2>
        <p className={css({ fontSize: 'xs', color: 'fg.faint', mb: '3' })}>
          Débloque les collections à accès restreint (la plupart des gros sets No-Intro/Redump). Le
          mot de passe est échangé une fois contre des clés API et des cookies de session — il
          n'est jamais stocké. Clés et cookies sont gardés en clair dans la base locale.
        </p>

        {isLoggedIn && (
          <p className={css({ fontSize: 'sm', color: 'green.600', mb: '3' })}>
            ✓ Connecté à archive.org (cookies de session actifs)
          </p>
        )}

        <div className={css({ display: 'flex', flexDirection: 'column', gap: '2', maxW: 'md', mb: '4' })}>
          <input
            type="email"
            placeholder="Email archive.org"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            className={inputClass}
          />
          <input
            type="password"
            placeholder="Mot de passe archive.org"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleLogin();
            }}
            className={inputClass}
          />
          <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
            <button
              onClick={() => void handleLogin()}
              disabled={loginState === 'pending' || !loginEmail.trim() || !loginPassword}
              className={css({
                alignSelf: 'flex-start',
                px: '4',
                py: '1.5',
                fontSize: 'sm',
                fontWeight: 'medium',
                bg: 'blue.500',
                color: 'white',
                borderRadius: 'md',
                cursor: 'pointer',
                _hover: { bg: 'blue.600' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {loginState === 'pending' ? 'Connexion…' : 'Se connecter'}
            </button>
            {loginState === 'done' && (
              <span className={css({ fontSize: 'xs', color: 'green.600' })}>✓ Connexion réussie</span>
            )}
          </div>
          {loginError && (
            <p role="alert" className={css({ fontSize: 'xs', color: 'red.600' })}>
              {loginError}
            </p>
          )}
        </div>

        <p className={css({ fontSize: 'xs', color: 'fg.faint', mb: '2' })}>
          Ou saisie manuelle des clés S3 (archive.org/account/s3.php) :
        </p>
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '2', maxW: 'md' })}>
          <input
            type="text"
            placeholder="Access key"
            value={shownAccessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            className={cx(css({ fontFamily: 'mono' }), inputClass)}
          />
          <input
            type="password"
            placeholder="Secret key"
            value={shownSecretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            className={cx(css({ fontFamily: 'mono' }), inputClass)}
          />
          <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
            <button
              onClick={handleSaveKeys}
              disabled={!keysDirty || mutation.isPending}
              className={css({
                alignSelf: 'flex-start',
                px: '4',
                py: '1.5',
                fontSize: 'sm',
                fontWeight: 'medium',
                bg: 'blue.500',
                color: 'white',
                borderRadius: 'md',
                cursor: 'pointer',
                _hover: { bg: 'blue.600' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              Enregistrer les clés
            </button>
            {settings.archiveOrgAccessKey !== '' && !keysDirty && (
              <span className={css({ fontSize: 'xs', color: 'green.600' })}>
                ✓ Clés configurées
              </span>
            )}
          </div>
        </div>

        <p className={css({ fontSize: 'xs', color: 'fg.faint', mt: '4', mb: '2' })}>
          Cookies de session (fallback si la connexion ci-dessus ne débloque pas un item : copiez
          les cookies <code>logged-in-user</code> et <code>logged-in-sig</code> depuis les DevTools
          du navigateur, onglet Application → Cookies → archive.org) :
        </p>
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '2', maxW: 'md' })}>
          <input
            type="text"
            placeholder="logged-in-user"
            value={shownCookieUser}
            onChange={(e) => setCookieUser(e.target.value)}
            className={cx(css({ fontFamily: 'mono' }), inputClass)}
          />
          <input
            type="password"
            placeholder="logged-in-sig"
            value={shownCookieSig}
            onChange={(e) => setCookieSig(e.target.value)}
            className={cx(css({ fontFamily: 'mono' }), inputClass)}
          />
          <button
            onClick={handleSaveCookies}
            disabled={!cookiesDirty || mutation.isPending}
            className={css({
              alignSelf: 'flex-start',
              px: '4',
              py: '1.5',
              fontSize: 'sm',
              fontWeight: 'medium',
              bg: 'blue.500',
              color: 'white',
              borderRadius: 'md',
              cursor: 'pointer',
              _hover: { bg: 'blue.600' },
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            Enregistrer les cookies
          </button>
        </div>
      </section>

      {/* Downloader concurrency */}
      <section className={sectionClass}>
        <h2
          className={css({
            fontSize: 'base',
            fontWeight: 'semibold',
            color: 'fg.default',
            mb: '1',
          })}
        >
          Téléchargements simultanés
        </h2>
        <p className={css({ fontSize: 'xs', color: 'fg.faint', mb: '3' })}>
          Nombre de fichiers téléchargés en parallèle (1–8). Archive.org est sensible aux rafales —
          2 est recommandé.
        </p>
        <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
          <input
            type="number"
            min={1}
            max={8}
            value={settings.downloaderConcurrency}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (v >= 1 && v <= 8) handleConcurrency(v);
            }}
            disabled={mutation.isPending}
            className={cx(css({ width: '16', textAlign: 'center' }), inputClass)}
          />
          <span className={css({ fontSize: 'sm', color: 'fg.subtle' })}>simultané(s)</span>
        </div>
      </section>

      {/* System paths */}
      <section className={sectionClass}>
        <h2
          className={css({
            fontSize: 'base',
            fontWeight: 'semibold',
            color: 'fg.default',
            mb: '1',
          })}
        >
          Répertoires par système
        </h2>
        <p className={css({ fontSize: 'xs', color: 'fg.faint', mb: '3' })}>
          Dossier de destination pour chaque système. Utilisé par le scanner et le téléchargeur.
        </p>

        {Object.keys(settings.systemPaths).length > 0 && (
          <div
            className={css({
              mb: '4',
              border: '1px solid',
              borderColor: 'bd.default',
              borderRadius: 'md',
              overflow: 'hidden',
            })}
          >
            {Object.entries(settings.systemPaths).map(([system, path]) => (
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
                  {path}
                </span>
                <button
                  onClick={() => handleRemovePath(system)}
                  disabled={mutation.isPending}
                  className={css({
                    fontSize: 'xs',
                    color: 'red.500',
                    cursor: 'pointer',
                    flexShrink: 0,
                    _hover: { color: 'red.700' },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new path — two-step: verify then confirm */}
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
          <input
            type="text"
            placeholder="Système (ex: Nintendo - Super Nintendo Entertainment System)"
            value={newSystem}
            onChange={(e) => setNewSystem(e.target.value)}
            className={inputClass}
          />
          <div className={css({ display: 'flex', gap: '2', alignItems: 'center' })}>
            <PathInput
              value={newPath}
              onChange={(v) => {
                setNewPath(v);
                setValidation('idle');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && validation === 'idle') void handleValidatePath();
              }}
              placeholder="Chemin absolu (ex: C:\Roms\SNES)"
              inputClassName={inputClass}
            />
            <button
              onClick={() => void handleValidatePath()}
              disabled={!newPath.trim() || validation === 'checking'}
              className={css({
                px: '3',
                py: '1.5',
                fontSize: 'sm',
                fontWeight: 'medium',
                border: '1px solid',
                borderColor: 'bd.strong',
                bg: 'bg.page',
                color: 'fg.muted',
                borderRadius: 'md',
                cursor: 'pointer',
                flexShrink: 0,
                _hover: { bg: 'bg.surface' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {validation === 'checking' ? 'Vérification…' : 'Vérifier'}
            </button>
            <button
              onClick={handleAddPath}
              disabled={!newSystem.trim() || validation !== 'valid' || mutation.isPending}
              className={css({
                px: '3',
                py: '1.5',
                fontSize: 'sm',
                fontWeight: 'medium',
                bg: 'blue.500',
                color: 'white',
                borderRadius: 'md',
                cursor: 'pointer',
                flexShrink: 0,
                _hover: { bg: 'blue.600' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              Ajouter
            </button>
          </div>
          {validationHint && (
            <p
              className={css({
                fontSize: 'xs',
                color: validationHint.ok ? 'green.600' : 'red.600',
              })}
            >
              {validationHint.text}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
