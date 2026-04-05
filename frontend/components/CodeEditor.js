import React from 'react';

const CodeEditor = React.memo(({ value, onChange, label, readOnly = false }) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <textarea
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        readOnly={readOnly}
        rows={12}
        className={`w-full p-4 border border-gray-300 rounded-lg font-mono ${
          readOnly ? 'bg-gray-100' : 'bg-white'
        } focus:ring-2 focus:ring-primary focus:border-transparent`}
      />
    </div>
  );
});

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;
