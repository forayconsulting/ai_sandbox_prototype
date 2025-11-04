/**
 * Cloudflare Worker - Claude API Proxy
 *
 * This worker securely proxies requests to the Claude API,
 * keeping your API key secret on the server side.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'AI Sandbox Worker is running',
        model: env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
        endpoint: '/api/generate',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Only handle API routes
    if (!url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only allow POST requests for API
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { prompt, contentType = 'csv' } = await request.json();

      if (!prompt) {
        return new Response(JSON.stringify({ error: 'Prompt is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Check if API key is available
      if (!env.ANTHROPIC_API_KEY) {
        console.error('ANTHROPIC_API_KEY is not set');
        return new Response(JSON.stringify({ error: 'API key not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      // System prompts for different content types
      const systemPrompts = {
        csv: `You are a helpful AI assistant that generates CSV data based on user requests.

Key guidelines:
- Generate valid CSV format with headers in the first row
- Use commas to separate values
- Wrap values in quotes if they contain commas, quotes, or newlines
- Escape internal quotes by doubling them ("")
- Be creative and generate realistic sample data
- Include appropriate columns based on the user's request
- Generate at least 5-10 rows of data unless specified otherwise
- Only output the CSV data, no explanations or markdown code blocks`,

        markdown: `You are a helpful AI assistant that generates well-formatted Markdown content based on user requests.

Key guidelines:
- Generate valid Markdown syntax
- Use appropriate headers (# ## ###) for structure
- Format lists, code blocks, tables, and other elements properly
- Be creative and generate detailed, well-organized content
- Only output the Markdown content, no explanations
- Use proper Markdown syntax for emphasis, links, images, etc.`,
      };

      const systemPrompt = systemPrompts[contentType] || systemPrompts.csv;

      // Call Claude API with streaming
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': env.ANTHROPIC_API_KEY,
        },
        body: JSON.stringify({
          model: env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
          max_tokens: contentType === 'markdown' ? 8192 : 4096,
          temperature: 0.7,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Claude API error:', response.status, error);
        return new Response(JSON.stringify({
          error: 'API request failed',
          status: response.status,
          details: error.substring(0, 200)
        }), {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        });
      }

      // Stream the response back to the client
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      // Process the SSE stream from Claude
      (async () => {
        try {
          const reader = response.body.getReader();
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

                  // Extract text from content blocks
                  if (parsed.type === 'content_block_delta' &&
                      parsed.delta?.type === 'text_delta') {
                    const text = parsed.delta.text;
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }

          await writer.write(encoder.encode('data: [DONE]\n\n'));
          await writer.close();
        } catch (error) {
          console.error('Streaming error:', error);
          await writer.abort(error);
        }
      })();

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
