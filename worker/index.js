/**
 * Cloudflare Worker - Claude API Proxy
 *
 * This worker securely proxies requests to the Claude API,
 * keeping your API key secret on the server side.
 */

// Text editor tool definition for Claude API
const TEXT_EDITOR_TOOL = {
  name: "str_replace_editor",
  description: "Custom text editor for making targeted edits to content. Use this to view and edit the text content incrementally.",
  input_schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        enum: ["view", "str_replace", "insert", "delete_range"],
        description: "The command to execute"
      },
      view_range: {
        type: "array",
        items: { type: "integer" },
        description: "For 'view' command: [start_line, end_line] to view specific lines (1-indexed). Omit to view all."
      },
      old_str: {
        type: "string",
        description: "For 'str_replace': exact string to find and replace. Must match exactly including whitespace."
      },
      new_str: {
        type: "string",
        description: "For 'str_replace' and 'insert': new string to replace with or insert. Can be empty string to delete."
      },
      insert_line: {
        type: "integer",
        description: "For 'insert': line number (1-indexed) after which to insert new content"
      },
      start_line: {
        type: "integer",
        description: "For 'delete_range': starting line number (1-indexed) to delete"
      },
      end_line: {
        type: "integer",
        description: "For 'delete_range': ending line number (1-indexed) to delete (inclusive)"
      }
    },
    required: ["command"]
  }
};

// Execute text editor tool command
function executeEditorCommand(command, content) {
  const lines = content.split('\n');

  switch (command.command) {
    case 'view':
      if (command.view_range && Array.isArray(command.view_range)) {
        const [start, end] = command.view_range;
        const viewLines = lines.slice(start - 1, end);
        return {
          success: true,
          content: viewLines.join('\n'),
          line_count: viewLines.length,
          total_lines: lines.length
        };
      }
      return {
        success: true,
        content: content,
        line_count: lines.length,
        total_lines: lines.length
      };

    case 'str_replace':
      const { old_str, new_str } = command;
      if (!old_str) {
        return { success: false, error: "old_str is required for str_replace" };
      }

      const occurrences = (content.match(new RegExp(old_str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

      if (occurrences === 0) {
        return {
          success: false,
          error: "No match found. The old_str does not exist in the content.",
          old_str_preview: old_str.substring(0, 100)
        };
      }

      if (occurrences > 1) {
        return {
          success: false,
          error: `Multiple matches found (${occurrences}). Please provide more context in old_str to make it unique.`,
          occurrences
        };
      }

      const newContent = content.replace(old_str, new_str || '');
      return {
        success: true,
        content: newContent,
        message: `Successfully replaced 1 occurrence`
      };

    case 'insert':
      const { insert_line } = command;
      const insertContent = command.new_str || '';

      if (!insert_line || insert_line < 0 || insert_line > lines.length) {
        return {
          success: false,
          error: `Invalid insert_line: ${insert_line}. Must be between 1 and ${lines.length}`
        };
      }

      lines.splice(insert_line, 0, insertContent);
      return {
        success: true,
        content: lines.join('\n'),
        message: `Inserted content after line ${insert_line}`
      };

    case 'delete_range':
      const { start_line, end_line } = command;

      if (!start_line || !end_line) {
        return { success: false, error: "start_line and end_line are required for delete_range" };
      }

      if (start_line < 1 || end_line > lines.length || start_line > end_line) {
        return {
          success: false,
          error: `Invalid range: [${start_line}, ${end_line}]. Must be within 1-${lines.length} and start <= end`
        };
      }

      const deletedLines = lines.splice(start_line - 1, end_line - start_line + 1);
      return {
        success: true,
        content: lines.join('\n'),
        message: `Deleted ${deletedLines.length} lines (${start_line}-${end_line})`
      };

    default:
      return { success: false, error: `Unknown command: ${command.command}` };
  }
}

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
        features: ['streaming', 'tool_use', 'prompt_caching', 'incremental_editing'],
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
      const { prompt, messages, contentType = 'csv' } = await request.json();

      // Support both single prompt (legacy) and messages array (new)
      let claudeMessages;
      if (messages && Array.isArray(messages)) {
        // New format: use messages directly
        // Add prompt caching to the content in the first user message
        claudeMessages = messages.map((msg, idx) => {
          if (idx === 0 && msg.role === 'user') {
            // Parse content to extract current content for caching
            let msgContent = msg.content;
            if (typeof msgContent === 'string' && msgContent.includes('Current content:')) {
              // Split into cacheable content and instruction
              const parts = msgContent.split('\n\nInstruction: ');
              if (parts.length === 2) {
                const contentPart = parts[0].replace('Current content:\n', '');
                return {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: `Current content:\n${contentPart}`,
                      cache_control: { type: 'ephemeral' }  // Cache the content for 5 minutes
                    },
                    {
                      type: 'text',
                      text: `\n\nInstruction: ${parts[1]}`
                    }
                  ]
                };
              }
            }
          }
          return msg;
        });
      } else if (prompt) {
        // Legacy format: convert to messages array
        claudeMessages = [{ role: 'user', content: prompt }];
      } else {
        return new Response(JSON.stringify({ error: 'Either prompt or messages is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
        csv: `You are an expert CSV editor with access to a text editor tool. Your role is to make TARGETED, INCREMENTAL edits to CSV data.

<editing_workflow>
1. FIRST use the 'view' command to see the current content
2. Identify the MINIMAL changes needed to fulfill the user's request
3. Use 'str_replace' to make precise edits (old_str must match EXACTLY)
4. Use 'insert' to add new rows
5. Use 'delete_range' to remove sections
6. After all edits, provide a brief summary of what you changed
</editing_workflow>

<editing_rules>
- Make ONE edit at a time for clarity
- NEVER regenerate the entire CSV - only make targeted changes
- Maintain valid CSV format (headers, commas, quotes)
- When using str_replace, include enough context to make old_str unique
- Ensure old_str matches exactly (including whitespace and quotes)
- Preserve data integrity - don't accidentally modify unrelated rows
</editing_rules>

<csv_guidelines>
- First row should be headers
- Use commas to separate values
- Wrap values in quotes if they contain commas, quotes, or newlines
- Escape internal quotes by doubling them ("")
</csv_guidelines>

Remember: View first, edit incrementally, summarize changes.`,

        markdown: `You are an expert Markdown editor with access to a text editor tool. Your role is to make TARGETED, INCREMENTAL edits to Markdown content.

<editing_workflow>
1. FIRST use the 'view' command to see the current content
2. Identify the MINIMAL changes needed to fulfill the user's request
3. Use 'str_replace' to make precise edits (old_str must match EXACTLY)
4. Use 'insert' to add new sections
5. Use 'delete_range' to remove sections
6. After all edits, provide a brief summary of what you changed
</editing_workflow>

<editing_rules>
- Make ONE edit at a time for clarity
- NEVER regenerate the entire document - only make targeted changes
- Maintain proper Markdown syntax
- When using str_replace, include enough context to make old_str unique
- Ensure old_str matches exactly (including whitespace and formatting)
- Preserve document structure - don't accidentally modify unrelated sections
</editing_rules>

<markdown_guidelines>
- Use appropriate headers (# ## ###) for structure
- Format lists, code blocks, tables properly
- Use proper syntax for emphasis, links, images
- Maintain consistent formatting throughout
</markdown_guidelines>

Remember: View first, edit incrementally, summarize changes.`,
      };

      const systemPrompt = systemPrompts[contentType] || systemPrompts.csv;

      // Stream the response back to the client
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Tool use loop - handles multiple tool calls
      (async () => {
        try {
          let currentContent = claudeMessages.find(m => m.role === 'user' && m.content)?.content || '';
          if (typeof currentContent === 'object' && Array.isArray(currentContent)) {
            // Extract text from content array
            currentContent = currentContent
              .filter(c => c.type === 'text')
              .map(c => c.text)
              .join('\n')
              .replace(/^Current content:\n/, '')
              .split('\nInstruction:')[0]
              .trim();
          }

          let conversationMessages = [...claudeMessages];
          let toolUseLoop = true;

          while (toolUseLoop) {
            // Call Claude API with tool support
            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': env.ANTHROPIC_API_KEY,
              },
              body: JSON.stringify({
                model: env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
                max_tokens: 4096,
                temperature: 0.7,
                system: systemPrompt,
                messages: conversationMessages,
                tools: [TEXT_EDITOR_TOOL],
              }),
            });

            if (!response.ok) {
              const error = await response.text();
              console.error('Claude API error:', response.status, error);
              await writer.write(encoder.encode(`data: ${JSON.stringify({
                error: 'API request failed',
                details: error.substring(0, 200)
              })}\n\n`));
              break;
            }

            const result = await response.json();
            console.log('Claude response:', JSON.stringify(result, null, 2));

            // Check stop reason
            if (result.stop_reason === 'tool_use') {
              // Claude wants to use a tool
              const toolUseBlock = result.content.find(block => block.type === 'tool_use');

              if (toolUseBlock) {
                // Send tool use notification to frontend
                await writer.write(encoder.encode(`data: ${JSON.stringify({
                  type: 'tool_use',
                  tool: toolUseBlock.name,
                  command: toolUseBlock.input.command,
                  status: 'executing'
                })}\n\n`));

                // Execute the tool
                const toolResult = executeEditorCommand(toolUseBlock.input, currentContent);

                // Update current content if edit was successful
                if (toolResult.success && toolResult.content !== undefined) {
                  currentContent = toolResult.content;

                  // Send updated content to frontend
                  await writer.write(encoder.encode(`data: ${JSON.stringify({
                    type: 'content_update',
                    content: currentContent
                  })}\n\n`));
                }

                // Send tool result notification
                await writer.write(encoder.encode(`data: ${JSON.stringify({
                  type: 'tool_result',
                  success: toolResult.success,
                  message: toolResult.message || toolResult.error
                })}\n\n`));

                // Add assistant message and tool result to conversation
                conversationMessages.push({
                  role: 'assistant',
                  content: result.content
                });

                conversationMessages.push({
                  role: 'user',
                  content: [{
                    type: 'tool_result',
                    tool_use_id: toolUseBlock.id,
                    content: JSON.stringify(toolResult)
                  }]
                });

                // Continue the loop for next tool use or final response
                continue;
              }
            }

            // Final response - stream any text content
            const textBlocks = result.content.filter(block => block.type === 'text');
            for (const block of textBlocks) {
              if (block.text) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({
                  type: 'text',
                  text: block.text
                })}\n\n`));
              }
            }

            // Exit loop
            toolUseLoop = false;
          }

          await writer.write(encoder.encode('data: [DONE]\n\n'));
          await writer.close();
        } catch (error) {
          console.error('Tool use loop error:', error);
          await writer.write(encoder.encode(`data: ${JSON.stringify({
            error: error.message
          })}\n\n`));
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
