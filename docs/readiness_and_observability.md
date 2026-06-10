# Readiness And Observability

This repo now exposes a small but deliberate runtime proof surface.

## Endpoints

### `GET /healthz`

Purpose:

- liveness probe
- answers whether the process is alive

Typical response:

```json
{
  "status": "ok",
  "timestamp": "2026-06-09T00:00:00.000Z"
}
```

### `GET /readyz`

Purpose:

- readiness probe
- answers whether the app is ready to serve meaningful traffic
- reports companion dependency state without collapsing core readiness into binary up/down

Response shape:

```json
{
  "status": "ok | degraded | not_ready",
  "coreReady": true,
  "checks": {
    "dashboardBuilt": true,
    "mockDataAvailable": true,
    "cacheAvailable": true,
    "socialPostService": "reachable | unreachable"
  },
  "ports": {
    "app": 3011,
    "socialServiceUrl": "http://localhost:3012"
  },
  "timestamp": "2026-06-09T00:00:00.000Z"
}
```

Interpretation:

- `ok`
  - core app is ready
  - companion service is reachable
- `degraded`
  - core app is ready
  - companion service is unavailable
  - read-heavy product value still exists, but social publishing is degraded
- `not_ready`
  - essential local prerequisites are missing, such as built frontend assets or mock evaluator data

### `GET /api/social/health`

Purpose:

- direct dependency reachability check for the companion service

## Why This Matters

The repo is intentionally not a single-process toy app.
It has:

- a core service
- static dashboard assets
- mock evaluator data
- a companion microservice dependency

That means a useful runtime story needs more than one boolean.

`/healthz` proves the process is alive.
`/readyz` proves whether the app is operationally usable.
`/api/social/health` exposes dependency reachability explicitly.

## Verified Scenarios

### Happy path

Validated by:

```bash
npm run demo:verify:social
```

Expected outcome:

- `/readyz` returns `ok`
- companion service is reachable
- publish handoff succeeds

### Dependency-down path

Validated by:

```bash
npm run demo:verify:social:down
```

Expected outcome:

- `/readyz` returns `degraded`
- companion service is unreachable
- publish proxy returns `502`
- core process remains alive

## What This Still Is Not

This is not full production observability.
There is still no:

- metrics backend
- structured log sink
- distributed tracing
- alerting pipeline

But for a portfolio repo, this is enough to show deliberate thinking about:

- liveness versus readiness
- core capability versus degraded dependency state
- explicit proof instead of hand-wavy architecture claims
