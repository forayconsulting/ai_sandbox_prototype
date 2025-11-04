import React, { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { streamMarkdownGeneration } from '@/services/claudeService';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { AlertCircle } from 'lucide-react';

// Configure marked options
marked.setOptions({
  breaks: true,
  gfm: true,
});

const LiveMarkdownEditor = () => {
  const [markdownText, setMarkdownText] = useState('');
  const [renderedHTML, setRenderedHTML] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  // Parse and sanitize markdown to HTML
  useEffect(() => {
    if (markdownText) {
      try {
        const rawHTML = marked(markdownText);
        const cleanHTML = DOMPurify.sanitize(rawHTML);
        setRenderedHTML(cleanHTML);
      } catch (err) {
        console.error('Markdown parsing error:', err);
        setRenderedHTML('<p class="text-red-500">Error rendering markdown</p>');
      }
    } else {
      setRenderedHTML('');
    }
  }, [markdownText]);

  // Stream Markdown generation from Claude API
  const handleGenerateMarkdown = async (userPrompt) => {
    setIsStreaming(true);
    setError(null);
    setMarkdownText(''); // Clear previous content

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    let buffer = '';

    await streamMarkdownGeneration({
      userPrompt,
      onChunk: (text) => {
        buffer += text;
        setMarkdownText(buffer);
      },
      onComplete: (message) => {
        console.log('Streaming completed:', message);
        setIsStreaming(false);
      },
      onError: (err) => {
        console.error('Streaming error:', err);
        setError(err.message || 'An error occurred while generating Markdown');
        setIsStreaming(false);
      },
      signal: abortControllerRef.current.signal,
    });
  };

  // Handle prompt submission
  const handlePromptSubmit = () => {
    if (prompt.trim()) {
      handleGenerateMarkdown(prompt);
      setPrompt('');
    }
  };

  // Stop streaming
  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Live Collaborative Markdown Editor</h1>
        <p className="text-gray-600">
          Real-time AI-powered Markdown generation with Claude API and live preview
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-800">{error}</p>
            <p className="text-xs text-red-700 mt-1">
              Make sure you've set up your VITE_ANTHROPIC_API_KEY in .env
            </p>
          </div>
        </div>
      )}

      {/* Prompt Interface */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handlePromptSubmit()}
            placeholder="Try: 'Write a technical blog post about React hooks' or 'Create a product launch announcement'"
            className="flex-1"
            disabled={isStreaming}
          />
          <Button
            onClick={handlePromptSubmit}
            disabled={isStreaming || !prompt.trim()}
          >
            Generate
          </Button>
          {isStreaming && (
            <Button onClick={stopStreaming} variant="destructive">
              Stop
            </Button>
          )}
        </div>
        {isStreaming && (
          <div className="text-sm text-blue-600 animate-pulse">
            Claude AI is generating Markdown content...
          </div>
        )}
      </div>

      {/* Split View */}
      <div className="grid grid-cols-2 gap-4">
        {/* Raw Markdown Text */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Raw Markdown (Source)</h2>
            <Button
              onClick={() => setMarkdownText('')}
              variant="outline"
              size="sm"
              disabled={isStreaming}
            >
              Clear
            </Button>
          </div>
          <Textarea
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            placeholder="Markdown text will stream here from Claude API..."
            className="font-mono text-sm h-96 resize-none"
            disabled={isStreaming}
          />
        </div>

        {/* Rendered Preview */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Live Preview</h2>
          </div>
          <div className="border rounded-lg overflow-auto h-96 p-4 bg-white">
            {renderedHTML ? (
              <div
                className="markdown-body prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: renderedHTML }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Preview will render here as Markdown streams in...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm space-y-2">
        <h3 className="font-semibold text-blue-900">How it works:</h3>
        <ul className="list-disc list-inside space-y-1 text-blue-800">
          <li><strong>Generate:</strong> Enter a prompt and watch Claude stream Markdown content in real-time</li>
          <li><strong>Live preview:</strong> See your Markdown rendered as formatted HTML instantly</li>
          <li><strong>Manual edit:</strong> Edit the raw Markdown directly to update the preview</li>
          <li><strong>Full Markdown support:</strong> Headers, lists, code blocks, tables, links, images, and more</li>
          <li><strong>Sanitized HTML:</strong> All rendered content is sanitized for security</li>
        </ul>
      </div>

      {/* Quick Examples */}
      <div className="space-y-2">
        <h3 className="font-semibold">Try these prompts:</h3>
        <div className="flex flex-wrap gap-2">
          {[
            'Write a technical blog post about React hooks',
            'Create a product launch announcement for a SaaS app',
            'Generate a comprehensive README for a Python project',
            'Write a tutorial on API design best practices',
            'Create meeting notes template with action items',
            'Write a user guide for a mobile app feature',
          ].map((example, idx) => (
            <Button
              key={idx}
              onClick={() => setPrompt(example)}
              variant="outline"
              size="sm"
              disabled={isStreaming}
            >
              {example}
            </Button>
          ))}
        </div>
      </div>

      {/* Markdown Syntax Reference */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
        <h3 className="font-semibold mb-2">Markdown Syntax Quick Reference:</h3>
        <div className="grid grid-cols-2 gap-4 font-mono text-xs">
          <div>
            <p># Heading 1</p>
            <p>## Heading 2</p>
            <p>**bold** or __bold__</p>
            <p>*italic* or _italic_</p>
            <p>[link](url)</p>
          </div>
          <div>
            <p>- Unordered list</p>
            <p>1. Ordered list</p>
            <p>`inline code`</p>
            <p>```code block```</p>
            <p>&gt; Blockquote</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMarkdownEditor;
