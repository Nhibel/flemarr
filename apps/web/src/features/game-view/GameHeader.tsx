import { css, cx } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { SystemIcon } from '@/components/SystemIcon.js';
import { GearIcon, BookIcon, iconBtnClass } from '@/components/icons.js';
import type { SystemIconStyle } from '@shared/system-icon.js';
import type { DatUploadResponse } from '@shared/api.js';

// The two text buttons that sit ON the Jeux header, given the fill the
// icon buttons beside them already have (iconBtnClass): bg.inset, one
// step deeper than the surface they sit on.
//
// The secondary variant's own bg.muted is a single tone off bg.surface —
// in the dark themes #232936 against #1B1F28 — which at this size made
// the button invisible (Camille, 2026-11-18: "le fond n'est pas présent
// dans les autres thèmes"). bg.inset is the tone the header already uses
// for a control, so this is the header agreeing with itself rather than a
// new idea.
//
// It applies in all nine themes, Lemon Grid included: there bg.inset is a
// near-black on the yellow band, which is what that band needs anyway.
// The text buttons were flat there for half a day — the slab looked wrong
// — but what was wrong was the geometry, now fixed by the `strip` size.
const bandControlClass = css({
  bg: 'bg.inset',
  color: 'fg.default',
  _hover: { bg: 'bg.muted', color: 'fg.default' },
});

interface Props {
  dat: DatUploadResponse;
  iconStyle: SystemIconStyle | null | undefined;
  /** null until a scan has run: the app then doesn't know what is owned. */
  ownedCount: number | null;
  lastScanAt: Date | null;
  showScanner: boolean;
  onScan: () => void;
  onReset: () => void;
  onLexique: () => void;
  onSettings: () => void;
}

/**
 * One floating card holding the system name and the icon actions, as the
 * design comps show it: the system it applies to on the left, the app's own
 * navigation on the right, a divider between them. The library search is
 * not here — GameList renders it on the row above the list.
 *
 * No flexWrap, and exactly ONE flexible child — the title. Every other
 * child is flexShrink: 0, so they are all pinned to the right edge at a
 * constant position and the title absorbs the variation by truncating.
 * Before this, the header wrapped and every control after the title shifted
 * with the length of the system name, which moved Lexique and Réglages
 * around between consoles. Navigation that moves is navigation you have to
 * re-find every time.
 */
export function GameHeader({
  dat,
  iconStyle,
  ownedCount,
  lastScanAt,
  showScanner,
  onScan,
  onReset,
  onLexique,
  onSettings,
}: Props) {
  const hasScanned = ownedCount !== null;

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '3',
        mb: '4',
        px: '4',
        py: '3',
        // Not bg.surface: in Lemon Grid this one header is a solid
        // yellow band, and everything written on it reads from the
        // matching fg.onBand* tokens. The other eight themes define
        // bg.band as their own bg.surface, so nothing moves in them.
        bg: 'bg.band',
        borderRadius: '16px',
        shadow: 'md',
        flexShrink: '0',
      })}
    >
      {/* Title and its counter stack, and the stack is the row's one
          flexible child. They used to sit side by side, which made the
          counter — "no-intro · 1401 jeux · possession inconnue" is wide —
          eat the width the title needed, truncating a name that had room
          to show. Stacked, the title gets the full width of the block and
          the counter reads as what it is: a subtitle about that console,
          not a separate control. */}
      <SystemIcon system={dat.system} style={iconStyle} size={44} />
      <div className={css({ flex: '1', minWidth: '0' })}>
        <h1
          title={dat.system}
          className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            color: 'fg.onBand',
            minWidth: '0',
            truncate: true,
            _nightdrive: {
              textShadow: '0 0 12px rgba(55, 235, 243, 0.3)',
            },
            _matrix: {
              textShadow: '0 0 12px rgba(67, 245, 123, 0.28)',
            },
          })}
        >
          {dat.system}
        </h1>
        <OwnershipCounter dat={dat} ownedCount={ownedCount} lastScanAt={lastScanAt} />
      </div>

      {/* The comps' "Revérifier mon dossier". It navigates to the scanner
          rather than starting a scan from here: the scan trigger lives in
          ScanPage with its own directory picker and progress stream, and
          lifting it into the header belongs with dissolving the tabs, not
          with this change. */}
      {showScanner && (
        <span className={css({ flexShrink: '0' })}>
          <Button variant="secondary" size="strip" className={bandControlClass} onClick={onScan}>
            {hasScanned ? 'Rescanner mon dossier' : 'Scanner mon dossier'}
          </Button>
        </span>
      )}

      {/* Everything left of this line is about the console currently open;
          everything right of it is about the app. A 1px rule is the right
          tool here: it is a divider inside a card, which is the one place
          the redesign kept borders. */}
      <span
        aria-hidden
        className={css({
          flexShrink: '0',
          w: '1px',
          alignSelf: 'stretch',
          my: '1',
          bg: 'bd.default',
          _lemongrid: { bg: 'bg.inset' },
        })}
      />

      <span className={css({ display: 'flex', alignItems: 'center', gap: '2', flexShrink: '0' })}>
        <Button variant="secondary" size="strip" className={bandControlClass} onClick={onReset}>
          Mes systèmes
        </Button>
        <button
          onClick={onLexique}
          title="Lexique"
          aria-label="Lexique"
          className={cx(iconBtnClass, bandControlClass)}
        >
          <BookIcon />
        </button>
        <button
          onClick={onSettings}
          title="Paramètres"
          aria-label="Paramètres"
          className={cx(iconBtnClass, bandControlClass)}
        >
          <GearIcon />
        </button>
      </span>
    </div>
  );
}

/**
 * How much of the catalogue is already on disk, and how much is not, as in
 * the comps. Two wordings, because the honest answer differs — with no scan
 * the app does not know what is owned, and the comps' "catalogue, possession
 * inconnue" state says exactly that instead of showing a count of zero.
 */
function OwnershipCounter({
  dat,
  ownedCount,
  lastScanAt,
}: Pick<Props, 'dat' | 'ownedCount' | 'lastScanAt'>) {
  if (ownedCount === null) {
    return (
      <span
        className={css({
          display: 'block',
          mt: '0.5',
          fontFamily: 'mono',
          fontSize: '2xs',
          color: 'fg.onBandMuted',
          truncate: true,
        })}
      >
        {dat.source} · {dat.gameCount} jeux · possession inconnue
      </span>
    );
  }

  return (
    <span
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '2',
        flexWrap: 'wrap',
        mt: '0.5',
        fontFamily: 'mono',
        fontSize: '2xs',
      })}
    >
      <span className={css({ color: 'fg.onBandSuccess' })}>{ownedCount} sur ton disque</span>
      <span className={css({ color: 'fg.onBandMuted' })}>
        {dat.gameCount - ownedCount} manquants sur {dat.gameCount}
      </span>
      {lastScanAt && (
        <span className={css({ color: 'fg.onBandMuted' })}>
          vérifié à {lastScanAt.toLocaleTimeString()}
        </span>
      )}
    </span>
  );
}
