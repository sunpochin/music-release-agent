# Interview Guide

## 60-Second Pitch

> I built an automated music-content pipeline that discovers new releases, generates AI-assisted commentary, publishes Markdown through GitOps, and renders a dashboard for browsing and sharing.  
> The core repo is intentionally read-heavy: release discovery, review generation, caching, and publishing.  
> I split outbound posting into a companion service because posting is write-heavy, retry-prone, and provider-specific.  
> The strongest engineering points are the dry-run sandbox, Spotify-to-MusicBrainz fallback path, and the explicit boundary between the content system and the posting system.

---

## What Problem It Solves

1. Release discovery is fragmented and rate-limited.
2. Editorial / content generation is usually manual.
3. Social publishing tends to get mixed into the same codebase and bloats the core pipeline.

This system turns those into:

- deterministic scanning
- AI-assisted commentary
- reproducible publishing
- explicit service boundaries

---

## 5 Talking Points

### 1. Dry-run sandbox

- lets interviewers validate the workflow without credentials
- proves the pipeline is reproducible and not just dependent on live APIs

### 2. Spotify fallback design

- Spotify is preferred
- MusicBrainz acts as a resilience path when rate-limited or unavailable

### 3. Core service vs companion service

- `music-release-agent` stays focused on discovery, generation, and publishing
- `social-post-service` handles outbound posting concerns

### 4. Frontend as a surface, not the core product

- the dashboard is useful, but it sits on top of the pipeline
- the interesting part is still orchestration and publish flow

### 5. Testability

- service / strategy layer is covered with Vitest
- dry-run path gives a realistic validation route even without external secrets

---

## What Not To Overclaim

- Do not claim this is a full production social publishing platform.
- Do not over-index on “AI writes reviews” as the main innovation.
- Emphasize system boundaries and reliability choices instead.
