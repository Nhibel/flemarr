import { useState, useRef, useCallback } from 'react';
import { css } from '@/styled-system/css';
import { startScan, openScanEvents, requestRenames } from '@/lib/api.js';
import { Button } from '@/components/Button.js';
import { Chip } from '@/components/Chip.js';
import { useSystemFolder } from '@/lib/use-system-folder.js';
import { displayPath } from '@/lib/paths.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';
import type { ScanResult, WrongNameEntry, ScanEvent } from '@shared/scan.js';
import { scanEventSchema } from '@shared/scan.js';

interface Props {
  datId: string;
  system: string;
  onScanComplete?: (result: ScanResult) => void;
}

type ScanState =
  | { phase: 'idle' }
  | { phase: 'scanning'; scanned: number; total: number }
  | { phase: 'done'; result: ScanResult; directory: string }
  | { phase: 'error'; message: string };

export function ScanPage({ datId, system, onScanComplete }: Props) {
  // The directory to scan is the system's folder, chosen once in SystemFolderBar.
  const { folder: directory, loaded } = useSystemFolder(system);
  const romsRoot = useRomsRoot();
  const [scan, setScan] = useState<ScanState>({ phase: 'idle' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState(false);
  const [renameResult, setRenameResult] = useState<{ done: number; failed: number } | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const handleScan = useCallback(async () => {
    if (!directory) return;
    esRef.current?.close();
    setSelected(new Set());
    setRenameResult(null);
    setScan({ phase: 'scanning', scanned: 0, total: 0 });

    let job: { jobId: string };
    try {
      job = await startScan(datId, directory);
    } catch (err) {
      setScan({ phase: 'error', message: err instanceof Error ? err.message : 'Échec du scan' });
      return;
    }

    const es = openScanEvents(job.jobId);
    esRef.current = es;

    es.onmessage = (e) => {
      const parsed = scanEventSchema.safeParse(JSON.parse(e.data as string) as unknown);
      if (!parsed.success) return;
      const event: ScanEvent = parsed.data;

      if (event.type === 'progress') {
        setScan({ phase: 'scanning', scanned: event.scanned, total: event.total });
      } else if (event.type === 'done') {
        setScan({ phase: 'done', result: event.result, directory });
        onScanComplete?.(event.result);
        es.close();
      } else if (event.type === 'error') {
        setScan({ phase: 'error', message: event.message });
        es.close();
      }
    };

    es.onerror = () => {
      setScan({ phase: 'error', message: 'Connexion au flux de scan perdue' });
      es.close();
    };
  }, [datId, directory, onScanComplete]);

  const toggleRename = useCallback((filePath: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  }, []);

  const handleRename = useCallback(async () => {
    if (scan.phase !== 'done' || selected.size === 0) return;
    setRenaming(true);

    const entries = scan.result.wrongName
      .filter((e) => selected.has(e.filePath))
      .map((e) => ({ from: e.filePath, to: e.canonicalName }));

    try {
      const result = await requestRenames({ renames: entries });
      setRenameResult({ done: result.done.length, failed: result.failed.length });
      if (result.failed.length === 0) {
        // Re-scan to refresh results
        await handleScan();
      }
    } catch (err) {
      setScan({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Échec du renommage',
      });
    } finally {
      setRenaming(false);
    }
  }, [scan, selected, handleScan]);

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
      {/* Scan control — the directory comes from the system folder (SystemFolderBar) */}
      <div className={css({ display: 'flex', gap: '3', alignItems: 'center' })}>
        <Button
          onClick={() => void handleScan()}
          disabled={!directory || scan.phase === 'scanning'}
        >
          {scan.phase === 'scanning' ? 'Scan en cours…' : 'Scanner'}
        </Button>
        {directory ? (
          <span
            className={css({
              fontSize: 'sm',
              color: 'fg.faint',
              fontFamily: 'mono',
              minW: 0,
              truncate: true,
            })}
          >
            {displayPath(directory, romsRoot)}
          </span>
        ) : (
          loaded && (
            <span className={css({ fontSize: 'sm', color: 'status.warning.text' })}>
              Définis le dossier du système (bandeau en haut de page) pour lancer un scan.
            </span>
          )
        )}
      </div>

      {/* Progress */}
      {scan.phase === 'scanning' && (
        <div className={css({ fontSize: 'sm', color: 'fg.subtle' })}>
          {scan.total > 0
            ? `${scan.scanned} / ${scan.total} fichiers hachés…`
            : 'Collecte des fichiers…'}
        </div>
      )}

      {/* Error */}
      {scan.phase === 'error' && (
        <p role="alert" className={css({ color: 'status.danger.text', fontSize: 'sm' })}>
          {scan.message}
        </p>
      )}

      {/* Results */}
      {scan.phase === 'done' && (
        <ScanResults
          result={scan.result}
          selected={selected}
          onToggle={toggleRename}
          onRename={() => void handleRename()}
          renaming={renaming}
          renameResult={renameResult}
        />
      )}
    </div>
  );
}

interface ScanResultsProps {
  result: ScanResult;
  selected: Set<string>;
  onToggle: (p: string) => void;
  onRename: () => void;
  renaming: boolean;
  renameResult: { done: number; failed: number } | null;
}

function ScanResults({
  result,
  selected,
  onToggle,
  onRename,
  renaming,
  renameResult,
}: ScanResultsProps) {
  const romsRoot = useRomsRoot();
  const total = result.matched.length + result.wrongName.length + result.unmatched.length;

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
      {/* Summary chips */}
      <div className={css({ display: 'flex', gap: '3', flexWrap: 'wrap' })}>
        <Chip label="trouvés" count={result.matched.length} color="green" />
        <Chip label="mal nommés" count={result.wrongName.length} color="amber" />
        <Chip label="introuvables" count={result.unmatched.length} color="gray" />
        <span className={css({ fontSize: 'xs', color: 'fg.faint', alignSelf: 'center' })}>
          {total} fichiers scannés
        </span>
      </div>

      {/* Rename suggestions */}
      {result.wrongName.length > 0 && (
        <div>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '3', mb: '2' })}>
            <h3 className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'fg.default' })}>
              Suggestions de renommage
            </h3>
            <button
              onClick={() => result.wrongName.forEach((e) => onToggle(e.filePath))}
              className={css({
                fontSize: 'xs',
                color: 'accent.text',
                cursor: 'pointer',
                _hover: { textDecoration: 'underline' },
              })}
            >
              {selected.size === result.wrongName.length
                ? 'Tout désélectionner'
                : 'Tout sélectionner'}
            </button>
          </div>
          <div
            className={css({
              borderRadius: 'xl',
              overflow: 'hidden',
            })}
          >
            {result.wrongName.map((entry) => (
              <RenameRow
                key={entry.filePath}
                entry={entry}
                checked={selected.has(entry.filePath)}
                onToggle={onToggle}
              />
            ))}
          </div>
          <div className={css({ mt: '3', display: 'flex', alignItems: 'center', gap: '3' })}>
            <button
              onClick={onRename}
              disabled={selected.size === 0 || renaming}
              className={css({
                px: '4',
                py: '2',
                bg: 'status.warning.solid',
                color: 'status.warning.fg',
                borderRadius: 'lg',
                fontSize: 'sm',
                fontWeight: 'medium',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                _hover: { bg: 'status.warning.hover' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {renaming
                ? 'Renommage…'
                : `Renommer ${selected.size} fichier${selected.size !== 1 ? 's' : ''}`}
            </button>
            {renameResult && (
              <span
                className={css({
                  fontSize: 'sm',
                  color: renameResult.failed > 0 ? 'status.danger.text' : 'status.success.text',
                })}
              >
                {renameResult.done} renommé{renameResult.done !== 1 ? 's' : ''}
                {renameResult.failed > 0 ? `, ${renameResult.failed} échoué(s)` : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Unmatched */}
      {result.unmatched.length > 0 && (
        <details className={css({ fontSize: 'sm' })}>
          <summary className={css({ cursor: 'pointer', color: 'fg.subtle', mb: '1' })}>
            {result.unmatched.length} fichier{result.unmatched.length !== 1 ? 's' : ''} non trouvé
            {result.unmatched.length !== 1 ? 's' : ''}
          </summary>
          <ul
            className={css({
              pl: '4',
              mt: '1',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5',
            })}
          >
            {result.unmatched.map((p) => (
              <li
                key={p}
                className={css({
                  color: 'fg.subtle',
                  fontFamily: 'mono',
                  fontSize: 'xs',
                  truncate: true,
                })}
              >
                {displayPath(p, romsRoot)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function RenameRow({
  entry,
  checked,
  onToggle,
}: {
  entry: WrongNameEntry;
  checked: boolean;
  onToggle: (p: string) => void;
}) {
  const romsRoot = useRomsRoot();
  return (
    <label
      className={css({
        display: 'flex',
        alignItems: 'flex-start',
        gap: '3',
        px: '3',
        py: '2',
        cursor: 'pointer',
        bg: checked ? 'status.warning.subtle' : 'bg.page',
        _hover: { bg: checked ? 'status.warning.subtle' : 'bg.surface' },
        _last: { borderBottom: 'none' },
      })}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(entry.filePath)}
        className={css({ mt: '0.5', flexShrink: 0 })}
      />
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.5', minW: 0 })}>
        <span
          className={css({ fontSize: 'xs', color: 'fg.faint', fontFamily: 'mono', truncate: true })}
        >
          {displayPath(entry.filePath, romsRoot)}
        </span>
        <span className={css({ fontSize: 'sm', color: 'fg.default' })}>
          <span className={css({ color: 'status.danger.text' })}>{entry.currentName}</span>
          {' → '}
          <span className={css({ color: 'status.success.text' })}>{entry.canonicalName}</span>
        </span>
        <span className={css({ fontSize: 'xs', color: 'fg.faint' })}>{entry.gameName}</span>
      </div>
    </label>
  );
}
