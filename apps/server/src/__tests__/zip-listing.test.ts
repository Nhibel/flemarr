import { describe, it, expect } from 'vitest';
import { parseZipListing } from '../services/archive-org/zip-listing.js';

describe('parseZipListing', () => {
  it('extracts inner entry names from view_archive HTML', () => {
    const html = `
      <table>
      <tr><td><a href="//archive.org/download/ni-roms/roms/Sega%20-%20Mega%20Drive%20-%20Genesis.zip/Aero%20Blasters%20%28Japan%29.zip">Aero Blasters (Japan).zip</a><td><td>1996<td id="size">320609</tr>
      <tr><td><a href="//archive.org/download/ni-roms/roms/Sega%20-%20Mega%20Drive%20-%20Genesis.zip/Aladdin%20%28Europe%29.zip">Aladdin (Europe).zip</a><td><td>1996<td id="size">524288</tr>
      </table>`;
    expect(parseZipListing(html)).toEqual(['Aero Blasters (Japan).zip', 'Aladdin (Europe).zip']);
  });

  it('decodes HTML entities in names', () => {
    const html =
      '<a href="//archive.org/download/x/sys.zip/Tom%20%26%20Jerry.zip">Tom &amp; Jerry.zip</a>';
    expect(parseZipListing(html)).toEqual(['Tom & Jerry.zip']);
  });

  it('returns an empty list when there are no inner entries', () => {
    expect(parseZipListing('<html><body>nothing here</body></html>')).toEqual([]);
  });

  it('extracts inner entries from a .7z archive listing (Redump rr-sony-* style)', () => {
    const html = `
      <a href="//archive.org/download/rr-sony-playstation-u/usa/Bloody%20Roar%20II%20%28USA%29.7z/Bloody%20Roar%20II%20%28USA%29.bin">Bloody Roar II (USA).bin</a>
      <a href="//archive.org/download/rr-sony-playstation-u/usa/Bloody%20Roar%20II%20%28USA%29.7z/Bloody%20Roar%20II%20%28USA%29.cue">Bloody Roar II (USA).cue</a>`;
    expect(parseZipListing(html)).toEqual(['Bloody Roar II (USA).bin', 'Bloody Roar II (USA).cue']);
  });

  it('extracts inner entries from a .rar archive listing', () => {
    // Unconfirmed against a real restricted .rar item — included on the
    // same assumption as .7z above (view_archive.php uses the identical
    // <a href="...archive.rar/inner">inner</a> pattern). If that assumption
    // is wrong, a rar-based per-game archive just won't resolve, same as
    // "not found" today — not a crash.
    const html =
      '<a href="//archive.org/download/some-item/Game%20%28USA%29.rar/Game%20%28USA%29.bin">Game (USA).bin</a>';
    expect(parseZipListing(html)).toEqual(['Game (USA).bin']);
  });
});
