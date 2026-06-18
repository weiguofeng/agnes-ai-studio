# Agnes AI Studio

> AI Video Production Pipeline ? From Characters to Videos in One Flow

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org) [![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## Project Overview



## Features

- **Character Management** - CRUD with reference images, structured profiles
- **Project & Storyboard** - Create projects with scenes and shots
- **AI Production Pipeline** - Generate character images to batch video generation
- **Text-to-Image** - Generate images with advanced params (seed, steps, CFG scale)
- **Image-to-Image** - Upload multiple images with same prompt
- **Image-to-Video** - Single image + multi-prompt batch generation
- **Asset Library** - Browser-side IndexedDB storage
- **Task Center** - View history, replay, save to library
- **Real-time Task Monitor** - Track ongoing generation tasks
- **Rate Limiting** - Built-in 429 backoff for video polling
- **i18n** - Chinese and English support

## System Architecture

```mermaid
graph TB
    subgraph Client[Browser]
        UI[React UI] --> SDK[Agnes SDK]
    end
    subgraph Server[Next.js Server]
        P[API Proxy /api/agnes/[...path]]
        DI[Download Proxy /api/pipeline/download-image]
    end
    subgraph Storage[Browser Storage]
        IDB[(IndexedDB - AssetsDB)]
        LS[(localStorage - Config)]
    end
    subgraph External[External APIs]
        AI[Agnes AI API apihub.agnes-ai.com]
        CDN[(Agnes CDN)]
    end
    SDK -->|API calls| P
    P --> AI
    AI --> CDN
    UI -->|save/load| IDB
    UI -->|download via proxy| DI
    DI --> CDN
```

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 15.5 (App Router) |
| Language | TypeScript 5.7 |
| UI Library | React 19 |
| Styling | Tailwind CSS 3.4 + shadcn/ui |
| State Management | Zustand 5.0 |
| HTTP Client | Axios 1.7 |
| Storage | IndexedDB + localStorage |
| Testing | Vitest + Playwright |

## Pages

| Route | Page | Description |
|-------|------|-------------|
| / | Dashboard | Project overview |
| /characters | Character Library | CRUD characters, reference images |
| /projects | Project Management | Scenes and shots config |
| /projects/[id] | Project Detail | Shot configurations |
| /pipeline | Production Pipeline | Core: generate videos |
| /generate-image | Text-to-Image | Generate from prompts |
| /image-to-image | Image-to-Image | Upload + prompt |
| /image-to-video | Image-to-Video | Multi-prompt batch |
| /text-to-video | Text-to-Video | From text prompt |
| /assets | Asset Library | Browse and manage assets |
| /history | Task Center | View history |
| /settings | API Configuration | API key and models |

## Environment Variables

| Variable | Required | Default |
|----------|----------|--------|
| NEXT_PUBLIC_AGNES_API_KEY | Yes | - |
| NEXT_PUBLIC_AGNES_BASE_URL | No | https://apihub.agnes-ai.com/v1 |
| NEXT_PUBLIC_AGNES_MODEL | No | agnes-image-2.1-flash |

## Quick Start

```bash
# Install
git clone <repo-url>
cd agnes-creator
npm install

# Configure API key
# Create .env.local with:
# NEXT_PUBLIC_AGNES_API_KEY=sk-your-key-here

# Run
npm run dev
```

## Deployment

### Production Build
```bash
npm run build
npm start
```

### Docker (Planned)
See [DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Detailed system architecture |
| [API.md](docs/API.md) | API integration reference |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deployment guide |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | Contribution guidelines |
| [CHANGELOG.md](docs/CHANGELOG.md) | Version history |
| [ROADMAP.md](docs/ROADMAP.md) | Development roadmap |

## License

MIT
