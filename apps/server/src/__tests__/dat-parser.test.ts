import { describe, it, expect } from 'vitest';
import { parseDat } from '../services/dat/parser.js';

const MINIMAL_NO_INTRO = `<?xml version="1.0"?>
<datafile>
  <header>
    <name>Test System</name>
    <url>https://www.no-intro.org</url>
  </header>
  <game name="Test Game (USA)">
    <description>Test Game (USA)</description>
    <rom name="Test Game (USA).rom" size="1024" crc="aabbccdd" md5="aabbccddaabbccddaabbccddaabbccdd" sha1="aabbccddaabbccddaabbccddaabbccddaabbccdd"/>
  </game>
</datafile>`;

const REDUMP_MULTI_ROM = `<?xml version="1.0"?>
<datafile>
  <header>
    <name>Sony - PlayStation</name>
    <url>http://redump.org</url>
  </header>
  <game name="Game (USA) (Disc 1)">
    <description>Game (USA) (Disc 1)</description>
    <rom name="Game (USA) (Disc 1).cue" size="87" crc="aabbcc01" md5="aabbcc01aabbcc01aabbcc01aabbcc01" sha1="aabbcc01aabbcc01aabbcc01aabbcc01aabbcc01"/>
    <rom name="Game (USA) (Disc 1).bin" size="734003008" crc="aabbcc02" md5="aabbcc02aabbcc02aabbcc02aabbcc02" sha1="aabbcc02aabbcc02aabbcc02aabbcc02aabbcc02"/>
  </game>
</datafile>`;

const MISSING_HEADER = `<?xml version="1.0"?>
<datafile>
  <game name="Orphan Game (Japan)">
    <description>Orphan Game (Japan)</description>
    <rom name="Orphan Game (Japan).rom" size="2048" crc="deadbeef" md5="deadbeefdeadbeefdeadbeefdeadbeef" sha1="deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"/>
  </game>
</datafile>`;

const WITH_NODUMP = `<?xml version="1.0"?>
<datafile>
  <header>
    <name>Test System</name>
    <url>https://www.no-intro.org</url>
  </header>
  <game name="Missing Game (USA)">
    <description>Missing Game (USA)</description>
    <rom name="Missing Game (USA).rom" size="0" crc="00000000" status="nodump"/>
  </game>
</datafile>`;

const UNICODE_NAMES = `<?xml version="1.0"?>
<datafile>
  <header>
    <name>Sony - PlayStation</name>
    <url>http://redump.org</url>
  </header>
  <game name="ファイナルファンタジーVII (Japan)">
    <description>ファイナルファンタジーVII (Japan)</description>
    <rom name="ファイナルファンタジーVII (Japan).bin" size="734003008" crc="cafe1234" md5="cafe1234cafe1234cafe1234cafe1234" sha1="cafe1234cafe1234cafe1234cafe1234cafe1234"/>
  </game>
</datafile>`;

describe('parseDat', () => {
  it('parses a minimal No-Intro DAT', () => {
    const result = parseDat(MINIMAL_NO_INTRO);
    expect(result.source).toBe('no-intro');
    expect(result.system).toBe('Test System');
    expect(result.games).toHaveLength(1);
    expect(result.games[0]?.name).toBe('Test Game (USA)');
    expect(result.games[0]?.roms[0]?.crc).toBe('aabbccdd');
  });

  it('normalises CRC to lowercase', () => {
    const result = parseDat(MINIMAL_NO_INTRO);
    const crc = result.games[0]?.roms[0]?.crc;
    expect(crc).toBe(crc?.toLowerCase());
  });

  it('detects redump source', () => {
    const result = parseDat(REDUMP_MULTI_ROM);
    expect(result.source).toBe('redump');
  });

  it('parses multi-ROM game (Redump)', () => {
    const result = parseDat(REDUMP_MULTI_ROM);
    expect(result.games[0]?.roms).toHaveLength(2);
  });

  it('falls back to fallbackName when header is missing', () => {
    const result = parseDat(MISSING_HEADER, 'Fallback System');
    expect(result.system).toBe('Fallback System');
  });

  it('defaults source to no-intro when header is missing', () => {
    const result = parseDat(MISSING_HEADER);
    expect(result.source).toBe('no-intro');
  });

  it('parses nodump ROM with status field', () => {
    const result = parseDat(WITH_NODUMP);
    expect(result.games[0]?.roms[0]?.status).toBe('nodump');
  });

  it('parses unicode game names without mangling', () => {
    const result = parseDat(UNICODE_NAMES);
    expect(result.games[0]?.name).toBe('ファイナルファンタジーVII (Japan)');
  });

  it('throws on malformed XML', () => {
    expect(() => parseDat('<not valid xml <')).toThrow();
  });

  it('throws on XML missing <datafile> root', () => {
    expect(() => parseDat('<root><something/></root>')).toThrow(/missing <datafile>/i);
  });

  it('assigns stable game ids', () => {
    const a = parseDat(MINIMAL_NO_INTRO);
    const b = parseDat(MINIMAL_NO_INTRO);
    expect(a.games[0]?.id).toBe(b.games[0]?.id);
  });

  it('extracts region from game name', () => {
    const result = parseDat(MINIMAL_NO_INTRO);
    expect(result.games[0]?.region).toEqual(['USA']);
  });
});
