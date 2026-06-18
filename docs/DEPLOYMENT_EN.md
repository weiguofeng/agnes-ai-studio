# Deployment Guide

> [中文](DEPLOYMENT.md) · [API](API_EN.md) · [Architecture](ARCHITECTURE_EN.md)

## Prerequisites
- Node.js 20+
- npm 10+
- Agnes API Key

## Local
```bash
cd agnes-creator
npm install
npm run dev    # Port 3000
npm run build  # Production build
npm start      # Production start
```

## Environment Variables
| Variable | Description |
|----------|-------------|
| AGNES_API_KEY | Server API Key |
| NEXT_PUBLIC_AGNES_API_KEY | Client API Key |

## Vercel
Push to GitHub, import in Vercel, set env vars, auto deploy.

## Cache
```bash
Remove-Item -Recurse -Force .next
```
