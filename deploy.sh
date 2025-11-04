#!/bin/bash

# AI Sandbox - Serverless Deployment Script
# Deploys both the Cloudflare Worker and static files

set -e

echo "🚀 AI Sandbox - Serverless Deployment"
echo "======================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler CLI not found"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

# Check if logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "❌ Error: Not logged in to Cloudflare"
    echo "Run: wrangler login"
    exit 1
fi

echo "✅ Wrangler CLI found and authenticated"
echo ""

# Deploy the worker
echo "📦 Deploying Cloudflare Worker..."
wrangler deploy worker/index.js

if [ $? -eq 0 ]; then
    echo "✅ Worker deployed successfully"
else
    echo "❌ Worker deployment failed"
    exit 1
fi

echo ""

# Ask for worker URL
echo "🔗 Please enter your deployed worker URL:"
echo "   (e.g., https://ai-sandbox-worker.your-subdomain.workers.dev)"
read -p "Worker URL: " WORKER_URL

if [ -z "$WORKER_URL" ]; then
    echo "⚠️  No worker URL provided. Skipping static file update."
else
    # Update the worker endpoint in JavaScript files
    echo ""
    echo "🔧 Updating worker endpoint in static files..."

    # Backup originals
    cp public/csv-editor.js public/csv-editor.js.bak
    cp public/markdown-editor.js public/markdown-editor.js.bak

    # Update CSV editor
    sed -i.tmp "s|this.workerEndpoint = '/api/generate';|this.workerEndpoint = '$WORKER_URL';|g" public/csv-editor.js
    rm -f public/csv-editor.js.tmp

    # Update Markdown editor
    sed -i.tmp "s|this.workerEndpoint = '/api/generate';|this.workerEndpoint = '$WORKER_URL';|g" public/markdown-editor.js
    rm -f public/markdown-editor.js.tmp

    echo "✅ Worker endpoint updated in static files"
fi

echo ""

# Deploy to Cloudflare Pages
echo "📄 Deploying static files to Cloudflare Pages..."
read -p "Project name [ai-sandbox]: " PROJECT_NAME
PROJECT_NAME=${PROJECT_NAME:-ai-sandbox}

wrangler pages deploy public --project-name="$PROJECT_NAME"

if [ $? -eq 0 ]; then
    echo "✅ Static files deployed successfully"
else
    echo "❌ Pages deployment failed"

    # Restore backups
    if [ -f public/csv-editor.js.bak ]; then
        mv public/csv-editor.js.bak public/csv-editor.js
    fi
    if [ -f public/markdown-editor.js.bak ]; then
        mv public/markdown-editor.js.bak public/markdown-editor.js
    fi

    exit 1
fi

# Cleanup backups
rm -f public/csv-editor.js.bak public/markdown-editor.js.bak

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Visit your Cloudflare Pages URL to test the app"
echo "2. Make sure you've set your Claude API key:"
echo "   wrangler secret put ANTHROPIC_API_KEY"
echo "3. Check worker logs with: wrangler tail"
echo ""
echo "📚 See SERVERLESS_README.md for more details"
