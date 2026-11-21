import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { uploadDat } from '@/lib/api.js';
import { invalidateLoadedDat } from '@/lib/invalidate-loaded-dat.js';
import type { DatUploadResponse } from '@shared/api.js';

interface Props {
  onSuccess: (summary: DatUploadResponse) => void;
}

export function DatUpload({ onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: uploadDat,
    onSuccess: (data) => {
      // The new DAT joins the systems list here, not in the caller: a write
      // resyncs its own queries.
      invalidateLoadedDat(queryClient, data.id);
      onSuccess(data);
    },
  });

  function handleFile(file: File | undefined) {
    if (!file) return;
    mutation.mutate(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Importer un fichier DAT"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3',
        border: '2px dashed',
        borderColor: isDragging ? 'accent.solid' : 'bd.strong',
        borderRadius: 'xl',
        padding: '12',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        _hover: { borderColor: 'accent.hover' },
      })}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".dat,.xml"
        aria-hidden
        className={css({ display: 'none' })}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <p className={css({ fontSize: 'lg', fontWeight: 'semibold', color: 'fg.default' })}>
        {mutation.isPending ? 'Analyse…' : 'Dépose ton fichier .dat ici'}
      </p>
      <p className={css({ fontSize: 'sm', color: 'fg.subtle' })}>
        ou clique pour parcourir — .dat ou .xml
      </p>

      {mutation.isError && (
        <p role="alert" className={css({ color: 'status.danger.text', fontSize: 'sm' })}>
          {mutation.error instanceof Error ? mutation.error.message : 'Échec de l’import'}
        </p>
      )}
    </div>
  );
}
