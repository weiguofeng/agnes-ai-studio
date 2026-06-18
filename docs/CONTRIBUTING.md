# Contributing Guide

## Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run the QA pipeline: `npm run qa:closed-loop`
5. Commit and push
6. Open a Pull Request

## Code Style

- TypeScript strict mode
- React functional components with hooks
- Zustand for state management
- Tailwind CSS for styling
- Prefer Radix UI primitives over custom components

## File Modification Rules

> ?? **Critical**: Never use PowerShell `Set-Content` or `Out-File` to modify TypeScript/TSX/JS files.
> These commands can corrupt UTF-8 encoding. Always use Node.js scripts or a proper IDE.

## Build Verification

Before submitting, run:

```bash
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run build         # Production build
npm run test:unit     # Unit tests
npm run qa:closed-loop  # All checks
```

## Pull Request Guidelines

- Keep PRs focused on a single concern
- Add/update tests for new functionality
- Update documentation (AGENTS.md and docs/ files)
- Ensure character consistency rules are respected
- No silent fallbacks for video generation
- Include before/after screenshots for UI changes

## Architecture Decisions

### Character Consistency First
Character appearance consistency takes priority over generation success rate.
- NEVER auto-fallback from image-to-video to text-to-video
- Error states must be explicit: CORS, URL expiry, CDN, network, API issues

### Root Cause Analysis
Before any fix, identify: Root Cause ? Solution ? Verification
No temporary workarounds without documented follow-up.

### Pipeline Stability
Priority order: Character Consistency > Pipeline Stability > Error Recovery > Performance > New Features

## Documentation

When adding new features, update:
- `AGENTS.md` - Project state snapshot
- `docs/CHANGELOG.md` - Version history
- `docs/PROJECT_CONTEXT.md` - Architecture and data flow
- `docs/ROADMAP.md` - Feature roadmap
