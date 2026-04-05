import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createNotebook, getNotebook, updateNotebook } from '@/services/api';

const NotebookPage = () => {
  const [notebook, setNotebook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const { id } = router.query;

  // If no ID is provided, this is a new notebook
  const isNew = !id;

  useEffect(() => {
    if (isNew) {
      createNewNotebook();
    } else if (id) {
      loadNotebook();
    }
  }, [id, isNew]);

  const createNewNotebook = async () => {
    try {
      setLoading(true);
      const response = await createNotebook('Untitled Notebook');
      setNotebook(response.notebook);
      // Redirect to the new notebook
      router.push(`/notebooks/${response.notebook.id}`);
    } catch (err) {
      setError('Failed to create notebook');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadNotebook = async () => {
    try {
      setLoading(true);
      const data = await getNotebook(id);
      setNotebook(data);
    } catch (err) {
      setError('Failed to load notebook');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateNotebookTitle = async (newTitle) => {
    if (!notebook) return;

    try {
      await updateNotebook(notebook.id, { title: newTitle });
      setNotebook({ ...notebook, title: newTitle });
    } catch (err) {
      console.error('Failed to update notebook title:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className="text-center py-8">
        <p className="text-accent">Notebook not found</p>
      </div>
    );
  }

  return (
    <div className="notebook-editor bg-background min-h-screen">
      {/* Notebook Header */}
      <div className="bg-surface border-b border-surface-hover px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              value={notebook.title}
              onChange={(e) => updateNotebookTitle(e.target.value)}
              className="text-xl font-semibold text-primary bg-transparent border-none outline-none focus:ring-0"
            />
            <span className="text-sm text-accent">
              Last updated: {new Date(notebook.updated_at).toLocaleString()}
            </span>
          </div>
          <div className="flex space-x-2">
            <button
              className="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-blue-700"
            >
              Run All
            </button>
            <button
              className="px-3 py-1 bg-secondary text-accent rounded text-sm hover:bg-gray-200"
            >
              + Code
            </button>
            <button
              className="px-3 py-1 bg-secondary text-accent rounded text-sm hover:bg-gray-200"
            >
              + Text
            </button>
          </div>
        </div>
      </div>

      {/* Notebook Cells */}
      <div className="notebook-cells px-4 py-6">
        {notebook.cells && notebook.cells.length > 0 ? (
          notebook.cells.map((cell, index) => (
            <div key={cell.id} className="cell mb-4 p-4 border border-surface-hover rounded">
              <div className="cell-header flex items-center justify-between mb-2">
                <span className="text-sm text-accent">
                  {cell.type === 'code' ? 'Code' : 'Text'} Cell {index + 1}
                </span>
                <div className="flex space-x-1">
                  <button className="text-accent hover:text-primary text-sm">↑</button>
                  <button className="text-accent hover:text-primary text-sm">↓</button>
                  <button className="text-accent hover:text-red-500 text-sm">×</button>
                </div>
              </div>
              <div className="cell-content">
                <pre className="text-accent font-mono text-sm bg-surface p-2 rounded">
                  {cell.content || (cell.type === 'code' ? '# New code cell' : '# New markdown cell')}
                </pre>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-accent mb-4">This notebook has no cells yet.</p>
            <button className="px-4 py-2 bg-primary text-white rounded hover:bg-blue-700">
              Add Code Cell
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotebookPage;