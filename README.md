# AI Sandbox Prototype: Live Collaborative Editor

> **Real Claude API Integration** - This prototype now features actual streaming AI generation using the Anthropic Claude API, not simulated responses!

## Overview

This prototype demonstrates a novel approach to human-AI collaboration through **live, bidirectional editing** of structured data. The core idea is to enable seamless, simultaneous collaboration between users and AI on documents where:

- **AI generates** structured content (CSV, Markdown, etc.) in real-time via **Claude 3.5 Sonnet**
- **Users see** that content rendered beautifully (as tables, formatted text, etc.)
- **Both can edit** simultaneously without conflicts
- **Changes sync** instantly in both directions

## ✨ What's New

- ✅ **Real Claude API Integration** - Actual streaming responses from Claude 3.5 Sonnet
- ✅ **CSV Editor** - Generate and edit CSV data with live table rendering
- ✅ **Markdown Editor** - Generate and edit Markdown with live HTML preview
- ✅ **Tab Navigation** - Switch between CSV and Markdown editors
- ✅ **Production Ready** - Full Vite + React setup with proper error handling

## The Use Case

Imagine working with an AI assistant that doesn't just chat with you, but actively collaborates on documents:

### Example Workflow

1. **User prompts**: "Generate a financial tracker spreadsheet"
2. **AI streams CSV text** which the user sees rendering live as a formatted table
3. **User edits cells** directly in the table (e.g., fills in actual expense amounts)
4. **User prompts**: "What do you think of these values?"
5. **AI analyzes** the current state and responds, potentially editing cells directly
6. **Both continue** working on the same document simultaneously

### Why This Matters

Traditional AI interactions are turn-based: you ask, AI responds, you ask again. This prototype explores **concurrent collaboration** where:

- AI can generate structured data faster than humans can type
- Users maintain control with direct manipulation (clicking cells, dragging, etc.)
- No context switching between "chat mode" and "edit mode"
- Natural workflow: request → generate → refine → iterate

## Technical Architecture

### Core Concept: Dual Representation

The system maintains two synchronized representations:

1. **Source of Truth**: Raw text format (CSV, JSON, Markdown, etc.)
   - This is what the AI generates and edits
   - Parseable, diffable, versionable
   
2. **Visual Layer**: Rendered UI (tables, forms, formatted text)
   - This is what users see and interact with
   - Rich, intuitive, familiar interfaces

### Key Components

```
┌─────────────────────────────────────────────────────┐
│                   User Prompt                        │
│              "Generate financial tracker"            │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                  AI (LLM)                            │
│         Streams CSV text character-by-character      │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              Raw Text Buffer (CSV)                   │
│        Date,Category,Amount,Notes                    │
│        2025-01-01,Groceries,125.50,...              │
│                 SOURCE OF TRUTH                      │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│            Incremental Parser                        │
│     Parses complete lines as they arrive             │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              Rendered Table View                     │
│    ┌──────┬──────────┬────────┬────────┐           │
│    │ Date │ Category │ Amount │ Notes  │           │
│    ├──────┼──────────┼────────┼────────┤           │
│    │ 1/1  │ Grocery  │ 125.50 │ ...    │ ◄─ Click │
│    └──────┴──────────┴────────┴────────┘           │
└─────────────────────┬───────────────────────────────┘
                      │
              User edits cell
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│         Update CSV at specific position              │
│         Maintain edit locks during changes           │
└─────────────────────────────────────────────────────┘
```

### Implementation Details

**Streaming & Incremental Parsing**
```javascript
// As LLM streams tokens
onLLMToken(token) {
  buffer += token;
  
  // Parse complete lines immediately
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line
  
  lines.forEach(line => {
    const row = parseCSVLine(line);
    renderNewRow(row); // Instant visual update
  });
}
```

**Bidirectional Sync**
```javascript
// User edits cell → Update source
onCellEdit(rowIdx, colIdx, newValue) {
  updateVisualCell(rowIdx, colIdx, newValue); // Immediate UI
  updateCSVText(rowIdx, colIdx, newValue);    // Update source
}

// Source changes → Update visual
onCSVChange(newText) {
  const parsed = parseCSV(newText);
  renderTable(parsed);
}
```

**Conflict Prevention**
```javascript
const editLocks = new Set(); // Track locked regions

// User starts editing
userStartsEdit(location) {
  editLocks.add(location);
  notifyAI({ locked: location });
}

// AI checks before editing
aiWantsToEdit(location) {
  if (editLocks.has(location)) {
    return false; // Skip or queue
  }
  applyAIEdit(location);
}
```

## Current Prototype Features

### CSV Editor (`LiveCSVEditor.jsx`)

✅ **Real Claude API streaming** - Actual AI generation from Claude 3.5 Sonnet
✅ **Live streaming** - Watch CSV data stream in token-by-token
✅ **Instant rendering** - Table updates as data streams in
✅ **Cell editing** - Click any cell to edit, syncs back to CSV
✅ **Bidirectional sync** - Edit CSV text or table, both stay in sync
✅ **Add rows** - Dynamically add new rows to the table
✅ **Edit locks** - Conflict prevention during simultaneous edits
✅ **Abort support** - Stop generation mid-stream with cancel button
✅ **Error handling** - Clear error messages with setup guidance

### Markdown Editor (`LiveMarkdownEditor.jsx`)

✅ **Real Claude API streaming** - Generate authentic markdown content
✅ **Live preview** - See HTML rendering as markdown streams
✅ **Full markdown support** - Headers, lists, code blocks, tables, links, images
✅ **Syntax highlighting** - Proper rendering of code blocks
✅ **Sanitized HTML** - Security through DOMPurify
✅ **Manual editing** - Edit raw markdown with instant preview updates
✅ **Quick reference** - Built-in markdown syntax guide

## Future Enhancements

### Short Term
- [x] ~~Real LLM integration (Claude API)~~ ✅ **DONE**
- [x] ~~Multiple format support (Markdown)~~ ✅ **DONE**
- [ ] Better conflict resolution (merge strategies, operational transforms)
- [ ] Undo/redo history
- [ ] JSON editor with form/tree view
- [ ] Visual indicators showing where AI is "typing"
- [ ] AI-powered editing (give instructions to modify existing content)

### Medium Term
- [ ] Backend proxy for API keys (security improvement)
- [ ] Multi-user collaboration (WebRTC/WebSockets)
- [ ] CRDT implementation for true distributed editing
- [ ] Voice prompts for hands-free interaction
- [ ] Export to various formats (PDF, DOCX, Excel)
- [ ] Import existing files for AI-assisted editing

### Long Term
- [ ] AI understands visual context (cursor position, selection)
- [ ] Predictive editing (AI suggests edits before you ask)
- [ ] Multi-modal collaboration (diagrams, charts, images)
- [ ] Version control integration
- [ ] Plugin ecosystem for custom data types
- [ ] YAML, SQL, LaTeX, SVG editors

## Use Cases Beyond Spreadsheets

This architecture generalizes to many structured formats:

| Format | Visual Representation | Use Case |
|--------|----------------------|----------|
| CSV | Tables | Financial tracking, inventories, contacts |
| JSON | Forms/Trees | Configuration files, API responses |
| Markdown | Formatted text | Documents, notes, articles |
| YAML | Structured editor | Configuration, CI/CD pipelines |
| SQL | Query builder | Database work |
| LaTeX | Rendered equations | Scientific documents |
| SVG | Visual canvas | Diagrams, illustrations |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- An Anthropic API key ([get one here](https://console.anthropic.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai_sandbox_prototype
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env

   # Edit .env and add your Claude API key
   # VITE_ANTHROPIC_API_KEY=your_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   - Navigate to `http://localhost:5173` (or the URL shown in terminal)
   - Start generating CSV or Markdown content with AI!

### Environment Variables

Create a `.env` file in the root directory:

```env
# Required: Your Anthropic Claude API key
VITE_ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# Optional: Specify Claude model (defaults to claude-3-5-sonnet-20241022)
VITE_CLAUDE_MODEL=claude-3-5-sonnet-20241022
```

> ⚠️ **Security Note**: The current implementation uses `dangerouslyAllowBrowser: true` for the Anthropic SDK, which exposes your API key in the browser. This is fine for local development and prototyping, but for production, you should proxy API calls through a backend server.

### Project Structure

```
ai_sandbox_prototype/
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── button.jsx
│   │   │   ├── input.jsx
│   │   │   └── textarea.jsx
│   │   ├── LiveCSVEditor.jsx      # CSV editor with table view
│   │   └── LiveMarkdownEditor.jsx # Markdown editor with preview
│   ├── services/
│   │   └── claudeService.js       # Claude API integration
│   ├── lib/
│   │   └── utils.js               # Utility functions
│   ├── App.jsx                    # Main app with tab navigation
│   ├── main.jsx                   # React entry point
│   └── index.css                  # Global styles + Tailwind
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

### Key Dependencies

- **React 18.2** - UI framework
- **Vite 5.0** - Build tool and dev server
- **@anthropic-ai/sdk 0.30** - Official Claude API client
- **marked 11.1** - Markdown parser
- **DOMPurify 3.0** - HTML sanitization
- **Tailwind CSS 3.4** - Styling
- **lucide-react 0.299** - Icons

### Build for Production

```bash
# Build the application
npm run build

# Preview the production build
npm run preview
```

### Troubleshooting

**"API key not set" error:**
- Make sure you've created a `.env` file with `VITE_ANTHROPIC_API_KEY`
- Restart the dev server after adding environment variables

**Streaming not working:**
- Check browser console for errors
- Verify your API key is valid and has credits
- Check network tab to see API requests

**Build errors:**
- Delete `node_modules` and run `npm install` again
- Make sure you're using Node 18+

## Claude API Integration

### How It Works

The application uses the official `@anthropic-ai/sdk` to stream responses from Claude API:

```javascript
// src/services/claudeService.js
const stream = await client.messages.stream({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4096,
  temperature: 0.7,
  system: systemPrompt,
  messages: [{ role: 'user', content: userPrompt }],
});

// Handle streaming chunks
for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta') {
    const text = chunk.delta.text;
    onChunk(text); // Update UI with each token
  }
}
```

### Features

- **Real-time streaming**: Tokens appear as Claude generates them
- **Abort support**: Cancel generation mid-stream with AbortController
- **Error handling**: Graceful error messages and recovery
- **Customizable prompts**: Different system prompts for CSV vs Markdown
- **Token limits**: Configurable max_tokens per request

### API Costs

Using Claude 3.5 Sonnet (default model):
- Input: $3 per million tokens
- Output: $15 per million tokens

Typical generation costs:
- CSV spreadsheet (500 tokens): ~$0.0075
- Markdown article (2000 tokens): ~$0.03

> 💡 **Tip**: Set up usage limits in your [Anthropic Console](https://console.anthropic.com/) to avoid unexpected charges.

## Architecture Decisions

### Why Raw Text as Source of Truth?

1. **AI-native**: LLMs generate text naturally
2. **Diffable**: Can use standard diff/merge tools
3. **Versionable**: Works with Git, etc.
4. **Parseable**: Many mature parsers exist
5. **Portable**: Easy to save, share, transfer

### Why Not Just Use Rich Text Editors?

Rich text editors (ProseMirror, Slate) work well for document editing, but:
- They're optimized for prose, not structured data
- Harder to integrate with AI that generates raw text
- Complex data structures (tables) are cumbersome
- Not ideal for streaming character-by-character updates

### Why Not Operational Transform (OT)?

OT is powerful but complex. For MVP:
- Simple edit locks are sufficient
- User edits are rare during AI streaming
- Can upgrade to OT/CRDT later if needed

## Related Work

- **Jupyter Notebooks**: Cell-based execution with rich output
- **Observable**: Reactive notebooks with live updates
- **Notion**: Block-based collaborative editing
- **Figma**: Real-time multi-user design
- **Google Docs**: Real-time collaborative text editing
- **VS Code Live Share**: Real-time code collaboration

## Contributing

This is an experimental prototype exploring new interaction patterns for human-AI collaboration. Contributions, ideas, and feedback welcome!

## License

MIT

---

**Contact**: For questions or collaboration opportunities, reach out through the repository issues.