import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { css, cx } from '@/styled-system/css';
import { listDirs, createDir } from '@/lib/api.js';
import { displayPath, absolutePath } from '@/lib/paths.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';

function pathBasename(p: string): string {
  return (
    p
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() ?? p
  );
}

// Join a child name onto a listed directory, preserving its separator.
function joinPath(base: string, name: string): string {
  const trimmed = base.replace(/[\\/]+$/, '');
  const sep = trimmed.includes('\\') ? '\\' : '/';
  return `${trimmed}${sep}${name}`;
}

function FolderIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3zm-8.322.12C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139z" />
    </svg>
  );
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputClassName?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function PathInput({ value, onChange, placeholder, inputClassName, onKeyDown }: Props) {
  const queryClient = useQueryClient();
  // `value` (and everything sent to the API) stays absolute; the input shows
  // and accepts the root-relative form when a library root is configured.
  const romsRoot = useRomsRoot();
  const [open, setOpen] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [newFolder, setNewFolder] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), 250);
    return () => clearTimeout(t);
  }, [value]);

  const { data } = useQuery({
    queryKey: ['list-dirs', debouncedValue],
    queryFn: () => listDirs(debouncedValue),
    enabled: open,
    staleTime: 30_000,
  });

  // Close only when focus leaves the whole component — moving focus to a child
  // (a folder button, or the "new folder" field) must keep the panel open.
  const handleContainerBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setOpen(false);
    }
  }, []);

  const navigate = useCallback(
    (path: string) => {
      onChange(path);
    },
    [onChange],
  );

  // Create a subfolder under the directory currently listed, then step into it.
  const base = data?.listedPath ?? '';
  const handleCreate = useCallback(async () => {
    const name = newFolder.trim();
    if (!name || !base) return;
    setCreating(true);
    setCreateError(null);
    try {
      const { path } = await createDir(joinPath(base, name));
      setNewFolder('');
      await queryClient.invalidateQueries({ queryKey: ['list-dirs'] });
      navigate(path);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Création impossible');
    } finally {
      setCreating(false);
    }
  }, [newFolder, base, queryClient, navigate]);

  const showPanel =
    open &&
    data != null &&
    (data.dirs.length > 0 || data.parent !== null || data.listedPath !== '');

  return (
    <div
      className={css({ position: 'relative', flex: 1 })}
      onFocus={() => setOpen(true)}
      onBlur={handleContainerBlur}
    >
      <input
        type="text"
        value={displayPath(value, romsRoot)}
        onChange={(e) => onChange(absolutePath(e.target.value, romsRoot))}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cx(css({ width: '100%' }), inputClassName)}
      />
      {showPanel && (
        <div
          className={css({
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            right: 0,
            zIndex: 50,
            bg: 'bg.surface',
            borderRadius: 'md',
            boxShadow: 'lg',
            maxH: '60',
            overflowY: 'auto',
          })}
        >
          {data.listedPath && data.listedPath !== value && (
            <div
              className={css({
                px: '3',
                py: '1',
                fontSize: 'xs',
                color: 'fg.faint',
                fontFamily: 'mono',
              })}
            >
              ↪ {displayPath(data.listedPath, romsRoot)}
            </div>
          )}
          {data.parent !== null && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                navigate(data.parent!);
              }}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '2',
                width: '100%',
                px: '3',
                py: '1.5',
                fontSize: 'sm',
                color: 'fg.muted',
                textAlign: 'left',
                cursor: 'pointer',
                _hover: { bg: 'bg.muted' },
              })}
            >
              <span className={css({ fontSize: 'xs', color: 'fg.faint' })}>↑</span>
              ..
            </button>
          )}
          {data.dirs.map((dir) => (
            <button
              key={dir.path}
              onMouseDown={(e) => {
                e.preventDefault();
                navigate(dir.path);
              }}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '2',
                width: '100%',
                px: '3',
                py: '1.5',
                fontSize: 'sm',
                color: 'fg.default',
                textAlign: 'left',
                cursor: 'pointer',
                _hover: { bg: 'bg.muted' },
              })}
            >
              <span className={css({ color: 'fg.faint', flexShrink: 0 })}>
                <FolderIcon />
              </span>
              <span className={css({ flex: '1', minW: '0', truncate: true })}>
                {pathBasename(dir.path)}
              </span>
              {/* Files directly inside, so a folder holding a collection is
                  recognisable without running a scan. Silent at zero: an
                  empty folder is the normal case when creating one. */}
              {dir.fileCount > 0 && (
                <span
                  className={css({
                    flexShrink: 0,
                    fontFamily: 'mono',
                    fontSize: '2xs',
                    color: 'fg.faint',
                  })}
                >
                  {dir.fileCount} fichier{dir.fileCount > 1 ? 's' : ''}
                </span>
              )}
            </button>
          ))}

          {/* Create a subfolder in the directory currently shown */}
          {base && (
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1',
                px: '3',
                py: '2',
                borderTop: '1px solid',
                borderColor: 'bd.default',
                bg: 'bg.muted',
              })}
            >
              <div className={css({ display: 'flex', gap: '2' })}>
                <input
                  type="text"
                  value={newFolder}
                  placeholder="Nouveau dossier…"
                  onChange={(e) => setNewFolder(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleCreate();
                    }
                  }}
                  className={css({
                    flex: 1,
                    minW: 0,
                    px: '2',
                    py: '1',
                    fontSize: 'sm',
                    borderRadius: 'sm',
                    bg: 'bg.surface',
                    outline: 'none',
                  })}
                />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void handleCreate();
                  }}
                  disabled={creating || !newFolder.trim()}
                  className={css({
                    px: '2.5',
                    py: '1',
                    fontSize: 'sm',
                    fontWeight: 'medium',
                    flexShrink: 0,
                    bg: 'accent.solid',
                    color: 'accent.fg',
                    borderRadius: 'sm',
                    cursor: 'pointer',
                    _hover: { bg: 'accent.hover' },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  {creating ? '…' : '+ Créer'}
                </button>
              </div>
              {createError && (
                <span className={css({ fontSize: 'xs', color: 'status.danger.text' })}>
                  {createError}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
