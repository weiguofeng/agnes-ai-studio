# Deployment Guide

## Local Development

### Prerequisites
- Node.js 22+
- npm 10+
- Agnes API key (sign up at https://agnes-ai.com)

### Setup
```bash
git clone <repo-url>
cd agnes-creator
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your API key

# Start dev server
npm run dev
# ? http://localhost:3000
```

### Production Build
```bash
npm run build
npm start
# ? http://localhost:3000
```

## Docker Deployment (Planned)

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t agnes-studio .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_AGNES_API_KEY=sk-your-key \
  agnes-studio
```

## Vercel Deployment (Planned)

1. Push code to GitHub/GitLab
2. Import repository in Vercel
3. Configure environment variables:
   - `NEXT_PUBLIC_AGNES_API_KEY`
4. Deploy

### Important Notes

- **Port**: Always uses port 3000
- **Cold start**: First load takes 20-30s compilation, subsequent ~200ms
- **Storage**: Browser IndexedDB - assets are NOT server-side. Clear browser data to reset.
- **API Key**: Can be set via env vars or Settings UI page
