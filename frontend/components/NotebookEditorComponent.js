import React from 'react';

const NotebookEditorComponent = React.memo(({ notebookId, isNew = false }) => {
  return (
    <div className="notebook-editor bg-background min-h-screen p-4">
      <h1 className="text-xl font-semibold text-primary mb-4">
        Notebook Editor
      </h1>
      <p className="text-accent">
        Notebook ID: {notebookId || 'New'}
      </p>
      <p className="text-accent">
        Is New: {isNew ? 'Yes' : 'No'}
      </p>
    </div>
  );
});

NotebookEditorComponent.displayName = 'NotebookEditorComponent';

export default NotebookEditorComponent;