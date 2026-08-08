# devbar skill

Add a dev-only DevBar to an app you own: a floating bottom-right pill that
expands on hover into color swatches, so a design value (background, accent,
surface) can be flipped live in the running app instead of edit-rebuild-look.
Templates for React/Next.js, plain web, and SwiftUI. You commit it for the
length of one design decision, then rip it out.

## How it looks like

![devbar demo](devbar-demo.webp)

Hover expands the pill leftward, the chevron and preview dot fade out, the
swatches fade in; clicking one moves the checkmark and repaints the app live.

Source recording: [`devbar-demo.mp4`](devbar-demo.mp4)

### States

| Idle              | Hover               | After picking                      |
| ----------------- | ------------------- | ---------------------------------- |
| ![idle](idle.png) | ![hover](hover.png) | ![after picking](hover-picked.png) |

Idle is a `‹` chevron plus one dot of the active value. Hovered, every swatch
shows with the checkmark on the active one. After clicking the fourth swatch the
check has moved and `--bg` repainted the page behind it.

The stills are the web template (`templates/devbar.js`) shot in headless Chrome;
the video is the SwiftUI one running in a real app.

## Installation

```bash
npx skills add wzulfikar/skills --skill devbar
```

To check for updates: `npx skills update devbar`

> **To install multiple skills**
> Run `npx skills add wzulfikar/skills` without
> `--skill` and pick the skills you want from the list.

Then invoke it as `/devbar` in a new session, e.g. "/devbar add devbar to change the background to blue, red, black".
