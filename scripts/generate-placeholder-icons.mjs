/**
 * Generates the placeholder PWA icons for Habittra.
 *
 * These are throwaway placeholders. Replace `public/pwa-*.png` and
 * `public/apple-touch-icon.png` with real artwork before release, or delete this
 * script. It exists so the repo has valid PNGs at the sizes the web manifest
 * requires without pulling in an image-processing dependency.
 *
 * Usage: node scripts/generate-placeholder-icons.mjs
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

import { fileURLToPath } from 'node:url'

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url))

const BACKGROUND = [0x2f, 0x2f, 0x2f]
const ACCENT = [0x7d, 0xd3, 0xa0]

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)

  const typeBytes = Buffer.from(type, 'ascii')

  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0)

  return Buffer.concat([length, typeBytes, data, crc])
}

function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: truecolour with alpha
  ihdr[10] = 0 // compression: deflate
  ihdr[11] = 0 // filter: adaptive
  ihdr[12] = 0 // interlace: none

  const stride = size * 4
  const raw = Buffer.alloc(size * (stride + 1))
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (stride + 1)
    raw[rowStart] = 0 // filter type 0 (None)
    pixels.copy(raw, rowStart + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * Draws a filled circle centred on a solid background, supersampled 4x4 per pixel
 * so the edge is not jagged.
 */
function drawIcon(size, radiusRatio) {
  const pixels = Buffer.alloc(size * size * 4)
  const center = size / 2
  const radius = size * radiusRatio
  const samples = 4
  const step = 1 / samples

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let hits = 0

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) * step
          const py = y + (sy + 0.5) * step
          const dx = px - center
          const dy = py - center

          if (Math.hypot(dx, dy) <= radius) {
            hits += 1
          }
        }
      }

      const coverage = hits / (samples * samples)
      const offset = (y * size + x) * 4

      for (let channel = 0; channel < 3; channel += 1) {
        const base = BACKGROUND[channel]
        const mark = ACCENT[channel]
        pixels[offset + channel] = Math.round(base + (mark - base) * coverage)
      }

      pixels[offset + 3] = 0xff
    }
  }

  return pixels
}

const TARGETS = [
  // Maskable icons must keep their content inside the central 80% safe zone,
  // so the mark is drawn smaller for the maskable variant.
  { file: 'pwa-192x192.png', size: 192, radiusRatio: 0.34 },
  { file: 'pwa-512x512.png', size: 512, radiusRatio: 0.34 },
  { file: 'pwa-maskable-512x512.png', size: 512, radiusRatio: 0.26 },
  { file: 'apple-touch-icon.png', size: 180, radiusRatio: 0.34 },
]

for (const { file, size, radiusRatio } of TARGETS) {
  const png = encodePng(size, drawIcon(size, radiusRatio))
  writeFileSync(join(PUBLIC_DIR, file), png)
  process.stdout.write(`wrote public/${file} (${size}x${size}, ${png.length} bytes)\n`)
}
