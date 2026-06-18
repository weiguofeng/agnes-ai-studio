# Contributing Guide

> [中文](CONTRIBUTING.md) · [API](API_EN.md) · [Architecture](ARCHITECTURE_EN.md)

## Workflow
1. Read README.md / AGENTS.md / docs/
2. `cd agnes-creator; npm install; npm run dev`
3. Create page in src/app/
4. Add i18n support
5. Implement components + Zustand stores
6. Call SDK methods

## Standards
- TypeScript strict mode
- CN/EN bilingual UI
- No hardcoded strings (use i18n)
- Run npm run build before commit

## Testing
```bash
npm run build
npm test
npm run qa:closed-loop
```

## Core Principles
1. Character Consistency First
2. Root Cause First
3. Pipeline Stability First
4. Internationalization
