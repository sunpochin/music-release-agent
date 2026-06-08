# Demo Script

## Demo Goal

Show that `music-release-agent` is not just “Spotify + AI + pretty UI”, but a system with:

- a deterministic dry-run path
- fallback-aware backend orchestration
- publishing output
- a companion posting service boundary

---

## 3-Minute Flow

### 1. Start with the dry run

Run:

```bash
npm run scan:dry
```

Say:

> This dry-run path is important because it lets another engineer or interviewer validate the release pipeline without bringing their own Spotify or Gemini credentials.

Then show:

- generated Markdown in `data/mock-gitbook/`
- updated summary / output structure

---

### 2. Show the dashboard

Run the backend and dashboard, then open:

- `http://localhost:5173`

Say:

> The dashboard is not the core system by itself. It is the browsing and publishing surface on top of the scan-and-review pipeline.

Then show:

- release browsing
- lyric / review panel
- share-card entrypoint

---

### 3. Explain rate-limit resilience

Say:

> Spotify is the preferred source, but the system is designed to survive rate limits. If Spotify is constrained, the scanner can fall back to MusicBrainz rather than failing the entire pipeline.

---

### 4. Explain the microservice split

Say:

> I intentionally split outbound social posting into `social-post-service`.  
> Music release discovery is read-heavy orchestration. Social posting is write-heavy, retry-prone integration work.  
> That service boundary keeps the core pipeline smaller and makes posting strategies replaceable.

---

### 5. End with the value statement

Say:

> The point of this project is not just generating AI content. It is building a reliable content pipeline with validation, fallback, publishing, and posting boundaries that can grow into a real system.
