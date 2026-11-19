import { css } from '@/styled-system/css';
import { SegmentedControl } from '@/components/SegmentedControl.js';
import { DatUpload } from '@/features/dat-loader/DatUpload.js';
import { Fresh1g1rBrowser } from '@/features/dat-loader/Fresh1g1rBrowser.js';
import type { DatUploadResponse } from '@shared/api.js';

export type LoaderMode = 'manual' | 'fresh1g1r';

const LOADER_MODE_OPTIONS = [
  { value: 'fresh1g1r', label: 'Fresh1G1R' },
  { value: 'manual', label: 'Importer un .dat' },
] as const;

interface Props {
  loaderMode: LoaderMode;
  onSetLoaderMode: (mode: LoaderMode) => void;
  onUploaded: (dat: DatUploadResponse) => void;
}

/**
 * The two ways to add a system: pick one from Fresh1G1R, or import a .dat.
 *
 * Its own component because it renders in two places — inside the dialog,
 * and inline on a first run where hiding it behind a button would leave an
 * empty screen.
 */
export function AddSystem({ loaderMode, onSetLoaderMode, onUploaded }: Props) {
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
      <SegmentedControl
        options={LOADER_MODE_OPTIONS}
        value={loaderMode}
        onChange={onSetLoaderMode}
      />

      {loaderMode === 'fresh1g1r' ? (
        // Loading a preset just adds it to the system cards — no
        // auto-navigation, so loading several systems in a row doesn't
        // bounce to the game view each time.
        <Fresh1g1rBrowser />
      ) : (
        <DatUpload onSuccess={onUploaded} />
      )}
    </div>
  );
}
