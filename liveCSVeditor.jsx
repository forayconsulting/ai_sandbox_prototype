import React, { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const LiveCSVEditor = () => {
  const [csvText, setCsvText] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [prompt, setPrompt] = useState('');
  const streamingRef = useRef(false);
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

  // Simulate LLM streaming response
  const simulateLLMStream = async (userPrompt) => {
    setIsStreaming(true);
    streamingRef.current = true;

    let response = '';
    
    // Different responses based on prompt
    if (userPrompt.toLowerCase().includes('financial') || userPrompt.toLowerCase().includes('tracker')) {
      response = `Date,Category,Amount,Notes
2025-01-01,Groceries,125.50,Weekly shopping
2025-01-02,Transportation,45.00,Gas
2025-01-03,Entertainment,75.00,Movie night
2025-01-05,Utilities,200.00,Electric bill
2025-01-07,Dining,89.99,Restaurant`;
    } else if (userPrompt.toLowerCase().includes('inventory')) {
      response = `Item,SKU,Quantity,Price,Location
Widget A,WDG-001,150,29.99,Warehouse A
Widget B,WDG-002,75,39.99,Warehouse A
Gadget X,GAD-001,200,19.99,Warehouse B
Gadget Y,GAD-002,50,24.99,Warehouse B`;
    } else if (userPrompt.toLowerCase().includes('contact')) {
      response = `Name,Email,Phone,Company
John Doe,john@example.com,555-0100,Acme Corp
Jane Smith,jane@example.com,555-0101,Tech Inc
Bob Wilson,bob@example.com,555-0102,Data LLC`;
    } else {
      response = `Column A,Column B,Column C
Value 1,Value 2,Value 3
Data 1,Data 2,Data 3
Info 1,Info 2,Info 3`;
    }

    // Stream character by character
    let buffer = '';
    for (let i = 0; i < response.length; i++) {
      if (!streamingRef.current) break;
      
      buffer += response[i];
      setCsvText(buffer);
      
      // Slow down streaming for demo effect
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    setIsStreaming(false);
    streamingRef.current = false;
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
      simulateLLMStream(prompt);
      setPrompt('');
    }
  };

  // Stop streaming
  const stopStreaming = () => {
    streamingRef.current = false;
    setIsStreaming(false);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Live Collaborative CSV Editor</h1>
        <p className="text-gray-600">
          Simulates LLM streaming CSV data with live table rendering and bidirectional editing
        </p>
      </div>

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
            AI is generating CSV data...
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
            >
              Clear
            </Button>
          </div>
          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="CSV text will appear here as it streams..."
            className="font-mono text-sm h-96 resize-none"
          />
        </div>

        {/* Rendered Table */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Live Table View</h2>
            {parsedData.length > 0 && (
              <Button onClick={handleAddRow} variant="outline" size="sm">
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
                            onClick={() => setEditingCell({ row: 0, col: colIdx })}
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
                              onClick={() => setEditingCell({ row: rowIdx + 1, col: colIdx })}
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
          <li><strong>Generate:</strong> Enter a prompt and watch CSV stream in character-by-character</li>
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
            'Generate a financial tracker spreadsheet',
            'Create an inventory list',
            'Make a contact list',
            'Build a simple dataset'
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