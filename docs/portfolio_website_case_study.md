# Music Release Agent

## Short Case Study Copy

Music Release Agent is a full-stack music-content pipeline that tracks new releases, generates AI-assisted writeups, outputs GitBook-ready Markdown, and delegates outbound social publishing to a companion service.

The project is built to be evaluated, not just described. It includes deterministic dry-run verification, a cross-service handoff proof, and a failure-mode proof that shows the core service stays usable when the social posting service is unavailable.

## What I Built

- A Node.js core service for release discovery, review generation, dashboard APIs, and GitBook-style content output
- A React/Vite dashboard for browsing releases and triggering review/social workflows
- A companion `social-post-service` boundary for async outbound posting
- Verification scripts that prove repo-only behavior, cross-service behavior, and degraded dependency behavior
- Runtime probes that distinguish liveness from readiness with `GET /healthz` and `GET /readyz`

## Why It Matters

Most AI portfolio projects are difficult to evaluate without private credentials or live services. This project is designed around a different standard: a reviewer can run one command and verify that the system produces meaningful output.

The service split also reflects a real architectural concern. Music discovery and AI content generation are read-heavy workflows, while social posting is write-heavy, retry-prone, and platform-specific. Keeping those responsibilities separate makes the system easier to reason about, test, and evolve.

## Proof Points

- `npm run demo:verify`
  Validates the dry-run music-content pipeline and generated GitBook artifacts.

- `npm run demo:verify:social`
  Starts both services and proves that `music-release-agent` can hand off a social publishing job to `social-post-service`.

- `npm run demo:verify:social:down`
  Proves that the core service reports degraded readiness and returns a controlled `502` when the companion service is unavailable.

## Technical Focus

- deterministic evaluator workflow
- explicit service boundary
- readiness semantics: `ok`, `degraded`, `not_ready`
- graceful dependency failure handling
- portfolio-safe demo flow without external API keys

## Portfolio Card Version

**Music Release Agent**

Full-stack music-content pipeline with deterministic dry-run verification, cross-service handoff proof, and degraded dependency validation.

**Stack:** Node.js, Express, React, Vite, Spotify API, Gemini, GitBook-style Markdown, companion microservice

**Highlights:** evaluator-first demo path, service-boundary proof, readiness/degraded-state modeling

## 60-Second Interview Version

I built Music Release Agent as a product-shaped AI system rather than a single model wrapper. It tracks music releases, generates AI-assisted content, and publishes GitBook-ready Markdown. The social posting path is split into a companion service because it has different failure and retry behavior from the core content pipeline. The repo includes runnable proof modes for the dry-run pipeline, cross-service handoff, and degraded dependency behavior, so an evaluator can verify the main architecture claims without needing private API credentials.

## Suggested Links

- README: `./README.md`
- Walkthrough: `./docs/demo_walkthrough_artifact.md`
- Runtime guide: `./docs/readiness_and_observability.md`
