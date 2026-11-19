import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontScaleControl } from '@/components/FontScaleControl.js';
import { GameView } from '@/features/game-view/GameView.js';
import { LexiquePage } from '@/features/lexique/LexiquePage.js';
import { TopologyStep } from '@/features/onboarding/TopologyStep.js';
import { SettingsPage } from '@/features/settings/SettingsPage.js';
import { SystemsScreen } from '@/features/systems/SystemsScreen.js';
import type { LoaderMode } from '@/features/systems/AddSystem.js';
import { listDats, updateSettings } from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';
import { useFontScale } from '@/lib/use-font-scale.js';
import { useSettings } from '@/lib/use-settings.js';
import { useTheme } from '@/lib/use-theme.js';
import type { DatUploadResponse } from '@shared/api.js';

type AppView = 'loader' | 'game' | 'settings' | 'lexique';

/**
 * Picks the screen to show — there is no router; navigation is this
 * component's state — and asks the install question on a fresh install.
 */
export function App() {
  const [activeDat, setActiveDat] = useState<DatUploadResponse | null>(null);
  const [loaderMode, setLoaderMode] = useState<LoaderMode>('fresh1g1r');
  const [view, setView] = useState<AppView>('loader');
  const { theme, setTheme } = useTheme();
  const { fontScale, setFontScale } = useFontScale();
  const queryClient = useQueryClient();
  const { data: rootSettings } = useSettings();
  const { data: knownDats } = useQuery({ queryKey: queryKeys.dats(), queryFn: listDats });

  const chooseTopology = useMutation({
    mutationFn: updateSettings,
    onSuccess: (updated) => queryClient.setQueryData(queryKeys.settings(), updated),
  });

  // The install question runs only on an install that has never been used:
  // no answer recorded, no system folder configured, no DAT ever loaded.
  //
  // All three conditions matter, not just the first. Answering writes
  // downloadTarget, so showing this to an existing user who happens to have
  // no topology recorded — anyone who installed before this field existed —
  // could silently flip where their downloads go. The extra conditions make
  // that impossible: an install with a folder or a DAT is one that already
  // works, and its existing downloadTarget is the answer.
  const isLoaded = rootSettings !== undefined && knownDats !== undefined;
  const isUnusedInstall =
    isLoaded &&
    rootSettings.topology === null &&
    Object.keys(rootSettings.systemPaths).length === 0 &&
    knownDats.length === 0;

  const backFromPage = () => setView(activeDat ? 'game' : 'loader');

  let content: ReactNode;
  if (view === 'settings') {
    content = <SettingsPage onClose={backFromPage} theme={theme} onSetTheme={setTheme} />;
  } else if (view === 'lexique') {
    content = <LexiquePage onClose={backFromPage} />;
  } else if (activeDat === null && isUnusedInstall) {
    content = <TopologyStep saving={chooseTopology.isPending} onChoose={chooseTopology.mutate} />;
  } else if (activeDat === null) {
    content = (
      <SystemsScreen
        loaderMode={loaderMode}
        onSetLoaderMode={setLoaderMode}
        onOpenSystem={(dat) => {
          setActiveDat(dat);
          setView('game');
        }}
        onSettings={() => setView('settings')}
        onLexique={() => setView('lexique')}
      />
    );
  } else {
    content = (
      <GameView
        dat={activeDat}
        onReset={() => {
          setActiveDat(null);
          setView('loader');
        }}
        onSettings={() => setView('settings')}
        onLexique={() => setView('lexique')}
      />
    );
  }

  return (
    <>
      {content}
      {/* Fixed position, outside the normal page flow, mounted once here
          (not per-view, not inline next to Lexique/Réglages) — see
          FontScaleControl's own comment for why it can't sit inline with
          those icons and still stay put as fontScale changes. */}
      <FontScaleControl fontScale={fontScale} onSetFontScale={setFontScale} />
    </>
  );
}
