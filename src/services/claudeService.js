import Anthropic from '@anthropic-ai/sdk';

// Initialize the Claude client
const getClaudeClient = () => {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_ANTHROPIC_API_KEY is not set in environment variables');
  }

  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true, // Note: In production, proxy through backend
  });
};

/**
 * Stream CSV generation from Claude API
 * @param {string} userPrompt - The user's prompt
 * @param {Function} onChunk - Callback for each text chunk
 * @param {Function} onComplete - Callback when streaming completes
 * @param {Function} onError - Callback for errors
 * @param {AbortSignal} signal - AbortSignal for cancellation
 */
export const streamCSVGeneration = async ({
  userPrompt,
  onChunk,
  onComplete,
  onError,
  signal,
}) => {
  try {
    const client = getClaudeClient();
    const model = import.meta.env.VITE_CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';

    const systemPrompt = `You are a helpful AI assistant that generates CSV data based on user requests.

Key guidelines:
- Generate valid CSV format with headers in the first row
- Use commas to separate values
- Wrap values in quotes if they contain commas, quotes, or newlines
- Escape internal quotes by doubling them ("")
- Be creative and generate realistic sample data
- Include appropriate columns based on the user's request
- Generate at least 5-10 rows of data unless specified otherwise
- Only output the CSV data, no explanations or markdown code blocks`;

    const stream = await client.messages.stream({
      model,
      max_tokens: 4096,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Handle streaming chunks
    for await (const chunk of stream) {
      if (signal?.aborted) {
        stream.controller.abort();
        break;
      }

      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        const text = chunk.delta.text;
        onChunk(text);
      }
    }

    const finalMessage = await stream.finalMessage();
    onComplete(finalMessage);

  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      console.log('Stream aborted by user');
      return;
    }
    console.error('Error streaming from Claude:', error);
    onError(error);
  }
};

/**
 * Stream Markdown generation from Claude API
 * @param {string} userPrompt - The user's prompt
 * @param {Function} onChunk - Callback for each text chunk
 * @param {Function} onComplete - Callback when streaming completes
 * @param {Function} onError - Callback for errors
 * @param {AbortSignal} signal - AbortSignal for cancellation
 */
export const streamMarkdownGeneration = async ({
  userPrompt,
  onChunk,
  onComplete,
  onError,
  signal,
}) => {
  try {
    const client = getClaudeClient();
    const model = import.meta.env.VITE_CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';

    const systemPrompt = `You are a helpful AI assistant that generates well-formatted Markdown content based on user requests.

Key guidelines:
- Generate valid Markdown syntax
- Use appropriate headers (# ## ###) for structure
- Format lists, code blocks, tables, and other elements properly
- Be creative and generate detailed, well-organized content
- Only output the Markdown content, no explanations
- Use proper Markdown syntax for emphasis, links, images, etc.`;

    const stream = await client.messages.stream({
      model,
      max_tokens: 8192,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Handle streaming chunks
    for await (const chunk of stream) {
      if (signal?.aborted) {
        stream.controller.abort();
        break;
      }

      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        const text = chunk.delta.text;
        onChunk(text);
      }
    }

    const finalMessage = await stream.finalMessage();
    onComplete(finalMessage);

  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      console.log('Stream aborted by user');
      return;
    }
    console.error('Error streaming from Claude:', error);
    onError(error);
  }
};

/**
 * Edit/refine existing content with Claude
 * @param {string} contentType - 'csv' or 'markdown'
 * @param {string} currentContent - The current content to edit
 * @param {string} userInstruction - What changes to make
 * @param {Function} onChunk - Callback for each text chunk
 * @param {Function} onComplete - Callback when streaming completes
 * @param {Function} onError - Callback for errors
 * @param {AbortSignal} signal - AbortSignal for cancellation
 */
export const streamContentEdit = async ({
  contentType,
  currentContent,
  userInstruction,
  onChunk,
  onComplete,
  onError,
  signal,
}) => {
  try {
    const client = getClaudeClient();
    const model = import.meta.env.VITE_CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';

    const systemPrompts = {
      csv: `You are a helpful AI assistant that edits CSV data based on user instructions.

Key guidelines:
- Maintain valid CSV format with proper headers
- Apply the requested changes accurately
- Keep all existing data unless explicitly asked to remove it
- Only output the modified CSV data, no explanations`,

      markdown: `You are a helpful AI assistant that edits Markdown content based on user instructions.

Key guidelines:
- Maintain valid Markdown syntax
- Apply the requested changes accurately
- Preserve the overall structure unless asked to change it
- Only output the modified Markdown content, no explanations`,
    };

    const stream = await client.messages.stream({
      model,
      max_tokens: 8192,
      temperature: 0.5,
      system: systemPrompts[contentType],
      messages: [
        {
          role: 'user',
          content: `Current ${contentType.toUpperCase()} content:\n\n${currentContent}\n\nInstructions: ${userInstruction}\n\nPlease provide the updated ${contentType.toUpperCase()} content:`,
        },
      ],
    });

    // Handle streaming chunks
    for await (const chunk of stream) {
      if (signal?.aborted) {
        stream.controller.abort();
        break;
      }

      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        const text = chunk.delta.text;
        onChunk(text);
      }
    }

    const finalMessage = await stream.finalMessage();
    onComplete(finalMessage);

  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      console.log('Stream aborted by user');
      return;
    }
    console.error('Error streaming from Claude:', error);
    onError(error);
  }
};

export default {
  streamCSVGeneration,
  streamMarkdownGeneration,
  streamContentEdit,
};
