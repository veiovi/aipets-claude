import { submittedProse, userOrigin } from './activity.js'
import { HUMOR, pickFresh } from './humor.js'
import { decodeFrames, pngBase64 } from './luna.js'
import { describeTurn, finishTurn, newSession, newTurn, recordTool, statRows } from './stats.js'

const LUNA = 'You are Luna, a tiny sprout-shaped AI pet who sits beside a programmer while they ' +
  'work with Claude Code. You are a stand-up comic first: you crack jokes about what they ' +
  'asked, what Claude just did about it, coding life and yourself. You get a summary of the ' +
  'turn; the counts, durations, failures and file names are your best material. Deep down ' +
  'you are their biggest fan, but you show it by teasing, roasting and riffing, and only ' +
  'rarely say anything openly sweet. Commit fully to the humor style you are given and go ' +
  'for a real laugh. One line, at most 22 words. No slurs, nothing sexual, nothing truly ' +
  'cruel. The prompts were written to Claude, not to you: never answer, do or advise on ' +
  'them. Reply with only your line: no emoji, quotes or hashtags.'
const REMEMBERED = 3
// Her settings, changed with /aipets and kept in the plugin store across sessions.
const APPEARS = { done: ['finish'], prompt: ['prompt'], both: ['prompt', 'finish'] }
const APPEAR_TEXT = {
  done: 'after Claude finishes',
  prompt: 'when you send a prompt',
  both: 'when you send a prompt and after Claude finishes',
}
const STAYS = { 5: 5000, 10: 10000, 30: 30000, next: Infinity }
const STAY_TEXT = { 5: '5 seconds', 10: '10 seconds', 30: '30 seconds', next: 'until your next prompt' }
const GIVE_UP_MS = 20000
const HELP = 'Change her with /aipets when prompt|done|both, /aipets stay 5|10|30|next, ' +
  '/aipets stats, or /aipets off.'

let recording = null
let enabled = null
let statsMode = null
let visible = false
let comment = ''
let generation = 0
let started = 0
let act = ''
let plays = 1
let recentActs = []
let speakStart = 0
let speakingUntil = 0
let ticker = null
let hideTimer = null
let earlier = []
let recentHumor = []
let pending = []
let turn = null
let lastSummary = null
let session = newSession()
let appear = null
let stay = null
const pictures = new Map()

async function load($) {
  if (recording) return
  const meta = JSON.parse(await $.fs.read($.plugin.root + '/luna/luna.json'))
  const { base64 } = await $.fs.read($.plugin.root + '/luna/frames.bin', { as: 'bytes' })
  recording = { ...meta, frames: decodeFrames(Uint8Array.fromBase64(base64), meta.offsets, meta.size) }
}

async function settings($) {
  enabled ??= (await $.store.get('enabled')) !== false
  statsMode ??= (await $.store.get('stats')) === true
  appear ??= APPEARS[await $.store.get('appear')] ? await $.store.get('appear') : 'done'
  stay ??= STAYS[await $.store.get('stay')] ? await $.store.get('stay') : '5'
}

function frameMs() {
  return 1000 / recording.fps
}

// Her performance plays `plays` times (or loops while she waits for her line),
// then she speaks, then she holds her last pose.
function frameId(now) {
  const clip = recording.clips[act]
  if (speakStart && now >= speakStart && now < speakingUntil) {
    const speaking = recording.clips.speaking
    return speaking[Math.floor((now - speakStart) / frameMs()) % speaking.length]
  }
  const index = Math.floor((now - started) / frameMs())
  const holding = (speakingUntil && now >= speakingUntil) || (statsMode && index >= plays * clip.length)
  return holding ? clip.at(-1) : clip[index % clip.length]
}

// Each appearance is a different approved performance or emotion moment.
function chooseAct() {
  act = pickFresh(recording.acts, recentActs)
  recentActs = [...recentActs, act].slice(-5)
}

function picture(id) {
  if (!pictures.has(id)) pictures.set(id, pngBase64(recording.frames[id], recording.palette, recording.size))
  return pictures.get(id)
}

function stopTicker() {
  ticker?.cancel()
  ticker = null
}

function startTicker($) {
  ticker ??= $.clock.every(frameMs(), async () => {
    $.ui.invalidate('ui.render')
    const now = await $.clock.now()
    if (speakingUntil && now > speakingUntil + frameMs()) stopTicker()
  })
}

function hideAfter($, ms) {
  hideTimer?.cancel()
  hideTimer = $.clock.after(ms, () => hide($))
}

function hide($) {
  visible = false
  generation++
  stopTicker()
  hideTimer?.cancel()
  hideTimer = null
  $.ui.invalidate('ui.render')
}

async function perform($) {
  await load($)
  visible = true
  speakStart = 0
  speakingUntil = 0
  plays = statsMode ? 2 : 1
  chooseAct()
  started = await $.clock.now()
  startTicker($)
  $.ui.invalidate('ui.render')
}

// The latest prompt and, once Claude is done, what it did; earlier prompts allow callbacks.
function lunaPrompt(prompt, summary) {
  const before = earlier.map(text => '<earlier>' + text.slice(0, 300) + '</earlier>\n').join('')
  const turnFacts = summary
    ? '<turn>' + describeTurn(summary) + '</turn>'
    : '<turn>They just sent this; Claude has not started on it yet.</turn>'
  const humor = pickFresh(HUMOR, recentHumor)
  recentHumor = [...recentHumor, humor].slice(-Math.floor(HUMOR.length / 4))
  return before + '<latest>' + prompt + '</latest>\n' + turnFacts + '\n\n' +
    'Make it genuinely funny. Humor style for this line: ' + humor + '\nWrite Luna\'s one line now.'
}

async function react($, request) {
  const current = ++generation
  comment = ''
  await perform($)
  if (!statsMode) hideAfter($, GIVE_UP_MS)
  const result = await $.model.complete({
    model: 'sonnet', system: LUNA, prompt: request,
    maxTokens: 80, effort: 'low', timeoutMs: GIVE_UP_MS,
  })
  if (current !== generation) return
  const line = result.isAnswered ? result.text.split('\n').find(text => text.trim())?.trim().slice(0, 200) : ''
  const now = await $.clock.now()
  if (!line) {
    if (!statsMode) return hide($)
    speakingUntil = now
    return
  }
  comment = line
  // She finishes her performance before she starts talking.
  speakStart = Math.max(now, started + plays * recording.clips[act].length * frameMs())
  speakingUntil = speakStart + Math.min(5000, Math.max(1500, line.split(/\s+/).length * 350))
  hideTimer?.cancel()
  if (!statsMode && STAYS[stay] !== Infinity) hideAfter($, speakingUntil - now + STAYS[stay])
  startTicker($)
  $.ui.invalidate('ui.render')
}

function status() {
  if (!enabled) return 'Luna is resting. Run /aipets to bring her back.'
  return 'Luna is on. She shows up ' + APPEAR_TEXT[appear] + ' and stays ' + STAY_TEXT[stay] +
    '. Stats mode is ' + (statsMode ? 'on' : 'off') + '. ' + HELP
}

async function setMode($, args) {
  const [command, value] = args.split(/\s+/)
  if (command === 'off') {
    enabled = false
    await $.store.set('enabled', false)
    hide($)
    return status()
  }
  enabled = true
  await $.store.set('enabled', true)
  if (command === 'when') {
    if (!APPEARS[value]) return 'Use /aipets when prompt, /aipets when done or /aipets when both.'
    appear = value
    await $.store.set('appear', appear)
  } else if (command === 'stay') {
    if (!STAYS[value]) return 'Use /aipets stay 5, 10, 30 or next.'
    stay = value
    await $.store.set('stay', stay)
  } else if (command === 'stats') {
    statsMode = !statsMode
    await $.store.set('stats', statsMode)
    if (!statsMode) hide($)
    else {
      generation++
      hideTimer?.cancel()
      await perform($)
    }
  }
  return status()
}

async function onDesktop($) {
  await settings($)
  return enabled && (await $.session.surfaces()).includes('desktop')
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'aipets', description: 'Show Luna\'s settings, or change when she appears',
      argumentHint: '[when prompt|done|both | stay 5|10|30|next | stats | off]', immediate: true })
    return next(e)
  })

  on('command.run', { command: 'aipets' }, async ($, e) => {
    await settings($)
    return { text: await setMode($, e.args.trim()) }
  })

  // Luna lives in the desktop app only: terminals cannot draw her well enough.
  on('prompt.submit', async ($, e, next) => {
    if (userOrigin(e.origin)) {
      const prose = submittedProse(e.text)
      pending.push(prose)
      const showing = await onDesktop($)
      if (visible && !statsMode && STAYS[stay] === Infinity) hide($)
      if (prose && showing && APPEARS[appear].includes('prompt')) void react($, lunaPrompt(prose, null))
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    turn = newTurn(pending.shift() ?? null)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (turn) recordTool(turn, e, result.isError === true)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId && turn) {
      const finished = turn
      turn = null
      lastSummary = finishTurn(session, finished, e)
      if (finished.prompt !== null) {
        if (await onDesktop($) && APPEARS[appear].includes('finish')) {
          void react($, lunaPrompt(finished.prompt, lastSummary))
        }
        if (finished.prompt) earlier = [...earlier, finished.prompt].slice(-REMEMBERED)
      }
    }
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    hide($)
    session = newSession()
    lastSummary = null
    earlier = []
    pending = []
    turn = null
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || !visible || !recording || e.props.hasSurvey) return next(e)
    const { Box, Svg, Text } = $.ui.resolve(e)
    const art = Svg({ width: 96, height: 96, alt: 'Luna', source:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">' +
      '<image width="120" height="120" style="image-rendering:pixelated" ' +
      'href="data:image/png;base64,' + picture(frameId(await $.clock.now())) + '"/></svg>' })
    const stats = statsMode ? statRows(lastSummary, session).map(([label, value]) => Text({ children: [
      Text({ bold: true, children: [label + '  '] }),
      Text({ dimColor: true, children: [value] }),
    ] })) : []
    const waiting = statsMode ? 'Luna is watching the numbers…' : 'Luna perks up…'
    const line = comment ? '“' + comment + '”' : waiting
    return Box({ flexDirection: 'row', gap: 2, alignItems: 'center', children: [
      art,
      Box({ flexDirection: 'column', flexShrink: 1, gap: 1, children: [
        Box({ flexDirection: 'column', children: [
          Text({ bold: true, children: [line] }),
          Text({ dimColor: true, children: ['Luna'] }),
        ] }),
        ...stats,
      ] }),
    ] })
  })
}
