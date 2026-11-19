import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { Dialog } from '@/components/Dialog.js';
import { GearIcon, BookIcon, iconBtnClass } from '@/components/icons.js';
import { listDats, deleteDat } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { useSystemIcons } from '@/lib/use-system-icons.js';
import type { DatUploadResponse } from '@shared/api.js';
import { AddSystem } from './AddSystem.js';
import type { LoaderMode } from './AddSystem.js';
import { SystemCard } from './SystemCard.js';

interface Props {
  loaderMode: LoaderMode;
  onSetLoaderMode: (mode: LoaderMode) => void;
  onOpenSystem: (dat: DatUploadResponse) => void;
  onSettings: () => void;
  onLexique: () => void;
}

/** The home screen: the registered systems as cards, and the way to add one. */
export function SystemsScreen({
  loaderMode,
  onSetLoaderMode,
  onOpenSystem,
  onSettings,
  onLexique,
}: Props) {
  // DATs persisted server-side (SQLite) — lets the user resume without re-parsing
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: existingDats = [] } = useQuery({
    queryKey: queryKeys.dats(),
    queryFn: listDats,
  });
  const removeDat = useMutation({
    mutationFn: deleteDat,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.dats() }),
  });
  const systemIcons = useSystemIcons(existingDats.map((d) => d.system));
  const hasSystems = existingDats.length > 0;

  const addSystem = (
    <AddSystem
      loaderMode={loaderMode}
      onSetLoaderMode={onSetLoaderMode}
      onUploaded={onOpenSystem}
    />
  );

  return (
    <main
      className={css({
        maxW: '6xl',
        mx: 'auto',
        mt: { base: '8', md: '16' },
        px: { base: '4', md: '6', lg: '8' },
      })}
    >
      <div className={css({ display: 'flex', alignItems: 'center', gap: '1', mb: '6' })}>
        <h1
          className={css({
            fontSize: '3xl',
            fontWeight: 'bold',
            color: 'fg.heading',
            flex: 1,
            _nightdrive: {
              // The comps' own title glow strength. Night Drive and Matrix
              // are the two themes whose artboard lights the page title;
              // both read the colour from fg.heading, which is their
              // accent. Lemon Grid and Keppel, drawn from the same palette
              // as Night Drive, deliberately have none — Camille's call,
              // 2026-11-18.
              textShadow: '0 0 14px rgba(55, 235, 243, 0.3)',
            },
            _matrix: {
              textShadow: '0 0 12px rgba(67, 245, 123, 0.28)',
            },
          })}
        >
          rom-curator
        </h1>
        <button onClick={onLexique} title="Lexique" aria-label="Lexique" className={iconBtnClass}>
          <BookIcon />
        </button>
        <button
          onClick={onSettings}
          title="Paramètres"
          aria-label="Paramètres"
          className={iconBtnClass}
        >
          <GearIcon />
        </button>
      </div>

      {/* The systems already registered, as cards. One per system, click to
          open it. The ✕ removes the DAT, not the files. */}
      {hasSystems && (
        <section className={css({ mb: '6' })}>
          <h2
            className={css({
              fontSize: 'sm',
              fontWeight: 'semibold',
              color: 'fg.default',
              mb: '3',
            })}
          >
            Mes systèmes
          </h2>
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: {
                base: '1fr',
                md: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
              gap: '3',
            })}
          >
            {existingDats.map((dat) => (
              <SystemCard
                key={dat.id}
                dat={dat}
                iconStyle={systemIcons.get(dat.system)}
                removing={removeDat.isPending}
                onOpen={() => onOpenSystem(dat)}
                onRemove={() => removeDat.mutate(dat.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Adding a system. Behind a button once there is at least one system
          — the console catalogue is long, and it is not what you came for
          when you already have systems to open. Inline when there are none:
          a first run would otherwise be an empty screen whose only content
          is a button, and the thing you have to do is the only thing on
          screen anyway. */}
      {hasSystems ? (
        <>
          <Button variant="primary" onClick={() => setAdding(true)}>
            + Ajouter un système
          </Button>
          <Dialog open={adding} onClose={() => setAdding(false)} title="Ajouter un système">
            {addSystem}
          </Dialog>
        </>
      ) : (
        addSystem
      )}
    </main>
  );
}
