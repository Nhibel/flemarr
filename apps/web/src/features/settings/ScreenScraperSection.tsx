import { useState } from 'react';
import { css, cx } from '@/styled-system/css';
import type { SettingsResponse, UpdateSettings } from '@/lib/api.js';
import { inputClass, sectionClass } from './styles.js';

const saveBtnClass = css({
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
});

export function ScreenScraperSection({
  settings,
  saving,
  onSave,
}: {
  settings: SettingsResponse;
  saving: boolean;
  onSave: (patch: UpdateSettings) => void;
}) {
  // Credentials are write-only: the server never returns them, so these
  // inputs start empty and only ever carry new values the user types.
  const [ssid, setSsid] = useState('');
  const [ssPassword, setSsPassword] = useState('');
  const [devId, setDevId] = useState('');
  const [devPassword, setDevPassword] = useState('');

  const allFilled = Boolean(ssid.trim() && ssPassword && devId.trim() && devPassword);

  const handleSave = () => {
    onSave({
      screenScraperSsid: ssid.trim(),
      screenScraperSsPassword: ssPassword,
      screenScraperDevId: devId.trim(),
      screenScraperDevPassword: devPassword,
    });
    setSsid('');
    setSsPassword('');
    setDevId('');
    setDevPassword('');
  };

  return (
    <section className={sectionClass}>
      <h2
        className={css({ fontSize: 'base', fontWeight: 'semibold', color: 'fg.default', mb: '1' })}
      >
        Compte ScreenScraper.fr
      </h2>
      <p className={css({ fontSize: 'xs', color: 'fg.faint', mb: '3' })}>
        Alimente le mode d'affichage détaillé (descriptif, année, genre, éditeur). Nécessite un
        compte utilisateur <em>et</em> un identifiant développeur approuvé (demande sur leur forum).
        Les identifiants restent côté serveur : ils ne sont jamais renvoyés au navigateur.
      </p>

      {settings.screenScraperConfigured && (
        <p className={css({ fontSize: 'sm', color: 'green.600', mb: '3' })}>
          ✓ Compte ScreenScraper configuré
        </p>
      )}

      <div
        className={css({ display: 'flex', flexDirection: 'column', gap: '2', maxW: 'md', mb: '4' })}
      >
        <input
          type="text"
          placeholder={settings.screenScraperConfigured ? 'ssid (déjà configuré)' : 'ssid (pseudo)'}
          value={ssid}
          onChange={(e) => setSsid(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder="Mot de passe utilisateur"
          value={ssPassword}
          onChange={(e) => setSsPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder={settings.screenScraperConfigured ? 'devid (déjà configuré)' : 'devid'}
          value={devId}
          onChange={(e) => setDevId(e.target.value)}
          className={cx(css({ fontFamily: 'mono' }), inputClass)}
        />
        <input
          type="password"
          placeholder="devpassword"
          value={devPassword}
          onChange={(e) => setDevPassword(e.target.value)}
          className={cx(css({ fontFamily: 'mono' }), inputClass)}
        />
        <button onClick={handleSave} disabled={!allFilled || saving} className={saveBtnClass}>
          Enregistrer le compte
        </button>
      </div>

      <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
        <span className={css({ fontSize: 'sm', color: 'fg.default' })}>Langue des descriptifs</span>
        <select
          value={settings.descriptionLanguage}
          onChange={(e) => onSave({ descriptionLanguage: e.target.value as 'fr' | 'en' })}
          disabled={saving}
          className={css({
            px: '2',
            py: '1',
            border: '1px solid',
            borderColor: 'bd.strong',
            borderRadius: 'md',
            fontSize: 'sm',
            cursor: 'pointer',
            bg: 'bg.page',
            color: 'fg.default',
          })}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>
    </section>
  );
}
