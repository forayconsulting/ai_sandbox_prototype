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
        const { done, value} = await reader.read();
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
              if (parsed.type === 'clarification_needed') {
                // Claude needs clarification - show modal
                await this.showClarificationModal(parsed.question, parsed.why_asking, parsed.conversation_state);
                // Modal will handle resumption - exit stream processing
                return;
              } else if (parsed.type === 'tool_use') {
                // Claude is using a tool
                this.updateStatus(`${parsed.command === 'view' ? 'Viewing' : 'Editing'} content...`);
                this.highlightTextarea('editing');
              } else if (parsed.type === 'content_update') {
                // Content has been updated by an edit - visualize the change
                await this.visualizeEdit(parsed.content, parsed.edit);
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
                this.renderPreview();
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

  /**
   * Visualize an edit with smooth animations
   * Shows WHERE and WHAT changed in the textarea
   */
  async visualizeEdit(newContent, editMetadata) {
    const textarea = this.elements.textArea;

    if (!editMetadata) {
      // No metadata - just update content
      textarea.value = newContent;
      this.renderPreview();
      this.highlightTextarea('success');
      return;
    }

    // STEP 1: Scroll to and select the text being edited
    textarea.setSelectionRange(editMetadata.start_pos, editMetadata.end_pos);
    textarea.focus();

    // Scroll to the selection
    this.scrollToSelection(textarea, editMetadata.start_pos);

    // STEP 2: Apply the edit - just do it directly without color effects
    // For small edits, show character-by-character typing
    if (editMetadata.new_text.length > 0 && editMetadata.new_text.length < 50) {
      await this.animateTyping(textarea, newContent, editMetadata);
    } else {
      // For large edits or deletions, just replace instantly
      await this.sleep(300); // Small pause to let user see selection
      textarea.value = newContent;
    }

    // Update preview
    this.renderPreview();
  }

  /**
   * Scroll textarea to show the edited position
   */
  scrollToSelection(textarea, charPosition) {
    // Get the text before the edit position
    const textBefore = textarea.value.substring(0, charPosition);
    const lines = textBefore.split('\n');
    const lineNumber = lines.length;

    // Estimate scroll position (approximate)
    const lineHeight = 20; // pixels per line (match CSS)
    const targetScroll = (lineNumber - 5) * lineHeight; // Center in view

    textarea.scrollTop = Math.max(0, targetScroll);
  }

  /**
   * Animate typing effect for small edits
   */
  async animateTyping(textarea, finalContent, editMetadata) {
    const oldContent = textarea.value;
    const newText = editMetadata.new_text;

    // Build content incrementally
    for (let i = 0; i <= newText.length; i++) {
      const partialNew = newText.substring(0, i);
      const before = oldContent.substring(0, editMetadata.start_pos);
      const after = oldContent.substring(editMetadata.end_pos);

      textarea.value = before + partialNew + after;

      // Update cursor position
      const cursorPos = editMetadata.start_pos + i;
      textarea.setSelectionRange(cursorPos, cursorPos);

      await this.sleep(30); // 30ms per character
    }

    // Set final content to be sure
    textarea.value = finalContent;
  }

  /**
   * Sleep utility for animations
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

  /**
   * Show clarification modal when Claude needs more information
   */
  showClarificationModal(question, whyAsking, conversationState) {
    return new Promise((resolve) => {
      const modal = document.getElementById('clarification-modal');
      const questionEl = modal.querySelector('.clarification-question');
      const contextEl = modal.querySelector('.clarification-context');
      const inputEl = modal.querySelector('.clarification-input');
      const submitBtn = modal.querySelector('.btn-submit');
      const cancelBtn = modal.querySelector('.btn-cancel');

      // Set content
      questionEl.textContent = question;
      contextEl.textContent = whyAsking || '';
      inputEl.value = '';

      // Show modal
      modal.style.display = 'flex';
      setTimeout(() => inputEl.focus(), 100);

      // Handle submit
      const handleSubmit = async () => {
        const answer = inputEl.value.trim();
        if (!answer) return;

        // Disable buttons during submission
        submitBtn.disabled = true;
        cancelBtn.disabled = true;
        submitBtn.textContent = 'SUBMITTING...';

        // Hide modal
        modal.style.display = 'none';

        // Resume conversation with answer
        await this.resumeWithClarification(conversationState, answer);

        // Cleanup
        cleanup();
        resolve();
      };

      // Handle cancel
      const handleCancel = () => {
        modal.style.display = 'none';
        cleanup();
        resolve();
      };

      // Handle escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') handleCancel();
      };

      // Handle enter key in textarea (Ctrl+Enter to submit)
      const handleEnter = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleSubmit();
        }
      };

      // Cleanup function
      const cleanup = () => {
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
        submitBtn.textContent = 'SUBMIT';
        submitBtn.removeEventListener('click', handleSubmit);
        cancelBtn.removeEventListener('click', handleCancel);
        document.removeEventListener('keydown', handleEscape);
        inputEl.removeEventListener('keydown', handleEnter);
      };

      // Attach event listeners
      submitBtn.addEventListener('click', handleSubmit);
      cancelBtn.addEventListener('click', handleCancel);
      document.addEventListener('keydown', handleEscape);
      inputEl.addEventListener('keydown', handleEnter);
    });
  }

  /**
   * Resume conversation after receiving clarification from user
   */
  async resumeWithClarification(conversationState, clarificationAnswer) {
    // Re-enable streaming UI
    this.isStreaming = true;
    this.elements.generateBtn.disabled = true;
    this.elements.stopBtn.classList.remove('hidden');
    this.elements.streamingStatus.classList.remove('hidden');
    this.elements.textArea.disabled = true;
    this.updateStatus('Resuming with your answer...');

    this.abortController = new AbortController();
    let assistantResponse = '';

    try {
      const response = await fetch(this.workerEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: 'markdown',
          conversation_state: conversationState,
          clarification_answer: clarificationAnswer,
          // Send a dummy message to satisfy the worker's requirement
          messages: [{ role: 'user', content: 'Resume' }]
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

              // Handle events (same as generate)
              if (parsed.type === 'clarification_needed') {
                // Nested clarification (Claude asks another question)
                await this.showClarificationModal(parsed.question, parsed.why_asking, parsed.conversation_state);
                return;
              } else if (parsed.type === 'tool_use') {
                this.updateStatus(`${parsed.command === 'view' ? 'Viewing' : 'Editing'} content...`);
                this.highlightTextarea('editing');
              } else if (parsed.type === 'content_update') {
                await this.visualizeEdit(parsed.content, parsed.edit);
              } else if (parsed.type === 'tool_result') {
                if (parsed.success) {
                  this.updateStatus(parsed.message || 'Edit applied');
                } else {
                  this.showError(`Edit failed: ${parsed.message}`);
                }
              } else if (parsed.type === 'text') {
                assistantResponse += parsed.text;
                this.updateStatus(parsed.text);
              } else if (parsed.error) {
                this.showError(parsed.error);
              }
            } catch (e) {
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
        console.error('Resume error:', error);
        this.showError(`Error: ${error.message}`);
      }
    } finally {
      this.isStreaming = false;
      this.elements.generateBtn.disabled = false;
      this.elements.stopBtn.classList.add('hidden');
      this.elements.streamingStatus.classList.add('hidden');
      this.elements.textArea.disabled = false;
      this.updateButtonLabel();
    }
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
