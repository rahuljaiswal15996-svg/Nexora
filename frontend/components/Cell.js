import { useState, useRef, useEffect } from 'react';
import MonacoEditorWrapper from './MonacoEditorWrapper';

export default function Cell({ cell, isExecuting, onUpdate, onExecute, onDelete, onAddCell }) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(cell.content);
  const cellRef = useRef(null);

  useEffect(() => {
    setContent(cell.content);
  }, [cell.content]);

  const handleContentChange = (newContent) => {
    setContent(newContent);
    onUpdate({ content: newContent });
  };

  const handleExecute = () => {
    if (cell.type === 'code') {
      onExecute();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleExecute();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const renderOutput = (output) => {
    switch (output.output_type) {
      case 'stream':
        return (
          <pre className="text-sm text-accent bg-surface p-2 rounded border overflow-x-auto">
            {output.text}
          </pre>
        );
      case 'execute_result':
        return (
          <div className="text-sm">
            <div className="text-primary font-mono mb-1">
              Out [{output.execution_count}]:
            </div>
            <pre className="text-accent bg-surface p-2 rounded border overflow-x-auto">
              {output.data['text/plain']}
            </pre>
          </div>
        );
      case 'error':
        return (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
            <div className="font-semibold">{output.ename}: {output.evalue}</div>
            <pre className="text-xs mt-1 overflow-x-auto">
              {output.traceback.join('\n')}
            </pre>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={cellRef}
      className="notebook-cell mb-4 border border-surface-hover rounded-lg bg-surface"
    >
      {/* Cell Header */}
      <div className="cell-header flex items-center justify-between px-3 py-2 border-b border-surface-hover bg-surface-hover">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-medium text-primary uppercase">
            {cell.type}
          </span>
          {cell.execution_count && (
            <span className="text-xs text-accent">
              [{cell.execution_count}]
            </span>
          )}
          {isExecuting && (
            <div className="flex items-center space-x-1">
              <div className="animate-spin rounded-full h-3 w-3 border border-primary border-t-transparent"></div>
              <span className="text-xs text-accent">Running...</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1">
          {cell.type === 'code' && (
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className="p-1 text-accent hover:text-primary rounded disabled:opacity-50"
              title="Run cell (Ctrl+Enter)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}

          <button
            onClick={() => onAddCell('code')}
            className="p-1 text-accent hover:text-primary rounded"
            title="Add code cell below"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>

          <button
            onClick={() => onAddCell('markdown')}
            className="p-1 text-accent hover:text-primary rounded"
            title="Add text cell below"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          <button
            onClick={onDelete}
            className="p-1 text-accent hover:text-red-600 rounded"
            title="Delete cell"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Cell Content */}
      <div className="cell-content p-3">
        {cell.type === 'markdown' ? (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: content
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
                .replace(/\*(.*)\*/gim, '<em>$1</em>')
                .replace(/`([^`]+)`/gim, '<code>$1</code>')
                .replace(/\n/gim, '<br>')
            }}
          />
        ) : (
          <MonacoEditorWrapper
            value={content}
            onChange={handleContentChange}
            language="python"
            height={cell.content.split('\n').length * 20 + 20}
            onKeyDown={handleKeyDown}
            options={{
              minimap: { enabled: false },
              lineNumbers: 'off',
              glyphMargin: false,
              folding: false,
              renderLineHighlight: 'none',
              scrollBeyondLastLine: false,
              wordWrap: 'on'
            }}
          />
        )}
      </div>

      {/* Cell Outputs */}
      {cell.outputs && cell.outputs.length > 0 && (
        <div className="cell-outputs px-3 pb-3">
          {cell.outputs.map((output, index) => (
            <div key={index} className="mt-2">
              {renderOutput(output)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}