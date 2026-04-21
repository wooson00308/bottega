# Bottega

> _Sprite Mask Painter for Unity team-color pipelines._
> A tiny, focused brush-and-bucket editor that outputs spec-clean PNG masks.

Bottega paints **4-channel sprite masks** (R / G / B / black) for Unity shaders
that drive team colors, faction tints, or any multi-region color swap. Built as
a native desktop app with Tauri 2 — installer is **under 3 MB**, app bundle is
**under 8 MB**.

The name comes from the Renaissance _bottega_ — the workshop where a master and
apprentices produced one kind of craft, very well. This tool does one thing:
paint masks that your shader actually accepts.

---

## Features

- **Four channels, enforced.** Primary (red), Secondary (green), Accent (blue),
  Detail (black). Every pixel is exactly one channel — no accidental mixing,
  no anti-aliased edges, no gray artifacts.
- **Hard edge by construction.** Output is snapped to pure channel values on
  save. Nothing for a `harden_mask.py` step to clean up afterward.
- **Alpha preservation.** Mask alpha matches the original sprite alpha exactly —
  shaders don't get surprised by pixels painted outside the sprite silhouette.
- **Mirror modes.** X, Y, or quadrant — brush, bucket, and eraser all respect
  it. Perfect for symmetric characters.
- **Smart bucket fill.** Seed-color tolerance fill that respects the sprite's
  internal color boundaries, constrained to the sprite's alpha.
- **Native path-aware export.** Loads a sprite from
  `~/Projects/foo/sprites/character.png`, saves the mask to
  `~/Projects/foo/sprites/Masks_SAM2/character_mask.png` — right next to the
  source, in a subfolder of your choosing.
- **Batch export.** Load a whole folder of sprites; each mask routes to its
  own source directory. No manual save-dialog-chasing.
- **In-app updater.** The app checks GitHub Releases for a new version and
  installs it with one click.
- **Built-in spec panel, live coverage stats, 30-step undo history,
  keyboard-first workflow.**

## Mask spec

Bottega's output conforms to this contract:

| Channel | RGB         | Role                      |
| ------- | ----------- | ------------------------- |
| R       | `255, 0, 0` | Primary (main team color) |
| G       | `0, 255, 0` | Secondary                 |
| B       | `0, 0, 255` | Accent                    |
| Black   | `0, 0, 0`   | Detail (keep original)    |
| —       | alpha 0     | Outside sprite silhouette |

- **Resolution:** matches original sprite, pixel-for-pixel.
- **Alpha:** binary, matches original silhouette.
- **Format:** 8-bit RGBA PNG.
- **Edge:** hard, no anti-aliasing.
- **Filename:** `<original>_mask.png`.

## Install

Grab the latest `.dmg` from the
[Releases](https://github.com/wooson00308/bottega/releases/latest) page and
drag `Bottega.app` into `/Applications`. First launch on macOS: right-click →
**Open** once to bypass Gatekeeper (the app is updater-signed for integrity,
not Apple-notarized).

Apple Silicon only at the moment. Intel Mac support is possible — open an
issue if you need it.

## Using it

1. **Load sprites** — drag PNGs onto the window, or use the Load button.
2. **Pick a channel** — keys `1`–`4`, or cycle with `X`.
3. **Paint** — `B` brush, `G` bucket fill, `E` eraser, `I` eyedropper, `H` pan.
   `[` and `]` resize the brush.
4. **Mirror** (optional) — press `M` to cycle `off → X → Y → quad`.
5. **Save** — `⌘S` exports to `<sprite folder>/<subfolder>/<name>_mask.png`.
   `⌘⇧S` opens a location picker for one-off overrides. `?` brings up the full
   shortcut sheet anytime.

The subfolder name defaults to `Masks_SAM2` and is editable in the left
panel's _Uscita · Output_ section — leave it blank to save masks right next
to their sprites.

## Development

```bash
pnpm install          # frontend deps
pnpm tauri dev        # dev window with hot reload
pnpm tauri build      # release .app + .dmg
```

### Stack

- **Frontend:** React 19 + Vite 8 (no CSS framework, inline styles + CSS vars)
- **Shell:** Tauri 2 (Rust)
- **Plugins:** `tauri-plugin-fs`, `tauri-plugin-dialog`, `tauri-plugin-updater`
- **Image ops:** `<canvas>` + `getImageData` / `putImageData` — no native
  image library dependency

### Release flow

Releases are driven by git tags. Push `v*.*.*` and GitHub Actions builds the
macOS bundle, signs the updater manifest, and uploads everything to a new
GitHub Release. Installed copies of the app then see the update through the
built-in updater.

```bash
pnpm version patch        # bumps package.json, creates a git tag
git push && git push --tags
```

CI on every main push / PR runs a frontend build + Rust compile check to
catch breakage early.

## License

MIT. See [LICENSE](LICENSE).
