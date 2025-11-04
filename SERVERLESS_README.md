# AI Sandbox - Serverless Edition

> **Cloudflare Workers + Vanilla JavaScript** - No build process, no Node.js server required!

## 🌟 Overview

This is a serverless, zero-dependency implementation of the AI Sandbox prototype. It runs entirely on **Cloudflare Workers** with static files hosted on **Cloudflare Pages** - no traditional server needed!

### Key Features

- ✅ **No Build Process** - Pure vanilla JavaScript, HTML, CSS
- ✅ **Serverless** - Runs on Cloudflare Workers (Edge computing)
- ✅ **Static Hosting** - Deploy to Cloudflare Pages, GitHub Pages, or any CDN
- ✅ **Real Claude API** - Actual streaming from Claude 3.5 Sonnet
- ✅ **Secure** - API keys stay on the serverless backend
- ✅ **Fast** - Edge network with global distribution
- ✅ **CSV & Markdown** - Dual editor modes with live rendering

## 🏗️ Architecture

```
┌─────────────────┐
│   User Browser  │
│                 │
│  index.html     │ ◄── Static files (Cloudflare Pages)
│  + vanilla JS   │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│ Cloudflare      │
│ Worker          │ ◄── Proxies requests to Claude API
│ (Edge Function) │     Keeps API key secret
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│ Anthropic       │
│ Claude API      │ ◄── Real AI streaming
└─────────────────┘
```

### Why Serverless?

1. **No Server Maintenance** - No EC2, no Docker, no PM2
2. **Automatic Scaling** - Handles 0 to 1M requests seamlessly
3. **Global Edge Network** - <50ms latency worldwide
4. **Pay Per Use** - Cloudflare Workers free tier: 100k requests/day
5. **Zero Build** - Edit HTML/JS and deploy instantly

## 📁 Project Structure

```
ai_sandbox_prototype/
├── public/                    # Static files (deploy to Cloudflare Pages)
│   ├── index.html            # Main HTML (no build required)
│   ├── styles.css            # Pure CSS (no preprocessor)
│   ├── app.js                # Tab navigation
│   ├── csv-editor.js         # CSV editor logic
│   └── markdown-editor.js    # Markdown editor logic
├── worker/
│   └── index.js              # Cloudflare Worker (Claude API proxy)
├── wrangler.toml             # Cloudflare configuration
└── SERVERLESS_README.md      # This file
```

## 🚀 Quick Start (Local Development)

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
# or
npm install --save-dev wrangler
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Set Your Claude API Key

```bash
wrangler secret put ANTHROPIC_API_KEY
# Paste your Claude API key when prompted
```

### 4. Run Locally

```bash
# Start the worker locally
wrangler dev worker/index.js

# In another terminal, serve the static files
npx serve public
# or use Python: python3 -m http.server 8000 --directory public
```

Visit `http://localhost:8000` and start creating!

## 🌐 Deploy to Production

### Option 1: Deploy Worker + Pages (Recommended)

**Step 1: Deploy the Worker**

```bash
# Deploy the Claude API proxy worker
wrangler deploy worker/index.js

# Note the worker URL (e.g., https://ai-sandbox-worker.your-subdomain.workers.dev)
```

**Step 2: Update the Worker Endpoint**

Edit `public/csv-editor.js` and `public/markdown-editor.js`:

```javascript
// Change this line:
this.workerEndpoint = '/api/generate';

// To your deployed worker URL:
this.workerEndpoint = 'https://ai-sandbox-worker.your-subdomain.workers.dev';
```

**Step 3: Deploy Static Files to Cloudflare Pages**

```bash
# Option A: Using Wrangler
wrangler pages deploy public --project-name=ai-sandbox

# Option B: Using Git (connect your repo in Cloudflare dashboard)
# 1. Push to GitHub
# 2. Connect repo in Cloudflare Pages dashboard
# 3. Set build output directory to: public
# 4. No build command needed!
```

### Option 2: Custom Domain Setup

**1. Update wrangler.toml**

```toml
route = { pattern = "yourdomain.com/api/*", zone_name = "yourdomain.com" }
```

**2. Deploy with route**

```bash
wrangler deploy worker/index.js
```

**3. Update JavaScript to use /api/generate**

The worker will automatically handle requests to `yourdomain.com/api/*`

## 🔧 Configuration

### Environment Variables (Worker Secrets)

```bash
# Required: Your Claude API key
wrangler secret put ANTHROPIC_API_KEY

# Optional: Specify Claude model (defaults to claude-3-5-sonnet-20241022)
wrangler secret put CLAUDE_MODEL
```

### Worker Settings

Edit `worker/index.js` to customize:

- **Max tokens**: Change `max_tokens` value
- **Temperature**: Adjust creativity (0.0 - 1.0)
- **System prompts**: Modify instructions for CSV vs Markdown generation
- **CORS**: Update `Access-Control-Allow-Origin` for production

### Rate Limiting (Optional)

Add rate limiting to prevent abuse:

```javascript
// In worker/index.js
const ip = request.headers.get('CF-Connecting-IP');
// Use KV to track request counts per IP
```

## 📊 Costs & Limits

### Cloudflare Workers Free Tier

- ✅ **100,000 requests/day** - FREE
- ✅ **10ms CPU time per request** - Usually sufficient
- ✅ **Unlimited bandwidth** - No egress charges

### Claude API Costs (Pay-as-you-go)

Using Claude 3.5 Sonnet:
- **Input**: $3 per million tokens (~$0.003 per 1K tokens)
- **Output**: $15 per million tokens (~$0.015 per 1K tokens)

**Typical usage:**
- CSV generation (500 tokens): ~$0.0075 per request
- Markdown article (2000 tokens): ~$0.03 per request
- 100 CSV generations: ~$0.75
- 100 Markdown articles: ~$3.00

### Example Monthly Costs

**Light usage** (100 requests/day):
- Cloudflare: $0 (within free tier)
- Claude API: ~$10/month

**Medium usage** (1,000 requests/day):
- Cloudflare: $0 (within free tier)
- Claude API: ~$100/month

**Heavy usage** (10,000 requests/day):
- Cloudflare: ~$5/month (paid plan)
- Claude API: ~$1,000/month

> 💡 **Tip**: Add rate limiting to control costs!

## 🔒 Security Best Practices

### Current Setup (Good for Prototypes)

✅ API key stored as Worker secret (never exposed to browser)
✅ CORS enabled for public access
✅ HTML sanitization with DOMPurify
✅ No user data persistence

### Production Hardening (Recommended)

1. **Add Authentication**
   ```javascript
   // Check auth header in worker
   const authToken = request.headers.get('Authorization');
   if (authToken !== env.VALID_AUTH_TOKEN) {
     return new Response('Unauthorized', { status: 401 });
   }
   ```

2. **Rate Limiting**
   ```javascript
   // Use KV to track requests per IP/user
   const rateLimitKey = `ratelimit:${ip}`;
   const count = await env.KV.get(rateLimitKey);
   if (count > 100) {
     return new Response('Rate limit exceeded', { status: 429 });
   }
   ```

3. **Restrict CORS**
   ```javascript
   // Only allow your domain
   'Access-Control-Allow-Origin': 'https://yourdomain.com'
   ```

4. **Add Request Logging**
   ```javascript
   // Log requests for monitoring
   console.log(`Request from ${ip} - Prompt: ${prompt.substring(0, 50)}`);
   ```

## 🧪 Testing

### Local Testing

```bash
# Terminal 1: Start worker
wrangler dev worker/index.js --port 8787

# Terminal 2: Serve static files
cd public && python3 -m http.server 8000
```

Test endpoints:
- Static site: http://localhost:8000
- Worker: http://localhost:8787/api/generate

### Manual API Testing

```bash
curl -X POST http://localhost:8787/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Generate a simple CSV with 3 columns", "contentType": "csv"}'
```

## 🐛 Troubleshooting

### "API key not set" Error

```bash
# Make sure you've set the secret
wrangler secret put ANTHROPIC_API_KEY

# Verify it's set
wrangler secret list
```

### CORS Errors

Check the browser console. If you see CORS errors:

1. Verify worker is deployed
2. Check `Access-Control-Allow-Origin` header in worker
3. Make sure you're using the correct worker URL

### Worker Not Streaming

If streaming doesn't work:

1. Check worker logs: `wrangler tail`
2. Verify Claude API key is valid
3. Check network tab for 200 status code
4. Look for SSE (text/event-stream) content type

### "Module not found" Error

Make sure your wrangler.toml has:
```toml
main = "worker/index.js"
```

## 📈 Monitoring

### View Worker Logs

```bash
# Real-time logs
wrangler tail

# View in dashboard
# https://dash.cloudflare.com -> Workers -> Your Worker -> Logs
```

### Analytics

Cloudflare provides free analytics:
- Request count
- Error rate
- P50/P99 latency
- CPU time usage

Access at: `https://dash.cloudflare.com`

## 🎯 Next Steps

### Enhancements

- [ ] Add user authentication (JWT tokens)
- [ ] Implement rate limiting with KV
- [ ] Add request caching for repeated prompts
- [ ] Create JSON editor mode
- [ ] Add export functionality (download CSV/MD)
- [ ] Implement undo/redo history
- [ ] Add multi-user collaboration with Durable Objects

### Advanced Features

- [ ] Use Cloudflare Durable Objects for real-time collaboration
- [ ] Add WebSocket support for live multi-user editing
- [ ] Implement CRDT for conflict-free editing
- [ ] Add voice input using Web Speech API
- [ ] Create mobile-responsive design

## 📚 Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Anthropic API Docs](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)

## 📄 License

MIT

---

**Questions?** Open an issue or check the [original README](README.md) for architecture details.
