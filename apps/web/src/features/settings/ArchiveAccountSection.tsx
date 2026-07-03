import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { css, cx } from '@/styled-system/css';
import { archiveLogin } from '@/lib/api.js';
import type { Settings, UpdateSettings } from '@/lib/api.js';
import { inputClass, sectionClass } from './styles.js';

export function ArchiveAccountSection({
  settings,
  saving,
  onSave,
}: {
  settings: Settings;
  saving: boolean;
  onSave: (patch: UpdateSettings) => void;
}) {
  const queryClient = useQueryClient();
  const [accessKey, setAccessKey] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginState, setLoginState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [cookieUser, setCookieUser] = useState<string | null>(null);
  const [cookieSig, setCookieSig] = useState<string | null>(null);

  // Local state is null until the user edits — the displayed value falls back
  // to what's stored in settings.
  const shownAccessKey = accessKey ?? settings.archiveOrgAccessKey;
  const shownSecretKey = secretKey ?? settings.archiveOrgSecretKey;
  const keysDirty =
    shownAccessKey !== settings.archiveOrgAccessKey ||
    shownSecretKey !== settings.archiveOrgSecretKey;

  const handleSaveKeys = () => {
    onSave({
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
    onSave({
      archiveOrgLoggedInUser: shownCookieUser.trim(),
      archiveOrgLoggedInSig: shownCookieSig.trim(),
    });
    setCookieUser(null);
    setCookieSig(null);
  };

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
        Compte archive.org
      </h2>
      <p className={css({ fontSize: 'xs', color: 'fg.faint', mb: '3' })}>
        Débloque les collections à accès restreint (la plupart des gros sets No-Intro/Redump). Le
        mot de passe est échangé une fois contre des clés API et des cookies de session — il n'est
        jamais stocké. Clés et cookies sont gardés en clair dans la base locale.
      </p>

      {isLoggedIn && (
        <p className={css({ fontSize: 'sm', color: 'green.600', mb: '3' })}>
          ✓ Connecté à archive.org (cookies de session actifs)
        </p>
      )}

      <div
        className={css({ display: 'flex', flexDirection: 'column', gap: '2', maxW: 'md', mb: '4' })}
      >
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
            disabled={!keysDirty || saving}
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
            <span className={css({ fontSize: 'xs', color: 'green.600' })}>✓ Clés configurées</span>
          )}
        </div>
      </div>

      <p className={css({ fontSize: 'xs', color: 'fg.faint', mt: '4', mb: '2' })}>
        Cookies de session (fallback si la connexion ci-dessus ne débloque pas un item : copiez les
        cookies <code>logged-in-user</code> et <code>logged-in-sig</code> depuis les DevTools du
        navigateur, onglet Application → Cookies → archive.org) :
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
          disabled={!cookiesDirty || saving}
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
  );
}
