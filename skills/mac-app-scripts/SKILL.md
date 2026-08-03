---
name: mac-app-scripts
description: Give a macOS app repo the same build scripts every time — build, dev, test, bundle, clean — plus a .work/ directory of shims so they run as `work build`, `work dev`, `work test`. Use when a Mac app (SwiftPM or Xcode) has no scripts yet, when someone asks for a dev loop, a dmg, or "the usual scripts", or when an existing repo's scripts should be brought into the same shape.
---

# Mac app scripts

Every Mac app repo here gets the same five scripts and the same runner, so the
command to rebuild is the same in all of them. This scaffolds that, then you
adapt it — the templates are a starting point, not something to leave untouched.

```
scripts/build.sh    debug by default, --release when it matters
scripts/dev         build, quit the running app, relaunch it
scripts/test.sh     the test suite
scripts/bundle.sh   release build -> dist/<App>.dmg, --notarize optional
scripts/clean.sh    remove .build, build/, dist/
.work/              one-line shims: work build | dev | test | bundle | clean | start
```

## Do it

```bash
scripts/scaffold.sh --repo ~/code/github/thing \
  --app "Thing" --bundle Thing --bundle-id dev.wzulfikar.thing --kind spm
```

`--kind xcode --scheme Thing` writes the `xcodebuild` variant instead. Add
`--no-bundle` when there is nothing to ship yet, `--force` to overwrite.

It refuses to clobber an existing script unless forced, and prints every file it
wrote.

## Work out the arguments first

Read the repo before running it. Getting these wrong writes a bundle that
launches into nothing.

| Argument | Where it comes from |
|---|---|
| `--kind` | `Package.swift` → `spm`. `*.xcodeproj` / `*.xcworkspace` → `xcode`. |
| `--bundle` | The executable product name. It becomes `build/<name>.app` and `CFBundleExecutable`, and it **must match the built binary**. |
| `--app` | What a person calls it. Window title, dmg volume, the name `dev` quits. |
| `--bundle-id` | Existing id if there is one — changing it strips the app's permissions and Keychain access. Otherwise `dev.<user>.<name>`. |
| `--scheme` | Xcode only. `xcodebuild -list`. |

## Then adapt

The templates deliberately stop at the generic part. What usually has to be
added, in the order it comes up:

- **Document types and exported UTIs** go in `build.sh`'s `Info.plist` heredoc.
  A document app with no `CFBundleDocumentTypes` opens nothing by double-click.
- **App-specific build steps** — rendering the app's own icon, generating
  resources, embedding a framework — go after the assemble step, marked by the
  `# app-specific` comment. Put them here rather than in `dev` so a release build
  gets them too.
- **`release.sh` is not in the templates.** Publishing needs somewhere to publish
  to — a Sparkle appcast, a GitHub release, a store. Write it when that exists,
  not before; a release script that publishes nowhere is worse than none.

## Things these templates already know

Each one cost a debugging session somewhere. Keep them when you edit.

- **`lsregister -f` after every build.** Rebuilding in place leaves
  LaunchServices holding the bundle it saw last, and the first `open` after a
  build then starts an app with no window.
- **`dev` waits for the old process to die.** Opening mid-shutdown races
  LaunchServices and fails with error -600. It quits, polls `pgrep`, then opens,
  and retries once.
- **Signing comes from `CODESIGN_IDENTITY`, defaulting to ad-hoc.** A stable
  identity is what makes a Keychain "Always Allow" decision survive a rebuild.
  An app that stores an API key needs one, or the user re-approves every launch.
- **`bundle.sh --notarize` checks its inputs before building.** Notarization
  rejects ad-hoc signatures, and finding that out ten minutes in is the whole
  problem.
- **Debug is the default.** The dev loop should be seconds. `--release` is for
  the dmg and for release-only bugs.

## `.work/` and the `work` runner

`work <name>` runs `.work/<name>` from the repo root, with short aliases
(`b` build, `d` dev, `s` start, `t` test). The shims are one line each so the
real script stays the thing you read and edit.

**`.work/` is gitignored globally.** So it survives nothing: a fresh clone has
no shims, and the fix is to run this skill again with `--force` (it only rewrites
`.work/`, and `--force` is needed because the scripts already exist). Say that
when someone clones a repo and `work dev` stops working.

`.work/notes.md` is scratch space for that repo, read by `work notes`. Scaffold
creates it empty and never writes to it.
