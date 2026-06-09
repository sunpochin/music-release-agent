# Release Showcase

This document is the external-facing release presentation for the current `music-release-agent` candidate.

## Candidate Theme

Move the repo from "strong demo project" to "flagship portfolio system with proof."

## What Changed

### 1. Evaluator-first entrypoint

- README landing page was tightened
- one canonical evaluator quickstart was added
- repo proof modes are now separated clearly:
  - repo-only proof
  - cross-service proof
  - failure-mode proof

### 2. Runnable proof surface

Added scripts:

- `npm run demo:verify`
- `npm run demo:verify:social`
- `npm run demo:verify:social:down`

These move the repo from "well-explained" to "independently verifiable."

### 3. Runtime credibility

Added runtime probes:

- `GET /healthz`
- `GET /readyz`

`/readyz` distinguishes:

- fully ready
- dependency degraded
- not ready

This makes the service story more operationally credible than a single binary health check.

### 4. Public-facing collateral

Added:

- `docs/demo_walkthrough_artifact.md`
- `docs/portfolio_case_study.md`
- `docs/readiness_and_observability.md`

This gives the project three external reading modes:

- fast walkthrough
- portfolio case study
- runtime/operational explanation

## What An Evaluator Can Now Verify

### Without credentials

- dry-run content pipeline
- generated mock GitBook outputs
- summary linkage

### With local runnable proof

- companion-service handoff
- async job completion
- degraded dependency behavior
- readiness state transitions

## Remaining Optional Upgrades

These are not required for the repo to be strong, but they would improve public presentation:

- a real dashboard hero screenshot
- a short demo GIF or video
- a live deployment URL if you want portfolio visitors to click before they read

## Hero Image Spec

If you create a repo hero image later, use this structure:

- left panel: dashboard UI
- center panel: verification commands and pass states
- right panel: architecture boundary showing `music-release-agent` and `social-post-service`

Suggested caption:

> Reproducible music-content pipeline with cross-service proof and degraded dependency validation.

## Current Verdict

This candidate is now strong enough to present as a flagship repo because it combines:

- product shape
- system boundaries
- runnable evaluator proof
- operational reasoning
