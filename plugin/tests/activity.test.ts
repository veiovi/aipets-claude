import { test, expect, mock } from 'claude-code/testing'
import { submittedProse, userOrigin } from '../hooks/activity.js'
import { HUMOR, pickFresh } from '../hooks/humor.js'
import { describeTurn, finishTurn, newSession, newTurn, recordTool, statRows } from '../hooks/stats.js'

const COMMAND = { command: 'aipets', origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 120 } }
const BAND = { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 20 }, view: {} }
const LINE = 'Fourteen edits to rename one function. Bold.'
const USAGE = { input_tokens: 1200, output_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 800 }

// One flat 120-pixel frame, run-length encoded as the recorder writes it, a model
// that answers with Luna's line, and the engine's side of a turn.
function engine(on, surfaces = ['desktop']) {
  const runs: number[] = []
  for (let left = 120 * 120; left > 0; left -= Math.min(255, left)) runs.push(Math.min(255, left), 0)
  const meta = { size: 120, fps: 10, palette: [[20, 40, 60]], offsets: [0, runs.length],
    acts: ['keyboard'], clips: { keyboard: [0], speaking: [0] } }
  const asked: string[] = []
  on('fs.read', (_, e) => ({ value: e.path.endsWith('luna.json') ? JSON.stringify(meta)
    : { base64: Uint8Array.from(runs).toBase64() } }))
  on('model.complete', (_, e) => {
    asked.push(e.prompt)
    return { value: { isAnswered: true, text: LINE, usage: USAGE } }
  })
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', (_, e) => e.file_path === '/repo/broken.ts'
    ? { result: 'failed', text: 'failed', isError: true } : { result: 'ok', text: 'ok' })
  on('session.surfaces', () => ({ value: surfaces }))
  on('ui.render', ($, e) => $.ui.resolve(e).Box({ children: [] }))
  mock.store(on)
  return { asked, clock: mock.clock(on) }
}

async function runTurn($, prompt) {
  await $.prompt.submit({ text: prompt, origin: { kind: 'composer' }, wait: false })
  await $.turn.start({ text: prompt, turnId: 't1' })
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/register.js', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Edit', file_path: '/repo/src/register.js', old_string: 'b', new_string: 'c' })
  await $.tool.call({ tool: 'Edit', file_path: '/repo/broken.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Bash', command: 'API_TOKEN=secret pnpm test' })
  await $.turn.complete({ answer: 'Done.', durationMs: 134000, isAborted: false, turnId: 't1',
    reason: 'answer', usage: { ...USAGE, model: 'claude' } })
}

test('humor styles rotate without repeating the recent ones', () => {
  expect(HUMOR.length).toBe(40)
  expect(pickFresh(HUMOR, HUMOR.slice(0, 39), () => 0.5)).toBe(HUMOR[39])
  expect(pickFresh(['only'], ['only'])).toBe('only')
})

test('Luna only sees submitted prose: no code, credentials or references', () => {
  const clean = submittedProse('I am frustrated. ```js\nconst secret = 3\n``` sk-abc-123 https://private.test/a /home/private/file')
  expect(clean.includes('frustrated')).toBe(true)
  expect(clean.includes('secret')).toBe(false)
  expect(clean.includes('sk-abc')).toBe(false)
  expect(clean.includes('private')).toBe(false)
  expect(userOrigin({ kind: 'peer' })).toBe(false)
})

test('turn stats keep names and counts only, never paths or secrets', () => {
  const turn = newTurn('rename it')
  recordTool(turn, { tool: 'Edit', file_path: '/Users/me/app/src/a.ts' }, false)
  recordTool(turn, { tool: 'Edit', file_path: '/Users/me/app/src/a.ts' }, true)
  recordTool(turn, { tool: 'Bash', command: 'TOKEN=abc123 curl https://x.test' }, false)
  recordTool(turn, { tool: 'Read', file_path: '/x', agentId: 'sub-1' }, false)
  const session = newSession()
  const summary = finishTurn(session, turn, { durationMs: 75000, isAborted: false, usage: USAGE })
  const told = describeTurn(summary)
  expect(told).toContain('Claude worked for 1m 15s.')
  expect(told).toContain('Files edited: a.ts ×2.')
  expect(told).toContain('Shell programs run: curl.')
  expect(told).toContain('1 tool calls failed.')
  expect(told).toContain('1 subagents helped.')
  expect(told.includes('/Users/me') || told.includes('abc123') || told.includes('x.test')).toBe(false)
  expect(statRows(summary, session).map(([label]) => label)).toEqual(['This turn', 'Session'])
})

test('after a turn Luna jokes about it on desktop, then collapses', async ($, on) => {
  const { asked, clock } = engine(on)
  await runTurn($, 'Rename getUser `const x = 1`')
  await clock.advance(10)
  expect(asked[0]).toContain('<latest>Rename getUser')
  expect(asked[0].includes('const x')).toBe(false)
  expect(asked[0]).toContain('Claude worked for 2m 14s.')
  expect(asked[0]).toContain('Files edited: register.js ×2, broken.ts.')
  expect(asked[0]).toContain('Shell programs run: pnpm.')
  expect(asked[0]).toContain('1 tool calls failed.')
  expect(asked[0].includes('secret')).toBe(false)
  const band = await $.ui.mount({ plugin: 'aipets', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ type: 'Svg' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /Fourteen edits/ })).toBeDefined()
  const terminal = await $.ui.mount({ plugin: 'aipets', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await terminal.find({ type: 'Text', text: /Fourteen edits/ })).toBeUndefined()
  await clock.advance(30000)
  const later = await $.ui.mount({ plugin: 'aipets', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await later.find({ type: 'Text', text: /Fourteen edits/ })).toBeUndefined()
})

test('a terminal-only session never wakes Luna or asks Claude', async ($, on) => {
  const { asked, clock } = engine(on, ['terminal'])
  await runTurn($, 'Refactor the parser')
  await clock.advance(10)
  expect(asked.length).toBe(0)
})

test('/aipets off keeps Luna away until /aipets brings her back', async ($, on) => {
  const { asked, clock } = engine(on)
  await $.command.run({ ...COMMAND, args: 'off' })
  await runTurn($, 'Refactor the parser')
  await clock.advance(10)
  expect(asked.length).toBe(0)
  await $.command.run({ ...COMMAND, args: '' })
  await runTurn($, 'Refactor the parser')
  await clock.advance(10)
  expect(asked.length).toBe(1)
})

test('stats mode keeps Luna up with this turn and the session', async ($, on) => {
  const { clock } = engine(on)
  const reply = await $.command.run({ ...COMMAND, args: 'stats' })
  expect(reply.text).toContain('Stats mode is on')
  await runTurn($, 'Rename getUser')
  await clock.advance(60000)
  const band = await $.ui.mount({ plugin: 'aipets', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ type: 'Text', text: /Fourteen edits/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /4 tool calls/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /most edited register\.js ×2/ })).toBeDefined()
  await $.command.run({ ...COMMAND, args: 'stats' })
})

test('/aipets when prompt makes her show up as the prompt is sent instead',
  async ($, on) => {
    const { asked, clock } = engine(on)
    const reply = await $.command.run({ ...COMMAND, args: 'when prompt' })
    expect(reply.text).toContain('She shows up when you send a prompt')
    await runTurn($, 'Rename getUser')
    await clock.advance(10)
    expect(asked.length).toBe(1)
    expect(asked[0]).toContain('Claude has not started on it yet')
  })

test('/aipets when both makes her show up on the prompt and again after the turn',
  async ($, on) => {
    const { asked, clock } = engine(on)
    const reply = await $.command.run({ ...COMMAND, args: 'when both' })
    expect(reply.text).toContain('She shows up when you send a prompt and after Claude finishes')
    await runTurn($, 'Rename getUser')
    await clock.advance(10)
    expect(asked.length).toBe(2)
    expect(asked[1]).toContain('Claude worked for 2m 14s.')
  })

test('/aipets stay next keeps her until the next prompt', async ($, on) => {
  const { clock } = engine(on)
  const reply = await $.command.run({ ...COMMAND, args: 'stay next' })
  expect(reply.text).toContain('stays until your next prompt')
  expect((await $.command.run({ ...COMMAND, args: 'stay forever' })).text).toContain('Use /aipets stay')
  await runTurn($, 'Rename getUser')
  await clock.advance(120000)
  const band = await $.ui.mount({ plugin: 'aipets', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ type: 'Text', text: /Fourteen edits/ })).toBeDefined()
  await $.prompt.submit({ text: 'Next thing', origin: { kind: 'composer' }, wait: false })
  const after = await $.ui.mount({ plugin: 'aipets', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await after.find({ type: 'Text', text: /Fourteen edits/ })).toBeUndefined()
})
