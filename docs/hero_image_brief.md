# Hero Image Brief

This brief defines the **real-source** version of the repo hero image for `music-release-agent`.

The goal is not to make a generic AI poster.
The goal is to create a hero image that looks good **and** preserves engineering credibility.

## Goal

Create one wide image that communicates all three of these in under five seconds:

1. this is a real product-shaped system
2. this repo has runnable proof, not just screenshots
3. the architecture intentionally separates the core app from outbound social posting

## Source Material Rules

Use real project material whenever possible.

Allowed source material:

- real dashboard screenshots from `music-release-agent`
- real terminal output from:
  - `npm run demo:verify`
  - `npm run demo:verify:social`
  - `npm run demo:verify:social:down`
- real architecture labels used in repo docs
- real runtime terms such as:
  - `healthz`
  - `readyz`
  - `ok`
  - `degraded`

Avoid:

- fictional metrics
- fake deployment URLs
- fake charts that do not resemble the product
- excessive marketing copy
- generic “AI” imagery that is unrelated to the repo

## Mandatory Content Blocks

### Block 1: Product surface

Show a real dashboard screen or cropped collage that proves there is an actual UI.

Prefer:

- album cards
- a selected album or track pane
- some hint of analysis / review content

### Block 2: Verification proof

Show terminal-style proof states using real command names:

- `demo:verify`
- `demo:verify:social`
- `demo:verify:social:down`

Prefer concise states such as:

- passed
- handoff verified
- degraded path verified

### Block 3: Architecture boundary

Show the core system split clearly:

- `music-release-agent`
- `social-post-service`

Use minimal labels such as:

- dry-run proof
- cross-service proof
- failure-mode proof

## Visual Direction

Use a serious flagship engineering tone.

Recommended look:

- dark neutral background
- teal / green verification accents
- warm amber for warnings or degraded state
- off-white text
- crisp panels with editorial spacing

Avoid:

- purple-heavy gradients
- noisy particle effects
- neon hacker clichés
- overstuffed diagrams

## Copy Budget

Keep visible text very short.

Good:

- `dry-run proof`
- `cross-service proof`
- `failure-mode proof`
- `readyz: degraded`

Bad:

- long paragraphs
- resume bullets
- dense architecture explanations

## Real Capture Checklist

Before generating or composing the final hero image:

1. capture one clean dashboard screenshot
2. capture one terminal screenshot for `demo:verify`
3. capture one terminal screenshot for `demo:verify:social`
4. capture one terminal screenshot for `demo:verify:social:down`
5. decide whether the architecture block is:
   - a simplified diagram, or
   - a textual service boundary panel

## Acceptance Criteria

The final hero image is good enough only if:

- a GitHub visitor can tell it is a music product
- a technical reviewer can tell there are real verification paths
- the service split is visible without reading the full README
- the image still looks clean when scaled down in GitHub markdown
