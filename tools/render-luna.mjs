// Records Luna's clips by running the canonical C/WASM player over her approved
// packs. The mod has no WebAssembly, so it plays these recordings.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WasmFramePlayer, parseFramePack } from '@aipet/frame-pack';

const root = fileURLToPath(new URL('../', import.meta.url));
const wasm = readFileSync(join(dirname(fileURLToPath(import.meta.resolve('@aipet/frame-pack'))), 'frame_player.wasm'));
const luna = readFileSync(join(root, 'vendor/luna/luna.aipetframes'));
const acting = readFileSync(join(root, 'vendor/luna/luna-work-draft.aipetframes'));
const review = JSON.parse(readFileSync(join(root, 'vendor/luna/draft-review/manifest.json'), 'utf8'));

const TICKS_PER_FRAME = 3; // The player ticks every 33 ms; the pane shows 10 frames a second.
const SIZE = 120;
const SAME = 255; // Palette index meaning "unchanged from the previous frame".
const IDLE = 3;
const SPEAKING = 6;
const EMOTION = Object.fromEntries(parseFramePack(new Uint8Array(luna)).emotions.map(item => [item.name, item.id]));
const MOMENTS = ['joy', 'excited', 'surprised', 'curious', 'shy'];

function speechLevel(tick) {
  // A syllable-like envelope; the player only reads the level for mouth shapes.
  const syllable = Math.max(0, Math.sin(tick / 2.1));
  const phrase = tick % 45 < 36 ? 1 : 0;
  return Math.round(255 * syllable * phrase);
}

function capture(player) {
  const pixels = new Uint16Array(player.exports.memory.buffer, player.exports.fp_framebuffer(player.playerPtr), SIZE * SIZE);
  return Uint16Array.from(pixels);
}

// An emotion moment or the speaking loop from the publication pack.
async function record(state, emotion, seconds) {
  const player = WasmFramePlayer.create(wasm, luna, 424242);
  const { exports } = player;
  exports.fp_set_sys_state(player.playerPtr, state);
  exports.fp_set_emotion(player.playerPtr, EMOTION[emotion]);
  const frames = [];
  for (let tick = 0; frames.length < seconds * 10; tick++) {
    if (state === SPEAKING) exports.fp_set_audio_level(player.playerPtr, speechLevel(tick));
    exports.fp_tick(player.playerPtr);
    if (tick % TICKS_PER_FRAME === 0) frames.push(capture(player));
  }
  return frames;
}

// One approved performance, from its first frame until the runtime ends it.
async function perform(action) {
  const player = WasmFramePlayer.create(wasm, acting, 424242);
  const { exports } = player;
  exports.fp_set_sys_state(player.playerPtr, action.state);
  const playing = () => exports.fp_active_action(player.playerPtr, 0) === action.index;
  let tick = 0;
  while (!(playing() && exports.fp_debug_frame(player.playerPtr) === action.frames[0])) {
    if (++tick > 60000) throw Error(action.id + ' was not reached in the runtime trace.');
    exports.fp_tick(player.playerPtr);
  }
  const frames = [];
  for (tick = 0; playing() && frames.length < 80; tick++) {
    if (tick % TICKS_PER_FRAME === 0) frames.push(capture(player));
    exports.fp_tick(player.playerPtr);
  }
  return frames;
}

const CLIPS = [
  ...review.actions.map(action => [action.id, () => perform(action)]),
  ...MOMENTS.map(emotion => [emotion, () => record(IDLE, emotion, 3)]),
  ['speaking', () => record(SPEAKING, 'joy', 8)],
];

const palette = new Map();
const unique = new Map();
const clips = {};
for (const [name, make] of CLIPS) {
  clips[name] = [];
  for (const frame of await make()) {
    const key = createHash('sha256').update(frame).digest('hex');
    if (!unique.has(key)) {
      const indexed = new Uint8Array(frame.length);
      frame.forEach((value, i) => {
        if (!palette.has(value)) palette.set(value, palette.size);
        indexed[i] = palette.get(value);
      });
      unique.set(key, { id: unique.size, indexed });
    }
    clips[name].push(unique.get(key).id);
  }
}
if (palette.size > SAME) throw Error('Luna uses too many colors.');

// Each frame is (run length, palette index) byte pairs over its difference from
// the previous frame; the mod decodes them in order.
function encode(indexed, previous) {
  const delta = indexed.map((value, i) => previous?.[i] === value ? SAME : value);
  const runs = [];
  for (let i = 0; i < delta.length;) {
    let length = 1;
    while (length < 255 && delta[i + length] === delta[i]) length++;
    runs.push(length, delta[i]);
    i += length;
  }
  return Buffer.from(runs);
}

const rgb = value => [(value >> 11 & 31) * 255 / 31, (value >> 5 & 63) * 255 / 63, (value & 31) * 255 / 31].map(Math.round);
const ordered = [...unique.values()];
const encoded = ordered.map((frame, i) => encode(frame.indexed, ordered[i - 1]?.indexed));
const offsets = [0];
for (const frame of encoded) offsets.push(offsets.at(-1) + frame.length);
const index = {
  source: {
    luna: createHash('sha256').update(luna).digest('hex'),
    acting: createHash('sha256').update(acting).digest('hex'),
  },
  size: SIZE,
  fps: 10,
  palette: [...palette.keys()].map(rgb),
  offsets,
  acts: CLIPS.map(([name]) => name).filter(name => name !== 'speaking'),
  clips,
};
mkdirSync(join(root, 'plugin/luna'), { recursive: true });
writeFileSync(join(root, 'plugin/luna/luna.json'), JSON.stringify(index));
writeFileSync(join(root, 'plugin/luna/frames.bin'), Buffer.concat(encoded));
console.log(`Recorded Luna: ${unique.size} frames, ${palette.size} colors, ${offsets.at(-1)} bytes.`);
