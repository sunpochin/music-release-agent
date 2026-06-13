# Hero Image Specification & Design Brief

This is the production specification and design brief for the final repo hero image and portfolio header asset.

---

## 1. Design Brief & Goals
The goal is to create one wide image that communicates the following three aspects of `music-release-agent` in under five seconds:
1. **This is a real product-shaped system** (not just a single API wrapper script).
2. **This repo has runnable proof** (verifiable locally by reviewers without complex API setups).
3. **The architecture intentionally separates the core application from outbound publishing**.

### Source Material Rules
- **Use real project elements**: Dashboard screenshots, real terminal outputs from verify commands (`npm run demo:verify`, etc.), and real runtime terms (`healthz`, `readyz`, `degraded`).
- **Avoid**: Fictional charts, marketing fillers, fake URLs, and generic AI stock illustrations.

---

## 2. Canvas & Technical Requirements
- **Primary export**: 1600 x 900 px (16:9), PNG format.
- **Secondary export**: 2400 x 1260 px (Open Graph / Social preview), PNG format.
- **Color System**:
  - Background: Charcoal or graphite dark gray.
  - Accent: Spotify-themed green or teal for healthy/verified states.
  - Accent (Warnings): Amber/yellow for degraded states.
  - Typography: Clean sans-serif for headings, monospaced font for command lines.

---

## 3. Composition & Layout (Three-Column Composition)

### Left column: Product Panel (width: ~42%)
- **Contents**: Real dashboard screenshots highlighting the album grid, track list, and AI-assisted panel.
- **Overlays**:
  - Title: `Music Release Agent`
  - Subtitle: `Reproducible music-content pipeline`

### Center column: Verification Proof (width: ~26%)
- **Contents**: Checklist-style terminal proof logs.
- **Logs**:
  - `demo:verify` ➔ `passed`
  - `demo:verify:social` ➔ `handoff verified`
  - `demo:verify:social:down` ➔ `degraded path verified`

### Right column: Architecture Panel (width: ~32%)
- **Contents**: Simplified diagram or boxes showing:
  - `music-release-agent` (core service)
  - `social-post-service` (companion service)
  - Inter-service communication arrow with status badges (`ok`, `degraded`).
  - Textual tags: `dry-run proof`, `cross-service proof`, `failure-mode proof`.

---

## 4. Copy Guidelines & Checklist
- **Copy Budget**: Keep text minimal. Prefer code commands or brief labels (`readyz: degraded`) over long description sentences.
- **Verification Checklist**:
  1. Capture a clean dashboard UI screen.
  2. Capture terminal outputs from verification steps.
  3. Ensure commands match exactly.
  4. Ensure text scaled down in GitHub Markdown remains readable.
