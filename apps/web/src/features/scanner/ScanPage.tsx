import { useState, useRef, useCallback } from 'react';
import { css } from '@/styled-system/css';
import { startScan, openScanEvents, requestRenames } from '@/lib/api.js';
import type { ScanResult, WrongNameEntry, ScanEvent } from '@shared/scan.js';
import { scanEventSchema } from '@shared/scan.js';

interface Props {
  datId: string;
}

type ScanState =
  | { phase: 'idle' }
  | { phase: 'scanning'; scanned: number; total: number }
  | { phase: 'done'; result: ScanResult; directory: string }
  | { phase: 'error'; message: string };

export function ScanPage({ datId }: Props) {
  const [directory, setDirectory] = useState('');
  const [scan, setScan] = useState<ScanState>({ phase: 'idle' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState(false);
  const [renameResult, setRenameResult] = useState<{ done: number; failed: number } | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const handleScan = useCallback(async () => {
    if (!directory.trim()) return;
    esRef.current?.close();
    setSelected(new Set());
    setRenameResult(null);
    setScan({ phase: 'scanning', scanned: 0, total: 0 });

    let job: { jobId: string };
    try {
      job = await startScan(datId, directory.trim());
    } catch (err) {
      setScan({ phase: 'error', message: err instanceof Error ? err.message : 'Scan failed' });
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
        setScan({ phase: 'done', result: event.result, directory: directory.trim() });
        es.close();
      } else if (event.type === 'error') {
        setScan({ phase: 'error', message: event.message });
        es.close();
      }
    };

    es.onerror = () => {
      setScan({ phase: 'error', message: 'Connection to scan stream lost' });
      es.close();
    };
  }, [datId, directory]);

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
      const result = await requestRenames({ renames: entries, root: scan.directory });
      setRenameResult({ done: result.done.length, failed: result.failed.length });
      if (result.failed.length === 0) {
        // Re-scan to refresh results
        await handleScan();
      }
    } catch (err) {
      setScan({ phase: 'error', message: err instanceof Error ? err.message : 'Rename failed' });
    } finally {
      setRenaming(false);
    }
  }, [scan, selected, handleScan]);

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
      {/* Directory input */}
      <div className={css({ display: 'flex', gap: '2' })}>
        <input
          type="text"
          placeholder="Directory path (e.g. /mnt/roms/snes)"
          value={directory}
          onChange={(e) => setDirectory(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleScan();
          }}
          className={css({
            flex: 1,
            px: '3',
            py: '2',
            border: '1px solid',
            borderColor: 'bd.strong',
            borderRadius: 'md',
            fontSize: 'sm',
            outline: 'none',
            _focusVisible: { borderColor: 'blue.400', ring: '2px', ringColor: 'blue.200' },
          })}
        />
        <button
          onClick={() => void handleScan()}
          disabled={!directory.trim() || scan.phase === 'scanning'}
          className={css({
            px: '4',
            py: '2',
            bg: 'blue.500',
            color: 'white',
            borderRadius: 'md',
            fontSize: 'sm',
            fontWeight: 'medium',
            cursor: 'pointer',
            _hover: { bg: 'blue.600' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {scan.phase === 'scanning' ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {/* Progress */}
      {scan.phase === 'scanning' && (
        <div className={css({ fontSize: 'sm', color: 'fg.subtle' })}>
          {scan.total > 0 ? `${scan.scanned} / ${scan.total} files hashed…` : 'Collecting files…'}
        </div>
      )}

      {/* Error */}
      {scan.phase === 'error' && (
        <p role="alert" className={css({ color: 'red.600', fontSize: 'sm' })}>
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
  const total = result.matched.length + result.wrongName.length + result.unmatched.length;

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
      {/* Summary chips */}
      <div className={css({ display: 'flex', gap: '3', flexWrap: 'wrap' })}>
        <Chip label="Matched" count={result.matched.length} color="green" />
        <Chip label="Wrong name" count={result.wrongName.length} color="amber" />
        <Chip label="Unmatched" count={result.unmatched.length} color="gray" />
        <span className={css({ fontSize: 'xs', color: 'fg.faint', alignSelf: 'center' })}>
          {total} files scanned
        </span>
      </div>

      {/* Rename suggestions */}
      {result.wrongName.length > 0 && (
        <div>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '3', mb: '2' })}>
            <h3 className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'fg.default' })}>
              Rename suggestions
            </h3>
            <button
              onClick={() => result.wrongName.forEach((e) => onToggle(e.filePath))}
              className={css({
                fontSize: 'xs',
                color: 'blue.500',
                cursor: 'pointer',
                _hover: { textDecoration: 'underline' },
              })}
            >
              {selected.size === result.wrongName.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div
            className={css({
              border: '1px solid',
              borderColor: 'bd.default',
              borderRadius: 'md',
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
                bg: 'amber.500',
                color: 'white',
                borderRadius: 'md',
                fontSize: 'sm',
                fontWeight: 'medium',
                cursor: 'pointer',
                _hover: { bg: 'amber.600' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {renaming
                ? 'Renaming…'
                : `Rename ${selected.size} file${selected.size !== 1 ? 's' : ''}`}
            </button>
            {renameResult && (
              <span
                className={css({
                  fontSize: 'sm',
                  color: renameResult.failed > 0 ? 'red.600' : 'green.600',
                })}
              >
                {renameResult.done} renamed
                {renameResult.failed > 0 ? `, ${renameResult.failed} failed` : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Unmatched */}
      {result.unmatched.length > 0 && (
        <details className={css({ fontSize: 'sm' })}>
          <summary className={css({ cursor: 'pointer', color: 'fg.subtle', mb: '1' })}>
            {result.unmatched.length} unmatched file{result.unmatched.length !== 1 ? 's' : ''}
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
                {p}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Chip({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: 'green' | 'amber' | 'gray';
}) {
  const colorStyle = css.raw(
    color === 'green'
      ? { bg: 'green.50', borderColor: 'green.200', color: 'green.700' }
      : color === 'amber'
        ? { bg: 'amber.50', borderColor: 'amber.200', color: 'amber.700' }
        : { bg: 'bg.surface', borderColor: 'bd.default', color: 'fg.muted' },
  );

  return (
    <span
      className={css(
        {
          px: '3',
          py: '1',
          borderRadius: 'full',
          fontSize: 'xs',
          fontWeight: 'medium',
          border: '1px solid',
        },
        colorStyle,
      )}
    >
      {count} {label}
    </span>
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
  return (
    <label
      className={css({
        display: 'flex',
        alignItems: 'flex-start',
        gap: '3',
        px: '3',
        py: '2',
        borderBottom: '1px solid',
        borderColor: 'bd.subtle',
        cursor: 'pointer',
        bg: checked ? 'amber.50' : 'bg.page',
        _hover: { bg: checked ? 'amber.100' : 'bg.surface' },
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
          {entry.filePath}
        </span>
        <span className={css({ fontSize: 'sm', color: 'fg.default' })}>
          <span className={css({ color: 'red.500' })}>{entry.currentName}</span>
          {' → '}
          <span className={css({ color: 'green.600' })}>{entry.canonicalName}</span>
        </span>
        <span className={css({ fontSize: 'xs', color: 'fg.faint' })}>{entry.gameName}</span>
      </div>
    </label>
  );
}
