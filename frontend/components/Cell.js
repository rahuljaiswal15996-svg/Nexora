import { useEffect, useMemo, useRef, useState } from 'react';

import MonacoEditorWrapper from './MonacoEditorWrapper';

const toolbarButtonClass = 'rounded-[18px] border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition';

function renderOutput(output, index) {
  if (!output) {
    return null;
  }

  if (output.output_type === 'stream') {
    return (
      <pre key={index} className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        {output.text}
      </pre>
    );
  }

  if (output.output_type === 'execute_result') {
    return (
      <div key={index} className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
        <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-sky-700/60">Result {output.execution_count ? `#${output.execution_count}` : ''}</div>
        <pre className="overflow-x-auto whitespace-pre-wrap">{output.data?.['text/plain'] || ''}</pre>
      </div>
    );
  }

  if (output.output_type === 'error') {
    return (
      <div key={index} className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        <div className="font-semibold">{output.ename}: {output.evalue}</div>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-rose-700/85">{(output.traceback || []).join('\n')}</pre>
      </div>
    );
  }

  return (
    <pre key={index} className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm text-slate-700">
      {JSON.stringify(output, null, 2)}
    </pre>
  );
}

function nextLanguage(cell) {
  return cell?.metadata?.language || 'python';
}

export default function Cell({
  cell,
  isExecuting,
  isSelected = false,
  languageOptions = [],
  onSelect,
  onUpdate,
  onExecute,
  onDelete,
  onAddCell,
}) {
  const [content, setContent] = useState(cell.content);
  const [language, setLanguage] = useState(nextLanguage(cell));
  const cellRef = useRef(null);

  useEffect(() => {
    setContent(cell.content);
  }, [cell.content]);

  useEffect(() => {
    setLanguage(nextLanguage(cell));
  }, [cell.metadata]);

  const handleContentChange = (newContent) => {
    setContent(newContent);
    onUpdate({ content: newContent });
  };

  const handleLanguageChange = (nextValue) => {
    setLanguage(nextValue);
    onUpdate({
      metadata: {
        ...(cell.metadata || {}),
        language: nextValue,
      },
    });
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
    }
  };

  const editorHeight = useMemo(() => {
    const lineCount = Math.max((content || '').split('\n').length, cell.type === 'markdown' ? 6 : 8);
    return Math.min(520, lineCount * 22 + 28);
  }, [cell.type, content]);

  return (
    <div
      ref={cellRef}
      onClick={onSelect}
      className={`mb-4 rounded-[30px] border transition ${
        isSelected
          ? 'border-sky-200 bg-white/90 shadow-[0_22px_54px_rgba(148,163,184,0.14)]'
          : 'border-stone-200 bg-white/80 hover:border-stone-300 hover:bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${cell.type === 'markdown' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
            {cell.type}
          </span>
          {cell.execution_count && (
            <span className="text-xs text-slate-500">
              [{cell.execution_count}]
            </span>
          )}
          {isExecuting && (
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></div>
              <span>Running</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cell.type === 'code' ? (
            <select
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value)}
              className="rounded-[18px] border border-stone-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 outline-none"
            >
              {languageOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          ) : null}

          {cell.type === 'code' ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                handleExecute();
              }}
              disabled={isExecuting}
              className={`${toolbarButtonClass} border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:opacity-50`}
              title="Run cell (Ctrl+Enter)"
            >
              Run
            </button>
          ) : null}

          <button
            onClick={(event) => {
              event.stopPropagation();
              onAddCell('code', cell.id);
            }}
            className={`${toolbarButtonClass} border-stone-200 bg-stone-50 text-slate-700 hover:border-stone-300 hover:bg-white`}
            title="Add code cell below"
          >
            + Code
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation();
              onAddCell('markdown', cell.id);
            }}
            className={`${toolbarButtonClass} border-stone-200 bg-stone-50 text-slate-700 hover:border-stone-300 hover:bg-white`}
            title="Add markdown cell below"
          >
            + Text
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className={`${toolbarButtonClass} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}
            title="Delete cell"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="p-4">
        {cell.type === 'markdown' ? (
          <textarea
            value={content}
            onChange={(event) => handleContentChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={Math.max(6, (content || '').split('\n').length + 1)}
            className="w-full rounded-[24px] border border-stone-200 bg-white px-4 py-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            placeholder="# Describe this step\n\nAdd markdown notes, assumptions, and run guidance here."
          />
        ) : (
          <MonacoEditorWrapper
            value={content}
            onChange={handleContentChange}
            language={language}
            height={editorHeight}
            onKeyDown={handleKeyDown}
            options={{
              minimap: { enabled: false },
              lineNumbers: 'on',
              glyphMargin: false,
              folding: false,
              renderLineHighlight: 'all',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
            }}
          />
        )}
      </div>

      {cell.outputs && cell.outputs.length > 0 && (
        <div className="border-t border-stone-200 px-4 pb-4 pt-1">
          <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-stone-500">Outputs</div>
          {cell.outputs.map((output, index) => (
            <div key={index} className="mt-2">
              {renderOutput(output, index)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}