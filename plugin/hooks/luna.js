// Luna's recorded frames, decoded and drawn for the pane. The recording comes
// from the canonical player (tools/render-luna.mjs); this file only plays it.

const SAME = 255

/** Decodes the delta run-length frames into one palette-index array per frame. */
export function decodeFrames(bytes, offsets, size) {
  const frames = []
  let previous = new Uint8Array(size * size)
  for (let f = 0; f + 1 < offsets.length; f++) {
    const frame = new Uint8Array(size * size)
    let pixel = 0
    for (let i = offsets[f]; i < offsets[f + 1]; i += 2) {
      const length = bytes[i]
      const value = bytes[i + 1]
      for (let n = 0; n < length; n++, pixel++) {
        frame[pixel] = value === SAME ? previous[pixel] : value
      }
    }
    if (pixel !== frame.length) throw Error('Luna frame ' + f + ' is damaged.')
    frames.push(frame)
    previous = frame
  }
  return frames
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1
  return c >>> 0
})

function crc32(bytes) {
  let c = 0xffffffff
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ c >>> 8
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const body = new Uint8Array(4 + data.length)
  body.set([...type].map(c => c.charCodeAt(0)))
  body.set(data, 4)
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(body, 4)
  view.setUint32(8 + data.length, crc32(body))
  return out
}

/** An indexed-colour PNG of one frame, stored without compression (no zlib here). */
export function pngBase64(frame, palette, size) {
  const header = new Uint8Array(13)
  const headerView = new DataView(header.buffer)
  headerView.setUint32(0, size)
  headerView.setUint32(4, size)
  header.set([8, 3, 0, 0, 0], 8)

  const scanlines = new Uint8Array(size * (size + 1))
  for (let y = 0; y < size; y++) scanlines.set(frame.subarray(y * size, (y + 1) * size), y * (size + 1) + 1)
  let a = 1
  let b = 0
  for (const byte of scanlines) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  // One stored deflate block holds up to 65535 bytes: 120 rows of 121 fit.
  const zlib = new Uint8Array(2 + 5 + scanlines.length + 4)
  const zlibView = new DataView(zlib.buffer)
  zlib.set([0x78, 0x01, 0x01], 0)
  zlibView.setUint16(3, scanlines.length, true)
  zlibView.setUint16(5, ~scanlines.length & 0xffff, true)
  zlib.set(scanlines, 7)
  zlibView.setUint32(7 + scanlines.length, (b << 16 | a) >>> 0)

  const parts = [
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk('IHDR', header),
    chunk('PLTE', Uint8Array.from(palette.flat())),
    chunk('IDAT', zlib),
    chunk('IEND', new Uint8Array()),
  ]
  const png = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let at = 0
  for (const part of parts) {
    png.set(part, at)
    at += part.length
  }
  return png.toBase64()
}
