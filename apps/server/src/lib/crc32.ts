import { createReadStream } from 'node:fs';

const TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c;
  }
  return t;
})();

function update(crc: number, buf: Buffer): number {
  let c = crc ^ 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (TABLE[(c ^ (buf[i] as number)) & 0xff] as number) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function computeCrc32Buffer(buf: Buffer): string {
  return update(0, buf).toString(16).padStart(8, '0');
}

export class Crc32Accumulator {
  private state = 0xffffffff;

  feed(buf: Buffer): void {
    let c = this.state;
    for (let i = 0; i < buf.length; i++) {
      c = ((TABLE[(c ^ (buf[i] as number)) & 0xff] as number) ^ (c >>> 8)) >>> 0;
    }
    this.state = c;
  }

  digest(): string {
    return ((this.state ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
  }
}

/** The CRC32 of a file, from byte `start` to its end. */
export function computeCrc32(filePath: string, start = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    let crc = 0;
    const stream = createReadStream(filePath, { start });
    stream.on('data', (chunk) => {
      crc = update(crc, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => resolve(crc.toString(16).padStart(8, '0')));
    stream.on('error', reject);
  });
}
