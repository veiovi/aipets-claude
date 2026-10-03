// What Claude did in a turn and across the session: names and counts only, never
// file contents, command output or Claude's replies.

const EDITORS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])

export function newTurn(prompt = '') {
  return { prompt, tools: new Map(), files: new Map(), commands: new Map(), failures: 0, subagents: new Set() }
}

export function newSession() {
  return {
    turns: 0, workedMs: 0, longestMs: 0, toolCalls: 0, tools: new Map(), files: new Map(),
    failures: 0, subagents: 0, interrupted: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0,
  }
}

function bump(map, key, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by)
}

function basename(path) {
  return String(path ?? '').split(/[\\/]/).filter(Boolean).at(-1) ?? ''
}

// The program a shell command runs, skipping environment assignments that may hold secrets.
function program(command) {
  const word = String(command ?? '').trim().split(/\s+/).find(part => part && !part.includes('='))
  return word && /^[\w./-]+$/.test(word) ? basename(word) : ''
}

/** Records one tool call of the turn; a subagent's calls only mark that it ran. */
export function recordTool(turn, call, isError) {
  if (call.agentId) {
    turn.subagents.add(call.agentId)
    return
  }
  bump(turn.tools, call.tool)
  if (isError) turn.failures++
  if (EDITORS.has(call.tool)) {
    const file = basename(call.file_path ?? call.notebook_path)
    if (file) bump(turn.files, file)
  }
  if (call.tool === 'Bash') {
    const name = program(call.command)
    if (name) bump(turn.commands, name)
  }
}

/** Closes the turn into a summary and adds it to the session totals. */
export function finishTurn(session, turn, complete) {
  const usage = complete.usage ?? {}
  const summary = {
    durationMs: complete.durationMs,
    isAborted: complete.isAborted,
    toolCalls: [...turn.tools.values()].reduce((total, count) => total + count, 0),
    tools: turn.tools,
    files: turn.files,
    commands: turn.commands,
    failures: turn.failures,
    subagents: turn.subagents.size,
    inputTokens: (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens ?? 0,
    cachedTokens: usage.cache_read_input_tokens ?? 0,
  }
  session.turns++
  session.workedMs += summary.durationMs
  session.longestMs = Math.max(session.longestMs, summary.durationMs)
  session.toolCalls += summary.toolCalls
  for (const [tool, count] of turn.tools) bump(session.tools, tool, count)
  for (const [file, count] of turn.files) bump(session.files, file, count)
  session.failures += summary.failures
  session.subagents += summary.subagents
  if (summary.isAborted) session.interrupted++
  session.inputTokens += summary.inputTokens
  session.outputTokens += summary.outputTokens
  session.cachedTokens += summary.cachedTokens
  return summary
}

export function duration(ms) {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return seconds + 's'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return minutes + 'm ' + (seconds % 60) + 's'
  return Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm'
}

function tokens(count) {
  return count >= 1000 ? (count / 1000).toFixed(1) + 'k' : String(count)
}

function ranked(map, limit) {
  return [...map].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

function listed(map, limit) {
  return ranked(map, limit).map(([name, count]) => count > 1 ? name + ' ×' + count : name).join(', ')
}

/** What Luna is told about the turn: the raw material for her joke. */
export function describeTurn(summary) {
  const facts = ['Claude worked for ' + duration(summary.durationMs) + '.']
  if (summary.isAborted) facts.push('The coder interrupted Claude.')
  facts.push(summary.toolCalls ? 'Tool calls: ' + listed(summary.tools, 6) + '.' : 'Claude used no tools.')
  if (summary.files.size) facts.push('Files edited: ' + listed(summary.files, 6) + '.')
  if (summary.commands.size) facts.push('Shell programs run: ' + listed(summary.commands, 5) + '.')
  if (summary.failures) facts.push(summary.failures + ' tool calls failed.')
  if (summary.subagents) facts.push(summary.subagents + ' subagents helped.')
  facts.push('Tokens: ' + tokens(summary.inputTokens) + ' read, ' + tokens(summary.outputTokens) + ' written.')
  return facts.join(' ')
}

/** The stats panel's rows: this turn, then the session so far. */
export function statRows(summary, session) {
  const rows = []
  if (summary) {
    const cache = summary.inputTokens ? Math.round(100 * summary.cachedTokens / summary.inputTokens) : 0
    rows.push(['This turn', [
      duration(summary.durationMs) + (summary.isAborted ? ' (interrupted)' : ''),
      summary.toolCalls + ' tool calls' + (summary.toolCalls ? ' (' + listed(summary.tools, 3) + ')' : ''),
      summary.files.size + ' files edited',
      summary.failures + ' failed',
      tokens(summary.inputTokens) + ' in / ' + tokens(summary.outputTokens) + ' out, ' + cache + '% cached',
    ].join(' · ')])
  }
  const [busiest] = ranked(session.tools, 1)
  const [edited] = ranked(session.files, 1)
  rows.push(['Session', [
    session.turns + ' turns',
    'Claude worked ' + duration(session.workedMs),
    'longest ' + duration(session.longestMs),
    session.toolCalls + ' tool calls' + (busiest ? ', mostly ' + busiest[0] : ''),
    edited ? 'most edited ' + edited[0] + ' ×' + edited[1] : 'nothing edited',
    session.failures + ' failures',
    session.subagents + ' subagents',
    session.interrupted + ' interrupted',
  ].join(' · ')])
  return rows
}
