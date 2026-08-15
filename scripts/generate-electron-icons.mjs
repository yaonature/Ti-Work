#!/usr/bin/env node
/**
 * 生成 Ti Work 品牌图标（纯 Node PNG 编码，零依赖）：
 *  - build/icon.ico                    —— 多尺寸 ICO（16/24/32/48/64/128/256），Windows 安装包/应用/快捷方式图标
 *  - build/icon.png                    —— 256x256，mac icns / linux png 由 electron-builder 转换
 *  - electron/tray-icon.ts             —— 32x32 内嵌 data URL，主进程托盘/窗口图标
 *  - public/hermes-icon-192.png / -512 —— PWA 图标（manifest.json 引用）
 *  - public/apple-touch-icon.png       —— iOS 主屏图标（__root.tsx 引用）
 *
 * 图案：扶桑树（品牌蓝渐变）托举金乌之日（金色日轮）——日出扶桑，与 public/ti-work-logo.svg 同源构图。
 * 运行：node scripts/generate-electron-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const BG_RGB = [29, 29, 32] // #1D1D20
const TREE_RGB = [54, 140, 255] // 品牌蓝 #368CFF
const SUN_RGB = [255, 176, 32] // 金乌金 #FFB020
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(size, rgba) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const idat = deflateSync(raw)
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * 打包多尺寸 PNG 为 Windows ICO（Vista+ 支持 PNG 内嵌）。
 * ICO 结构：ICONDIR(6B) + N × ICONDIRENTRY(16B) + 依次拼接各尺寸 PNG 数据。
 */
function encodeIco(pngBySize) {
  const sizes = Object.keys(pngBySize)
    .map(Number)
    .sort((a, b) => a - b)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(sizes.length, 4)
  const entries = []
  let offset = 6 + sizes.length * 16
  for (const size of sizes) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // height (0 = 256)
    entry.writeUInt8(0, 2) // color count
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // planes
    entry.writeUInt16LE(32, 6) // bit count
    const png = pngBySize[size]
    entry.writeUInt32LE(png.length, 8) // bytes in resource
    entry.writeUInt32LE(offset, 12) // image offset
    offset += png.length
    entries.push(entry)
  }
  return Buffer.concat([
    header,
    ...entries,
    ...sizes.map((size) => pngBySize[size]),
  ])
}

/**
 * 三次贝塞尔曲线采样（坐标归一化 0..1，与 SVG 同源控制点）。
 * 返回 [[x,y], ...] 采样点数组。
 */
function sampleBezier(p0, p1, p2, p3, steps) {
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const mt = 1 - t
    pts.push([
      mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
      mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
    ])
  }
  return pts
}

function mirror(pts) {
  return pts.map(([x, y]) => [1 - x, y])
}

// 扶桑树各段（归一化坐标 + 半宽；与 ti-work-logo.svg 对应）
const TRUNK = { pts: [[0.5, 0.938], [0.5, 0.727]], hw: 15 / 256 / 2 }
const ROOT_L = sampleBezier([0.5, 0.938], [0.422, 0.949], [0.367, 0.969], [0.328, 0.992], 12)
const BOUGH1 = sampleBezier([0.5, 0.789], [0.336, 0.758], [0.211, 0.625], [0.148, 0.43], 16)
const BOUGH2 = sampleBezier([0.5, 0.727], [0.383, 0.695], [0.273, 0.578], [0.211, 0.383], 16)
const TWIG = sampleBezier([0.5, 0.672], [0.43, 0.641], [0.375, 0.594], [0.352, 0.539], 12)

const TREE_SHAPES = [
  { pts: TRUNK.pts, hw: TRUNK.hw },
  { pts: ROOT_L, hw: 10 / 256 / 2 },
  { pts: mirror(ROOT_L), hw: 10 / 256 / 2 },
  { pts: BOUGH1, hw: 11 / 256 / 2 },
  { pts: mirror(BOUGH1), hw: 11 / 256 / 2 },
  { pts: BOUGH2, hw: 9 / 256 / 2 },
  { pts: mirror(BOUGH2), hw: 9 / 256 / 2 },
  { pts: TWIG, hw: 6 / 256 / 2 },
  { pts: mirror(TWIG), hw: 6 / 256 / 2 },
]

const SUN_CX = 0.5
const SUN_CY = 96 / 256
const SUN_R = 32 / 256

function paintBrandMark(size) {
  const rgba = Buffer.alloc(size * size * 4)
  const corner = Math.round(size * 0.22)
  const edge = size - 1
  const halfPx = 0.5 / size
  // 小尺寸兜底：任何笔触至少 0.9px 可见
  const minHw = 0.9 / size

  for (let y = 0; y < size; y++) {
    const ny = (y + 0.5) / size
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const xr = x < corner ? corner - x : x > edge - corner ? x - (edge - corner) : 0
      const yr = y < corner ? corner - y : y > edge - corner ? y - (edge - corner) : 0
      const insideRound = xr * xr + yr * yr <= corner * corner
      if (!insideRound) continue

      const nx = (x + 0.5) / size

      // 金乌之日（日轮最上层）
      const dx = nx - SUN_CX
      const dy = ny - SUN_CY
      if (dx * dx + dy * dy <= SUN_R * SUN_R) {
        rgba[idx] = SUN_RGB[0]
        rgba[idx + 1] = SUN_RGB[1]
        rgba[idx + 2] = SUN_RGB[2]
        rgba[idx + 3] = 255
        continue
      }

      // 扶桑树（品牌蓝笔触）
      let onTree = false
      for (const shape of TREE_SHAPES) {
        const hw = Math.max(shape.hw, minHw) + halfPx
        let hit = false
        for (const [px, py] of shape.pts) {
          const ex = nx - px
          const ey = ny - py
          if (ex * ex + ey * ey <= hw * hw) {
            hit = true
            break
          }
        }
        if (hit) {
          onTree = true
          break
        }
      }
      if (onTree) {
        rgba[idx] = TREE_RGB[0]
        rgba[idx + 1] = TREE_RGB[1]
        rgba[idx + 2] = TREE_RGB[2]
        rgba[idx + 3] = 255
        continue
      }

      // 深色底
      rgba[idx] = BG_RGB[0]
      rgba[idx + 1] = BG_RGB[1]
      rgba[idx + 2] = BG_RGB[2]
      rgba[idx + 3] = 255
    }
  }
  return rgba
}

const icon256 = encodePng(256, paintBrandMark(256))
mkdirSync(join(ROOT, 'build'), { recursive: true })
writeFileSync(join(ROOT, 'build', 'icon.png'), icon256)

// Windows ICO：多尺寸内嵌 PNG（16/24/32/48/64/128/256），供 electron-builder win.icon / nsis 使用
const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const pngBySize = {}
for (const size of icoSizes) {
  pngBySize[size] = encodePng(size, paintBrandMark(size))
}
const iconIco = encodeIco(pngBySize)
writeFileSync(join(ROOT, 'build', 'icon.ico'), iconIco)

const tray32 = encodePng(32, paintBrandMark(32))
const dataUrl = `data:image/png;base64,${tray32.toString('base64')}`
const trayTs = `/**
 * 自动生成：node scripts/generate-electron-icons.mjs —— 请勿手改。
 * 32x32 品牌托盘图标（data URL），由主进程 nativeImage.createFromDataURL 加载。
 */
export const TRAY_ICON_DATA_URL = '${dataUrl}'
`
writeFileSync(join(ROOT, 'electron', 'tray-icon.ts'), trayTs)

// PWA / iOS 图标（public/，manifest.json 与 __root.tsx 引用）
const pwaOutputs = [
  ['hermes-icon-192.png', 192],
  ['hermes-icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]
for (const [fileName, size] of pwaOutputs) {
  writeFileSync(join(ROOT, 'public', fileName), encodePng(size, paintBrandMark(size)))
}

console.log(`wrote build/icon.png (${icon256.length} bytes)`)
console.log(`wrote build/icon.ico (${iconIco.length} bytes, ${icoSizes.join('/')})`)
console.log(`wrote electron/tray-icon.ts (${trayTs.length} bytes)`)
for (const [fileName, size] of pwaOutputs) {
  console.log(`wrote public/${fileName} (${size}x${size})`)
}
