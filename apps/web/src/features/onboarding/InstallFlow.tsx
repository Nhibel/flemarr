import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { getSettings, updateSettings } from '@/lib/api.js';
import type { DatUploadResponse } from '@shared/api.js';
import { DatUpload } from '@/features/dat-loader/DatUpload.js';
import { Fresh1g1rBrowser } from '@/features/dat-loader/Fresh1g1rBrowser.js';
import { TopologyStep } from './TopologyStep.js';
import { FolderStep } from './FolderStep.js';
import { SourcesStep } from './SourcesStep.js';
import { stepsFor, positionOf, STEP_LABELS, STEP_TITLES } from './install-steps.js';
import type { StepId } from './install-steps.js';
import { inferTopology } from './topology.js';

/**
 * The install flow's shell: the step indicator, the title, Retour/Continuer,
 * and whichever step is current. It composes the steps and owns none of
 * them — each one is its own component, and three of the four already
 * existed as standalone screens before this chained them.
 *
 * The sequence itself lives in install-steps.ts, because which steps exist
 * depends on the topology answer and the numbering is the part that goes
 * wrong.
 */
export function InstallFlow({
  startAt,
  onDone,
  onCancel,
}: {
  /** 'console' when adding a console to an install that is already set up. */
  startAt: StepId;
  onDone: (dat: DatUploadResponse) => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const [current, setCurrent] = useState<StepId>(startAt);
  const [dat, setDat] = useState<DatUploadResponse | null>(null);
  const [loaderMode, setLoaderMode] = useState<'manual' | 'fresh1g1r'>('fresh1g1r');

  const chooseTopology = useMutation({
    mutationFn: updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings'], updated);
      setCurrent('console');
    },
  });

  // undefined until the settings land, which stepsFor treats as "assume the
  // full sequence" — the count can then only shrink, never grow.
  const topology = settings === undefined ? undefined : inferTopology(settings);
  const steps = stepsFor(topology, { skipTopology: startAt !== 'topology' });
  const pos = positionOf(steps, current);

  // positionOf's id is authoritative, not `current`: answering `remote`
  // removes the folder step, and the user may be standing on it.
  const step = pos.id;

  const goNext = () => {
    if (pos.next !== undefined) setCurrent(pos.next);
    else if (dat !== null) onDone(dat);
  };

  return (
    <main
      className={css({
        maxW: '3xl',
        mx: 'auto',
        mt: { base: '6', md: '12' },
        px: { base: '4', md: '6' },
        pb: '12',
        display: 'flex',
        flexDirection: 'column',
        gap: '5',
      })}
    >
      {/* The step indicator. Rendered from the real sequence, so a skipped
          folder step never leaves a gap in the numbering. */}
      <ol
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          listStyle: 'none',
          flexWrap: 'wrap',
        })}
      >
        {steps.map((id, i) => {
          const state = i + 1 === pos.number ? 'current' : i + 1 < pos.number ? 'past' : 'future';
          return (
            <li
              key={id}
              aria-current={state === 'current' ? 'step' : undefined}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '1.5',
                px: '2.5',
                py: '1',
                borderRadius: '9px',
                fontSize: 'xs',
                fontWeight: state === 'current' ? 'bold' : 'medium',
                bg: state === 'current' ? 'accent.subtle' : 'transparent',
                color:
                  state === 'current' ? 'accent.text' : state === 'past' ? 'fg.muted' : 'fg.faint',
              })}
            >
              <span className={css({ fontFamily: 'mono' })}>{i + 1}</span>
              {STEP_LABELS[id]}
            </li>
          );
        })}
      </ol>

      <div>
        <h1
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            color: 'fg.heading',
            mb: '1',
          })}
        >
          {STEP_TITLES[step]}
        </h1>
        <p className={css({ fontSize: 'xs', color: 'fg.faint', fontFamily: 'mono' })}>
          Étape {pos.number} sur {pos.total}
          {step === 'console' && ' · tu pourras ajouter d’autres consoles plus tard'}
        </p>
      </div>

      {step === 'topology' && (
        <TopologyStep saving={chooseTopology.isPending} onChoose={chooseTopology.mutate} />
      )}

      {step === 'console' && (
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
          <div
            className={css({
              display: 'inline-flex',
              alignSelf: 'flex-start',
              gap: '0.5',
              p: '0.5',
              bg: 'bg.muted',
              borderRadius: '13px',
            })}
          >
            {(['fresh1g1r', 'manual'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setLoaderMode(m)}
                className={css({
                  px: '4',
                  minH: '34px',
                  fontSize: 'sm',
                  fontWeight: loaderMode === m ? 'bold' : 'medium',
                  cursor: 'pointer',
                  border: 'none',
                  borderRadius: '10px',
                  bg: loaderMode === m ? 'accent.solid' : 'transparent',
                  color: loaderMode === m ? 'accent.fg' : 'fg.subtle',
                })}
              >
                {m === 'fresh1g1r' ? 'Fresh1G1R' : 'Importer un .dat'}
              </button>
            ))}
          </div>
          {loaderMode === 'fresh1g1r' ? (
            <Fresh1g1rBrowser onSuccess={setDat} />
          ) : (
            <DatUpload onSuccess={setDat} />
          )}
          {dat !== null && (
            <p className={css({ fontSize: 'sm', color: 'status.success.text' })}>
              {dat.system} — {dat.gameCount} jeux chargés.
            </p>
          )}
        </div>
      )}

      {step === 'folder' &&
        (dat === null ? (
          <p className={css({ fontSize: 'sm', color: 'fg.subtle' })}>
            Choisis d’abord une console.
          </p>
        ) : (
          <FolderStep system={dat.system} onSaved={goNext} />
        ))}

      {step === 'sources' &&
        (dat === null ? (
          <p className={css({ fontSize: 'sm', color: 'fg.subtle' })}>
            Choisis d’abord une console.
          </p>
        ) : (
          <SourcesStep datId={dat.id} system={dat.system} />
        ))}

      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '3',
          pt: '2',
          flexWrap: 'wrap',
        })}
      >
        {pos.previous !== undefined && (
          <Button variant="secondary" onClick={() => setCurrent(pos.previous!)}>
            ← Retour
          </Button>
        )}
        {onCancel !== undefined && pos.previous === undefined && (
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <span className={css({ flex: '1' })} />
        {/* The topology step advances by answering, so it has no Continuer
            of its own — a second way to leave it could leave it unanswered. */}
        {step !== 'topology' && (
          <Button variant="primary" onClick={goNext} disabled={dat === null}>
            {pos.next === undefined ? 'Ouvrir la bibliothèque' : 'Continuer'}
          </Button>
        )}
      </div>
    </main>
  );
}
