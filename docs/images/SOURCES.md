# README visual sources

The visuals present the desktop-only Luna mod. Generic band and stats layouts
are illustrations, not screenshots. `luna-in-action.png` is an actual screenshot
supplied by Jay; it is copied without retouching. Its token counts are part of
that screenshot, not measurements from the illustrative stats example.

## Regeneration

Use Node 24 or newer, the pinned pnpm version, and FFmpeg on your PATH:

```sh
pnpm install --frozen-lockfile
pnpm build
node tools/render-readme-visuals.mjs
```

Sharp is a development-only dependency for nearest-neighbour composition, text
rendering and GIF encoding. A process-local Fontconfig file selects the bundled
Zen Maru Gothic font for raster text. The tool adapts Claude's byte-array base64
API for Node 24 without changing the plugin. SVG text uses the same family with system sans-serif
fallbacks, and separate light and dark palettes. All inputs are tracked here;
regeneration does not access sibling repositories or call an image model.

The hero is 960×400 rather than 960×320: a full 120×120 frame at 3× needs 360
pixels of height. Its six-second loop is a montage of short excerpts from five
performances followed by speaking. The gallery shows all twenty acts and a
twenty-first cell for speaking. The UI illustrations are rendered at 1920px
and displayed at 768px, so a 240px recorded frame depicts a 96px Luna. Integer
nearest-neighbour scaling is used in the actual source images. GIF palette
quantization may slightly change colours; no frames are redrawn or masked.

`luna-stats.png` uses fictional tool events processed by the real `recordTool`,
`finishTurn` and `statRows` exports. The privacy graphics extract their prose
from the README, removing Markdown formatting and reflowing it without changing
the words. The original static `luna-clips.png` remains the gallery fallback.

`social-preview.png` is a 1280×640 upload-ready image. Repository social-preview
settings are not changed by this generator. Its smiling pose with a playful
tilt and stars is frame 25 of the recorded `excited` clip, scaled by exactly 3×.
The source frame sits inside 30px of matching background on every side, giving
the antenna and red tip room above her without editing any recorded pixels.

## Actual desktop demo

`luna-demo.gif` is the 25.5–37.9 second excerpt of Jay's supplied
`Screen Recording 2569-10-03 at 21.58.59.mov`, preserved in
`tools/readme-assets/luna-demo.mov`. The source SHA-256 is
`ea522b848aab54611065e934ce002143804f1eba50d1c06d2d8f9c8e0c36d26c`.
FFmpeg converts it to a looping 10 fps GIF at the original 1086×384 resolution
and original playback speed. No pixels are redrawn, cropped, sharpened or
rescaled; only palette quantization is applied. The excerpt shows Luna's final
reaction and omits the preceding waiting time. The original recording remains
tracked as a reproducible input, outside the private release's docs directory.

## Recorded Luna

The generator reads `plugin/luna/luna.json` and `frames.bin` produced by
`pnpm build`, through `decodeFrames` and `pngBase64` in `plugin/hooks/luna.js`.
Vendor manifests and `docs/implementation.md` hold the upstream provenance.
The generated recording identifies these source pack hashes:

| Source | SHA-256 |
| --- | --- |
| Luna publication pack | `4f4adaeb4870426c7411f62a3aa4b883771fe1e0481e99d748a0f186a5931b4a` |
| Approved acting pack | `e8e305a78e1a5f72dc5ec5582bc49027a63f686201ea6d3c6973fa71adb56876` |

## Brand, font and screenshot

| Tracked input | Original source | SHA-256 |
| --- | --- | --- |
| `logo-horizontal.png` | AI Pets cloud repository, `apps/style-guide/assets/brand/logo-horizontal.png` | `17bdc1f5db364285866c865518bcf803c6fd1143587380192ba90873a9f05189` |
| `tools/readme-assets/zen-regular.ttf` | Zen Maru Gothic, preserved from the private prototype's `web/zen-regular.ttf` | `d1e5d9a182b5a6a64609ce237a3d44cd9a7eee588b74893b3ebe2c90caaac11d` |
| `luna-in-action.png` | Jay's supplied `SCR-20261003-styt.png` | `973862e96acc7203919e88d634a0de002c9d11d02d65a2888854a5660d495737` |

The font is licensed under SIL OFL 1.1, included at
`tools/readme-assets/OFL.txt`. Brand tokens were read from
the AI Pets cloud repository's `packages/brand-system/src/index.ts`: cream
`#FAF7F1`, ink `#15171C`, mint `#C3E1CD`, lavender `#D8D1EF`. The logo source
is directly under `brand/`; the handoff's `brand/web/` directory did not exist.

## Generated scenery

`tools/readme-assets/background.png` was generated with Codex ImageGen on
2026-10-03. SHA-256:
`210e67836cfdbe8293ba7a2564a03d8b984fcbf0ce0c6f1ac07a7050f6f70309`.
It contains scenery only. The official logo, text and recorded Luna are
composited separately by the generator. The saved result is the reproducible
input; rerunning an image model is neither necessary nor deterministic.

Prompt:

> Use case: ads-marketing. Asset type: understated wide editorial backdrop for
> AI Pets README hero and social card. Create a wide 3:2 background ONLY, no
> character, no creature, no face, no sprout mascot, no logo, no lettering, no
> text. Cream paper base #FAF7F1, a soft large mint #C3E1CD rounded stage on the
> right half, a few subtle lavender #D8D1EF abstract paper ribbons and tiny ink
> linework stars near the far outer corners. Sophisticated warm Japanese
> stationery aesthetic, matte cut-paper shapes, exceptionally quiet and
> restrained. Left half remains almost completely empty cream negative space
> for a title. Right central area is a plain open mint field, reserved for a
> real recorded pixel-art character that will be composited later. Very subtle
> tactile paper grain. Flat front view, no perspective, no desk, no objects or
> illustrative figures, no gradients with high contrast. The background should
> frame the real character without competing. Finished editorial composition,
> generous air.
