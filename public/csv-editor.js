/**
 * CSV Editor - Vanilla JavaScript
 * No build process required
 */

class CSVEditor {
  constructor() {
    // Worker endpoint - change this to your deployed worker URL
    this.workerEndpoint = 'https://ai-sandbox-worker.foray-consulting.workers.dev/api/generate';

    // DOM Elements
    this.elements = {
      prompt: document.getElementById('csv-prompt'),
      generateBtn: document.getElementById('csv-generate'),
      stopBtn: document.getElementById('csv-stop'),
      clearBtn: document.getElementById('csv-clear'),
      addRowBtn: document.getElementById('csv-add-row'),
      textArea: document.getElementById('csv-text'),
      tableContainer: document.getElementById('csv-table-container'),
      streamingStatus: document.getElementById('csv-streaming-status'),
      error: document.getElementById('csv-error'),
    };

    // State
    this.isStreaming = false;
    this.abortController = null;
    this.csvData = [];
    this.editingCell = null;
    this.conversationHistory = []; // Full conversation for iterative updates

    this.init();
  }

  // Get current mode based on content
  get mode() {
    return this.elements.textArea.value.trim() ? 'update' : 'generate';
  }

  // Update button label based on mode
  updateButtonLabel() {
    const label = this.mode === 'generate' ? 'Generate' : 'Update';
    this.elements.generateBtn.textContent = label;
  }

  init() {
    // Event listeners
    this.elements.generateBtn.addEventListener('click', () => this.generate());
    this.elements.stopBtn.addEventListener('click', () => this.stopStreaming());
    this.elements.clearBtn.addEventListener('click', () => this.clear());
    this.elements.addRowBtn.addEventListener('click', () => this.addRow());
    this.elements.textArea.addEventListener('input', () => {
      this.parseAndRender();
      this.updateButtonLabel();
    });
    this.elements.prompt.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.generate();
    });

    // Example buttons
    document.querySelectorAll('.csv-example').forEach(btn => {
      btn.addEventListener('click', () => {
        this.elements.prompt.value = btn.textContent;
        this.generate();
      });
    });

    // Initialize button label
    this.updateButtonLabel();
  }

  async generate() {
    const prompt = this.elements.prompt.value.trim();
    if (!prompt || this.isStreaming) return;

    this.isStreaming = true;
    this.elements.generateBtn.disabled = true;
    this.elements.stopBtn.classList.remove('hidden');
    this.elements.streamingStatus.classList.remove('hidden');
    this.elements.textArea.disabled = true;
    this.elements.error.classList.add('hidden');

    // Store current content for context
    const currentContent = this.elements.textArea.value.trim();

    // Build user message with context
    let userMessage;
    if (currentContent && this.mode === 'update') {
      // Update mode: include current content
      userMessage = `Current content:\n${currentContent}\n\nInstruction: ${prompt}`;
    } else {
      // Generate mode: just the prompt
      userMessage = prompt;
      // Clear textarea for new generation
      this.elements.textArea.value = '';
    }

    // Add user message to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    this.abortController = new AbortController();
    let assistantResponse = '';

    try {
      const response = await fetch(this.workerEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: this.conversationHistory,
          contentType: 'csv'
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              // Handle different event types
              if (parsed.type === 'tool_use') {
                // Claude is using a tool
                this.updateStatus(`${parsed.command === 'view' ? 'Viewing' : 'Editing'} content...`);
                this.highlightTextarea('editing');
              } else if (parsed.type === 'content_update') {
                // Content has been updated by an edit
                this.elements.textArea.value = parsed.content;
                this.parseAndRender();
                this.highlightTextarea('success');
              } else if (parsed.type === 'tool_result') {
                // Tool execution result
                if (parsed.success) {
                  this.updateStatus(parsed.message || 'Edit applied');
                } else {
                  this.showError(`Edit failed: ${parsed.message}`);
                }
              } else if (parsed.type === 'text') {
                // Final text response from Claude (summary)
                assistantResponse += parsed.text;
                this.updateStatus(parsed.text);
              } else if (parsed.text) {
                // Legacy format support
                assistantResponse += parsed.text;
                this.elements.textArea.value += parsed.text;
                this.parseAndRender();
              } else if (parsed.error) {
                // Error from worker
                this.showError(parsed.error);
              }
            } catch (e) {
              // Skip invalid JSON
              console.warn('Failed to parse SSE data:', e);
            }
          }
        }
      }

      // Add assistant response to conversation history
      if (assistantResponse) {
        this.conversationHistory.push({
          role: 'assistant',
          content: assistantResponse
        });
      }

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Generation error:', error);
        this.showError(`Error: ${error.message}. Make sure the worker is deployed and ANTHROPIC_API_KEY is set.`);
      }
      // Remove the user message from history if request failed
      this.conversationHistory.pop();
    } finally {
      this.isStreaming = false;
      this.elements.generateBtn.disabled = false;
      this.elements.stopBtn.classList.add('hidden');
      this.elements.streamingStatus.classList.add('hidden');
      this.elements.textArea.disabled = false;
      this.elements.prompt.value = '';
      this.updateButtonLabel();
    }
  }

  updateStatus(message) {
    this.elements.streamingStatus.textContent = message;
  }

  highlightTextarea(type) {
    const textarea = this.elements.textArea;
    textarea.classList.remove('highlight-editing', 'highlight-success');

    if (type === 'editing') {
      textarea.classList.add('highlight-editing');
    } else if (type === 'success') {
      textarea.classList.add('highlight-success');
      setTimeout(() => textarea.classList.remove('highlight-success'), 500);
    }
  }

  stopStreaming() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  clear() {
    this.elements.textArea.value = '';
    this.conversationHistory = [];
    this.parseAndRender();
    this.updateButtonLabel();
  }

  parseCSV(text) {
    if (!text.trim()) return [];

    const lines = text.trim().split('\n');
    return lines.map(line => {
      const cells = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    });
  }

  arrayToCSV(data) {
    return data.map(row =>
      row.map(cell => {
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    ).join('\n');
  }

  parseAndRender() {
    this.csvData = this.parseCSV(this.elements.textArea.value);
    this.renderTable();
  }

  renderTable() {
    if (this.csvData.length === 0) {
      this.elements.tableContainer.innerHTML = '<div class="empty-state">Table will render here as CSV streams in...</div>';
      return;
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Header row
    const headerRow = document.createElement('tr');
    this.csvData[0].forEach((cell, colIdx) => {
      const th = document.createElement('th');
      const cellDiv = this.createEditableCell(cell, 0, colIdx);
      th.appendChild(cellDiv);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Data rows
    for (let rowIdx = 1; rowIdx < this.csvData.length; rowIdx++) {
      const tr = document.createElement('tr');
      this.csvData[rowIdx].forEach((cell, colIdx) => {
        const td = document.createElement('td');
        const cellDiv = this.createEditableCell(cell, rowIdx, colIdx);
        td.appendChild(cellDiv);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    this.elements.tableContainer.innerHTML = '';
    this.elements.tableContainer.appendChild(table);
  }

  createEditableCell(value, rowIdx, colIdx) {
    const div = document.createElement('div');
    div.className = 'cell-editable';
    div.textContent = value || '';

    if (!value) {
      div.classList.add('cell-empty');
      div.textContent = 'Empty';
    }

    div.addEventListener('click', () => {
      if (this.isStreaming) return;
      this.startCellEdit(div, rowIdx, colIdx);
    });

    return div;
  }

  startCellEdit(cellDiv, rowIdx, colIdx) {
    const currentValue = this.csvData[rowIdx][colIdx];
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-input';
    input.value = currentValue;

    const finishEdit = () => {
      const newValue = input.value;
      this.csvData[rowIdx][colIdx] = newValue;
      this.elements.textArea.value = this.arrayToCSV(this.csvData);
      this.renderTable();
    };

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        finishEdit();
      }
    });

    cellDiv.innerHTML = '';
    cellDiv.appendChild(input);
    input.focus();
    input.select();
  }

  addRow() {
    if (this.csvData.length === 0) return;

    const colCount = this.csvData[0].length;
    const newRow = new Array(colCount).fill('');
    this.csvData.push(newRow);
    this.elements.textArea.value = this.arrayToCSV(this.csvData);
    this.renderTable();
  }

  showError(message) {
    this.elements.error.textContent = message;
    this.elements.error.classList.remove('hidden');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.csvEditor = new CSVEditor();
  });
} else {
  window.csvEditor = new CSVEditor();
}
