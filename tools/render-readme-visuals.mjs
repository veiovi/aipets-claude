// Documentation only: composite the mod's recorded frames, never redraw Luna.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { decodeFrames, pngBase64 } from '../plugin/hooks/luna.js'
import { newTurn, newSession, recordTool, finishTurn, statRows } from '../plugin/hooks/stats.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const out = root + 'docs/images/'
const assets = root + 'tools/readme-assets/'
const fontfile = assets + 'zen-regular.ttf'
process.env.FONTCONFIG_FILE = assets + 'fonts.conf'
// Claude's byte-array API is newer than Node 24; keep the adapter in this tool.
if (!Uint8Array.prototype.toBase64) Object.defineProperty(Uint8Array.prototype, 'toBase64', {
  value() { return Buffer.from(this).toString('base64') }, configurable: true,
})
const art = JSON.parse(await readFile(root + 'plugin/luna/luna.json', 'utf8'))
const frames = decodeFrames(new Uint8Array(await readFile(root + 'plugin/luna/frames.bin')), art.offsets, art.size)
const readme = await readFile(root + 'README.md', 'utf8')
const C = { cream: '#FAF7F1', ink: '#15171C', muted: '#6B7077', mint: '#C3E1CD', purple: '#D8D1EF', border: '#D6D0C6' }
const quote = "Two minutes and fourteen edits to change one word. You didn't rename a function, you threw it a full witness-protection relocation."
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)
const rect = (x, y, w, h, fill, r = 0, stroke = 'none') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`
const layer = (input, left, top) => ({ input, left, top })
const canvas = (w, h, background = C.cream) => sharp({ create: { width: w, height: h, channels: 4, background } })
async function text(s, size, width, color = C.ink) {
  return sharp({ text: { text: `<span foreground="${color}">${escape(s)}</span>`, font: `Zen Maru Gothic ${size}`, fontfile, width, rgba: true, spacing: 5 } }).png().toBuffer()
}
const memo = new Map()
async function luna(clip, tick, scale = 1) {
  const sequence = art.clips[clip]
  const id = sequence[tick % sequence.length]
  const key = `${id}:${scale}`
  if (!memo.has(key)) memo.set(key, sharp(Buffer.from(pngBase64(frames[id], art.palette, art.size), 'base64'))
    .resize(art.size * scale, art.size * scale, { kernel: 'nearest' }).png().toBuffer())
  return memo.get(key)
}
async function logo(width) {
  return sharp(out + 'logo-horizontal.png').resize({ width }).png().toBuffer()
}
async function png(name, base, layers) {
  await sharp(base).composite(layers).png().toFile(out + name)
}
async function gif(name, base, w, h, count, overlays, delay = 100) {
  const pages = []
  for (let i = 0; i < count; i++) pages.push(await sharp(base).composite(await overlays(i)).ensureAlpha().raw().toBuffer())
  await sharp(Buffer.concat(pages), { raw: { width: w, height: h * count, channels: 4, pageHeight: h } })
    .gif({ delay: Array(count).fill(delay), loop: 0, effort: 7, colours: 256, dither: 0 }).toFile(out + name)
  console.log(name)
}
await mkdir(out, { recursive: true })

// 120 × 3 needs 360 vertical pixels; 400 leaves a 20px margin on each side.
const heroBase = await sharp(assets + 'background.png').resize(960, 400, { fit: 'cover' }).composite([
  layer(await logo(150), 44, 30),
  layer(await text('A little Luna.\nA lighter workday.', 40, 480), 44, 119),
  layer(await text('Your tiny comic above the prompt.', 20, 470, C.muted), 46, 264),
  layer(await text('LUNA FOR CLAUDE', 13, 400, C.muted), 46, 346),
]).png().toBuffer()
const montage = ['keyboard', 'bug-net', 'coffee', 'crystal-ball', 'typewriter']
await gif('luna-hero.gif', heroBase, 960, 400, 60, async i => [
  layer(await luna(i < 40 ? montage[Math.floor(i / 8)] : 'speaking', i < 40 ? i % 8 : i - 40, 3), 570, 20),
])
const social = await sharp(assets + 'background.png').resize(1280, 640, { fit: 'cover' }).png().toBuffer()
const [r, g, b] = art.palette[frames[art.clips.excited[25]][0]]
const socialLuna = await canvas(420, 420, { r, g, b, alpha: 1 })
  .composite([layer(await luna('excited', 25, 3), 30, 30)]).png().toBuffer()
await png('social-preview.png', social, [
  layer(await logo(210), 64, 55),
  layer(await text('Luna for Claude', 52, 700), 64, 240),
  layer(await text('A tiny comic for your coding day.', 25, 620, C.muted), 67, 330),
  layer(socialLuna, 800, 125),
])

// Actual desktop recording, trimmed to the final reaction at its original size.
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', assets + 'luna-demo.mov',
  '-filter_complex', '[0:v]trim=start=25.5:end=37.9,setpts=PTS-STARTPTS,fps=10,split[a][b];' +
    '[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none',
  '-loop', '0', out + 'luna-demo.gif'], { stdio: 'inherit' })

// Generic UI illustration at 2.5× display resolution: 240px frame / 2.5 = 96 CSS px.
const uiW = 1920, uiH = 640
const header = [layer(await logo(180), 65, 27), layer(await text('DESKTOP BAND · ILLUSTRATION', 22, 800, C.muted), 1080, 43)]
const prompt = y => svg(uiW, uiH, rect(40, y, 1840, 95, '#202120', 30, '#5D605E') +
  '<path d="M1790 ' + (y + 35) + ' h30 v20 h-30 l10 -10 m-10 10 l10 10" fill="none" stroke="#999C98" stroke-width="3"/>')
const uiBase = await canvas(uiW, uiH).composite([
  ...header, layer(svg(uiW, uiH, rect(20, 110, 1880, 510, '#151615', 35) + rect(40, 135, 1840, 335, '#242523', 32)), 0, 0),
  layer(prompt(490), 0, 0),
]).png().toBuffer()
const line = await text('“' + quote + '”', 34, 1440, '#F1F1EC')
const label = await text('Luna', 30, 300, '#92958D')
const bandLayers = async (clip, tick, withLine) => [layer(await luna(clip, tick, 2), 65, 178),
  ...(withLine ? [layer(line, 350, 216), layer(label, 350, 371)] : [])]
await png('luna-band.png', uiBase, await bandLayers('speaking', 10, true))
const collapsed = await canvas(uiW, uiH).composite([...header,
  layer(svg(uiW, uiH, rect(20, 110, 1880, 510, '#151615', 35)), 0, 0), layer(prompt(490), 0, 0),
]).png().toBuffer()
await gif('luna-band.gif', uiBase, uiW, uiH, 65, async i => i >= 55
  ? [layer(collapsed, 0, 0)] : bandLayers(i < 25 ? 'keyboard' : 'speaking', i < 25 ? i : i - 25, i >= 25))

// Fictional events go through the same formatting function as the actual band.
const session = newSession()
let summary
for (let turnIndex = 0; turnIndex < 3; turnIndex++) {
  const turn = newTurn('Rename the greeting.')
  for (let i = 0; i < 8; i++) recordTool(turn, { tool: 'Edit', file_path: i < 6 ? 'greeting.ts' : 'greeting.test.ts' }, false)
  for (let i = 0; i < 4; i++) recordTool(turn, { tool: 'Bash', command: 'pnpm test' }, i === 0)
  for (let i = 0; i < 2; i++) recordTool(turn, { tool: 'Read' }, false)
  summary = finishTurn(session, turn, { durationMs: 120000, isAborted: false,
    usage: { input_tokens: 6800, cache_read_input_tokens: 27200, output_tokens: 2100 } })
}
const rows = statRows(summary, session)
const statsLayers = [layer(await luna('curious', 0, 2), 65, 178)]
for (const [i, [title, value]] of rows.entries()) {
  statsLayers.push(layer(await text(title, 27, 1450, C.mint), 350, 171 + i * 150))
  statsLayers.push(layer(await text(value, 26, 1450, '#F1F1EC'), 350, 215 + i * 150))
}
await png('luna-stats.png', uiBase, statsLayers)

const clips = [...art.acts, 'speaking']
const gridLayers = [layer(await logo(150), 24, 12), layer(await text('20 acts + her speaking loop', 22, 650, C.muted), 340, 27)]
for (let i = 0; i < clips.length; i++) {
  const x = 24 + i % 7 * 140, y = 89 + Math.floor(i / 7) * 174
  gridLayers.push(layer(await text(clips[i], 15, 136), x, y + 128))
}
const gridBase = await canvas(1008, 618).composite(gridLayers).png().toBuffer()
await gif('luna-clips.gif', gridBase, 1008, 618, 60, async tick => Promise.all(clips.map(async (clip, i) =>
  layer(await luna(clip, tick), 24 + i % 7 * 140, 89 + Math.floor(i / 7) * 174))))

// SVGs use generous line spacing and explicit palettes for GitHub's two themes.
function words(s, limit) {
  const lines = ['']
  for (const word of s.split(/\s+/)) {
    if (lines.at(-1).length + word.length + 1 > limit) lines.push('')
    lines[lines.length - 1] += (lines.at(-1) ? ' ' : '') + word
  }
  return lines
}
function vectorText(s, x, y, size, color, limit = 100, lineHeight = size * 1.5) {
  return `<text fill="${color}" font-family="'Zen Maru Gothic',system-ui,sans-serif" font-size="${size}">${words(s, limit)
    .map((line, i) => `<tspan x="${x}" y="${y + i * lineHeight}">${escape(line)}</tspan>`).join('')}</text>`
}
const privacy = readme.split('## What Luna sees\n')[1].split('## How it works')[0]
  .split('<picture>')[0].split('![')[0].trim()
const plain = s => s.replace(/[*`]/g, '').replace(/\s+/g, ' ').trim()
const never = plain(privacy.slice(privacy.indexOf('She never sees')))
const sees = privacy.slice(0, privacy.indexOf('She never sees')).split(/\n- /).map(plain)
const brandMark = (x, y) => `<image x="${x}" y="${y}" width="120" height="40" href="data:image/png;base64,${logoInline}"/>`
const logoInline = (await logo(240)).toString('base64')
for (const dark of [false, true]) {
  const bg = dark ? '#1F2229' : C.cream, ink = dark ? '#FFFAF4' : C.ink
  const muted = dark ? '#BDC2C8' : C.muted, panel = dark ? '#30363A' : '#F0EFE5'
  const suffix = dark ? '-dark' : ''
  let flow = rect(0, 0, 1080, 450, bg, 20) + vectorText('A little comic timing', 36, 54, 27, ink)
  const nodes = [['prompt.submit', 'Your sent prompt'], ['tool.call ×N', 'Names and counts'], ['turn.complete', 'The turn ends'],
    ['turn summary', 'Only small facts'], ['Sonnet line', '40 comedic voices'], ['band', 'Above your prompt']]
  for (const [i, [title, detail]] of nodes.entries()) {
    const x = 36 + i % 3 * 350, y = i < 3 ? 98 : 250
    flow += rect(x, y, 308, 105, panel, 15) + vectorText(title, x + 20, y + 39, 22, ink)
    flow += vectorText(detail, x + 20, y + 76, 17, muted)
    if (i % 3 < 2) flow += vectorText('→', x + 318, y + 61, 26, muted)
  }
  flow += `<path d="M886 211 v18 H190 v14" fill="none" stroke="${muted}" stroke-width="2"/>`
  flow += vectorText('↓', 181, 255, 19, muted)
  flow += vectorText('Desktop only. Terminal sessions are skipped.', 36, 410, 18, muted)
  flow += rect(915, 382, 132, 48, C.cream, 10) + brandMark(921, 386, dark)
  await writeFile(out + `how-it-works${suffix}.svg`, svg(1080, 450, flow))
  let privacySvg = rect(0, 0, 1120, 820, bg, 20) + vectorText('A small window into your work', 36, 58, 28, ink)
  privacySvg += rect(28, 93, 526, 700, panel, 18) + rect(572, 93, 520, 700, panel, 18)
  privacySvg += vectorText('Sees', 52, 143, 26, ink) + vectorText('Never sees', 596, 143, 26, ink)
  let y = 185
  for (const para of sees) {
    privacySvg += vectorText(para, 52, y, 19, ink, 43, 29)
    y += words(para, 43).length * 29 + 23
  }
  privacySvg += vectorText(never, 596, 185, 19, ink, 42, 29)
  privacySvg += rect(892, 713, 170, 54, C.cream, 10) + brandMark(917, 720)
  await writeFile(out + `what-luna-sees${suffix}.svg`, svg(1120, 820, privacySvg))
}
const generated = ['luna-hero.gif', 'luna-band.png', 'luna-band.gif', 'luna-stats.png', 'luna-clips.gif',
  'how-it-works.svg', 'how-it-works-dark.svg', 'what-luna-sees.svg', 'what-luna-sees-dark.svg', 'social-preview.png', 'luna-demo.gif']
for (const name of generated) {
  const bytes = (await stat(out + name)).size
  if (name.endsWith('.gif') && bytes >= 2500000) throw new Error(`${name} exceeds 2.5 MB: ${bytes}`)
  console.log(`${name}: ${bytes} bytes`)
}
