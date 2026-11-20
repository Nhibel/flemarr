import { useState, useRef, useCallback } from 'react';
import { css } from '@/styled-system/css';
import { startScan, openScanEvents, requestRenames } from '@/lib/api.js';
import { Button } from '@/components/Button.js';
import { useSystemFolder } from '@/lib/use-system-folder.js';
import { displayPath } from '@/lib/paths.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';
import type { ScanResult, ScanEvent } from '@shared/scan.js';
import { scanEventSchema } from '@shared/scan.js';
import { ScanResults } from './ScanResults.js';
import { plural } from '@/lib/plural.js';

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

      switch (event.type) {
        case 'progress':
          setScan({ phase: 'scanning', scanned: event.scanned, total: event.total });
          break;
        case 'done':
          setScan({ phase: 'done', result: event.result, directory });
          onScanComplete?.(event.result);
          es.close();
          break;
        case 'error':
          setScan({ phase: 'error', message: event.message });
          es.close();
          break;
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

  // Not a toggle per file: with some already ticked, toggling each one
  // inverted the selection instead of completing it.
  const setAllRenames = useCallback(
    (selectAll: boolean) => {
      if (scan.phase !== 'done') return;
      const everyFile = scan.result.wrongName.map((entry) => entry.filePath);
      setSelected(new Set(selectAll ? everyFile : []));
    },
    [scan],
  );

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
            ? `${scan.scanned} / ${scan.total} ${plural(scan.total, 'fichier')} ${plural(scan.total, 'haché')}…`
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
          onSetAll={setAllRenames}
          onRename={() => void handleRename()}
          renaming={renaming}
          renameResult={renameResult}
        />
      )}
    </div>
  );
}
