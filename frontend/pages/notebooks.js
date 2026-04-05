import { useState, useEffect } from 'react';
import Link from 'next/link';
import { listNotebooks, createNotebook, deleteNotebook } from '../services/api';

export default function NotebooksPage() {
  const [notebooks, setNotebooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');

  useEffect(() => {
    loadNotebooks();
  }, []);

  const loadNotebooks = async () => {
    try {
      setLoading(true);
      console.log('Loading notebooks...');
      const data = await listNotebooks();
      console.log('Notebooks loaded:', data);
      setNotebooks(data);
    } catch (err) {
      console.error('Failed to load notebooks:', err);
      setError(`Failed to load notebooks: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNotebook = async (e) => {
    e.preventDefault();
    if (!newNotebookTitle.trim()) return;

    try {
      await createNotebook(newNotebookTitle);
      setNewNotebookTitle('');
      setShowCreateForm(false);
      loadNotebooks(); // Refresh the list
    } catch (err) {
      setError('Failed to create notebook');
      console.error(err);
    }
  };

  const handleDeleteNotebook = async (notebookId) => {
    if (!confirm('Are you sure you want to delete this notebook?')) return;

    try {
      await deleteNotebook(notebookId);
      loadNotebooks(); // Refresh the list
    } catch (err) {
      setError('Failed to delete notebook');
      console.error(err);
    }
  };

  return (
    <div className="bg-secondary min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-2">Notebooks</h1>
              <p className="text-accent">Interactive notebooks for data exploration, code execution, and Nexora integration.</p>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>New Notebook</span>
            </button>
          </div>
        </div>

        {/* Create Notebook Form */}
        {showCreateForm && (
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-primary mb-4">Create New Notebook</h2>
            <form onSubmit={handleCreateNotebook}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-accent mb-2">
                  Notebook Title
                </label>
                <input
                  type="text"
                  value={newNotebookTitle}
                  onChange={(e) => setNewNotebookTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter notebook title..."
                  required
                />
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
                >
                  Create Notebook
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-secondary text-accent rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Notebooks Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : notebooks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 text-accent">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-primary mb-2">No notebooks yet</h3>
            <p className="text-accent mb-4">Create your first notebook to start exploring data and running code.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700"
            >
              Create Notebook
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {notebooks.map((notebook) => (
              <div
                key={notebook.id}
                className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <Link href={`/notebooks/${notebook.id}`}>
                      <h3 className="text-lg font-semibold text-primary hover:text-blue-600 cursor-pointer mb-2">
                        {notebook.title}
                      </h3>
                    </Link>
                    <p className="text-sm text-accent">
                      Created: {new Date(notebook.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-accent">
                      Updated: {new Date(notebook.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteNotebook(notebook.id)}
                    className="p-1 text-accent hover:text-red-600 rounded"
                    title="Delete notebook"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="flex space-x-2">
                  <Link href={`/notebooks/${notebook.id}`}>
                    <button className="flex-1 px-3 py-2 bg-primary text-white rounded text-sm hover:bg-blue-700">
                      Open Notebook
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Features Section */}
        <div className="mt-12 bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold text-primary mb-4">Notebook Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-primary/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="font-medium text-primary mb-2">Code Execution</h3>
              <p className="text-sm text-accent">Run Python code interactively with real-time output display.</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-primary/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-medium text-primary mb-2">Data Visualization</h3>
              <p className="text-sm text-accent">Create charts, graphs, and visualizations directly in your notebooks.</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-primary/10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-medium text-primary mb-2">Nexora Integration</h3>
              <p className="text-sm text-accent">Seamlessly integrate with Nexora's conversion and pipeline capabilities.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}