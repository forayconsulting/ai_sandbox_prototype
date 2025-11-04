# AI Sandbox Prototype: Live Collaborative Editor

## Overview

This prototype demonstrates a novel approach to human-AI collaboration through **live, bidirectional editing** of structured data. The core idea is to enable seamless, simultaneous collaboration between users and AI on documents where:

- **AI generates** structured content (CSV, JSON, etc.) in real-time
- **Users see** that content rendered beautifully (as tables, forms, etc.)
- **Both can edit** simultaneously without conflicts
- **Changes sync** instantly in both directions

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

The `live-csv-editor.jsx` component demonstrates:

✅ **Live streaming** - AI generates CSV character-by-character  
✅ **Instant rendering** - Table updates as data streams in  
✅ **Cell editing** - Click any cell to edit, syncs back to CSV  
✅ **Bidirectional sync** - Edit CSV text or table, both stay in sync  
✅ **Add rows** - Dynamically add new rows to the table  
✅ **Edit locks** - Basic conflict prevention during simultaneous edits  
✅ **Multiple prompts** - Different data types (financial, inventory, contacts)

## Future Enhancements

### Short Term
- [ ] Real LLM integration (Claude API, OpenAI API)
- [ ] Better conflict resolution (merge strategies, operational transforms)
- [ ] Undo/redo history
- [ ] Multiple format support (JSON → forms, Markdown → formatted text)
- [ ] Visual indicators showing where AI is "typing"

### Medium Term
- [ ] Multi-user collaboration (WebRTC/WebSockets)
- [ ] CRDT implementation for true distributed editing
- [ ] Rich text editing (not just tables)
- [ ] Voice prompts for hands-free interaction
- [ ] Export to various formats

### Long Term
- [ ] AI understands visual context (cursor position, selection)
- [ ] Predictive editing (AI suggests edits before you ask)
- [ ] Multi-modal collaboration (diagrams, charts, images)
- [ ] Version control integration
- [ ] Plugin ecosystem for custom data types

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

## Running the Prototype

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# Open in browser
# The component uses shadcn/ui, so ensure you have those dependencies
```

### Dependencies
- React 18+
- shadcn/ui components (Button, Input, Textarea)
- Tailwind CSS

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