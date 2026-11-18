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
  // Collapsed by default — the manual identifier field sat directly under the
  // search results, which read as "refine your search here" even though it's
  // a separate, unrelated way to add a source. Hiding it behind an explicit
  // toggle removes that false adjacency.
  const [showManual, setShowManual] = useState(false);
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
  //
  // previewIndex always runs, even when the layout is given explicitly and
  // its own suggestion goes unused: it's also the only thing that confirms
  // the identifier actually exists on archive.org. A typo'd or made-up
  // identifier (archive.org's own metadata endpoint returns 200 with an
  // empty `{}` for one, not a 404) used to only surface later, as "this
  // source never finds anything" — indistinguishable from a real source
  // that legitimately doesn't have the game, with no error anywhere. Now a
  // bad identifier is rejected right here, for every layout choice.
  const resolveLayoutAndAdd = async (
    targetIdentifier: string,
    targetLayout: LayoutChoice,
    targetNote: string,
  ) => {
    const idx = await previewIndex(targetIdentifier);
    const resolvedLayout: ArchiveLayout =
      targetLayout === 'auto' ? idx.suggestedLayout : targetLayout;
    await addSource(system, {
      identifier: targetIdentifier,
      layout: resolvedLayout,
      note: targetNote,
    });
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
      // previewIndex failing here means archive.org couldn't be read at
      // all for this identifier (unreachable or doesn't exist) — true
      // whether the layout was auto-detected or chosen by hand, so the
      // message doesn't steer toward "pick it manually" anymore.
      setError(`${message} — vérifie que l'identifiant existe bien sur archive.org`);
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
        position: 'relative',
        mb: '4',
        p: '4',
        borderRadius: '16px',
        bg: 'accent.subtle',
        shadow: 'md',
        display: 'flex',
        flexDirection: 'column',
        gap: '3',
      })}
    >
      {/* The top-level "Annuler" toggle (in SourcesManager) closes this same
          panel, but it's a scroll away once the results list fills the
          screen — this puts a close affordance right where you're working. */}
      <button
        type="button"
        onClick={onDone}
        aria-label="Fermer"
        className={css({
          position: 'absolute',
          top: '3',
          right: '3',
          fontSize: 'lg',
          lineHeight: '1',
          color: 'fg.faint',
          cursor: 'pointer',
          _hover: { color: 'fg.muted' },
        })}
      >
        ×
      </button>

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
            Aucune collection trouvée pour « {searchQ.trim()} ». Essaie un autre libellé, ou utilise
            « Je connais déjà l’identifiant » ci-dessous.
          </p>
        )}

        {searchResults !== null && searchResults.length > 0 && (
          <div
            className={css({
              mt: '2',
              borderRadius: '14px',
              bg: 'bg.surface',
              shadow: 'md',
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

      {error && (
        <p role="alert" className={css({ fontSize: 'xs', color: 'status.danger.text' })}>
          {error}
        </p>
      )}

      {/* Manual entry — a separate, unrelated way to add a source (skip the
          search entirely), so it's collapsed behind its own toggle instead of
          sitting right under the search results where it reads as part of it. */}
      <div
        className={css({
          borderTop: '1px solid',
          borderColor: 'bd.subtle',
          pt: '3',
          display: 'flex',
          flexDirection: 'column',
          gap: '3',
        })}
      >
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className={css({
            alignSelf: 'flex-start',
            fontSize: 'xs',
            color: 'fg.faint',
            cursor: 'pointer',
            _hover: { color: 'fg.muted' },
          })}
        >
          {showManual ? '− Masquer la saisie manuelle' : 'Je connais déjà l’identifiant'}
        </button>

        {showManual && (
          <>
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
              <p className={css({ fontSize: 'xs', color: 'fg.subtle' })}>
                L’identifiant de la collection, c’est-à-dire la fin de son URL :
                archive.org/details/
                <strong>sony_playstation_part1</strong>. Ce n’est pas ton compte archive.org, qui se
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
                    borderRadius: 'md',
                    bg: 'bg.surface',
                    outline: 'none',
                    fontFamily: 'mono',
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
                <select
                  value={layout}
                  onChange={(e) => setLayout(e.target.value as LayoutChoice)}
                  className={css({
                    px: '2.5',
                    py: '1.5',
                    fontSize: 'sm',
                    borderRadius: 'md',
                    bg: 'bg.surface',
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
            </div>

            <Button
              onClick={() => void handleSave()}
              disabled={saving || !identifier.trim()}
              className={css({ alignSelf: 'flex-start' })}
            >
              {saving ? 'Ajout…' : 'Ajouter la source'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
