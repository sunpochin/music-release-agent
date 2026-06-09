# Hero Image Spec

This is the production spec for the final repo hero image and portfolio header image.

## Primary Use Cases

- top of GitHub README
- project section on personal portfolio site
- optional Open Graph preview asset

## Canvas

Primary export:

- 1600 x 900 px
- 16:9
- PNG

Secondary export:

- 2400 x 1260 px
- social / Open Graph friendly
- PNG

## Layout

Three-column composition:

### Left column: Product panel

Width:

- about 42%

Contents:

- real dashboard screenshot
- cropped to emphasize:
  - album grid
  - selected analysis area
  - polished UI feel

Headline overlay:

`Music Release Agent`

Subheadline overlay:

`Reproducible music-content pipeline`

### Center column: Proof panel

Width:

- about 26%

Contents:

- terminal-style or checklist-style proof stack

Required lines:

- `demo:verify` → `passed`
- `demo:verify:social` → `handoff verified`
- `demo:verify:social:down` → `degraded path verified`

Optional line:

- `readyz` → `ok / degraded`

### Right column: Architecture panel

Width:

- about 32%

Contents:

- two service blocks
  - `music-release-agent`
  - `social-post-service`
- arrow from core app to companion service
- small badge states:
  - `ok`
  - `degraded`

Supporting labels:

- `dry-run proof`
- `cross-service proof`
- `failure-mode proof`

## Typography

Use a clean, technical, editorial style.

Recommended:

- sans serif for headings
- mono or semi-mono for command lines

Hierarchy:

- project title: largest
- proof labels: medium
- support labels: small

## Color System

Background:

- charcoal / graphite

Primary accent:

- teal or emerald

Secondary accent:

- amber for degraded state

Text:

- off-white
- muted gray for secondary labels

## Caption Options

Use one of these directly under the image in README or portfolio:

### Option A

Reproducible music-content pipeline with cross-service proof and degraded dependency validation.

### Option B

Full-stack release discovery, AI-assisted content generation, and companion-service social publishing with runnable proof modes.

### Option C

Flagship portfolio system showing product surface, service boundaries, and verifier-friendly runtime proof.

## README Placement

Recommended markdown placement:

```md
![Music Release Agent Hero](./docs/assets/music-release-agent-hero.png)
```

Place it:

- after the title and badges
- before the first long explanatory paragraph

## Asset File Plan

When the real image is produced, store it here:

- `docs/assets/music-release-agent-hero.png`

Optional supporting assets:

- `docs/assets/music-release-agent-dashboard-shot.png`
- `docs/assets/music-release-agent-proof-shot.png`
- `docs/assets/music-release-agent-degraded-shot.png`

## Quality Bar

Reject the image if any of these are true:

- the dashboard looks fake or generic
- the command names do not exactly match the repo
- the architecture panel is too dense to parse quickly
- the image looks like “AI art” instead of a software project hero
- text becomes unreadable at GitHub README width
