import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { css, cx } from '@/styled-system/css';
import { listDirs } from '@/lib/api.js';

function pathBasename(p: string): string {
  return (
    p
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() ?? p
  );
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
  const [open, setOpen] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState(value);

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

  const handleBlur = useCallback(() => {
    setTimeout(() => setOpen(false), 150);
  }, []);

  const navigate = useCallback(
    (path: string) => {
      onChange(path);
    },
    [onChange],
  );

  const showPanel = open && data != null && (data.dirs.length > 0 || data.parent !== null);

  return (
    <div className={css({ position: 'relative', flex: 1 })}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
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
            bg: 'bg.page',
            border: '1px solid',
            borderColor: 'bd.default',
            borderRadius: 'md',
            boxShadow: 'lg',
            maxH: '52',
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
                borderBottom: '1px solid',
                borderColor: 'bd.subtle',
                fontFamily: 'mono',
              })}
            >
              ↪ {data.listedPath}
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
                borderBottom: '1px solid',
                borderColor: 'bd.subtle',
                _hover: { bg: 'bg.surface' },
              })}
            >
              <span className={css({ fontSize: 'xs', color: 'fg.faint' })}>↑</span>
              ..
            </button>
          )}
          {data.dirs.map((dir) => (
            <button
              key={dir}
              onMouseDown={(e) => {
                e.preventDefault();
                navigate(dir);
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
                borderBottom: '1px solid',
                borderColor: 'bd.subtle',
                _last: { borderBottom: 'none' },
                _hover: { bg: 'bg.surface' },
              })}
            >
              <span className={css({ color: 'fg.faint', flexShrink: 0 })}>
                <FolderIcon />
              </span>
              {pathBasename(dir)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
