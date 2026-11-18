import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { css, cx } from '@/styled-system/css';
import { archiveLogin } from '@/lib/api.js';
import type { SettingsResponse, UpdateSettings } from '@/lib/api.js';
import { inputClass, sectionClass } from './styles.js';
import { Button } from '@/components/Button.js';

export function ArchiveAccountSection({
  settings,
  saving,
  onSave,
}: {
  settings: SettingsResponse;
  saving: boolean;
  onSave: (patch: UpdateSettings) => void;
}) {
  const queryClient = useQueryClient();
  // Credentials are write-only: the server never returns them, so these
  // inputs start empty and only ever carry new values the user types.
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginState, setLoginState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [cookieUser, setCookieUser] = useState('');
  const [cookieSig, setCookieSig] = useState('');

  const handleSaveKeys = () => {
    onSave({
      archiveOrgAccessKey: accessKey.trim(),
      archiveOrgSecretKey: secretKey.trim(),
    });
    setAccessKey('');
    setSecretKey('');
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

  const handleSaveCookies = () => {
    onSave({
      archiveOrgLoggedInUser: cookieUser.trim(),
      archiveOrgLoggedInSig: cookieSig.trim(),
    });
    setCookieUser('');
    setCookieSig('');
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
        jamais stocké. Clés et cookies restent côté serveur : ils ne sont jamais renvoyés au
        navigateur.
      </p>

      {settings.archiveOrgSessionConfigured && (
        <p className={css({ fontSize: 'sm', color: 'status.success.text', mb: '3' })}>
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
          <Button
            onClick={() => void handleLogin()}
            disabled={loginState === 'pending' || !loginEmail.trim() || !loginPassword}
            className={css({ alignSelf: 'flex-start' })}
          >
            {loginState === 'pending' ? 'Connexion…' : 'Se connecter'}
          </Button>
          {loginState === 'done' && (
            <span className={css({ fontSize: 'xs', color: 'status.success.text' })}>
              ✓ Connexion réussie
            </span>
          )}
        </div>
        {loginError && (
          <p role="alert" className={css({ fontSize: 'xs', color: 'status.danger.text' })}>
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
          placeholder={
            settings.archiveOrgKeysConfigured ? 'Access key (déjà configurée)' : 'Access key'
          }
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
          className={cx(css({ fontFamily: 'mono' }), inputClass)}
        />
        <input
          type="password"
          placeholder={
            settings.archiveOrgKeysConfigured ? 'Secret key (déjà configurée)' : 'Secret key'
          }
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          className={cx(css({ fontFamily: 'mono' }), inputClass)}
        />
        <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
          <Button
            onClick={handleSaveKeys}
            disabled={!accessKey.trim() || !secretKey.trim() || saving}
            className={css({ alignSelf: 'flex-start' })}
          >
            Enregistrer les clés
          </Button>
          {settings.archiveOrgKeysConfigured && (
            <span className={css({ fontSize: 'xs', color: 'status.success.text' })}>
              ✓ Clés configurées
            </span>
          )}
        </div>
      </div>

      <p className={css({ fontSize: 'xs', color: 'fg.faint', mt: '4', mb: '2' })}>
        Cookies de session (fallback si la connexion ci-dessus ne débloque pas un item : copie les
        cookies <code>logged-in-user</code> et <code>logged-in-sig</code> depuis les DevTools du
        navigateur, onglet Application → Cookies → archive.org) :
      </p>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '2', maxW: 'md' })}>
        <input
          type="text"
          placeholder="logged-in-user"
          value={cookieUser}
          onChange={(e) => setCookieUser(e.target.value)}
          className={cx(css({ fontFamily: 'mono' }), inputClass)}
        />
        <input
          type="password"
          placeholder="logged-in-sig"
          value={cookieSig}
          onChange={(e) => setCookieSig(e.target.value)}
          className={cx(css({ fontFamily: 'mono' }), inputClass)}
        />
        <Button
          onClick={handleSaveCookies}
          disabled={!cookieUser.trim() || !cookieSig.trim() || saving}
          className={css({ alignSelf: 'flex-start' })}
        >
          Enregistrer les cookies
        </Button>
      </div>
    </section>
  );
}
