# Portfolio Case Study: Music Release Agent

## Title
Music Release Agent: a reproducible music-content pipeline with explicit service boundaries

## Summary
`music-release-agent` is a full-stack music-content system that tracks new releases, generates AI-assisted reviews, outputs GitBook-ready Markdown, and hands off outbound social publishing to a companion microservice.

This project is not framed as "Spotify plus AI plus a dashboard." Its real value is that it proves three engineering claims with runnable evidence:
1. The content pipeline is reproducible through a dry-run path.
2. The social-posting boundary is intentionally split into a companion service.
3. Degraded dependency behavior is explicit and verifiable.

---

## 1. Short Case Study Copy
Music Release Agent is a full-stack music-content pipeline that tracks new releases, generates AI-assisted writeups, outputs GitBook-ready Markdown, and delegates outbound social publishing to a companion service.

The project is built to be evaluated, not just described. It includes deterministic dry-run verification, a cross-service handoff proof, and a failure-mode proof that shows the core service stays usable when the social posting service is unavailable.

---

## 2. Why It Matters
Most AI portfolio projects are difficult to evaluate without private credentials or live services. This project is designed around a different standard: a reviewer can run one command and verify that the system produces meaningful output.

The service split also reflects a real architectural concern. Music discovery and AI content generation are read-heavy workflows, while social posting is write-heavy, retry-prone, and platform-specific. Keeping those responsibilities separate makes the system easier to reason about, test, and evolve.

---

## 3. What I Built
- A Node.js core service for release discovery, review generation, dashboard APIs, and GitBook-style content output.
- A React/Vite dashboard for browsing releases and triggering review/social workflows.
- A companion `social-post-service` boundary for async outbound posting.
- Verification scripts that prove repo-only behavior, cross-service behavior, and degraded dependency behavior.
- Runtime probes that distinguish liveness from readiness with `GET /healthz` and `GET /readyz`.

---

## 4. Technical Focus & Highlights
- Deterministic dry-run pipeline for evaluator-safe verification.
- Explicit liveness versus readiness separation.
- Dependency-state aware readiness model: `ok / degraded / not_ready`.
- Companion-service boundary validated with runnable integration proof.
- Graceful degradation path validated with runnable failure-mode proof.
- Portfolio-safe demo flow without external API keys.

---

## 5. Proof Points & Commands

### Dry-run content pipeline validation
```bash
npm run demo:verify
```
Validates the dry-run music-content pipeline and generated GitBook artifacts.

### Cross-service handoff validation
```bash
npm run demo:verify:social
```
Starts both services and proves that `music-release-agent` can hand off a social publishing job to `social-post-service`.

### Graceful degradation validation
```bash
npm run demo:verify:social:down
```
Proves that the core service reports degraded readiness and returns a controlled `502` when the companion service is unavailable.

---

## 6. Portfolio Card Version
**Music Release Agent**
Full-stack music-content pipeline with deterministic dry-run verification, cross-service handoff proof, and degraded dependency validation.
- **Stack:** Node.js, Express, React, Vite, Spotify API, Gemini, GitBook-style Markdown, companion microservice
- **Highlights:** evaluator-first demo path, service-boundary proof, readiness/degraded-state modeling

---

## 7. 60-Second Interview Version
I built Music Release Agent as a product-shaped AI system rather than a single model wrapper. It tracks music releases, generates AI-assisted content, and publishes GitBook-ready Markdown. The social posting path is split into a companion service because it has different failure and retry behavior from the core content pipeline. The repo includes runnable proof modes for the dry-run pipeline, cross-service handoff, and degraded dependency behavior, so an evaluator can verify the main architecture claims without needing private API credentials.
