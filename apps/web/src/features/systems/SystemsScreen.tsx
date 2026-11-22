import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { AppLogo } from '@/components/AppLogo.js';
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
import { useDatUpdates } from './use-dat-updates.js';

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
  const { updatesByDat, applyUpdate, updatingDatId } = useDatUpdates();
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
      <div className={css({ display: 'flex', alignItems: 'center', gap: '1', mb: '10' })}>
        {/* The home screen is the one place the logo shows large, as the
            page title; App hides the small AppTopBar here so it is not shown
            twice. The comps' title glow (Night Drive, Matrix) was a
            text-shadow on the old text title and does not carry over to an
            image with its own fixed colours. */}
        <h1 className={css({ flex: 1, minWidth: 0 })}>
          <AppLogo height={150} />
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
          {/* The add button sits above the list, beside its title: with a
              dozen systems, a button below the cards ended up off screen. */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '3',
              flexWrap: 'wrap',
              mb: '3',
            })}
          >
            <h2 className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'fg.default' })}>
              Mes systèmes
            </h2>
            <Button variant="primary" onClick={() => setAdding(true)}>
              + Ajouter un système
            </Button>
          </div>
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
                newVersion={updatesByDat.get(dat.id)?.version}
                updating={updatingDatId === dat.id}
                onUpdate={() => {
                  const update = updatesByDat.get(dat.id);
                  if (update) applyUpdate(update);
                }}
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
        <Dialog open={adding} onClose={() => setAdding(false)} title="Ajouter un système">
          {addSystem}
        </Dialog>
      ) : (
        addSystem
      )}
    </main>
  );
}
