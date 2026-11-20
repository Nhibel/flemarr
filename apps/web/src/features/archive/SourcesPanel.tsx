import { useCallback, useState } from 'react';
import { css } from '@/styled-system/css';
import type { QueuedDownload } from '@/features/downloader/job-state.js';
import { SourcesManager } from './SourcesManager.js';
import { ResolvePanel } from './ResolvePanel.js';

export type DatSource = 'no-intro' | 'redump';

interface Props {
  datId: string;
  system: string;
  source: DatSource;
  selectedGameIds: string[];
  /** Selected games absent from the last scan — null when no scan ran yet */
  missingGameIds: string[] | null;
  onQueueDownload: (job: QueuedDownload) => void;
}

export function SourcesPanel({
  datId,
  system,
  source,
  selectedGameIds,
  missingGameIds,
  onQueueDownload,
}: Props) {
  // Which sources a resolve searches, ticked in the source list and read by
  // the resolve panel below it: one list, not a second copy of it.
  const [pickedSources, setPickedSources] = useState<ReadonlySet<string>>(new Set());
  const togglePickedSource = useCallback((identifier: string) => {
    setPickedSources((previous) => {
      const next = new Set(previous);
      if (next.has(identifier)) next.delete(identifier);
      else next.add(identifier);
      return next;
    });
  }, []);

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '8' })}>
      <SourcesManager
        datId={datId}
        system={system}
        source={source}
        pickedSources={pickedSources}
        onTogglePicked={togglePickedSource}
      />
      <ResolvePanel
        datId={datId}
        system={system}
        selectedGameIds={selectedGameIds}
        missingGameIds={missingGameIds}
        onQueueDownload={onQueueDownload}
        pickedSources={pickedSources}
      />
    </div>
  );
}
