---
name: devbar
description: Add or adjust a dev-only DevBar in an app you own — a floating bottom-right pill that expands on hover into color swatches, so a design value (background, accent, surface) can be flipped live in the running app instead of edit-rebuild-look. First call installs a component from a template (React/Next.js, plain web, or SwiftUI); later calls edit the swatches and apply() of the DevBar already in the repo. Use for "add a devbar", "/devbar add Dev Bar to change the background", "add a swatch to the devbar", "let me try a few background colors live", "add a swatch picker to my app". For injecting into someone else's live page instead, use chrome-live-toggle.
---

# DevBar

A picker you commit into your own app for the length of one design decision.
Idle it's a `‹` chevron and one dot showing the active value; hover expands it
leftward into every candidate with a checkmark on the active one; click repaints
the app live. Pick a winner, hardcode it, delete the file.

This is the "try five backgrounds without five rebuilds" tool. It is NOT
chrome-live-toggle — that one injects into a **third-party page** over CDP and
needs persistence machinery. This one is **your source tree**, so it's a normal
component with a normal import.

## The look

```
        idle                          hover
   ╭──────────╮        ╭──────────────────────────────╮
   │  ‹   ●   │   ──▶  │   ✓●    ○    ○    ○          │
   ╰──────────╯        ╰──────────────────────────────╯
        └ active value       └ checkmark on active

   right-anchored at bottom-right, so the pill grows LEFTWARD.
   chevron + active dot fade out as the full strip fades in.
```

Screenshots and a video of the real thing:
[docs/devbar](https://github.com/wzulfikar/skills/tree/main/docs/devbar). Media
lives there, not here — a copy-install (`npx skills add`) duplicates everything
in this folder onto every machine, so keep skill folders text.

## Pick the template

| Stack | Template | Mounted as |
|---|---|---|
| React / Next.js | `templates/DevBar.tsx` | a component in the root layout |
| Any other web app | `templates/devbar.js` | a dev-only `<script>` / guarded import |
| SwiftUI (macOS) | `templates/DevBar.swift` | `.overlay(alignment: .bottomTrailing)` |

All three have the same two seams and nothing else to edit:

- **`SWATCHES` / `swatches`** — the candidates.
- **`apply()` / reading `DevBarState.shared.value`** — where the value lands.

## First: is there already a DevBar in this repo?

**Always check before doing anything else.** The skill has two modes and the
answer picks one:

```bash
rg -l "DevBar|devbar" --glob '!node_modules' --glob '!*.md' .
```

| Found | Mode | What you do |
|---|---|---|
| nothing | **Initialize** | Copy a template in, wire it, mount it |
| a DevBar component | **Tweak** | Edit the seams of THAT file, in place |

**Initialize is a one-time move: the template becomes a file in their repo.**
From then on it is their source, not the skill's. Never copy a second template
next to an existing DevBar, and never re-copy over one they have edited — you
would silently drop their swatches and their `apply()`.

Before copying, say where it is going and let them redirect it:

> No DevBar in this repo yet. I'd add `components/DevBar.tsx` from the
> React/Next template and mount it in `app/layout.tsx`, dev-only. Want it
> somewhere else, or written from scratch against your own conventions?

Take the template unless they say otherwise — it already carries the geometry,
the luminance-picked checkmark, the hover grace period, and the SSR guard, all
of which are easy to get subtly wrong from scratch. If they want it hand-rolled,
build it to the same behavior described in **The look** and **Traps**.

**Tweak mode is the common case.** "/devbar add a warmer paper option" on a repo
that already has one means: open the existing file, edit `SWATCHES` and `apply`,
touch nothing else. Mounting is already done. Don't re-explain the install.

## Workflow

Steps 1–3 apply to both modes. Step 4 is where they diverge.

1. **Name the knob.** "Change the background" means: which surface, and what
   does the app currently read for it — a CSS variable, a Tailwind token, a
   `Theme` constant? Find that ONE thing before writing swatches. If the app has
   no single source for it, add one first; a DevBar wired to three hardcoded
   sites is a DevBar that lies.
2. **Choose candidates that pull in different directions.** 3–5. Not five
   shades of the same warm paper — go lighter/cooler, warmer/deeper, flatter.
   One-line comment per swatch saying what it's testing. Comparing near-clones
   wastes the whole exercise.
3. **`SWATCHES[0]` MUST be the app's current compiled-in value.** Selection is
   per-session (localStorage on web, memory in Swift), so a cleared profile or a
   relaunch lands on index 0 — with the original there, that's the stock app.
   Otherwise "I cleared storage" silently means "I'm now looking at a modified
   build." This replaces chrome-live-toggle's `applyOff`; there is no revert.
4. **Initialize:** copy the template into their tree, fill the two seams, mount
   it dev-only (below). **Tweak:** edit the seams in the file that is already
   there; skip the mount entirely.
5. **Verify by looking, not by reading state.** Screenshot idle, screenshot
   hovered, click a dot and screenshot again. A computed style can report your
   value while an overlay child paints something else on top.

## Mounting — dev only, one line

React / Next.js, in `app/layout.tsx`:

```tsx
{process.env.NODE_ENV === 'development' && <DevBar />}
```

Plain web — load `devbar.js` only from the dev server, or:

```js
if (import.meta.env.DEV) import('./devbar.js');
```

SwiftUI, on the root view:

```swift
.overlay(alignment: .bottomTrailing) {
    if DevBarState.enabled { DevBar(fallback: Theme.bg).padding(12) }
}
```

and every consumer reads the override with the compiled value as fallback:

```swift
Color(dev.value ?? Theme.bg)
```

## Wiring the value

**Web: write a CSS variable the app already reads.** `apply()` sets
`--bg` on `documentElement` and every consumer updates at once — no prop
plumbing, no context, and removal is deleting the file. If the app doesn't read
a variable for this yet, introducing one is the smaller change. Only reach for
state/context if the value can't be expressed in CSS.

Use `setProperty(name, value, 'important')` if the app writes competing inline
styles on re-render — same-specificity inline-vs-inline is decided by whoever
wrote last.

**Swift: `DevBarState` is `@Observable`, so the reading view must observe it.**
A view that reads `DevBarState.shared.value` from a plain helper function or a
static won't re-render when it changes — hold it as `@State private var dev =
DevBarState.shared` in each view that reads it. This looks exactly like "the
picker does nothing," and it is the trap that costs the debugging session.

## Traps

- **A second call is a tweak, not a second install.** Copying the template over
  a DevBar the user has already filled in throws away their swatches, their
  `apply()`, and any offset they tuned for their own furniture. Grep first.
- **A dot's `color` is not necessarily its `value`.** `color` is what the dot
  paints and what drives checkmark contrast; `value` is whatever `apply()`
  consumes — a class name, a token, a gradient string. They coincide only when
  the change IS the color. Optional `fill` lets the dot preview a gradient while
  `color` stays the flat tone for contrast.
- **The checkmark color is computed from luminance.** Don't hardcode it, or a
  dark swatch swallows the check.
- **Next.js: mount-guard the render.** Selection comes from localStorage, which
  the server can't know. `DevBar.tsx` returns `null` until mounted; keep that or
  hydration mismatches.
- **Geometry is derived from `DOT`/`GAP`/`PAD`/`CHEV`.** Adding a swatch needs
  no width edits. Don't hardcode pill widths.
- **The pill is right-anchored so it grows LEFTWARD.** If the app has its own
  bottom-right furniture (chat launcher, a tab bar), bump the `right` offset
  past it rather than moving the anchor.
- **80ms grace period on unhover is load-bearing** — without it the pill
  flickers when the pointer crosses the gap between dots.
- **Swift: dots keep hit-testing while invisible** unless
  `allowsHitTesting(hovered)` stays. Idle clicks would otherwise land on a
  swatch that isn't there.

## Removing it

The point is that this leaves. When a value wins:

1. Move the winning literal into the real theme/token.
2. Delete the template file and the one mount line.
3. Web: the `localStorage` key `devbar:sel` is now dead — harmless, but say so
   if anyone's browser still has one.

If it needs to stay a while, flip the single kill switch instead —
`DevBarState.enabled = false` in Swift, or drop the mount line — so the diff to
bring it back is one line.

## Files

- `templates/DevBar.tsx` — React/Next.js client component, seams `SWATCHES` /
  `apply`. Persists to localStorage, mount-guarded for SSR.
- `templates/devbar.js` — framework-free injector for any web app you own, same
  seams, with a reassert tick for apps that re-render over it.
- `templates/DevBar.swift` — SwiftUI macOS overlay, seams `swatches` /
  `DevBarState.shared.value`. Typechecks against macOS 14+.
