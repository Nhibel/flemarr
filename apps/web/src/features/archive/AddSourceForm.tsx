import { useState } from 'react';
import { css } from '@/styled-system/css';
import { addSource, searchArchive, previewIndex } from '@/lib/api.js';
import type { ArchiveLayout, SearchResponse } from '@/lib/api.js';
import type { DatSource } from './SourcesPanel.js';
import { Button } from '@/components/Button.js';
import { SearchResultRow } from './SearchResultRow.js';
import { seriesBase } from '@/lib/archive-series.js';

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
  onAdded,
  configured,
}: {
  system: string;
  source: DatSource;
  onDone: () => void;
  /** A search-result row was added directly — refresh the source list, but
   *  keep the form open (there may be other parts of the same series left). */
  onAdded: () => void;
  /** Identifiers already configured for this system — shown as "✓ Déjà ajoutée". */
  configured?: Set<string>;
}) {
  const [identifier, setIdentifier] = useState('');
  const [layout, setLayout] = useState<LayoutChoice>('auto');
  const [note, setNote] = useState('');
  const [searchQ, setSearchQ] = useState(() => defaultSearchQuery(system, source));
  const [seriesMode, setSeriesMode] = useState(false);
  // null means "no search run yet"; [] means "searched, found nothing" — the
  // two have to read differently, or a fruitless search looks like a dead button.
  const [searchResults, setSearchResults] = useState<SearchResponse['results'] | null>(null);
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
      let results = res.results;

      // A collection can be split across several items with no fixed naming
      // convention ("sony_playstation_part1".."part5" on archive.org) — the
      // normal text search surfaces an arbitrary subset of them. Once one
      // sibling is found, a prefix search for the rest (a trailing "*" is
      // already plain archive.org query syntax, verified directly against
      // advancedsearch.php) finds the others without the user having to know
      // the naming pattern or type a wildcard by hand.
      if (seriesMode) {
        const bases = new Set(
          results.map((r) => seriesBase(r.identifier)).filter((b): b is string => b !== null),
        );
        if (bases.size > 0) {
          const extraBatches = await Promise.all([...bases].map((b) => searchArchive(`${b}*`)));
          const merged = new Map(results.map((r) => [r.identifier, r]));
          for (const batch of extraBatches) {
            for (const r of batch.results) merged.set(r.identifier, r);
          }
          results = [...merged.values()];
        }
      }

      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recherche échouée');
      // Keeping the previous hits under an error message would suggest they
      // answer the query that just failed.
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  };

  // Shared by the manual "Ajouter la source" button below and each search
  // result's own "Ajouter" — detect the layout when asked to, then add.
  const resolveLayoutAndAdd = async (
    targetIdentifier: string,
    targetLayout: LayoutChoice,
    targetNote: string,
  ) => {
    let resolvedLayout: ArchiveLayout;
    if (targetLayout === 'auto') {
      // The index fetch tells us how the collection stores its ROMs
      const idx = await previewIndex(targetIdentifier);
      resolvedLayout = idx.suggestedLayout;
    } else {
      resolvedLayout = targetLayout;
    }
    await addSource(system, { identifier: targetIdentifier, layout: resolvedLayout, note: targetNote });
  };

  const handleSave = async () => {
    if (!identifier.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await resolveLayoutAndAdd(identifier.trim(), layout, note);
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

  // Each search result adds itself independently (auto layout detection,
  // like the manual field above) — the form stays open so the rest of a
  // found series can be added right after.
  const handleAddFromSearch = async (resultIdentifier: string, resultNote: string) => {
    await resolveLayoutAndAdd(resultIdentifier, 'auto', resultNote);
    onAdded();
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

        <label
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            mt: '2',
            fontSize: 'xs',
            color: 'fg.subtle',
            cursor: 'pointer',
          })}
        >
          <input
            type="checkbox"
            checked={seriesMode}
            onChange={(e) => setSeriesMode(e.target.checked)}
          />
          Chercher toute la série (collection découpée en plusieurs parties/disques)
        </label>

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
              <SearchResultRow
                key={r.identifier}
                result={r}
                onAdd={handleAddFromSearch}
                configured={configured?.has(r.identifier) ?? false}
              />
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
