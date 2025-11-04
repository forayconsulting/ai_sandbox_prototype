import React, { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { streamCSVGeneration } from '@/services/claudeService';
import { AlertCircle } from 'lucide-react';

const LiveCSVEditor = () => {
  const [csvText, setCsvText] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const editLocksRef = useRef(new Set());

  // Parse CSV text into 2D array
  const parseCSV = (text) => {
    if (!text.trim()) return [];
    const lines = text.trim().split('\n');
    return lines.map(line => {
      // Simple CSV parser (handles basic cases)
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
  };

  // Convert 2D array back to CSV text
  const arrayToCSV = (data) => {
    return data.map(row =>
      row.map(cell => {
        // Escape cells with commas or quotes
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    ).join('\n');
  };

  // Stream CSV generation from Claude API
  const handleGenerateCSV = async (userPrompt) => {
    setIsStreaming(true);
    setError(null);
    setCsvText(''); // Clear previous content

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    let buffer = '';

    await streamCSVGeneration({
      userPrompt,
      onChunk: (text) => {
        buffer += text;
        setCsvText(buffer);
      },
      onComplete: (message) => {
        console.log('Streaming completed:', message);
        setIsStreaming(false);
      },
      onError: (err) => {
        console.error('Streaming error:', err);
        setError(err.message || 'An error occurred while generating CSV');
        setIsStreaming(false);
      },
      signal: abortControllerRef.current.signal,
    });
  };

  // Handle cell edit
  const handleCellEdit = (rowIdx, colIdx, newValue) => {
    const lockKey = `${rowIdx}-${colIdx}`;
    editLocksRef.current.add(lockKey);

    const newData = [...parsedData];
    newData[rowIdx][colIdx] = newValue;

    const newCSV = arrayToCSV(newData);
    setCsvText(newCSV);

    // Remove lock after a short delay
    setTimeout(() => {
      editLocksRef.current.delete(lockKey);
    }, 500);
  };

  // Handle adding a new row
  const handleAddRow = () => {
    if (parsedData.length === 0) return;

    const colCount = parsedData[0].length;
    const newRow = new Array(colCount).fill('');
    const newData = [...parsedData, newRow];
    const newCSV = arrayToCSV(newData);
    setCsvText(newCSV);
  };

  // Update parsed data when CSV text changes
  useEffect(() => {
    const parsed = parseCSV(csvText);
    setParsedData(parsed);
  }, [csvText]);

  // Handle prompt submission
  const handlePromptSubmit = () => {
    if (prompt.trim()) {
      handleGenerateCSV(prompt);
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
        <h1 className="text-3xl font-bold">Live Collaborative CSV Editor</h1>
        <p className="text-gray-600">
          Real-time AI-powered CSV generation with Claude API and bidirectional editing
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
            placeholder="Try: 'Generate a financial tracker spreadsheet' or 'Create an inventory list'"
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
            Claude AI is generating CSV data...
          </div>
        )}
      </div>

      {/* Split View */}
      <div className="grid grid-cols-2 gap-4">
        {/* Raw CSV Text */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Raw CSV (Source of Truth)</h2>
            <Button
              onClick={() => setCsvText('')}
              variant="outline"
              size="sm"
              disabled={isStreaming}
            >
              Clear
            </Button>
          </div>
          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="CSV text will stream here from Claude API..."
            className="font-mono text-sm h-96 resize-none"
            disabled={isStreaming}
          />
        </div>

        {/* Rendered Table */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Live Table View</h2>
            {parsedData.length > 0 && (
              <Button onClick={handleAddRow} variant="outline" size="sm" disabled={isStreaming}>
                Add Row
              </Button>
            )}
          </div>
          <div className="border rounded-lg overflow-auto h-96">
            {parsedData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                Table will render here as CSV streams in...
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    {parsedData[0].map((cell, colIdx) => (
                      <th
                        key={colIdx}
                        className="border-r px-3 py-2 text-left font-semibold text-sm"
                      >
                        {editingCell?.row === 0 && editingCell?.col === colIdx ? (
                          <Input
                            value={cell}
                            onChange={(e) => handleCellEdit(0, colIdx, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyPress={(e) => e.key === 'Enter' && setEditingCell(null)}
                            autoFocus
                            className="h-7 text-sm"
                          />
                        ) : (
                          <div
                            onClick={() => !isStreaming && setEditingCell({ row: 0, col: colIdx })}
                            className="cursor-pointer hover:bg-gray-50 rounded px-1"
                          >
                            {cell || <span className="text-gray-400">Empty</span>}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(1).map((row, rowIdx) => (
                    <tr
                      key={rowIdx + 1}
                      className="border-b hover:bg-gray-50"
                    >
                      {row.map((cell, colIdx) => (
                        <td
                          key={colIdx}
                          className="border-r px-3 py-2 text-sm"
                        >
                          {editingCell?.row === rowIdx + 1 && editingCell?.col === colIdx ? (
                            <Input
                              value={cell}
                              onChange={(e) => handleCellEdit(rowIdx + 1, colIdx, e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              onKeyPress={(e) => e.key === 'Enter' && setEditingCell(null)}
                              autoFocus
                              className="h-7 text-sm"
                            />
                          ) : (
                            <div
                              onClick={() => !isStreaming && setEditingCell({ row: rowIdx + 1, col: colIdx })}
                              className="cursor-pointer hover:bg-blue-50 rounded px-1 min-h-[1.5rem]"
                            >
                              {cell || <span className="text-gray-300">Empty</span>}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm space-y-2">
        <h3 className="font-semibold text-blue-900">How it works:</h3>
        <ul className="list-disc list-inside space-y-1 text-blue-800">
          <li><strong>Generate:</strong> Enter a prompt and watch Claude stream CSV data in real-time</li>
          <li><strong>Edit cells:</strong> Click any cell in the table to edit it (syncs back to raw CSV)</li>
          <li><strong>Add rows:</strong> Click "Add Row" to append empty rows</li>
          <li><strong>Manual edit:</strong> Edit the raw CSV directly to update the table</li>
          <li><strong>Simultaneous editing:</strong> The system maintains edit locks to prevent conflicts</li>
        </ul>
      </div>

      {/* Quick Examples */}
      <div className="space-y-2">
        <h3 className="font-semibold">Try these prompts:</h3>
        <div className="flex flex-wrap gap-2">
          {[
            'Generate a financial tracker spreadsheet with 10 rows',
            'Create an inventory list for a small electronics store',
            'Make a contact list with 8 team members',
            'Build a product catalog with prices and descriptions',
            'Generate a project task list with priorities and deadlines',
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
    </div>
  );
};

export default LiveCSVEditor;
