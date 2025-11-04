import React, { useState } from 'react';
import LiveCSVEditor from './components/LiveCSVEditor';
import LiveMarkdownEditor from './components/LiveMarkdownEditor';
import { FileSpreadsheet, FileText } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('csv');

  const tabs = [
    {
      id: 'csv',
      name: 'CSV Editor',
      icon: FileSpreadsheet,
      component: LiveCSVEditor,
    },
    {
      id: 'markdown',
      name: 'Markdown Editor',
      icon: FileText,
      component: LiveMarkdownEditor,
    },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Sandbox</h1>
              <p className="text-sm text-gray-600">
                Live collaborative editing with Claude API
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                Powered by Claude 3.5 Sonnet
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                    transition-all duration-200
                    ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-6">
        {ActiveComponent && <ActiveComponent />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <p>
              AI Sandbox - Demonstrating real-time human-AI collaboration patterns
            </p>
            <p>
              Built with React + Vite + Anthropic Claude API
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
