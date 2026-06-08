# PM2 Guide

## Purpose

This repo can run multiple moving pieces during development:

- backend API
- dashboard dev server
- scheduled scan flow
- optional companion posting service

PM2 is useful here because it gives a single place to inspect process state and restart failed services.

---

## Typical Commands

```bash
npx pm2 start ecosystem.config.cjs
npx pm2 list
npx pm2 logs
npx pm2 restart all
npx pm2 stop all
```

---

## What To Say In Interview

If asked why PM2 is included:

> I used PM2 as lightweight process supervision for a multi-process local system. It is not the headline of the project, but it helps make the repo easier to run, debug, and demo repeatedly.
