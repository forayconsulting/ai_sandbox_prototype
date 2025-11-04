# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**innovation_sandbox** is a serverless AI-powered editor deployed on Cloudflare's edge network. The project has **two separate implementations** that coexist in the repository:

1. **Production (Serverless)** - Vanilla JS + Cloudflare Workers/Pages (currently deployed)
2. **Legacy (React)** - Vite + React + Tailwind (not deployed, kept for reference)

**Active deployment:**
- Live at: https://innovation-sandbox.foray-consulting.com
- Worker API: https://ai-sandbox-worker.foray-consulting.workers.dev

## Architecture: Dual Implementation

### Serverless Implementation (ACTIVE)

**Location:** `public/` + `worker/`

This is the **current production system** - a zero-build, vanilla JavaScript implementation:

```
Browser (public/)
  ├── index.html          # Main page
  ├── styles.css          # Postmodern brutalist design
  ├── app.js              # Tab navigation
  ├── csv-editor.js       # CSV editor class
  └── markdown-editor.js  # Markdown editor class
       ↓ HTTPS
Cloudflare Worker (worker/index.js)
  ├── Health check: / and /health
  ├── API endpoint: /api/generate
  └── Proxies to Claude API (Haiku 4.5)
```

**Key characteristics:**
- No build process - edit and deploy immediately
- Pure vanilla JavaScript (no frameworks)
- Static files on Cloudflare Pages
- API proxy on Cloudflare Workers
- Claude Haiku 4.5 (claude-haiku-4-5-20251001)

### React Implementation (LEGACY)

**Location:** `src/`

This is the **original prototype** using React + Vite:

```
src/
  ├── App.jsx
  ├── components/
  │   ├── LiveCSVEditor.jsx
  │   └── LiveMarkdownEditor.jsx
  └── services/
      └── claudeService.js
```

**Note:** This version uses `@anthropic-ai/sdk` directly in the browser with `dangerouslyAllowBrowser: true`, exposing API keys. It's kept for reference but should not be deployed.

## Common Development Commands

### Serverless (Production)

```bash
# Local development
wrangler dev worker/index.js              # Start worker on localhost:8787
npx serve public                          # Serve static files on localhost:3000
# or
python3 -m http.server 8000 --directory public

# Deploy worker
wrangler deploy                           # Deploy worker to Cloudflare

# Deploy static files
wrangler pages deploy public --project-name=ai-sandbox-ui --commit-dirty=true

# Manage secrets
wrangler secret put ANTHROPIC_API_KEY     # Set API key
wrangler secret list                      # List configured secrets

# Monitor
wrangler tail                             # Live worker logs
wrangler tail --format pretty             # Pretty-printed logs
```

### React (Legacy)

```bash
# Local development
npm run dev                               # Start Vite dev server

# Build
npm run build                             # Build for production
npm run preview                           # Preview production build

# Lint
npm run lint                              # Run ESLint
```

## Critical Implementation Details

### Worker API Contract (worker/index.js)

**Endpoints:**
- `GET /` or `/health` - Health check, returns JSON with status and model info
- `POST /api/generate` - Generate content via Claude API

**Request format:**
```json
{
  "prompt": "Generate CSV with...",
  "contentType": "csv" | "markdown"
}
```

**Response:** Server-Sent Events (SSE) stream
```
data: {"text":"chunk1"}
data: {"text":"chunk2"}
...
data: [DONE]
```

**Critical routing logic:**
- Only `/api/*` paths are handled
- All other paths return 404 (not 405) to avoid favicon.ico errors
- Health check returns model info: `claude-haiku-4-5-20251001`

### Frontend Configuration

**Worker endpoint URLs in editors:**

Both `csv-editor.js` and `markdown-editor.js` have:
```javascript
this.workerEndpoint = 'https://ai-sandbox-worker.foray-consulting.workers.dev/api/generate';
```

**Important:** When deploying to a different domain, update this URL in both files.

### Design System

The UI uses a **postmodern brutalist aesthetic**:

**Typography:**
- Primary: Space Grotesk (geometric sans-serif)
- Monospace: JetBrains Mono (code font)
- Loaded via Google Fonts in `index.html`

**Colors:**
- Monochromatic: Black (#0a0a0a) and white (#fafafa)
- High contrast borders (3px solid)
- Red (#ff0000) for danger states only

**Interactive elements:**
- Neo-brutalist shadows: `box-shadow: 4px 4px 0 0 #0a0a0a`
- Transform on hover: `translate(-2px, -2px)`
- Uppercase labels with `letter-spacing: 0.05em`

### Streaming Implementation

The serverless architecture streams Claude responses through SSE:

**Worker (worker/index.js):**
```javascript
// Claude API returns SSE stream
// Worker parses and re-streams to client
for (const line of lines) {
  if (line.startsWith('data: ')) {
    const data = line.slice(6);
    const parsed = JSON.parse(data);
    if (parsed.type === 'content_block_delta') {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
    }
  }
}
```

**Frontend (csv-editor.js / markdown-editor.js):**
```javascript
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.text) {
        this.elements.textArea.value += data.text;
        this.parseAndRender(); // Update table/preview
      }
    }
  }
}
```

## Deployment Workflow

### Production Deployment Checklist

1. **Update worker:** `wrangler deploy`
2. **Update static files:** `wrangler pages deploy public --project-name=ai-sandbox-ui --commit-dirty=true`
3. **Verify health:** Visit https://ai-sandbox-worker.foray-consulting.workers.dev/health
4. **Test streaming:** Try generating content at https://innovation-sandbox.foray-consulting.com

### Custom Domain Setup

The app uses Cloudflare Pages custom domain:
- Domain: innovation-sandbox.foray-consulting.com
- DNS: CNAME record in Squarespace pointing to `ai-sandbox-ui.pages.dev`
- SSL: Automatic via Cloudflare

**To change domains:**
1. Add custom domain in Cloudflare Pages dashboard
2. Update CNAME record at DNS provider
3. Update `workerEndpoint` URLs in `csv-editor.js` and `markdown-editor.js` if worker URL changes

## Branding & Content

**Branding rules:**
- Name: "innovation_sandbox" (lowercase, underscored)
- Model badge: "Powered by Claude Haiku 4.5"
- No marketing copy about "live collaboration" or "real-time"
- Footer: "innovation_sandbox" + tech stack only

**Avoid these phrases:**
- "Live collaborative editing"
- "Real-time AI-powered"
- Any superlatives or marketing language

## Environment Variables

### Cloudflare Worker Secrets

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional (defaults to claude-haiku-4-5-20251001)
CLAUDE_MODEL=claude-haiku-4-5-20251001
```

Set via: `wrangler secret put <KEY_NAME>`

### React App (Legacy)

Create `.env` file:
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_CLAUDE_MODEL=claude-3-5-sonnet-20241022
```

**Warning:** Legacy React app exposes API key in browser - do not deploy to production.

## Cost Structure

**Cloudflare:**
- Workers: 100,000 requests/day free
- Pages: Unlimited bandwidth free

**Claude API (Haiku 4.5):**
- Input: ~$0.25 per million tokens
- Output: ~$1.25 per million tokens
- Typical CSV generation: ~$0.001
- Typical Markdown article: ~$0.003

## Troubleshooting

**"API key not configured" error:**
- Check: `wrangler secret list`
- Set: `wrangler secret put ANTHROPIC_API_KEY`
- Worker must be redeployed after setting secrets

**Streaming doesn't work:**
- Check browser Network tab for SSE response
- Verify Content-Type: text/event-stream
- Check worker logs: `wrangler tail`

**404 on /favicon.ico:**
- This is expected - worker only handles `/api/*` paths
- Health check is at `/` or `/health`

**Deployment shows old version:**
- Cloudflare Pages may cache - wait 1-2 minutes
- Clear browser cache
- Check deployment ID in wrangler output matches live site

## File Structure Key Points

```
ai_sandbox_prototype/
├── public/              # ACTIVE serverless frontend
│   ├── index.html       # Main page with Google Fonts
│   ├── styles.css       # Brutalist design system
│   ├── app.js           # Tab switching logic
│   ├── csv-editor.js    # CSV editor class (self-contained)
│   └── markdown-editor.js # Markdown editor class (self-contained)
├── worker/
│   └── index.js         # ACTIVE Cloudflare Worker API proxy
├── src/                 # LEGACY React implementation (not deployed)
├── wrangler.toml        # Cloudflare configuration
├── README.md            # Original React architecture docs
└── SERVERLESS_README.md # Serverless deployment guide
```

**Critical:** When making changes, ensure you're editing the correct implementation (public/ vs src/).

## Git Workflow

**Commit message format:**
- Do NOT add "Co-Authored-By: Claude" or AI attribution
- Use clear, descriptive messages
- Include deployment URLs when relevant

**Branches:**
- `main` - production branch
- Direct commits are fine for this project (no PR workflow currently)
