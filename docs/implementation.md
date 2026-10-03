# Implementation

## Behavior

Luna appears in the band above the prompt (`AbovePrompt`) with one of her
approved performances or emotion moments, chosen at random while skipping the
five shown most recently. She plays it through at least once, then speaks her
line beside it. Two settings, changed with `/aipets` and kept in the plugin
store across sessions, shape this:

- `/aipets when done|prompt|both`: after Claude finishes a turn the person
  started (default), when the person sends a prompt, or both. On a prompt she
  knows only the prompt; after the turn she also gets the turn summary.
- `/aipets stay 5|10|30|next`: 5 (default), 10 or 30 seconds after her line,
  or until the person's next prompt.

`/aipets` alone reports her current settings, and `/aipets off` and `/aipets`
switch her off and on. If no line arrives within 20 seconds she collapses
without one. A newer appearance replaces an older line.

`/aipets stats` toggles stats mode, also kept in the store. Luna then stays in
the band: each turn she plays her performance twice, speaks, and holds her last
pose beside two rows of numbers from `plugin/hooks/stats.js`. This turn: time,
tool calls with the busiest tools, files edited, failed calls, tokens in and out
and the cached share. The session: turns, total and longest working time, tool
calls and the busiest tool, the most-edited file, failures, subagents and
interruptions.

Luna is a stand-up comic first and the coder's biggest fan underneath. Her line
comes from `$.model.complete` with the `sonnet` alias on the session's own Claude
client. Its input is the turn's prompt plus up to three earlier ones from the
same session, after `submittedProse` removes code fences, inline code, indented
code, links, paths and credential-looking text, and a one-paragraph summary of
the turn. Tool calls are recorded in `tool.call` as names and counts only: file
names (never directories) for edits, the program name of a shell command
(skipping environment assignments), failed calls, subagents seen, and the turn's
duration and token usage. Drafts, file contents, command arguments and output,
and Claude's replies never reach her. Each request also names one of 40 comedic
voices from `plugin/hooks/humor.js`, from bone-dry deadpan and anti-jokes to
observational bits, roasts, absurdism and bleak confessional honesty, chosen at
random while skipping the ten used most recently. Only turns started by the
person (`composer` or `bridge` origin) count.

## Frames

Mods have no WebAssembly, so `tools/render-luna.mjs` runs the canonical C/WASM
player (`@aipet/frame-pack`, including its WASM loader) at build time and
records 10-frames-a-second clips:

- the fifteen performances (keyboard, typewriter, pencil, paper
  planes, bug net, abacus, whiteboard, yarn, magnifier, coffee, antenna,
  notes, crystal ball, puzzle, gear) from the acting pack, each from its first
  frame until the runtime ends it; the pack and its review record are pinned
  in `vendor/luna/luna-work-draft.aipetframes` and `vendor/luna/draft-review/`;
- five emotion moments (joy, excited, surprised, curious, shy) and a speaking
  loop (joy, synthetic speech envelope) from the Luna 5.3.2 publication pack,
  pinned in `vendor/luna/manifest.json`.

The 320 distinct 120-pixel frames are palette-indexed and run-length encoded
against the previous frame into `plugin/luna/frames.bin` (about 1.5 MB) with
`plugin/luna/luna.json`.

Luna appears only on the desktop surface. Her `prompt.submit` hook does nothing
unless `$.session.surfaces()` includes `desktop`, so a terminal-only session
never asks the model, and her band hook passes on every other surface. The mod
decodes the frames once and draws the current one as an `Svg` holding an
uncompressed indexed PNG, 96 CSS pixels wide with pixelated scaling.

The band redraws ten times a second only while Luna is visible.

## Evidence

Version 0.6.1 repairs duplicated arms in notes, antenna-listen, crystal-ball,
abacus, coffee, magnifier, pencil and puzzle. All fifteen source sheets and
150 canonical acting frames were inspected. The repair receipt is hash-bound
and explicitly records autonomous review, separate from the earlier human
approval. All 175 original speaking/blink composites remain byte-identical.

On 2026-10-03, with Claude Code 2.1.288, the Claude desktop app showed Luna
above the prompt after a submitted prompt, with a model-written line, and collapsed her
afterwards. Terminal rendering (half-block cells in Terminal.app) was judged too
coarse and removed. The native tests mount the band on the desktop and terminal
element tables, check she draws only on desktop, that a terminal-only session
makes no model request, that the model input is filtered, that she collapses,
and that `/aipets off` works.

## Sources

- Luna publication pack: `veiovi/aipet-esp32` commit
  `50a4afb7da0116cfe0e1b661810249bd8aa72356`, pinned in `vendor/luna/`.
- Player: compiler export `fb571d522d5421a0000b28689c2b8b628cd653f2`
  (`vendor/device/compiler-pin.json`), including its existing WASM loader and
  frame-pack reader, used only at build time. No private cloud package is included.
- [Claude mods](https://code.claude.com/docs/en/plugins/mods/overview).
