# Portfolio Case Study

## Title

Music Release Agent: a reproducible music-content pipeline with explicit service boundaries

## Summary

`music-release-agent` is a full-stack music-content system that tracks new releases, generates AI-assisted reviews, outputs GitBook-ready Markdown, and hands off outbound social publishing to a companion microservice.

This project is not framed as "Spotify plus AI plus a dashboard."
Its real value is that it proves three engineering claims with runnable evidence:

1. the content pipeline is reproducible through a dry-run path
2. the social-posting boundary is intentionally split into a companion service
3. degraded dependency behavior is explicit and verifiable

## Problem

Most portfolio AI apps stop at one of two levels:

- a thin UI around one model call
- a backend script that is hard to demo or verify

I wanted something more credible:

- a product-shaped system instead of a single endpoint
- a deterministic evaluator path instead of credential-heavy setup
- a service boundary that reflects real operational differences

## Solution

I built the system as two cooperating parts:

- `music-release-agent`
  - release discovery
  - AI review generation
  - dashboard backend
  - GitBook-oriented content output
  - proxy boundary for social publishing
- `social-post-service`
  - async outbound posting
  - platform-specific posting strategy execution

This separation matters because the read-heavy content pipeline and the write-heavy posting pipeline do not share the same dependency profile, retry behavior, or failure mode.

## What Makes It Strong

### Reproducible evaluation

The repo includes a deterministic evaluator path:

```bash
npm install
npm run demo:verify
```

This runs the dry-run pipeline against bundled mock release data and verifies the generated GitBook-style artifacts.

### Service-boundary proof

The repo also includes:

```bash
npm run demo:verify:social
```

This spins up the core service and the companion service, sends a publish request through the proxy boundary, and verifies async completion through status polling.

### Failure-mode proof

And it includes:

```bash
npm run demo:verify:social:down
```

This proves the core service degrades cleanly when the companion service is unavailable:

- health remains alive
- readiness becomes `degraded`
- publish requests return `502`
- the process does not crash

## Technical Highlights

- deterministic dry-run pipeline for evaluator-safe verification
- explicit liveness versus readiness separation
- dependency-state aware readiness model: `ok / degraded / not_ready`
- companion-service boundary validated with runnable integration proof
- graceful degradation path validated with runnable failure-mode proof

## Why This Project Is Portfolio-Worthy

It demonstrates more than feature breadth.
It shows:

- product framing
- system decomposition
- verification discipline
- operational thinking

That makes it a stronger flagship artifact than a UI-only demo or a script-only automation project.

## Suggested Portfolio Blurb

Built a full-stack music-content pipeline that discovers releases, generates AI-assisted reviews, publishes GitBook-ready Markdown, and delegates outbound posting to a companion microservice. Added deterministic dry-run verification, explicit readiness semantics, cross-service handoff proof, and degraded-dependency validation to make the system evaluator-friendly and production-credible.

## Suggested 60-Second Version

I built an automated music-content system that tracks releases, generates AI-assisted writeups, and publishes GitBook-ready content. The interesting part is not only the dashboard, but the system design: the social posting path is split into a companion service, the repo includes a deterministic dry-run path for evaluators, and I explicitly prove both the happy path and the degraded dependency path with runnable verification scripts.
