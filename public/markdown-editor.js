/**
 * Markdown Editor - Vanilla JavaScript
 * No build process required
 */

class MarkdownEditor {
  constructor() {
    // Worker endpoint - change this to your deployed worker URL
    this.workerEndpoint = 'https://ai-sandbox-worker.foray-consulting.workers.dev/api/generate';

    // DOM Elements
    this.elements = {
      prompt: document.getElementById('markdown-prompt'),
      generateBtn: document.getElementById('markdown-generate'),
      stopBtn: document.getElementById('markdown-stop'),
      clearBtn: document.getElementById('markdown-clear'),
      textArea: document.getElementById('markdown-text'),
      preview: document.getElementById('markdown-preview'),
      streamingStatus: document.getElementById('markdown-streaming-status'),
      error: document.getElementById('markdown-error'),
    };

    // State
    this.isStreaming = false;
    this.abortController = null;
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
    // Configure marked
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,
        gfm: true,
      });
    }

    // Event listeners
    this.elements.generateBtn.addEventListener('click', () => this.generate());
    this.elements.stopBtn.addEventListener('click', () => this.stopStreaming());
    this.elements.clearBtn.addEventListener('click', () => this.clear());
    this.elements.textArea.addEventListener('input', () => {
      this.renderPreview();
      this.updateButtonLabel();
    });
    this.elements.prompt.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.generate();
    });

    // Example buttons
    document.querySelectorAll('.markdown-example').forEach(btn => {
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
    let isFirstChunk = true;

    try {
      const response = await fetch(this.workerEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: this.conversationHistory,
          contentType: 'markdown'
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
              if (parsed.text) {
                assistantResponse += parsed.text;

                // Clear textarea on first chunk in update mode to enable full editing
                if (isFirstChunk && this.mode === 'update') {
                  this.elements.textArea.value = '';
                  isFirstChunk = false;
                }

                this.elements.textArea.value += parsed.text;
                this.renderPreview();
              }
            } catch (e) {
              // Skip invalid JSON
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

  stopStreaming() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  clear() {
    this.elements.textArea.value = '';
    this.conversationHistory = [];
    this.renderPreview();
    this.updateButtonLabel();
  }

  renderPreview() {
    const markdownText = this.elements.textArea.value;

    if (!markdownText.trim()) {
      this.elements.preview.innerHTML = '<div class="empty-state">Preview will render here as Markdown streams in...</div>';
      return;
    }

    try {
      // Parse markdown to HTML
      let html = '';
      if (typeof marked !== 'undefined') {
        html = marked.parse(markdownText);
      } else {
        // Fallback if marked.js not loaded
        html = `<pre>${this.escapeHtml(markdownText)}</pre>`;
      }

      // Sanitize HTML
      if (typeof DOMPurify !== 'undefined') {
        html = DOMPurify.sanitize(html);
      }

      this.elements.preview.innerHTML = html;
    } catch (error) {
      console.error('Render error:', error);
      this.elements.preview.innerHTML = '<div class="error-message">Error rendering markdown</div>';
    }
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  showError(message) {
    this.elements.error.textContent = message;
    this.elements.error.classList.remove('hidden');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.markdownEditor = new MarkdownEditor();
  });
} else {
  window.markdownEditor = new MarkdownEditor();
}
