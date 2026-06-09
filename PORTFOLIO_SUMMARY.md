# Portfolio Summary

## One-Sentence Version

`music-release-agent` is an automated music-content pipeline that discovers releases, generates AI-assisted commentary, publishes Markdown via GitOps, and delegates outbound posting to a companion microservice.

---

## Short Portfolio Blurb

Built a multi-part music release system using Node.js, Spotify, MusicBrainz, Gemini, GitOps publishing, and a Vite/React dashboard. The system supports dry-run validation, rate-limit fallback, AI-generated review flows, and a companion social posting microservice for async outbound publishing.

---

## Resume Bullets

- Built an automated music release pipeline that scans Spotify, falls back to MusicBrainz under rate limits, generates AI-assisted reviews, and publishes Markdown output through a GitOps workflow.
- Designed a read-heavy core service and separated write-heavy social posting into a companion microservice, improving boundary clarity and future strategy extensibility.
- Added a dry-run sandbox and test coverage to make the system reproducible and interview-verifiable without external credentials.

---

## PR Summary

This repo is positioned as the core service in a two-repo music publishing system:

- `music-release-agent`: discovery, review generation, dashboard, publishing
- `social-post-service`: async posting and posting strategy execution

Portfolio-facing improvements include:

- a concise README focused on system value and boundaries
- demo / interview docs
- explicit companion-service framing
- a cleaner GitHub-facing entrypoint for evaluators
