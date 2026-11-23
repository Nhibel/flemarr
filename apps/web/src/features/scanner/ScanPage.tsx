import { useState, useRef, useCallback, useEffect } from 'react';
import { css } from '@/styled-system/css';
import { startScan, openScanEvents } from '@/lib/api.js';
import { Button } from '@/components/Button.js';
import { useSystemFolder } from '@/lib/use-system-folder.js';
import { displayPath } from '@/lib/paths.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';
import type { ScanResult, ScanEvent, WrongNameEntry } from '@shared/scan.js';
import { scanEventSchema } from '@shared/scan.js';
import { RenameOutcomeNote } from './RenameOutcomeNote.js';
import { ScanResults } from './ScanResults.js';
import { useRenames } from './use-renames.js';
import { plural } from '@/lib/plural.js';

interface Props {
  datId: string;
  system: string;
  onScanComplete?: (result: ScanResult) => void;
}

type ScanState =
  | { phase: 'idle' }
  | { phase: 'scanning'; scanned: number; total: number; extracting?: string }
  | { phase: 'done'; result: ScanResult; directory: string }
  | { phase: 'error'; message: string };

const NO_ENTRIES: WrongNameEntry[] = [];

export function ScanPage({ datId, system, onScanComplete }: Props) {
  // The directory to scan is the system's folder, chosen once in SystemFolderBar.
  const { folder: directory, loaded } = useSystemFolder(system);
  const romsRoot = useRomsRoot();
  const [scan, setScan] = useState<ScanState>({ phase: 'idle' });
  const esRef = useRef<EventSource | null>(null);

  const runScan = useCallback(async () => {
    if (!directory) return;
    esRef.current?.close();
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
          setScan({
            phase: 'scanning',
            scanned: event.scanned,
            total: event.total,
            extracting: event.extracting,
          });
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

  const wrongNames = scan.phase === 'done' ? scan.result.wrongName : NO_ENTRIES;
  const renames = useRenames(wrongNames, runScan);
  const { clearSelection, clearOutcome } = renames;

  // A new scan makes the ticked files stale, whoever started it.
  const isScanning = scan.phase === 'scanning';
  useEffect(() => {
    if (isScanning) clearSelection();
  }, [isScanning, clearSelection]);

  const handleScan = useCallback(() => {
    clearOutcome();
    void runScan();
  }, [clearOutcome, runScan]);

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
      {/* Scan control — the directory comes from the system folder (SystemFolderBar) */}
      <div className={css({ display: 'flex', gap: '3', alignItems: 'center' })}>
        <Button onClick={handleScan} disabled={!directory || scan.phase === 'scanning'}>
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
          {scan.extracting !== undefined && (
            <span className={css({ display: 'block', mt: '1', color: 'fg.faint' })}>
              Décompression de {scan.extracting} pour l&apos;identifier…
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {scan.phase === 'error' && (
        <p role="alert" className={css({ color: 'status.danger.text', fontSize: 'sm' })}>
          {scan.message}
        </p>
      )}

      {renames.outcome !== null && <RenameOutcomeNote outcome={renames.outcome} />}

      {/* Results */}
      {scan.phase === 'done' && (
        <ScanResults
          datId={datId}
          result={scan.result}
          selected={renames.selected}
          choices={renames.choices}
          onToggle={renames.toggle}
          onChoose={renames.choose}
          onSetAll={renames.setAll}
          onRename={() => void renames.rename()}
          renaming={renames.renaming}
        />
      )}
    </div>
  );
}
