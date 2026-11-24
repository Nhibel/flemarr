import { useCallback, useState } from 'react';

export type ScanSection = 'found' | 'wrongName' | 'linked' | 'unmatched';

// The found games and the absent files are the long lists, and not the ones
// that ask for action.
const INITIALLY_OPEN: Record<ScanSection, boolean> = {
  found: false,
  wrongName: true,
  linked: true,
  unmatched: false,
};

export function sectionId(section: ScanSection): string {
  return `scan-section-${section}`;
}

/** Which lists of the scan results are unfolded. */
export function useOpenSections() {
  const [openSections, setOpenSections] = useState(INITIALLY_OPEN);

  const setOpen = useCallback((section: ScanSection, open: boolean) => {
    setOpenSections((previous) =>
      previous[section] === open ? previous : { ...previous, [section]: open },
    );
  }, []);

  return { openSections, setOpen };
}
