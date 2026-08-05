---
name: chrome-live-toggle
description: Inject a floating toggle switch into a live third-party web page via a controlled Chrome, so a human can click it to flip a reversible change on/off — and the toggle PERSISTS across page reloads. Use when asked to "add a toggle to a live page", "inject a toggle button that persists across reload", "controlled chrome inject script", or a request like "open example.com and add /chrome-live-toggle to make the background blue". The AI supplies applyOn/applyOff; everything else is boilerplate this skill provides.
---

# Chrome live toggle

Drop a bare toggle switch onto someone else's live page. One click applies a
change, the next reverts it, and the button survives the user reloading the tab.
The change is reversible by construction — `applyOff` is the exact inverse of
`applyOn`.

**The only project-specific part is `applyOn` / `applyOff`.** The button shape,
placement, boolean state, injection timing, and persistence are boilerplate in
`reference/injector-template.js`. A request like "add /chrome-live-toggle to
example.com to make the background blue" means: take the template, fill
`applyOn` with the change and `applyOff` with its inverse, register it, done.

## When to use

- You have a controlled Chrome and want to demo a reversible page edit a human
  can flip.
- The edit must stay put across manual reloads, not vanish on the first refresh.
- Not for scraping, form-filling, or one-off DOM pokes — a plain
  `evaluate_script` is simpler and this skill's persistence machinery is wasted.

## Prerequisites

- The **chrome-devtools** MCP, attached to a **controlled Chrome with a debug
  port** — e.g. a `browser-profile` opened with its `debug_port`. This is
  required: persistence rides on `navigate_page`'s `initScript` param (Puppeteer
  `evaluateOnNewDocument`), which the `claude-in-chrome` extension path does not
  expose. A one-shot injection through that path is wiped on the first reload.

## Workflow

1. **Open / identify the target tab.** `list_pages`, then `select_page` on the
   target. To iterate on the script, open a **fresh** tab (`new_page`) — see the
   initScript-stacking gotcha below.
2. **Craft `applyOn` / `applyOff`** in a copy of
   `reference/injector-template.js`. Capture any original state ONCE, up front
   (a var, or a `data-orig` attribute stashed at inject time). `applyOff` must
   be the exact inverse. Adapt the button's `right:` offset to sit left of any
   bottom-right chat/support widget.
3. **Register via initScript.** `navigate_page` with `type: "reload"` and
   `initScript` set to the whole injector string. It now re-runs on every
   document load for that tab's lifetime.
4. **Verify.** Programmatically click it and confirm the effect, then click
   again to confirm it reverts cleanly:
   ```js
   // evaluate_script
   document.getElementById('chrome-live-toggle').click();  // -> on
   // ...check the change landed...
   document.getElementById('chrome-live-toggle').click();  // -> off, page restored
   ```
   Then reload the tab yourself and confirm the button reappears.

## Gotchas — each cost a debugging session

- **initScript registrations STACK and cannot be hot-removed via the MCP.**
  Re-register a changed script on the same tab and BOTH the old and new versions
  run and fight each other. To iterate: **open a fresh tab, register there, and
  tell the user to close the old one.** Never re-register on a tab you have
  already registered on.
- **Hydration timing.** Target pages are SSR + hydrate: the element may not
  exist when the injector first runs, and hydration can wipe injected nodes. The
  template guards double-inject with a fixed element id and retries via
  `setInterval(inject, 400)` plus `DOMContentLoaded` + `load` + a `setTimeout`.
  The interval re-injects if the button ever gets removed. Keep all of it.
- **Reversibility means capturing the original first.** For DOM edits, stash the
  original at inject time (`el.setAttribute('data-orig', el.innerHTML)`) and
  restore it in `applyOff`. Never assume the "before" value — read and keep it
  before the first mutation.
- **Placement.** Bare toggle: SVG only, no background, border, or label.
  `position:fixed; z-index:2147483647`. Bottom-right but LEFT OF any existing
  chat launcher (a typical launcher is ~56px at `right:24px`), so the standard
  offset is `right:96px; bottom:24px`. No bottom-right widget → `right:24px`.
  Adapt to avoid overlapping page furniture.

## The toggle look

The SVGs are OpenMoji, inlined into the template so there is no network
dependency. **OFF = red knob on the LEFT. ON = green knob on the RIGHT.**

The source files are counterintuitively named — map by how they RENDER, not by
the E-code:

| Renders | State | OpenMoji source | Saved here as |
|---|---|---|---|
| red knob left | OFF | `E241.svg` | `reference/assets/toggle-off.svg` |
| green knob right | ON | `E245.svg` | `reference/assets/toggle-on.svg` |

The compact `height:40px` variants used at runtime are inlined as the `OFF` /
`ON` strings at the top of `reference/injector-template.js`. The `assets/` files
are the canonical full-size sources.

## Worked example (betterstack.com)

Real case: the toggle reorders two hero sections AND rewrites a headline, both
reversibly.

Reversible in-place swap of two sibling nodes (works even with content between
them):

```js
function swap(a, b){ var aNext=a.nextSibling, p=a.parentNode; b.parentNode.insertBefore(a,b); p.insertBefore(b,aNext); }
```

Reversible text rewrite — stash the original once, restore from it:

```js
var h; // the headline node, found once
function applyOn(){
  swap(sectionA, sectionB);
  if (!h.hasAttribute('data-orig')) h.setAttribute('data-orig', h.textContent);
  h.textContent = 'New headline';
}
function applyOff(){
  swap(sectionA, sectionB);            // swap is its own inverse
  h.textContent = h.getAttribute('data-orig');
}
```

`applyOn` and `applyOff` are the only things that changed from the template.
`swap` is self-inverse, so calling it again in `applyOff` puts the folds back;
the headline restores from `data-orig`.

## Files

- `reference/injector-template.js` — the validated boilerplate, with the one
  project-specific seam (`applyOn` / `applyOff`) marked.
- `reference/assets/toggle-off.svg` — red-knob-left, OFF state (OpenMoji E241).
- `reference/assets/toggle-on.svg` — green-knob-right, ON state (OpenMoji E245).
