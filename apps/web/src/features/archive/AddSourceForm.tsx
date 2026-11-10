import { useState } from 'react';
import { css } from '@/styled-system/css';
import { addSource, searchArchive, previewIndex } from '@/lib/api.js';
import type { ArchiveLayout } from '@/lib/api.js';
import type { DatSource } from './SourcesPanel.js';
import { Button } from '@/components/Button.js';

// "Nintendo - Super Nintendo Entertainment System (Retool)" → "Super Nintendo
// Entertainment System" — vendor prefix and trailing tags pollute the search
function shortSystemName(system: string): string {
  let name = system.replace(/^[^-]+-\s*/, '').trim() || system;
  for (;;) {
    const stripped = name.replace(/\s*\([^)]*\)$/, '').trim();
    if (stripped === name || stripped === '') break;
    name = stripped;
  }
  return name || system;
}

function defaultSearchQuery(system: string, source: DatSource): string {
  return `${source === 'redump' ? 'Redump' : 'No-Intro'} ${shortSystemName(system)}`;
}

type LayoutChoice = ArchiveLayout | 'auto';

export function AddSourceForm({
  system,
  source,
  onDone,
}: {
  system: string;
  source: DatSource;
  onDone: () => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [layout, setLayout] = useState<LayoutChoice>('auto');
  const [note, setNote] = useState('');
  const [searchQ, setSearchQ] = useState(() => defaultSearchQuery(system, source));
  // null means "no search run yet"; [] means "searched, found nothing" — the
  // two have to read differently, or a fruitless search looks like a dead button.
  const [searchResults, setSearchResults] = useState<
    { identifier: string; title: string; description: string }[] | null
  >(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const query = searchQ.trim();
    // The Enter key reaches here too, and the button being disabled does not
    // stop it: without this guard two searches overlap, and since archive.org
    // gives no response-time guarantee the slower one overwrites the newer
    // results.
    if (!query || searching) return;
    setSearching(true);
    setError(null);
    try {
      const res = await searchArchive(query);
      setSearchResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recherche échouée');
      // Keeping the previous hits under an error message would suggest they
      // answer the query that just failed.
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    if (!identifier.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let resolvedLayout: ArchiveLayout;
      if (layout === 'auto') {
        // The index fetch tells us how the collection stores its ROMs
        const idx = await previewIndex(identifier.trim());
        resolvedLayout = idx.suggestedLayout;
      } else {
        resolvedLayout = layout;
      }
      await addSource(system, { identifier: identifier.trim(), layout: resolvedLayout, note });
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur';
      setError(
        layout === 'auto'
          ? `${message} — impossible de détecter le layout, choisissez-le manuellement`
          : message,
      );
      setSaving(false);
    }
  };

  return (
    <div
      className={css({
        mb: '4',
        p: '4',
        border: '1px solid',
        borderColor: 'accent.subtleBorder',
        borderRadius: 'xl',
        bg: 'accent.subtle',
        display: 'flex',
        flexDirection: 'column',
        gap: '3',
      })}
    >
      {/* Search */}
      <div>
        <p className={css({ fontSize: 'xs', color: 'fg.subtle', mb: '1.5' })}>
          Rechercher sur archive.org (optionnel)
        </p>
        <div className={css({ display: 'flex', gap: '2' })}>
          <input
            type="text"
            placeholder={`ex. "No-Intro SNES" ou "Redump PS2"`}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSearch();
            }}
            className={css({
              flex: 1,
              px: '2.5',
              py: '1.5',
              fontSize: 'sm',
              border: '1px solid',
              borderColor: 'bd.strong',
              borderRadius: 'md',
              bg: 'bg.page',
              outline: 'none',
              _focusVisible: { borderColor: 'accent.hover' },
            })}
          />
          <Button
            variant="secondary"
            onClick={() => void handleSearch()}
            disabled={searching || !searchQ.trim()}
          >
            {searching ? '…' : 'Chercher'}
          </Button>
        </div>

        {searchResults !== null && searchResults.length === 0 && !searching && (
          <p className={css({ fontSize: 'xs', color: 'fg.faint', mt: '2' })}>
            Aucune collection trouvée pour « {searchQ.trim()} ». Essayez un autre libellé, ou
            saisissez l’identifiant de l’item directement ci-dessous.
          </p>
        )}

        {searchResults !== null && searchResults.length > 0 && (
          <div
            className={css({
              mt: '2',
              border: '1px solid',
              borderColor: 'bd.default',
              borderRadius: 'md',
              bg: 'bg.page',
              maxH: '48',
              overflowY: 'auto',
            })}
          >
            {searchResults.map((r) => (
              <button
                key={r.identifier}
                onClick={() => {
                  setIdentifier(r.identifier);
                  setNote(r.title);
                  setSearchResults(null);
                }}
                className={css({
                  display: 'block',
                  w: 'full',
                  textAlign: 'left',
                  px: '3',
                  py: '2',
                  fontSize: 'sm',
                  borderBottom: '1px solid',
                  borderColor: 'bd.subtle',
                  cursor: 'pointer',
                  _hover: { bg: 'accent.subtle' },
                  _last: { borderBottom: 'none' },
                })}
              >
                <span
                  className={css({ fontFamily: 'mono', color: 'accent.text', display: 'block' })}
                >
                  {r.identifier}
                </span>
                {r.title !== r.identifier && (
                  <span className={css({ color: 'fg.subtle', fontSize: 'xs' })}>{r.title}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual fields */}
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
        <p className={css({ fontSize: 'xs', color: 'fg.subtle' })}>
          L’identifiant de la collection, c’est-à-dire la fin de son URL : archive.org/details/
          <strong>sony_playstation_part1</strong>. Ce n’est pas votre compte archive.org, qui se
          règle dans Paramètres.
        </p>
        <div className={css({ display: 'flex', gap: '2' })}>
          <input
            type="text"
            placeholder="Identifiant de l’item (ex. sony_playstation_part1)"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={css({
              flex: 1,
              px: '2.5',
              py: '1.5',
              fontSize: 'sm',
              border: '1px solid',
              borderColor: 'bd.strong',
              borderRadius: 'md',
              bg: 'bg.page',
              outline: 'none',
              fontFamily: 'mono',
              _focusVisible: { borderColor: 'accent.hover' },
            })}
          />
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as LayoutChoice)}
            className={css({
              px: '2.5',
              py: '1.5',
              fontSize: 'sm',
              border: '1px solid',
              borderColor: 'bd.strong',
              borderRadius: 'md',
              bg: 'bg.page',
              cursor: 'pointer',
            })}
          >
            <option value="auto">layout auto</option>
            <option value="direct">direct</option>
            <option value="zip-collection">zip-collection</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="Note (optionnelle)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={css({
            px: '2.5',
            py: '1.5',
            fontSize: 'sm',
            border: '1px solid',
            borderColor: 'bd.strong',
            borderRadius: 'md',
            bg: 'bg.page',
            outline: 'none',
            _focusVisible: { borderColor: 'accent.hover' },
          })}
        />
      </div>

      {error && (
        <p role="alert" className={css({ fontSize: 'xs', color: 'status.danger.text' })}>
          {error}
        </p>
      )}

      <Button
        onClick={() => void handleSave()}
        disabled={saving || !identifier.trim()}
        className={css({ alignSelf: 'flex-start' })}
      >
        {saving ? 'Ajout…' : 'Ajouter la source'}
      </Button>
    </div>
  );
}
