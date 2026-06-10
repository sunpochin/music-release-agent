# Demo Walkthrough Artifact

This document is the portfolio-safe public walkthrough for `music-release-agent`.
It is designed for someone who wants to understand the repo without running a full live demo first.

## One-Sentence Story

`music-release-agent` is an automated music-content system that discovers releases, generates AI-assisted writeups, publishes GitBook-ready Markdown, and hands off outbound social posting to a companion service.

## What This Repo Proves

1. It has a reproducible dry-run evaluator path.
2. It has a real service boundary to a companion posting service.
3. It can demonstrate graceful degradation when that companion dependency is unavailable.

## Fastest Evaluation Path

### Repo-only proof

```bash
npm install
npm run demo:verify
```

Expected result:

- dry-run completes successfully
- mock GitBook files are generated
- `SUMMARY.md` links are validated

### Cross-service proof

```bash
npm run demo:verify:social
```

Expected result:

- `music-release-agent` becomes healthy and ready
- `social-post-service` becomes healthy
- a publish request is forwarded and accepted
- the async job completes through the proxy status endpoint

### Failure-mode proof

```bash
npm run demo:verify:social:down
```

Expected result:

- `/api/social/health` reports the companion as unreachable
- `/readyz` reports the app as `degraded`
- publish proxy returns `502`
- the core service stays alive

## Architecture Snapshot

Core responsibilities in this repo:

- release discovery
- AI review generation
- GitBook-oriented content output
- dashboard backend support
- proxy boundary for social publishing

Companion responsibility in `social-post-service`:

- async outbound posting
- platform-specific posting strategy execution

This split matters because the read-heavy music system and the write-heavy social posting system do not share the same failure modes, scaling profile, or dependency shape.

## Why This Is Not Just A UI Demo

The dashboard matters, but it is not the main artifact.
The flagship evidence is:

- deterministic dry-run output
- automated proof of inter-service handoff
- automated proof of degraded dependency behavior

## Suggested 3-Minute Talk Track

1. Start with `npm run demo:verify`
2. Show the generated mock GitBook output
3. Explain why `social-post-service` is split out
4. Run `npm run demo:verify:social`
5. Mention `npm run demo:verify:social:down` as the dependency failure proof

## If You Only Read One More File

Read [README.md](../README.md) for the evaluator path, then [readiness_and_observability.md](./readiness_and_observability.md) for the runtime proof story.
